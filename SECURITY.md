# Security policy

Report suspected vulnerabilities through GitHub Security Advisories for this repository. If advisories are unavailable, contact the repository owner privately.

DSH-RTK does not execute commands, change command arguments, request broader sandbox permissions, access files, or make network requests. Its automatic hook replaces only the model-facing text of eligible successful Bash results. Non-zero exits and detail-oriented source/diff/search commands pass through unchanged.

Because compaction can omit repetitive lines or clip unusually large successful output, review configuration changes carefully and use DSH_RTK_BYPASS=1 when complete output is required. This plugin does not replace DSH permission, approval, or sandbox controls.
