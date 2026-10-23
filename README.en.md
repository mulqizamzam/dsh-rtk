# DSH-RTK

A native **DeepSeek Harness (DSH)** bundle that reduces noisy engineering command output, preserves failure diagnostics, and reports process-local context savings.

**Compatibility target:** DSH `0.2.1-rc.2`. **Plugin version:** `0.1.0`.

DSH-RTK independently applies the productivity goal behind RTK—less unnecessary command output in model context—through DSH's `tools/post-execute` hook. It does not bundle the Rust RTK binary, RTK Engine (BUSL-1.1), RTK Proxy, or installers for other agents.

## Install

Start DSH Web if it is not already running:

```bash
npx @deepseek-ai/dsh web
```

Install the bundle into the `web` profile:

```bash
dsh plugin --profile web add "github:mulqizamzam/dsh-rtk#main"
```

Restart DSH Web, then verify that the layer is present:

```bash
dsh --profile web --dump-config | grep dsh-rtk
```

Successful Bash commands may be compacted automatically. Non-zero exits and source-inspection commands (such as `git diff`, `git show`, `rg`, `grep`, and `cat`) are passed through unchanged by the automatic hook.

## Tools

- `dsh_rtk_stats` reports process-local compaction counts, UTF-8 bytes avoided, and approximate tokens avoided (`bytes / 4`; not a billing metric).
- `dsh_rtk_compact` compacts text supplied to the tool. It does not execute commands or read files.
- Prefix a single command with `DSH_RTK_BYPASS=1` to bypass automatic compaction for that command. This does not alter DSH sandbox or permission policy.

## Configuration

Configuration is in `cordis.patch.yml` and can be overridden in your profile patch:

| Field | Default | Purpose |
|---|---:|---|
| `enabled` | `true` | Toggle automatic compaction; manual tools remain available. |
| `compactSuccessfulTests` | `true` | Summarize recognized successful test/build output. |
| `compactInstallOutput` | `true` | Remove recognized package-manager progress noise while retaining warnings and lifecycle messages. |
| `maxOutputChars` | `12000` | Character budget for successful non-inspection output. |
| `maxOutputLines` | `160` | Line budget for successful non-inspection output. |
| `excludedCommands` | `[]` | Literal command prefixes to exclude from automatic compaction. |

## Development

```bash
npm test
npm run check
npm run pack:check
```

Local install:

```bash
dsh plugin --profile web add link:/absolute/path/to/dsh-rtk
```

## Scope and licensing

This is an independent DSH port, not feature-for-feature parity with RTK CLI. Native DSH post-execution hooks cannot rewrite already-recorded command arguments, and this project does not include RTK's proxy/engine, persistent historical analytics, or non-DSH agent installers. See [porting notes](docs/PORTING-NOTES.md), [NOTICE](NOTICE.md), and [LICENSE](LICENSE).

---

[README Bahasa Indonesia](README.md)
