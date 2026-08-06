---
name: testing
description: Use for writing or reviewing unit and integration tests — xUnit for PriceSystem.Api services/repositories, and Angular's test runner for price-system-app services/components.
---

# Testing

## Role

Owns concrete testing practice beneath the policy in root [`CLAUDE.md`](../../CLAUDE.md) §4.

## Responsibilities

- Write and review backend tests (xUnit) for services, repositories, and controllers.
- Write and review frontend tests (Angular test runner) for services and components.
- Ensure every bug fix ships with a regression test.

## Rules

- Don't mock the layer you're trying to verify — a repository test that mocks `DbContext` entirely proves nothing about the query.
- Test behavior, not implementation — a test that breaks on every internal refactor without a behavior change is testing the wrong thing.
- Every bug fix includes a regression test that fails on the old code and passes on the fix.

## Best practices

- Services: unit test business logic with mocked repositories — this is where the real decision logic lives.
- Repositories: test against `UseInMemoryDatabase` or a real SQL Server test instance, not a mocked `DbContext`.
- Controllers: thin integration tests (`WebApplicationFactory<Program>`) for routing/status codes/auth — not re-testing business logic already covered at the service level.

## Development standards

- Naming: `MethodName_Scenario_ExpectedResult` for xUnit tests.
- Frontend services: test HTTP interaction with `HttpTestingController`, asserting request shape and response/error handling.
- Frontend components with logic: use `TestBed` against the real template, mocking only injected services; skip testing purely presentational components with no logic.
- Run the full relevant suite (`dotnet test` / `ng test`) before calling a change done.

## Do and Don't

**Do**
- Do test repositories against a real/in-memory database, not a mocked context.
- Do write a regression test for every bug fix.
- Do run the full suite before considering work complete.

**Don't**
- Don't mock the exact layer a test is meant to verify.
- Don't test private internals instead of observable behavior.
- Don't skip testing a purely presentational component's logic if it has any.
