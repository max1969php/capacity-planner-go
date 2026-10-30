package planner

import (
	"errors"
	"testing"
	"time"
)

func date(s string) time.Time {
	t, err := time.Parse(DateLayout, s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestWeekStart(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"2026-11-02", "2026-11-02"}, // Monday
		{"2026-11-04", "2026-11-02"}, // Wednesday
		{"2026-11-08", "2026-11-02"}, // Sunday belongs to the previous Monday
		{"2027-01-01", "2026-12-28"}, // across the year boundary
	}
	for _, tt := range tests {
		if got := WeekStart(date(tt.in)).Format(DateLayout); got != tt.want {
			t.Errorf("WeekStart(%s) = %s, want %s", tt.in, got, tt.want)
		}
	}
}

func TestPlannedHours(t *testing.T) {
	week := date("2026-11-02")
	tests := []struct {
		name       string
		start, end string
		want       float64
	}{
		{"whole week", "2026-10-01", "2026-12-31", 20},
		{"starts on Wednesday", "2026-11-04", "2026-12-31", 12},
		{"ends on Tuesday", "2026-10-01", "2026-11-03", 8},
		{"single day", "2026-11-05", "2026-11-05", 4},
		{"weekend only", "2026-11-07", "2026-11-08", 0},
		{"before the week", "2026-10-01", "2026-10-30", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := Allocation{Start: date(tt.start), End: date(tt.end), HoursPerWeek: 20}
			if got := PlannedHours(a, week); got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestClassify(t *testing.T) {
	tests := []struct {
		planned, capacity float64
		want              Status
	}{
		{0, 40, StatusUnder},
		{31, 40, StatusUnder},
		{32, 40, StatusOK},
		{40, 40, StatusOK},
		{41, 40, StatusOver},
		{0, 0, StatusUnder},
		{5, 0, StatusOver},
	}
	for _, tt := range tests {
		if _, got := Classify(tt.planned, tt.capacity); got != tt.want {
			t.Errorf("Classify(%v, %v) = %s, want %s", tt.planned, tt.capacity, got, tt.want)
		}
	}
}

func TestParseRange(t *testing.T) {
	tests := []struct {
		from, to string
		wantErr  error
	}{
		{"2026-11-02", "2026-11-29", nil},
		{"2026-11-29", "2026-11-02", ErrInvalidRange},
		{"02/11/2026", "2026-11-29", ErrInvalidRange},
		{"2026-01-01", "2026-12-31", ErrRangeTooLong},
	}
	for _, tt := range tests {
		_, _, err := ParseRange(tt.from, tt.to)
		if !errors.Is(err, tt.wantErr) {
			t.Errorf("ParseRange(%s, %s) error = %v, want %v", tt.from, tt.to, err, tt.wantErr)
		}
	}
}

func TestBuildReport(t *testing.T) {
	people := []Person{
		{ID: 1, Name: "Ada", WeeklyCapacity: 40},
		{ID: 2, Name: "Linus", WeeklyCapacity: 20},
	}
	allocations := []Allocation{
		{PersonID: 1, Start: date("2026-11-02"), End: date("2026-11-13"), HoursPerWeek: 24},
		{PersonID: 1, Start: date("2026-11-09"), End: date("2026-11-13"), HoursPerWeek: 24},
		{PersonID: 2, Start: date("2026-11-02"), End: date("2026-11-13"), HoursPerWeek: 16},
	}
	tracked := map[TrackedKey]float64{
		{PersonID: 1, WeekStart: date("2026-11-02")}: 22.5,
	}

	rows := BuildReport(people, allocations, tracked, date("2026-11-04"), date("2026-11-12"))

	want := []struct {
		week    string
		person  int64
		planned float64
		tracked float64
		status  Status
	}{
		{"2026-11-02", 1, 24, 22.5, StatusUnder},
		{"2026-11-02", 2, 16, 0, StatusOK},
		{"2026-11-09", 1, 48, 0, StatusOver},
		{"2026-11-09", 2, 16, 0, StatusOK},
	}
	if len(rows) != len(want) {
		t.Fatalf("got %d rows, want %d", len(rows), len(want))
	}
	for i, w := range want {
		r := rows[i]
		if r.WeekStart != w.week || r.PersonID != w.person || r.Planned != w.planned || r.Tracked != w.tracked || r.Status != w.status {
			t.Errorf("row %d = %+v, want %+v", i, r, w)
		}
	}
}
