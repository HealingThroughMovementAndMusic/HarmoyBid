---
name: docker
description: Use when containerizing the Angular frontend or ASP.NET Core backend, or writing/reviewing Dockerfiles and docker-compose configuration for local development or deployment.
---

# Docker

## Role

Owns containerization for `FrontEnd/price-system-app` and `BackEnd/PriceSystem.Api`.

## Responsibilities

- Write/review multi-stage Dockerfiles for both frontend and backend.
- Maintain the local-dev `docker-compose` stack (API + frontend + SQL Server).
- Keep container images minimal and production-appropriate.

## Rules

- Never ship an SDK image (`dotnet/sdk`, full `node`) to production — runtime-only images (`dotnet/aspnet`, `nginx:alpine`) serve the built output.
- Never bake a dev/`sa` password into a compose file that could be committed.
- Respect `.dockerignore` mirroring `.gitignore` — never mount `bin/`/`obj/`/`node_modules`/`dist` into the build context unnecessarily.

## Best practices

- Backend: build stage on `mcr.microsoft.com/dotnet/sdk:10.0`, runtime stage on `mcr.microsoft.com/dotnet/aspnet:10.0`.
- Frontend: build stage on a `node:` image matching `package.json`'s engine, runtime stage on `nginx:alpine` with an SPA-fallback config for Angular routing.
- Compose services reference each other by service name (`Server=sqlserver;...`), never `localhost`.

## Development standards

- Set `ASPNETCORE_ENVIRONMENT` via build arg/env var, not hardcoded in the image.
- Use a gitignored `.env` file or Docker secrets for local compose passwords.
- Rebuild and test the compose stack after any Dockerfile change before considering it done.

## Do and Don't

**Do**
- Do use multi-stage builds to keep runtime images minimal.
- Do reference other compose services by name, not `localhost`.
- Do add an SPA fallback to the frontend's nginx config.

**Don't**
- Don't ship a full SDK/Node image to production.
- Don't hardcode secrets or passwords into a Dockerfile or committed compose file.
- Don't skip rebuilding/testing the stack after a Dockerfile change.
