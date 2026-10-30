// Package httpapi exposes the planner over JSON/HTTP using only the
// standard library router (Go 1.22+ method and path patterns).
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"capacityplanner/internal/planner"
	"capacityplanner/internal/store"
)

// Store is what the handlers need from the data layer. *store.Store
// satisfies it implicitly; tests use an in-memory fake.
type Store interface {
	CreatePerson(ctx context.Context, name string, weeklyCapacity float64) (planner.Person, error)
	CreateProject(ctx context.Context, name string) (planner.Project, error)
	CreateAllocation(ctx context.Context, a planner.Allocation) (planner.Allocation, error)
	CreateTimeEntry(ctx context.Context, e planner.TimeEntry) (planner.TimeEntry, error)
	ListPeople(ctx context.Context) ([]planner.Person, error)
	AllocationsOverlapping(ctx context.Context, from, to time.Time) ([]planner.Allocation, error)
	TrackedHoursByWeek(ctx context.Context, from, to time.Time) (map[planner.TrackedKey]float64, error)
}

type Server struct {
	store Store
	log   *slog.Logger
}

func NewServer(s Store, log *slog.Logger) *Server {
	return &Server{store: s, log: log}
}

// Handler returns the routes wrapped in the logging and recovery
// middleware.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /people", s.listPeople)
	mux.HandleFunc("POST /people", s.createPerson)
	mux.HandleFunc("POST /projects", s.createProject)
	mux.HandleFunc("POST /allocations", s.createAllocation)
	mux.HandleFunc("POST /time-entries", s.createTimeEntry)
	mux.HandleFunc("GET /capacity", s.capacity)
	return s.recoverer(s.logRequests(mux))
}

type createPersonRequest struct {
	Name           string  `json:"name"`
	WeeklyCapacity float64 `json:"weeklyCapacity"`
}

func (s *Server) createPerson(w http.ResponseWriter, r *http.Request) {
	var req createPersonRequest
	if !s.decode(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.WeeklyCapacity < 0 || req.WeeklyCapacity > 168 {
		writeError(w, http.StatusUnprocessableEntity, "name is required and weeklyCapacity must be between 0 and 168")
		return
	}
	p, err := s.store.CreatePerson(r.Context(), req.Name, req.WeeklyCapacity)
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) listPeople(w http.ResponseWriter, r *http.Request) {
	people, err := s.store.ListPeople(r.Context())
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, people)
}

type createProjectRequest struct {
	Name string `json:"name"`
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	var req createProjectRequest
	if !s.decode(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusUnprocessableEntity, "name is required")
		return
	}
	p, err := s.store.CreateProject(r.Context(), req.Name)
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

type createAllocationRequest struct {
	PersonID     int64   `json:"personId"`
	ProjectID    int64   `json:"projectId"`
	Start        string  `json:"start"`
	End          string  `json:"end"`
	HoursPerWeek float64 `json:"hoursPerWeek"`
}

func (s *Server) createAllocation(w http.ResponseWriter, r *http.Request) {
	var req createAllocationRequest
	if !s.decode(w, r, &req) {
		return
	}
	start, end, err := planner.ParseDates(req.Start, req.End)
	if err != nil || req.HoursPerWeek <= 0 || req.HoursPerWeek > 168 {
		writeError(w, http.StatusUnprocessableEntity, "start and end must be YYYY-MM-DD with end >= start, hoursPerWeek between 0 and 168")
		return
	}
	a, err := s.store.CreateAllocation(r.Context(), planner.Allocation{
		PersonID: req.PersonID, ProjectID: req.ProjectID,
		Start: start, End: end, HoursPerWeek: req.HoursPerWeek,
	})
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

type createTimeEntryRequest struct {
	PersonID  int64  `json:"personId"`
	ProjectID int64  `json:"projectId"`
	Date      string `json:"date"`
	Minutes   int    `json:"minutes"`
}

func (s *Server) createTimeEntry(w http.ResponseWriter, r *http.Request) {
	var req createTimeEntryRequest
	if !s.decode(w, r, &req) {
		return
	}
	d, err := time.Parse(planner.DateLayout, req.Date)
	if err != nil || req.Minutes <= 0 || req.Minutes > 24*60 {
		writeError(w, http.StatusUnprocessableEntity, "date must be YYYY-MM-DD and minutes between 1 and 1440")
		return
	}
	e, err := s.store.CreateTimeEntry(r.Context(), planner.TimeEntry{
		PersonID: req.PersonID, ProjectID: req.ProjectID, Date: d, Minutes: req.Minutes,
	})
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, e)
}

// capacity serves GET /capacity?from=YYYY-MM-DD&to=YYYY-MM-DD. The range
// is widened to whole ISO weeks so that every row covers a full week.
func (s *Server) capacity(w http.ResponseWriter, r *http.Request) {
	from, to, err := planner.ParseRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	switch {
	case errors.Is(err, planner.ErrRangeTooLong):
		writeError(w, http.StatusUnprocessableEntity, "range is limited to 26 weeks")
		return
	case err != nil:
		writeError(w, http.StatusBadRequest, "from and to must be YYYY-MM-DD with to >= from")
		return
	}
	from = planner.WeekStart(from)
	to = planner.WeekStart(to).AddDate(0, 0, 6)

	ctx := r.Context()
	people, err := s.store.ListPeople(ctx)
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	allocations, err := s.store.AllocationsOverlapping(ctx, from, to)
	if err != nil {
		s.storeError(w, r, err)
		return
	}
	tracked, err := s.store.TrackedHoursByWeek(ctx, from, to)
	if err != nil {
		s.storeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"from": from.Format(planner.DateLayout),
		"to":   to.Format(planner.DateLayout),
		"rows": planner.BuildReport(people, allocations, tracked, from, to),
	})
}

// decode reads a JSON body of at most 1 MB and rejects unknown fields.
func (s *Server) decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func (s *Server) storeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusUnprocessableEntity, "referenced person or project does not exist")
	case errors.Is(err, store.ErrInvalid):
		writeError(w, http.StatusConflict, "the data conflicts with an existing record or a constraint")
	default:
		s.log.ErrorContext(r.Context(), "store error", "err", err, "path", r.URL.Path)
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
