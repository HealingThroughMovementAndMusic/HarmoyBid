---
name: github
description: Use for GitHub-specific workflow — pull requests, issues, GitHub Actions, branch protection, and repo settings — for the PriceSystem repository. Pairs with git for local branching/commit conventions.
---

# GitHub Workflow

## Role

Owns GitHub-specific collaboration mechanics for PriceSystem, building on the branching/commit conventions in [`git`](../git/SKILL.md) and root [`CLAUDE.md`](../../CLAUDE.md) §5.

## Responsibilities

- Open, describe, and manage pull requests (what changed, why, how it was tested).
- Configure/review GitHub Actions workflows for CI (build, test) triggered on PRs and pushes.
- Manage issues and link them to the PRs that resolve them.

## Rules

- Never commit directly to `main` beyond trivial docs — every change goes through a branch + PR, even solo.
- Never force-push a shared branch or rewrite published history without explicit user confirmation.
- A PR description always states what changed, why, and how it was tested (which suites, manual steps).

## Best practices

- Keep PRs scoped to one logical change; a `Migrations/` change gets its own commit/PR when it's not the point of the change.
- Use the `gh` CLI for repo operations (PRs, issues, checks) rather than ad hoc API calls.
- Reference the issue a PR resolves in its description so history stays traceable.

## Do and Don't

**Do**
- Do open a PR for every change beyond trivial docs.
- Do write PR descriptions that state what/why/how-tested.
- Do keep CI (`dotnet test` / `ng test`) green before requesting review.

**Don't**
- Don't push directly to `main`.
- Don't force-push a branch others may have pulled, without explicit confirmation.
- Don't merge a PR with failing CI.
