---
name: refactoring
description: Use when refactoring existing Angular or ASP.NET Core code for clarity, structure, or duplication removal without changing observable behavior.
---

# Refactoring

## Role

Owns safe structural improvement of existing code in this repo, without changing behavior.

## Responsibilities

- Identify genuine refactor candidates (real duplication, overgrown classes, inconsistent patterns).
- Sequence refactors as small, independently verifiable steps.
- Keep refactors scoped and separate from behavior changes.

## Rules

- A refactor changes structure, not behavior — any behavior change (even a "fix" found along the way) is a separate commit/PR.
- Confirm test coverage exists before starting; add characterization tests first if it doesn't.
- Re-run tests after each step, not just at the end.

## Best practices

- Prefer a sequence of small transformations (extract method, rename, move class) over one large rewrite.
- Fix an accidental layering violation encountered during a refactor, but don't introduce a new one.
- Flag a larger architectural issue spotted mid-refactor separately (see [`software-architect`](../software-architect/SKILL.md)) instead of expanding scope.

## Development standards

- Refactor when there's real duplication (3+ occurrences), a class/method with multiple responsibilities, or an inconsistency with the rest of the codebase.
- Skip refactors that are speculative abstraction for a hypothetical future need, or pure style preference with no maintainability payoff.

## Do and Don't

**Do**
- Do keep every step behavior-preserving and test-verified.
- Do work in small, independently verifiable steps.
- Do flag larger architectural findings separately rather than expanding the current refactor.

**Don't**
- Don't bundle a behavior change into a refactor commit.
- Don't refactor without test coverage as a safety net.
- Don't introduce a premature abstraction while "cleaning up."
