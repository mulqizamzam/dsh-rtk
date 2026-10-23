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

### Install across profiles

DSH bundles are installed **per profile**. To enable consistent compaction in `web`, `desktop`, `cli`, and other profiles you use, run this from a repository checkout:

```bash
git clone https://github.com/mulqizamzam/dsh-rtk.git
cd dsh-rtk
bash scripts/install-profiles.sh web desktop cli
```

Replace those names with your actual profile names. You can also repeat `dsh plugin --profile <profile> add "github:mulqizamzam/dsh-rtk#main"` for each profile. The DSH CLI may initialize a profile that does not yet exist, so check the names before running the helper. Restart each active DSH process after installing or updating the bundle.

Restart DSH Web, then verify that the layer is present:

```bash
dsh --profile web --dump-config | grep dsh-rtk
```

Successful Bash commands may be compacted automatically. Non-zero exits and source-inspection commands (such as `git diff`, `git show`, `rg`, `grep`, and `cat`) are passed through unchanged by the automatic hook.

## Tools

- `dsh_rtk_stats` reports process-local compaction counts, UTF-8 bytes avoided, and approximate tokens avoided (`bytes / 4`; not a billing metric).
- `dsh_rtk_compact` compacts text supplied to the tool. It does not execute commands or read files.
- Prefix a single command with `DSH_RTK_BYPASS=1` to bypass automatic compaction for that command:

```bash
DSH_RTK_BYPASS=1 cargo test --workspace
```

For CI jobs or DSH sessions that require full diagnostics, set the variable on the process/job that runs DSH:

```yaml
jobs:
  integration:
    runs-on: ubuntu-latest
    env:
      DSH_RTK_BYPASS: "1"
    steps:
      # checkout/setup steps ...
      - run: dsh --profile headless "run the required checks with full diagnostics"
```

`RTK_DSH_BYPASS=1` is also supported. Environment-level bypass applies to all commands handled by that DSH process; a command prefix applies only to one command. It does not alter DSH sandbox or permission policy. Avoid setting it on a job intended to test compaction, unless it is scoped to a separate step.

## Configuration

Configuration is in `cordis.patch.yml` and can be overridden in your profile patch:

| Field | Default | Purpose |
|---|---:|---|
| `enabled` | `true` | Toggle automatic compaction; manual tools remain available. |
| `compactSuccessfulTests` | `true` | Summarize recognized successful test/build output. |
| `compactInstallOutput` | `true` | Remove recognized package-manager progress noise while retaining warnings and lifecycle messages. |
| `maxOutputChars` | `12000` | Character budget for successful non-inspection output. |
| `maxOutputLines` | `160` | Line budget for successful non-inspection output. |
| `excludedCommands` | `["git diff"]` | Additional literal command prefixes to exclude. `git diff` is always excluded by default, even when the custom list is empty. |

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
