#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-upstream/dingosky}"

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  printf 'Base ref not found: %s\n' "$BASE_REF" >&2
  printf 'Run `git fetch upstream --prune` and retry.\n' >&2
  exit 2
fi

merge_base=$(git merge-base HEAD "$BASE_REF")
changed_files=$(git diff --name-only "$merge_base"...HEAD)

if [[ -z "$changed_files" ]]; then
  printf 'No file changes relative to %s\n' "$BASE_REF"
  exit 0
fi

disallowed_files=()

while IFS= read -r file; do
  if [[ -z "$file" ]]; then
    continue
  elif [[ "$file" == test/* ]]; then
    continue
  elif [[ "$file" == package.json ]]; then
    continue
  elif [[ "$file" == vite.config.js ]]; then
    continue
  elif [[ "$file" == yarn.lock ]]; then
    continue
  elif [[ "$file" == .gitignore ]]; then
    continue
  else
    disallowed_files+=("$file")
  fi
done <<< "$changed_files"

if (( ${#disallowed_files[@]} > 0 )); then
  printf 'Disallowed files changed relative to %s:\n' "$BASE_REF" >&2
  printf '  %s\n' "${disallowed_files[@]}" >&2
  exit 1
fi

printf 'Allowed drift only (test files + test-infra files) relative to %s\n' "$BASE_REF"
