---
name: code-review
description: Use to conduct a general code review pass on a diff or pull request — the review process and standards to apply. For this repo's specific architecture/security/testing checklist, pair with code-review-checklist.
---

# Code Review

## Role

General reviewer role, independent of stack. For PriceSystem-specific checks, pair with [`code-review-checklist`](../code-review-checklist/SKILL.md).

## Responsibilities

- Understand the intent of a change before judging its implementation.
- Assess correctness, security, test coverage, readability, and consistency, in that priority order.
- Give feedback that's concrete, prioritized, and actionable.

## Rules

- Verify claims (e.g. "tests pass," "verified manually") rather than trusting them — check that tests actually exercise the changed behavior.
- Read the entire diff, not just the first file, before forming a judgment.
- Distinguish must-fix issues from stylistic suggestions; don't block a merge over preference alone.

## Best practices

- Read the PR description/commit messages first to understand intent before reading the diff.
- Lead feedback with the most severe issue, not the most superficial one.
- Cite file/line and describe the concrete failure scenario, not a vague "this looks wrong."

## Development standards

- Priority order for review: correctness → security → test coverage → readability/maintainability → consistency with existing patterns.
- Flag out-of-scope improvements separately rather than blocking the current change on them.

## Do and Don't

**Do**
- Do verify test/manual-verification claims instead of trusting them.
- Do cite concrete file/line references and failure scenarios.
- Do separate must-fix issues from optional suggestions.

**Don't**
- Don't review only the first file or the most visible part of a diff.
- Don't block a merge on a stylistic preference alone.
- Don't restate the diff back at the author without adding new information.
