---
name: performance-optimization
description: Use when investigating or improving performance — Angular rendering/bundle size, ASP.NET Core API latency, or SQL Server query performance in this repo.
---

# Performance Optimization

## Role

Owns layer-by-layer performance investigation and improvement across the stack.

## Responsibilities

- Diagnose slow behavior in the frontend, backend, or database.
- Apply targeted optimizations backed by measurement.
- Verify improvement after each change.

## Rules

- Always measure before and after a change — never optimize on intuition alone.
- Make one change at a time and re-measure before stacking another.
- Diagnose a slow SQL query with an actual execution plan, not assumptions.

## Best practices

- Angular: `OnPush` change detection, `trackBy` on iterated lists, lazy-loaded feature routes, debounced reactive chains.
- Backend: genuinely async I/O end-to-end, avoid N+1 queries, cache read-heavy/rarely-changing data, paginate unbounded list endpoints.
- SQL Server: add an index because a specific slow query needs it, not preemptively; watch for missing indexes on foreign keys used in frequent filters/joins.

## Development standards

- Confirm bundle size claims with `ng build --stats-json` + a bundle analyzer rather than assuming a dependency is "too heavy."
- Don't cache data with a tight consistency requirement (e.g. booking availability).
- Reproduce the slow scenario with a measurement (Network tab timing, backend request logging, SQL execution time) before forming a hypothesis.

## Do and Don't

**Do**
- Do measure before and after every performance change.
- Do fix confirmed N+1 queries and missing indexes.
- Do paginate list endpoints that can grow unbounded.

**Don't**
- Don't optimize based on intuition without measurement.
- Don't cache data that has a tight consistency requirement.
- Don't stack multiple speculative performance fixes before re-measuring.
