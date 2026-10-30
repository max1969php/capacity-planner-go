//go:build integration

package store

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"capacityplanner/internal/planner"
)

// Run with: DATABASE_URL=... go test -tags integration ./internal/store
// The test truncates every table: point it at a throwaway database.
func setup(t *testing.T) (*Store, context.Context) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `TRUNCATE people, projects, allocations, time_entries RESTART IDENTITY CASCADE`); err != nil {
		t.Fatal(err)
	}
	return New(pool), ctx
}

func d(s string) time.Time {
	t, _ := time.Parse(planner.DateLayout, s)
	return t
}

func TestStoreRoundTrip(t *testing.T) {
	s, ctx := setup(t)

	ada, err := s.CreatePerson(ctx, "Ada", 40)
	if err != nil {
		t.Fatal(err)
	}
	proj, err := s.CreateProject(ctx, "Website")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateProject(ctx, "Website"); !errors.Is(err, ErrInvalid) {
		t.Errorf("duplicate project error = %v, want ErrInvalid", err)
	}
	if projects, err := s.ListProjects(ctx); err != nil || len(projects) != 1 {
		t.Errorf("projects = %v, %v, want one", projects, err)
	}

	alloc := planner.Allocation{PersonID: ada.ID, ProjectID: proj.ID, Start: d("2026-11-02"), End: d("2026-11-20"), HoursPerWeek: 30}
	if _, err := s.CreateAllocation(ctx, alloc); err != nil {
		t.Fatal(err)
	}
	alloc.PersonID = 999
	if _, err := s.CreateAllocation(ctx, alloc); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown person error = %v, want ErrNotFound", err)
	}

	for _, e := range []planner.TimeEntry{
		{PersonID: ada.ID, ProjectID: proj.ID, Date: d("2026-11-02"), Minutes: 240},
		{PersonID: ada.ID, ProjectID: proj.ID, Date: d("2026-11-03"), Minutes: 210},
		{PersonID: ada.ID, ProjectID: proj.ID, Date: d("2026-11-10"), Minutes: 60},
	} {
		if _, err := s.CreateTimeEntry(ctx, e); err != nil {
			t.Fatal(err)
		}
	}

	allocs, err := s.AllocationsOverlapping(ctx, d("2026-11-16"), d("2026-11-22"))
	if err != nil || len(allocs) != 1 {
		t.Fatalf("overlapping = %v, %v", allocs, err)
	}
	if none, _ := s.AllocationsOverlapping(ctx, d("2026-11-23"), d("2026-11-29")); len(none) != 0 {
		t.Errorf("allocation after end date returned: %v", none)
	}

	tracked, err := s.TrackedHoursByWeek(ctx, d("2026-11-02"), d("2026-11-15"))
	if err != nil {
		t.Fatal(err)
	}
	if got := tracked[planner.TrackedKey{PersonID: ada.ID, WeekStart: d("2026-11-02")}]; got != 7.5 {
		t.Errorf("week 1 tracked = %v, want 7.5", got)
	}
	if got := tracked[planner.TrackedKey{PersonID: ada.ID, WeekStart: d("2026-11-09")}]; got != 1 {
		t.Errorf("week 2 tracked = %v, want 1", got)
	}
}
