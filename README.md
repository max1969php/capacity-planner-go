# capacity-planner-go

A lightweight capacity planning API built to learn Go properly, with a React + Cloudscape frontend, in an Nx monorepo.

per person, per week, how much work is planned versus how much time was actually tracked?

## endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /people` | `{ "name", "weeklyCapacity" }` |
| `GET /people` | List people |
| `GET /projects` | List projects |
| `POST /projects` | `{ "name" }` |
| `POST /allocations` | `{ "personId", "projectId", "start", "end", "hoursPerWeek" }` (dates inclusive) |
| `POST /time-entries` | `{ "personId", "projectId", "date", "minutes" }` |
| `GET /capacity?from=YYYY-MM-DD&to=YYYY-MM-DD` | Weekly breakdown per person: capacity, planned, tracked, utilization, status (`under` < 80%, `ok`, `over` > 100%) |
| `GET /healthz` | Liveness check |

Mid-week allocations get pro-rated on working days (e.g., a 20h/week allocation starting on a Wednesday counts as 12h for that week). The report range automatically expands to whole weeks and caps out at 26 weeks.

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
apps/api          Go module (go.mod), Nx targets in project.json
apps/web          Vite + React + TypeScript, AWS Cloudscape, TanStack Query
docker-compose.yml  Postgres 17 for local development
```

Inside `apps/api`:

```
cmd/api           main entrypoint: config, pgx pool, migrations, http.Server, graceful shutdown
internal/planner  domain logic and calculations (weeks, pro-rating, utilization): zero I/O
internal/store    Postgres interaction via pgx, raw SQL, embedded migrations
internal/httpapi  net/http handlers, request validation, error mapping, middleware

```

1) All business logic lives in `planner` and is covered by fast, database-free table tests.
2) Tracked time rolls up via Postgres (`GROUP BY person_id, date_trunc('week', entry_date)`). Go handles the pro-rating math where it's easy to unit test.
3) `allocations (person_id, start_date, end_date)` for range overlaps, and `time_entries (entry_date, person_id) INCLUDE (minutes)` for index-only weekly sums.
4) DB enforces validity via `CHECK` and foreign keys. The store layer translates SQL states into `ErrNotFound` / `ErrInvalid`, which the HTTP layer turns into proper status codes so handlers stay clean.
5) Routing uses Go's built-in `net/http` pattern matching (Go 1.22+), logging uses `slog`, and shutdown uses `signal.NotifyContext`. The only external dependency is `pgx`.
6) `httpapi.Store` is declared right where it's used. `*store.Store` implements it implicitly, and tests use a simple in-memory mock.

## Running it

You'll need Go 1.27+, Node 22 with pnpm, and Docker with the Compose plugin.

```sh
pnpm install
pnpm db:up                    # Spins up Postgres 17 on localhost:5433
pnpm dev                      # API on :8080 and web on :5173, together
pnpm db:seed                  # Seeds fake data (run in another terminal)
pnpm nx serve api             # Only the API
pnpm nx serve web             # Only the web app (proxies /api to :8080)
pnpm test                     # Go unit tests (no DB required)
pnpm lint                     # go vet + gofmt, oxlint
pnpm build                    # Go binary in apps/api/bin, web bundle in apps/web/dist
pnpm nx test-integration api  # Store integration tests against Docker (truncates the tables)
```

CI runs two jobs: `gofmt`, `go vet` and the Go test suites against a live Postgres service, then lint and build for the web app.

## Moving from TS to Go: Observations

A few things that clicked (or tripped me up) while building this:

- No `try/catch`. Every fallible function returns an `error`. Wrapping with `fmt.Errorf("...: %w", err)` and checking with `errors.Is` replaces exception hierarchies.
- You don't declare that a struct implements an interface; it just does. And you define them at the consumer, not next to the struct implementation.
- A `nil` map can be read from but will panic on write. A `nil` slice encodes to JSON `null` rather than `[]`.
- `context.Context` goes down to every query for cancellation and deadlines instead of hiding in async-local storage.
-  Goroutines and channels in `main` handle server lifecycles cleanly without event-loop abstractions.
- `gofmt`, `go vet`, `-race`, and `-cover` work out of the box with zero configuration files.