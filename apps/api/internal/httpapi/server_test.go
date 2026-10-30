package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"capacityplanner/internal/planner"
	"capacityplanner/internal/store"
)

// fakeStore keeps everything in memory. It returns store.ErrNotFound for
// unknown people, like the foreign keys in Postgres do.
type fakeStore struct {
	people      []planner.Person
	allocations []planner.Allocation
	tracked     map[planner.TrackedKey]float64
}

func (f *fakeStore) CreatePerson(_ context.Context, name string, c float64) (planner.Person, error) {
	p := planner.Person{ID: int64(len(f.people) + 1), Name: name, WeeklyCapacity: c}
	f.people = append(f.people, p)
	return p, nil
}

func (f *fakeStore) CreateProject(_ context.Context, name string) (planner.Project, error) {
	return planner.Project{ID: 1, Name: name}, nil
}

func (f *fakeStore) CreateAllocation(_ context.Context, a planner.Allocation) (planner.Allocation, error) {
	if !f.hasPerson(a.PersonID) {
		return planner.Allocation{}, store.ErrNotFound
	}
	a.ID = int64(len(f.allocations) + 1)
	f.allocations = append(f.allocations, a)
	return a, nil
}

func (f *fakeStore) CreateTimeEntry(_ context.Context, e planner.TimeEntry) (planner.TimeEntry, error) {
	if !f.hasPerson(e.PersonID) {
		return planner.TimeEntry{}, store.ErrNotFound
	}
	e.ID = 1
	return e, nil
}

func (f *fakeStore) ListPeople(context.Context) ([]planner.Person, error) { return f.people, nil }

func (f *fakeStore) AllocationsOverlapping(context.Context, time.Time, time.Time) ([]planner.Allocation, error) {
	return f.allocations, nil
}

func (f *fakeStore) TrackedHoursByWeek(context.Context, time.Time, time.Time) (map[planner.TrackedKey]float64, error) {
	return f.tracked, nil
}

func (f *fakeStore) hasPerson(id int64) bool {
	for _, p := range f.people {
		if p.ID == id {
			return true
		}
	}
	return false
}

func newTestServer(fs *fakeStore) http.Handler {
	return NewServer(fs, slog.New(slog.NewTextHandler(io.Discard, nil))).Handler()
}

func do(t *testing.T, h http.Handler, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestCreatePersonValidation(t *testing.T) {
	h := newTestServer(&fakeStore{})
	tests := []struct {
		name, body string
		want       int
	}{
		{"valid", `{"name":"Ada","weeklyCapacity":40}`, http.StatusCreated},
		{"blank name", `{"name":"  ","weeklyCapacity":40}`, http.StatusUnprocessableEntity},
		{"capacity too high", `{"name":"Ada","weeklyCapacity":200}`, http.StatusUnprocessableEntity},
		{"unknown field", `{"name":"Ada","weeklyCapacity":40,"role":"x"}`, http.StatusBadRequest},
		{"not JSON", `name=Ada`, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := do(t, h, http.MethodPost, "/people", tt.body); rec.Code != tt.want {
				t.Errorf("status = %d, want %d (%s)", rec.Code, tt.want, rec.Body)
			}
		})
	}
}

func TestCreateAllocationUnknownPerson(t *testing.T) {
	h := newTestServer(&fakeStore{})
	body := `{"personId":99,"projectId":1,"start":"2026-11-02","end":"2026-11-30","hoursPerWeek":10}`
	if rec := do(t, h, http.MethodPost, "/allocations", body); rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", rec.Code)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	h := newTestServer(&fakeStore{})
	if rec := do(t, h, http.MethodDelete, "/people", ""); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405", rec.Code)
	}
}

func TestCapacity(t *testing.T) {
	fs := &fakeStore{
		people: []planner.Person{{ID: 1, Name: "Ada", WeeklyCapacity: 40}},
		allocations: []planner.Allocation{{
			PersonID: 1, HoursPerWeek: 50,
			Start: time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC),
			End:   time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC),
		}},
	}
	h := newTestServer(fs)

	rec := do(t, h, http.MethodGet, "/capacity?from=2026-11-04&to=2026-11-10", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got struct {
		From string             `json:"from"`
		To   string             `json:"to"`
		Rows []planner.WeekLoad `json:"rows"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.From != "2026-11-02" || got.To != "2026-11-15" {
		t.Errorf("range = %s..%s, want widened to whole weeks", got.From, got.To)
	}
	if len(got.Rows) != 2 || got.Rows[0].Status != planner.StatusOver || got.Rows[1].Planned != 0 {
		t.Errorf("rows = %+v", got.Rows)
	}
}

func TestCapacityBadRange(t *testing.T) {
	h := newTestServer(&fakeStore{})
	tests := []struct {
		query string
		want  int
	}{
		{"", http.StatusBadRequest},
		{"?from=2026-11-10&to=2026-11-01", http.StatusBadRequest},
		{"?from=2026-01-01&to=2026-12-31", http.StatusUnprocessableEntity},
	}
	for _, tt := range tests {
		if rec := do(t, h, http.MethodGet, "/capacity"+tt.query, ""); rec.Code != tt.want {
			t.Errorf("GET /capacity%s = %d, want %d", tt.query, rec.Code, tt.want)
		}
	}
}
