# capacity-planner-go

A small capacity-planning API in Go and Postgres. It answers one question:
**for each person and week, how much work is planned against their capacity,
and how much time was actually tracked?**

I write TypeScript (React, NestJS) in production every day. I built this
project to learn Go properly. It does not port a Node app line by line: it
follows the idioms of the standard library, writes SQL by hand, and tests
the parts that can break.

## What it does

| Endpoint | Purpose |
| --- | --- |
| `POST /people` | `{ "name", "weeklyCapacity" }`: a person and their hours per week |
| `GET /people` | list people |
| `POST /projects` | `{ "name" }` |
| `POST /allocations` | `{ "personId", "projectId", "start", "end", "hoursPerWeek" }`: planned work, dates inclusive |
| `POST /time-entries` | `{ "personId", "projectId", "date", "minutes" }`: tracked work |
| `GET /capacity?from=YYYY-MM-DD&to=YYYY-MM-DD` | one row per person per ISO week: capacity, planned, tracked, utilisation, status (`under` below 80%, `ok`, `over` above 100%) |
| `GET /healthz` | liveness |

Allocations that start or end mid-week are **pro-rated on working days**: a
20 h/week allocation that starts on a Wednesday plans 12 h in that week.
The report range is widened to whole weeks and limited to 26 weeks.

```console
$ curl -s 'localhost:8080/capacity?from=2026-11-16&to=2026-11-22' | jq '.rows[0]'
{
  "personId": 1,
  "personName": "Ada Example",
  "weekStart": "2026-11-16",
  "capacity": 40,
  "planned": 48,
  "tracked": 0,
  "utilisation": 1.2,
  "status": "over"
}
```

## Design

```
cmd/api            main: config, pgx pool, migrations, http.Server, graceful shutdown
internal/planner   domain types and pure logic (weeks, pro-rating, utilisation): no I/O
internal/store     Postgres via pgx, plain SQL, embedded migrations
internal/httpapi   net/http handlers, validation, error mapping, middleware
```

- **Pure core, thin edges.** All the capacity logic is in `planner` and is
  covered by table-driven tests that need no database.
- **SQL where it belongs.** Tracked time is aggregated in Postgres
  (`GROUP BY person_id, date_trunc('week', entry_date)`), so the API reads
  one row per person and week, not every entry. Pro-rating stays in Go,
  where it is easy to read and test.
- **Indexes match the queries.** `allocations (person_id, start_date, end_date)`
  for the overlap filter, and `time_entries (entry_date, person_id) INCLUDE (minutes)`
  so the weekly sum can be an index-only scan.
- **Constraints in the database, errors in the API.** `CHECK`, `UNIQUE` and
  foreign keys reject bad data. The store maps SQLSTATE codes to
  `ErrNotFound` and `ErrInvalid`, and the HTTP layer maps those to
  422 and 409, so handlers never see driver details.
- **Standard library first.** Routing uses Go 1.22+ patterns
  (`mux.HandleFunc("GET /capacity", …)`), logging uses `log/slog`, and
  shutdown uses `signal.NotifyContext`. The only dependency is `pgx`.
- **Interfaces at the consumer.** `httpapi.Store` is declared where it is
  used. `*store.Store` satisfies it implicitly, and tests use an in-memory
  fake.

## Running it

Requires Go 1.27+ and Docker.

```sh
make db-up                # Postgres 17 on localhost:5433
make run                  # applies migrations, listens on :8080
make seed                 # demo data with fictional names (in another terminal)
make test                 # unit tests, no database
make test-integration     # store tests against the Docker database (truncates it)
```

CI (`.github/workflows/ci.yml`) runs `gofmt`, `go vet`, the unit tests and
the integration tests with the race detector against a Postgres service.

## TypeScript → Go: notes

Things that changed how I write code, collected while building this:

- **Errors are values.** No `try/catch`: every call that can fail returns an
  `error`, and wrapping (`fmt.Errorf("…: %w", err)`) plus `errors.Is` /
  `errors.As` replace exception classes.
- **Interfaces are satisfied implicitly.** Declare small interfaces where
  they are consumed, not next to the implementation.
- **Zero values are part of the design.** A `nil` map can be read but not
  written, and a `nil` slice encodes as JSON `null`, not `[]`.
- **`context.Context` is passed explicitly** for cancellation and deadlines,
  down to every query, instead of living in async-local storage.
- **Concurrency is explicit.** Goroutines and channels in `main` for the
  server and shutdown, instead of an event loop.
- **Tooling is built in.** `gofmt`, `go vet`, `go test -race` and
  `go test -cover` with no configuration files.

## Learning log

| Date | What I studied or built |
| --- | --- |
| 2026-10-28 | Project setup: planner core with tests, pgx store, net/http API, CI |
| | |

## Next steps

Planned exercises, each one a new concept:

- [ ] Run the two report queries concurrently with `errgroup` and measure
      the difference.
- [ ] Generate the store from SQL with `sqlc` and compare it with the
      hand-written version.
- [ ] Load test `/capacity` with 1,000 people and 100k time entries, and
      read the `EXPLAIN ANALYZE` output.
- [ ] Add an exclusion constraint on `daterange(start_date, end_date, '[]')`
      to prevent duplicate allocations of a person on the same project.
- [ ] OpenAPI description and a small React client that uses TanStack Query.
