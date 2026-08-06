---
name: api-testing
description: Use for testing PriceSystem.Api endpoints directly — integration tests, manual verification via HTTP clients, and contract validation against the DTOs. Pairs with testing for the broader test strategy.
---

# API Testing

## Role

Owns HTTP-level testing of `BackEnd/PriceSystem.Api` endpoints — verifying routing, status codes, auth behavior, and response shape against the documented DTO contract.

## Responsibilities

- Write thin controller integration tests (e.g. via `WebApplicationFactory`) covering routing, status codes, and auth enforcement.
- Manually verify new/changed endpoints against Swagger before considering them done.
- Validate that responses match the documented DTO shape, including error responses.

## Rules

- Integration tests exercise real routing/middleware, not a mocked-out controller — that's what unit tests are for.
- Auth-protected endpoints get at least one test asserting `401`/`403` for missing/invalid/insufficient credentials.
- Run the full backend suite (`dotnet test`) before considering endpoint work complete, not just the new tests.

## Best practices

- Use `WebApplicationFactory<Program>` with an in-memory/test database rather than mocking `DbContext` entirely.
- Assert on status code and response shape together — a `200` with the wrong shape is still a failure for the frontend contract.
- Keep test data setup realistic (seed via the same paths the app uses) rather than hand-crafting edge-case-only fixtures.

## Do and Don't

**Do**
- Do test auth enforcement explicitly on every protected endpoint.
- Do validate response shape against the DTO, not just status code.
- Do use a real test database over mocking `DbContext`.

**Don't**
- Don't test controllers in isolation from the middleware pipeline when the point is integration coverage.
- Don't skip manual Swagger verification for a newly added endpoint.
- Don't leave an endpoint untested because "it's simple."
