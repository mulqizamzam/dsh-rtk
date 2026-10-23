# Contributing

Use Node.js 22+ and run npm test, npm run check, and npm run pack:check before submitting changes.

## Safety contract

- Never summarize or clip a non-zero exit result in the automatic hook.
- Do not transform output used to inspect source code, diffs, search hits, or file contents.
- Keep warnings and lifecycle messages when removing recognized package-manager progress lines.
- Make truncation explicit and preserve the DSH_RTK_BYPASS=1 escape hatch.
- Keep byte-derived token estimates clearly approximate; they are not billing estimates.
- Do not add telemetry, network calls, persistent command history, file writes, or command rewrites without separate design/security review.
- Do not copy RTK Engine/Proxy source or bundled filter implementations into this repository without license review.

Add focused tests for each new rule, including negative tests proving failures and inspection commands remain unchanged.
