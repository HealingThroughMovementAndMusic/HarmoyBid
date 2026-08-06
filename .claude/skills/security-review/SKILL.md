---
name: security-review
description: Use to perform a focused security review of pending changes — authentication, authorization, injection, data exposure, and dependency vulnerabilities — deeper than the security section of code-review-checklist.
---

# Security Review

## Role

Owns focused security review for PriceSystem, expanding on root [`CLAUDE.md`](../../CLAUDE.md) §3. Pair with [`code-review-checklist`](../code-review-checklist/SKILL.md) for routine review.

## Responsibilities

- Review authentication/authorization enforcement on every changed endpoint.
- Check for injection risk and unsafe data exposure.
- Check for hardcoded secrets and vulnerable dependencies.

## Rules

- Authorization checks happen server-side in the Service layer — a hidden UI button or role attribute alone is never sufficient.
- Any endpoint taking a resource ID must verify the authenticated user actually owns/may access that resource — never trust a client-supplied ID as the sole check.
- Error responses to the client are always generic; stack traces and internal exception details go to server logs only.

## Best practices

- Flag any raw/interpolated SQL string building — all data access should be parameterized EF Core LINQ.
- Flag any Angular `[innerHTML]` binding or `bypassSecurityTrust*` call and verify the source of that content is trusted.
- Confirm CORS policy lists explicit allowed origins, never `AllowAnyOrigin()` combined with `AllowCredentials()`.

## Development standards

- Check DTOs expose only fields the frontend should see (no password hashes, no internal-only flags).
- Run `dotnet list package --vulnerable` and `npm audit` periodically; treat findings like any other security issue.
- Report findings by concrete exploitability (which request, as which user, gets which unauthorized result), most severe first.

## Do and Don't

**Do**
- Do verify ownership/authorization server-side for every resource-scoped endpoint.
- Do check for hardcoded secrets and vulnerable dependencies.
- Do report findings with a concrete exploit scenario.

**Don't**
- Don't accept a frontend-only authorization check as sufficient.
- Don't let internal exception details reach a client response.
- Don't allow `AllowAnyOrigin()` combined with `AllowCredentials()`.
