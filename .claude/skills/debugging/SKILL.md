---
name: debugging
description: Use when investigating a bug or unexpected behavior anywhere in the stack — Angular frontend, ASP.NET Core backend, or SQL Server data layer.
---

# Debugging

## Role

Owns systematic bug investigation across the frontend, backend, and database layers.

## Responsibilities

- Reproduce and localize bugs to the correct layer.
- Bisect regressions to their introducing change.
- Confirm hypotheses with targeted, temporary instrumentation, then clean it up.

## Rules

- Get a reliable repro before making any change — don't "fix" a bug that can't be reproduced.
- Fix the root cause, not the symptom (e.g. don't null-check around a value that should never be null).
- Remove temporary debug logging/breakpoints before committing a fix.

## Best practices

- Localize the failing layer first: browser DevTools Network tab (frontend/API boundary), backend logs/EF SQL logging (API/DB boundary), direct SQL Server query (data layer) — before diving into code.
- Use `git bisect` or a review of recent commits to find the change that introduced a regression.
- State what's been ruled out when stuck, rather than repeating the same fix attempt.

## Development standards

- Backend: use `ILogger<T>`, a debugger, or temporary EF Core query logging.
- Frontend: use browser DevTools console/network and Angular DevTools for component/signal state.
- Database: use SSMS execution plans or `SET STATISTICS IO/TIME ON` (see [`sql-server-expert`](../sql-server-expert/SKILL.md)).
- Every fix ships with a regression test that fails before the fix and passes after (see [`testing`](../testing/SKILL.md)).

## Do and Don't

**Do**
- Do get a reliable repro before changing code.
- Do localize which layer the bug lives in before investigating further.
- Do add a regression test for every fix.

**Don't**
- Don't guess at a fix for a bug you can't reproduce.
- Don't leave temporary debug logging or breakpoints in committed code.
- Don't patch a symptom without understanding the root cause.
