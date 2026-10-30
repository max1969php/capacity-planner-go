CREATE TABLE people (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
    weekly_capacity NUMERIC(5,2) NOT NULL CHECK (weekly_capacity >= 0 AND weekly_capacity <= 168),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE allocations (
    id             BIGSERIAL PRIMARY KEY,
    person_id      BIGINT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    project_id     BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    hours_per_week NUMERIC(5,2) NOT NULL CHECK (hours_per_week > 0 AND hours_per_week <= 168),
    CHECK (end_date >= start_date)
);

-- The report asks "which allocations overlap [from, to]": filter on the
-- start date, then on the end date, for each person.
CREATE INDEX allocations_person_dates_idx ON allocations (person_id, start_date, end_date);
CREATE INDEX allocations_dates_idx ON allocations (start_date, end_date);

CREATE TABLE time_entries (
    id         BIGSERIAL PRIMARY KEY,
    person_id  BIGINT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    minutes    INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440)
);

-- Tracked hours are summed per person and week over a date range.
CREATE INDEX time_entries_date_person_idx ON time_entries (entry_date, person_id) INCLUDE (minutes);
