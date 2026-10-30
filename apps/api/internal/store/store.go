// Package store is the Postgres data layer. It uses plain SQL through
// pgx, with no ORM, so every query is visible and can be EXPLAINed.
package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"capacityplanner/internal/planner"
)

var (
	// ErrNotFound means a referenced row (person, project) does not exist.
	ErrNotFound = errors.New("not found")
	// ErrInvalid means the database rejected the values (check or unique
	// constraint).
	ErrInvalid = errors.New("invalid data")
)

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// mapError turns Postgres constraint violations into the package errors,
// so the HTTP layer never has to know about SQLSTATE codes.
func mapError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503": // foreign_key_violation
			return ErrNotFound
		case "23505", "23514": // unique_violation, check_violation
			return ErrInvalid
		}
	}
	return err
}

func (s *Store) CreatePerson(ctx context.Context, name string, weeklyCapacity float64) (planner.Person, error) {
	p := planner.Person{Name: name, WeeklyCapacity: weeklyCapacity}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO people (name, weekly_capacity) VALUES ($1, $2) RETURNING id`,
		name, weeklyCapacity,
	).Scan(&p.ID)
	return p, mapError(err)
}

func (s *Store) CreateProject(ctx context.Context, name string) (planner.Project, error) {
	p := planner.Project{Name: name}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO projects (name) VALUES ($1) RETURNING id`, name,
	).Scan(&p.ID)
	return p, mapError(err)
}

func (s *Store) CreateAllocation(ctx context.Context, a planner.Allocation) (planner.Allocation, error) {
	err := s.pool.QueryRow(ctx,
		`INSERT INTO allocations (person_id, project_id, start_date, end_date, hours_per_week)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		a.PersonID, a.ProjectID, a.Start, a.End, a.HoursPerWeek,
	).Scan(&a.ID)
	return a, mapError(err)
}

func (s *Store) CreateTimeEntry(ctx context.Context, e planner.TimeEntry) (planner.TimeEntry, error) {
	err := s.pool.QueryRow(ctx,
		`INSERT INTO time_entries (person_id, project_id, entry_date, minutes)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		e.PersonID, e.ProjectID, e.Date, e.Minutes,
	).Scan(&e.ID)
	return e, mapError(err)
}

func (s *Store) ListPeople(ctx context.Context) ([]planner.Person, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, weekly_capacity::float8 FROM people ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (planner.Person, error) {
		var p planner.Person
		err := r.Scan(&p.ID, &p.Name, &p.WeeklyCapacity)
		return p, err
	})
}

// AllocationsOverlapping returns the allocations that cover at least one
// day of [from, to].
func (s *Store) AllocationsOverlapping(ctx context.Context, from, to time.Time) ([]planner.Allocation, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, person_id, project_id, start_date, end_date, hours_per_week::float8
		   FROM allocations
		  WHERE start_date <= $2 AND end_date >= $1`,
		from, to,
	)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (planner.Allocation, error) {
		var a planner.Allocation
		err := r.Scan(&a.ID, &a.PersonID, &a.ProjectID, &a.Start, &a.End, &a.HoursPerWeek)
		return a, err
	})
}

// TrackedHoursByWeek sums tracked time per person and ISO week. The
// aggregation runs in Postgres: only one row per person and week comes
// back, however many entries there are.
func (s *Store) TrackedHoursByWeek(ctx context.Context, from, to time.Time) (map[planner.TrackedKey]float64, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT person_id,
		        date_trunc('week', entry_date)::date AS week_start,
		        (sum(minutes) / 60.0)::float8 AS hours
		   FROM time_entries
		  WHERE entry_date BETWEEN $1 AND $2
		  GROUP BY person_id, week_start`,
		from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tracked := make(map[planner.TrackedKey]float64)
	for rows.Next() {
		var (
			k     planner.TrackedKey
			hours float64
		)
		if err := rows.Scan(&k.PersonID, &k.WeekStart, &hours); err != nil {
			return nil, err
		}
		k.WeekStart = k.WeekStart.UTC()
		tracked[k] = hours
	}
	return tracked, rows.Err()
}
