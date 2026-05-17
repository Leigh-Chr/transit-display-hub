# Transit Display Hub — developer Makefile
# Run `make help` to see available targets.

.PHONY: help dev backend frontend postgres test lint check clean stop logs

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: postgres ## Start full local dev stack (postgres + backend + frontend)
	@echo "Starting backend + frontend in background…"
	@cd backend && JWT_SECRET=$${JWT_SECRET:-$$(openssl rand -base64 48)} ./gradlew bootRun &
	@cd frontend && npm start

postgres: ## Start the Postgres docker container
	@docker compose up -d postgres
	@echo "Postgres ready on localhost:5432"

backend: ## Run backend only (port 8080)
	@cd backend && JWT_SECRET=$${JWT_SECRET:-$$(openssl rand -base64 48)} ./gradlew bootRun

frontend: ## Run frontend only (port 4200)
	@cd frontend && npm start

test: ## Run all tests (frontend + backend)
	@cd frontend && npm test
	@cd backend && ./gradlew test

lint: ## Run linters (ESLint + knip + jscpd)
	@cd frontend && npx eslint src --max-warnings 0
	@cd frontend && npx knip
	@npx jscpd

check: ## Full quality check (test + jacoco + spotbugs + pmd + ArchUnit)
	@cd backend && ./gradlew check
	@cd frontend && npm test
	@cd frontend && npx eslint src --max-warnings 0
	@cd frontend && npx knip

clean: ## Clean build artifacts
	@cd backend && ./gradlew clean
	@cd frontend && rm -rf dist node_modules/.cache .angular

stop: ## Stop the dev stack
	@docker compose stop

logs: ## Tail postgres logs
	@docker compose logs -f postgres
