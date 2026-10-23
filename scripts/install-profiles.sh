#!/usr/bin/env bash
set -Eeuo pipefail

package_spec="${DSH_RTK_PACKAGE_SPEC:-github:mulqizamzam/dsh-rtk#main}"

if (($# == 0)); then
  printf 'Usage: bash scripts/install-profiles.sh <profile> [profile...]\n' >&2
  printf 'Example: bash scripts/install-profiles.sh web desktop cli\n' >&2
  exit 2
fi

if ! command -v dsh >/dev/null 2>&1; then
  printf 'Error: dsh was not found on PATH. Activate or install DSH first.\n' >&2
  exit 127
fi

# Validate the full list before modifying any profile.
for profile in "$@"; do
  if [[ ! "$profile" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    printf 'Error: invalid DSH profile name: %s\n' "$profile" >&2
    exit 2
  fi
done

for profile in "$@"; do
  printf '\n==> Installing dsh-rtk into profile: %s\n' "$profile"
  dsh plugin --profile "$profile" add "$package_spec"
done
