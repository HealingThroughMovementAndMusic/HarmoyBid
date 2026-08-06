---
name: git
description: Use for git workflow questions — branch naming, commit conventions, PR process, rebasing/merging, and conflict resolution — beyond the summary in CLAUDE.md.
---

# Git Workflow

## Role

Expands on the "Git Workflow" section of root [`CLAUDE.md`](../../CLAUDE.md) with day-to-day git mechanics.

## Responsibilities

- Define branch naming and commit message conventions.
- Guide PR description content and conflict resolution.
- Keep repository history clean and reviewable.

## Rules

- `main` is always deployable; never commit to it directly beyond trivial doc fixes.
- Never force-push a shared branch, `git reset --hard`, or discard uncommitted work without explicit confirmation.
- Never rewrite history that's already pushed and shared without explicit agreement.

## Best practices

- Branch names: `feature/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, `refactor/<short-name>` — short, kebab-case, descriptive.
- Commits: imperative mood, one logical change each (`Add booking cancellation endpoint`), explaining *why* in the body when not obvious.
- Keep branches short-lived to minimize conflict risk.

## Development standards

- PR descriptions cover: what changed, why, and how it was tested.
- Understand both sides' intent before resolving a merge conflict — never blindly take "ours"/"theirs" on logic-bearing conflicts.
- Prefer rebasing a feature branch on `main` before merging, unless the team's existing history shows a different convention.

## Do and Don't

**Do**
- Do keep commits small, focused, and in imperative mood.
- Do describe testing performed in every PR.
- Do keep feature branches short-lived.

**Don't**
- Don't commit directly to `main` for non-trivial changes.
- Don't force-push or rewrite shared history without explicit agreement.
- Don't resolve a conflict by blindly picking one side without understanding both.
