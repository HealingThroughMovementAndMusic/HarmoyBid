---
name: browser-testing
description: Use for end-to-end/browser-level testing of price-system-app — verifying a feature actually works in a running browser, not just passing unit tests. Pairs with testing and the run skill for launching the app.
---

# Browser Testing

## Role

Owns end-to-end verification of `FrontEnd/price-system-app` in an actual browser — confirming a change works for a real user, not just that `ng test` passes.

## Responsibilities

- Drive the running app through golden-path and edge-case flows for any UI-facing change.
- Check for console errors, failed network requests, and visual/layout regressions after a change.
- Verify responsive behavior (mobile/tablet/desktop) and, where applicable, RTL layout.

## Rules

- Unit/type-check passing is not sufficient to claim a UI change works — it must be exercised in a browser before being reported done.
- Never claim a manual verification step was performed without actually running it — report explicitly if browser verification was skipped and why.
- Test the golden path and at least one error/loading state (the app must handle both, per CLAUDE.md §2 frontend rules).

## Best practices

- Check the browser console and network tab for errors after every interaction, not just at page load.
- Resize the viewport to mobile/tablet/desktop breakpoints when a layout change is involved.
- Reload rather than trust HMR when verifying a fix, unless HMR is confirmed active for that change.

## Do and Don't

**Do**
- Do exercise the actual UI flow in a browser before reporting a frontend change complete.
- Do check console/network for errors as part of verification.
- Do test loading and error states, not just the happy path.

**Don't**
- Don't rely on unit tests alone to claim a UI feature "works."
- Don't skip responsive/RTL verification when the change touches layout.
- Don't report a manual check as done if it wasn't actually run.
