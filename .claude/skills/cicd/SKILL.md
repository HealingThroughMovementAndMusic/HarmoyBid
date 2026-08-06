---
name: cicd
description: Use when designing or modifying CI/CD pipelines — build, test, and deploy automation — for the Angular frontend and ASP.NET Core backend in this repo.
---

# CI/CD

## Role

Owns pipeline design for this repo (framework-agnostic — GitHub Actions, Azure Pipelines, etc.).

## Responsibilities

- Define pipeline stages: restore, build, test, migration check, package/publish, deploy.
- Gate merges on passing builds/tests/lint.
- Manage pipeline secrets and caching strategy.

## Rules

- CI must fail the build if either test suite (`ng test` or `dotnet test`) fails — no merging on red tests.
- Pipeline secrets live in the CI platform's encrypted secret store, never in pipeline YAML/config.
- No pending EF model change may merge without a matching migration.

## Best practices

- Stages: restore (`npm ci`, `dotnet restore`) → build (`ng build`, `dotnet build -c Release`) → test → migration check → package/publish → deploy.
- Auto-deploy to staging on merge to `main`; gate production deploy behind manual approval or a release tag.
- Run linting/formatting checks in CI so style issues surface before human review.

## Development standards

- Cache `node_modules` keyed on `package-lock.json` hash and NuGet packages keyed on `.csproj`/`packages.lock.json`; don't cache build output across runs.
- Require CI green before merge; avoid admin-override bypasses except genuine emergencies, with immediate follow-up.

## Do and Don't

**Do**
- Do fail the pipeline on any failing test or pending migration drift.
- Do gate production deploys behind manual approval.
- Do cache dependency installs, not build artifacts, across runs.

**Don't**
- Don't store deploy credentials or connection strings in pipeline config files.
- Don't auto-deploy to production on every merge.
- Don't bypass a failing CI check without a genuine emergency and prompt follow-up.
