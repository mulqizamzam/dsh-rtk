# RTK → DSH porting notes

## Source and target inspected

- Source: https://github.com/rtk-ai/rtk — README, Cargo manifest, filter/hook documentation, and engine license.
- Harness target: DeepSeek Harness 0.2.1-rc.2, using its documented Cordis bundle and post-execution tool-result contracts.

## Workflow reconciliation

| Upstream capability | Decision | Reason / DSH implementation |
|---|---|---|
| Compact noisy successful command output | Re-implemented | Native tools/post-execute policy compacts recognized successful test/build/install output, duplicate lines, and over-budget output. |
| Preserve useful failures | Preserved | The automatic hook passes through non-zero exit results. |
| Large command-specific filter catalog | Partial | Safer, high-value patterns only; this is not the original Rust filter registry. |
| Rewrite commands before execution | Not implemented | DSH's native pre-execute event is a permission decision, not an argument-rewrite API. Changing already logged arguments would undermine audit consistency. |
| Gain/savings dashboard | Partial | dsh_rtk_stats reports process-local counts and bytes; tokens are estimated as bytes divided by four, not tokenizer-exact. |
| Explicit/manual output filtering | Re-implemented | dsh_rtk_compact processes supplied text only; it neither executes commands nor reads files. |
| Per-command bypass and exclusions | Preserved/adapted | DSH_RTK_BYPASS=1 / RTK_DSH_BYPASS=1 and excludedCommands. |
| User-defined trusted regex filters / trust flow | Not implemented | Arbitrary deletion rules can hide diagnostics; this port allows literal command exclusions only. |
| Persistent gain, discover, and session analytics | Not implemented | Avoids creating a separate persistent command history. Metrics reset with the process. |
| RTK Engine and RTK Proxy | Excluded | Separately licensed upstream components are not copied or packaged; this plugin does not intercept provider API traffic. |
| Hook installers for other agents and original CLI binaries | Excluded | Package targets DeepSeek Harness only. |

## Architecture and safety

The package is an independent native DSH bundle. Its tools/post-execute hook runs after a Bash result and replaces only the model-facing text for eligible successful foreground commands. It does not mutate command arguments, run another shell command, touch files, make network calls, or alter DSH sandbox/permission decisions. Detail-oriented source/diff/search commands are excluded. Truncation is explicit and supports a per-command bypass.

## Licensing and evidence limits

No RTK Rust source, built-in filter files, engine implementation, proxy source, binaries, credentials, or other-agent installers are included. The source was independently implemented against DSH's documented extension contract. RTK and DSH source licenses remain the owners' responsibility; consult upstream license files before copying any component.

Unit tests and the npm package dry-run passed locally. A live DSH profile install was not possible in this environment; perform a smoke test against DSH 0.2.1-rc.2 before calling this port runtime-verified.
