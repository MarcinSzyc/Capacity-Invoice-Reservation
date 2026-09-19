#!/usr/bin/env bash
# Fails when an em dash or an en dash appears in any Markdown file, or in the
# commit messages of the given range. Used by `npm run check:prose` and by CI.
#
#   scripts/check-prose.sh              files only
#   scripts/check-prose.sh origin/main  files plus commit messages in origin/main..HEAD
set -euo pipefail

EM=$(printf '\xe2\x80\x94')
EN=$(printf '\xe2\x80\x93')
status=0

echo "check-prose: scanning Markdown files"
if grep -rn --include='*.md' -e "$EM" -e "$EN" \
     --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=coverage . ; then
  echo "check-prose: long dashes found in files above" >&2
  status=1
fi

if [ "${1:-}" != "" ]; then
  echo "check-prose: scanning commit messages in $1..HEAD"
  if git log "$1..HEAD" --format='%H%n%B' | grep -n -e "$EM" -e "$EN"; then
    echo "check-prose: long dashes found in commit messages above" >&2
    status=1
  fi
fi

if [ $status -eq 0 ]; then echo "check-prose: clean"; fi
exit $status
