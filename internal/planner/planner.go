// Package planner holds the domain model and the pure capacity logic.
// It has no dependency on HTTP or on the database, so it can be tested
// with plain table-driven tests.
package planner

import (
	"errors"
	"math"
	"time"
)

// DateLayout is the only date format accepted by the API.
const DateLayout = "2006-01-02"

// MaxReportWeeks caps the size of a capacity report.
const MaxReportWeeks = 26

var (
	ErrInvalidRange = errors.New("invalid date range")
	ErrRangeTooLong = errors.New("date range too long")
)

type Person struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	WeeklyCapacity float64 `json:"weeklyCapacity"`
}

type Project struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// Allocation plans HoursPerWeek of a person on a project between Start
// and End, both inclusive.
type Allocation struct {
	ID           int64     `json:"id"`
	PersonID     int64     `json:"personId"`
	ProjectID    int64     `json:"projectId"`
	Start        time.Time `json:"start"`
	End          time.Time `json:"end"`
	HoursPerWeek float64   `json:"hoursPerWeek"`
}

type TimeEntry struct {
	ID        int64     `json:"id"`
	PersonID  int64     `json:"personId"`
	ProjectID int64     `json:"projectId"`
	Date      time.Time `json:"date"`
	Minutes   int       `json:"minutes"`
}

type Status string

const (
	StatusUnder Status = "under"
	StatusOK    Status = "ok"
	StatusOver  Status = "over"
)

// Utilisation thresholds: below 80% a person has room, above 100% they
// are overbooked.
const (
	underThreshold = 0.8
	overThreshold  = 1.0
)

// WeekLoad is one row of the capacity report: a person in a week.
type WeekLoad struct {
	PersonID    int64   `json:"personId"`
	PersonName  string  `json:"personName"`
	WeekStart   string  `json:"weekStart"`
	Capacity    float64 `json:"capacity"`
	Planned     float64 `json:"planned"`
	Tracked     float64 `json:"tracked"`
	Utilisation float64 `json:"utilisation"`
	Status      Status  `json:"status"`
}

// TrackedKey identifies the tracked hours of a person in a week.
type TrackedKey struct {
	PersonID  int64
	WeekStart time.Time
}

// WeekStart returns the Monday of the ISO week that contains t, at
// midnight UTC.
func WeekStart(t time.Time) time.Time {
	d := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	offset := (int(d.Weekday()) + 6) % 7 // Monday = 0
	return d.AddDate(0, 0, -offset)
}

// ParseDates parses two API dates and checks that to is not before from.
func ParseDates(from, to string) (time.Time, time.Time, error) {
	f, err := time.Parse(DateLayout, from)
	if err != nil {
		return time.Time{}, time.Time{}, ErrInvalidRange
	}
	t, err := time.Parse(DateLayout, to)
	if err != nil || t.Before(f) {
		return time.Time{}, time.Time{}, ErrInvalidRange
	}
	return f, t, nil
}

// ParseRange validates a report range: valid dates, at most
// MaxReportWeeks weeks.
func ParseRange(from, to string) (time.Time, time.Time, error) {
	f, t, err := ParseDates(from, to)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	weeks := int(WeekStart(t).Sub(WeekStart(f)).Hours()/(24*7)) + 1
	if weeks > MaxReportWeeks {
		return time.Time{}, time.Time{}, ErrRangeTooLong
	}
	return f, t, nil
}

// workingDaysOverlap counts the Monday-to-Friday days that the
// allocation covers in the week starting at weekStart.
func workingDaysOverlap(a Allocation, weekStart time.Time) int {
	from := maxTime(a.Start, weekStart)
	to := minTime(a.End, weekStart.AddDate(0, 0, 4)) // Friday
	if to.Before(from) {
		return 0
	}
	return int(to.Sub(from).Hours()/24) + 1
}

// PlannedHours returns the hours an allocation plans in a given week,
// pro-rated when the allocation starts or ends mid-week.
func PlannedHours(a Allocation, weekStart time.Time) float64 {
	days := workingDaysOverlap(a, weekStart)
	return a.HoursPerWeek * float64(days) / 5
}

// Classify returns the utilisation ratio and its status.
func Classify(planned, capacity float64) (float64, Status) {
	if capacity <= 0 {
		if planned > 0 {
			return 0, StatusOver
		}
		return 0, StatusUnder
	}
	u := planned / capacity
	switch {
	case u < underThreshold:
		return u, StatusUnder
	case u > overThreshold+1e-9:
		return u, StatusOver
	default:
		return u, StatusOK
	}
}

// BuildReport combines people, allocations and tracked hours into one
// row per person per week, ordered by week and then by person as given.
func BuildReport(people []Person, allocations []Allocation, tracked map[TrackedKey]float64, from, to time.Time) []WeekLoad {
	byPerson := make(map[int64][]Allocation)
	for _, a := range allocations {
		byPerson[a.PersonID] = append(byPerson[a.PersonID], a)
	}

	rows := []WeekLoad{} // never nil: encodes as [] rather than null
	for week := WeekStart(from); !week.After(to); week = week.AddDate(0, 0, 7) {
		for _, p := range people {
			var planned float64
			for _, a := range byPerson[p.ID] {
				planned += PlannedHours(a, week)
			}
			u, status := Classify(planned, p.WeeklyCapacity)
			rows = append(rows, WeekLoad{
				PersonID:    p.ID,
				PersonName:  p.Name,
				WeekStart:   week.Format(DateLayout),
				Capacity:    p.WeeklyCapacity,
				Planned:     round2(planned),
				Tracked:     round2(tracked[TrackedKey{PersonID: p.ID, WeekStart: week}]),
				Utilisation: round2(u),
				Status:      status,
			})
		}
	}
	return rows
}

func round2(x float64) float64 { return math.Round(x*100) / 100 }

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}
