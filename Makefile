DATABASE_URL ?= postgres://planner:planner@localhost:5433/planner?sslmode=disable
export DATABASE_URL

.PHONY: run test test-integration vet db-up db-down seed

run:
	go run ./cmd/api

test:
	go test ./...

test-integration:
	go test -tags integration ./...

vet:
	go vet ./...
	gofmt -l . | (! grep .)

db-up:
	docker compose up -d --wait db

db-down:
	docker compose down

seed:
	docker compose exec -T db psql -U planner -d planner < scripts/seed.sql
