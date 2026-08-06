---
name: devops
description: Use for deployment topology, environment configuration, secrets management, and infrastructure questions spanning both the Angular frontend and ASP.NET Core backend.
---

# DevOps

## Role

Owns environment and deployment topology for both `FrontEnd/price-system-app` and `BackEnd/PriceSystem.Api`. For pipeline mechanics, see [`cicd`](../cicd/SKILL.md); for containerization, see [`docker`](../docker/SKILL.md).

## Responsibilities

- Define environment topology (Development/Staging/Production) and per-environment configuration.
- Manage secrets handling across environments.
- Define deployment shape (stateless API, static frontend, managed DB) and health/observability requirements.

## Rules

- Never share a JWT signing key or database across environments.
- Never commit real connection strings, JWT keys, or API keys to a tracked `appsettings.*.json`.
- Never modify shared/staging/production deployment config without explicit user confirmation.

## Best practices

- Configure per environment: backend via `appsettings.{Environment}.json` + environment variables, frontend via Angular `environment.ts` file replacement.
- Inject staging/production secrets via the hosting platform's secret store at deploy time, not baked into images.
- Run the backend as a stateless service (JWT auth, no server session) so it scales horizontally.

## Development standards

- Expose a health-check endpoint (DB connectivity at minimum) for load balancer/orchestrator probes.
- Centralize backend logs with structured logging so staging/production issues are diagnosable without direct box access.
- Serve the frontend as a static build via CDN or a lightweight web server — no Node runtime in production.

## Do and Don't

**Do**
- Do keep each environment's secrets and database fully isolated.
- Do expose a health-check endpoint for orchestration.
- Do confirm with the user before touching shared/staging/production config.

**Don't**
- Don't bake secrets into a container image.
- Don't reuse a signing key or connection string across environments.
- Don't deploy an in-process session-dependent backend design (breaks horizontal scaling).
