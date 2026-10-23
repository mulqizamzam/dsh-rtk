# Changelog

## Unreleased

- Add a helper to install DSH-RTK into multiple explicitly named profiles.
- Exclude `git diff` by default, even when a custom exclusion list is empty.
- Support process-environment bypass flags for CI jobs that need full diagnostics.
- Verify the environment bypass and multi-profile helper syntax in GitHub Actions.

## 0.1.0 — initial DSH port

- Add a DeepSeek Harness bundle targeting DSH `0.2.1-rc.2`.
- Compact selected successful Bash test/build/install output through `tools/post-execute`.
- Preserve non-zero exits and detail-oriented file/diff/search output in the automatic hook.
- Add `dsh_rtk_stats` for process-local byte and approximate token estimates.
- Add `dsh_rtk_compact` for explicit compaction of caller-supplied text.
- Add one-command bypass and configurable command-prefix exclusions.
- Document non-ported RTK CLI, analytics, proxy, and cross-agent hook capabilities.
