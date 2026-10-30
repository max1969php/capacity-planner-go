-- Demo data with fictional names. Run after the API has started once
-- (it applies the migrations): make seed
TRUNCATE people, projects, allocations, time_entries RESTART IDENTITY CASCADE;

INSERT INTO people (name, weekly_capacity) VALUES
    ('Ada Example', 40),
    ('Grace Sample', 32),
    ('Linus Demo', 20);

INSERT INTO projects (name) VALUES ('Website redesign'), ('Mobile app'), ('Internal tools');

INSERT INTO allocations (person_id, project_id, start_date, end_date, hours_per_week) VALUES
    (1, 1, '2026-11-02', '2026-12-18', 24),
    (1, 2, '2026-11-16', '2026-11-27', 24),
    (2, 2, '2026-11-04', '2026-12-31', 20),
    (3, 3, '2026-11-02', '2026-11-13', 10);

-- Tracked time: one entry per working day for the first two weeks.
INSERT INTO time_entries (person_id, project_id, entry_date, minutes)
SELECT a.person_id, a.project_id, day::date, (a.hours_per_week / 5 * 60)::int
  FROM allocations a
 CROSS JOIN generate_series(date '2026-11-02', date '2026-11-13', interval '1 day') AS day
 WHERE extract(isodow FROM day) < 6
   AND day::date BETWEEN a.start_date AND a.end_date;
