.PHONY: help up down restart logs build ps url clean dev install lint typecheck build-app test test-run format ci ci-lint ci-typecheck ci-test-run ci-build-app

# Default target
help:
	@echo "Available commands:"
	@echo "  Development:"
	@echo "    make up          - Start all docker services (builds if needed)"
	@echo "    make down        - Stop all docker services"
	@echo "    make restart     - Restart all docker services"
	@echo "    make logs        - Show docker logs (follow mode)"
	@echo "    make build       - Rebuild Docker images"
	@echo "    make ps          - Show running containers"
	@echo "    make url         - Show application URLs"
	@echo "    make dev         - Start dev server (app only, without tunnel)"
	@echo "    make install     - Install npm dependencies in container"
	@echo "    make clean       - Clean node_modules and dist"
	@echo ""
	@echo "  Code Quality & CI:"
	@echo "    make lint        - Run ESLint"
	@echo "    make typecheck   - Run TypeScript type checking"
	@echo "    make test        - Run tests in watch mode"
	@echo "    make test-run    - Run tests once (CI mode)"
	@echo "    make format      - Format code with Prettier"
	@echo "    make build-app   - Build production bundle"
	@echo "    make ci          - Run all CI checks (lint + typecheck + test + build)"
	@echo ""
	@echo "  CI (Docker-in-Docker compatible):"
	@echo "    make ci-lint     - Run ESLint (using docker run)"
	@echo "    make ci-typecheck - Run TypeScript type checking (using docker run)"
	@echo "    make ci-test-run  - Run tests once (using docker run)"
	@echo "    make ci-build-app - Build production bundle (using docker run)"

# Start services (builds first if needed)
up:
	docker compose up -d
	@echo ""
	@echo "🚀 Services started!"
	@echo "   App:        http://localhost:5173"
	@if docker compose ps cloudflared --format '{{.State}}' 2>/dev/null | grep -q running; then \
		echo "   Cloudflare: Checking tunnel..."; \
		sleep 3; \
		HOSTNAME=$$(docker compose logs cloudflared 2>&1 | grep -oP 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com|https://[a-zA-Z0-9.-]+\.(xyz|com)' | head -1); \
		if [ -n "$$HOSTNAME" ]; then \
			echo "   Cloudflare: $$HOSTNAME"; \
		else \
			echo "   Cloudflare: Configure CLOUDFLARE_TUNNEL_TOKEN in .env"; \
		fi; \
	fi
	@echo ""

# Stop services
down:
	docker compose down

# Restart services
restart:
	docker compose restart

# Show logs (follow mode)
logs:
	docker compose logs -f

# Rebuild images
build:
	docker compose build
	@echo "✅ Docker images built"

# Show running containers
ps:
	docker compose ps

# Show application URLs
url:
	@echo "🌐 Application URLs:"
	@echo "   Local:      http://localhost:5173"
	@echo ""
	@if docker compose ps cloudflared --format '{{.State}}' 2>/dev/null | grep -q running; then \
		HOSTNAME=$$(docker compose logs cloudflared 2>&1 | grep -oP 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com|https://[a-zA-Z0-9.-]+\.(xyz|com)' | head -1); \
		if [ -n "$$HOSTNAME" ]; then \
			echo "   Cloudflare: $$HOSTNAME"; \
		else \
			echo "   Cloudflare: Not configured (set CLOUDFLARE_TUNNEL_TOKEN in .env)"; \
		fi; \
	else \
		echo "   Cloudflare: Tunnel not running"; \
	fi

# Start dev server only (without Cloudflare tunnel)
dev:
	docker compose up app

# Install npm dependencies
install:
	docker compose run --rm app npm install

# Clean generated files
clean:
	docker compose run --rm app rm -rf node_modules dist
	@echo "✅ Cleaned node_modules and dist"

# Code Quality & CI targets

# Local development targets (use docker compose with volume mounts)
lint:
	docker compose run --rm app npm run lint

typecheck:
	docker compose run --rm app npx vue-tsc --noEmit

test:
	docker compose run --rm app npm run test

test-run:
	docker compose run --rm app npm run test:run

format:
	docker compose run --rm app npm run format

build-app:
	docker compose run --rm app npm run build

# CI targets (use docker run - works with Docker-in-Docker)
# These targets use the built image directly without volume mounts
ci-lint:
	docker run --rm idle-mmo-profiter-app npm run lint

ci-typecheck:
	docker run --rm idle-mmo-profiter-app npx vue-tsc --noEmit

ci-test-run:
	docker run --rm idle-mmo-profiter-app npm run test:run

ci-build-app:
	docker run --rm idle-mmo-profiter-app npm run build

# Run all CI checks (fails fast)
ci: ci-lint ci-typecheck ci-test-run ci-build-app
	@echo "✅ All CI checks passed!"
