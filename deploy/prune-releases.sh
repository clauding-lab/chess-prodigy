#!/usr/bin/env bash
# Prune old chess-prodigy release directories and stale deploy staging
# directories under /tmp. See deploy/README.md, "Release retention".
set -euo pipefail
shopt -s nullglob

# declare -A below requires bash 4+. Guard explicitly with a dedicated exit
# code (3) so a stock-macOS /bin/bash 3.2 failure is never mistaken for the
# script's own policy refusals, which use exit 2.
if (( BASH_VERSINFO[0] < 4 )); then
  echo "prune: requires bash >= 4 (found ${BASH_VERSION:-unknown}); this is an interpreter mismatch, not a decision to decline pruning" >&2
  exit 3
fi

ROOT="${CHESS_PRODIGY_ROOT:-/opt/chess-prodigy}"
KEEP="${CHESS_PRODIGY_KEEP:-3}"
STAGE_GLOB="${CHESS_PRODIGY_STAGE_GLOB:-/tmp/chess-*-stage.*}"
STAGE_MAX_AGE_HOURS="${CHESS_PRODIGY_STAGE_MAX_AGE_HOURS:-24}"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    *)
      echo "prune: unknown argument '$arg'" >&2
      exit 2
      ;;
  esac
done

if ! [[ "$KEEP" =~ ^[0-9]+$ ]] || [[ "$KEEP" -lt 1 ]]; then
  echo "prune: refusing — CHESS_PRODIGY_KEEP must be a positive integer (got '$KEEP')" >&2
  exit 2
fi

# Portable mtime (epoch seconds): GNU stat first, BSD stat as fallback.
mtime_of() {
  stat -c '%Y' "$1" 2>/dev/null || stat -f '%m' "$1"
}

# Portable size in KB: du -sk works the same on GNU and BSD.
size_kb_of() {
  du -sk "$1" 2>/dev/null | cut -f1
}

# Canonicalize ROOT up front so every path built from it below (globbed
# release dirs, current/current-next resolution) agrees on the same form —
# on macOS /tmp (and mktemp's /var/folders paths) resolve through a symlink
# to /private/..., and readlink -f later fully canonicalizes its result, so
# without this the two sides would compare canonical vs non-canonical paths
# and never match.
[[ -d "$ROOT" ]] && ROOT="$(cd "$ROOT" && pwd -P)"

RELEASES_DIR="$ROOT/releases"
if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "prune: refusing — releases directory '$RELEASES_DIR' is missing" >&2
  exit 2
fi
RELEASES_REAL="$(cd "$RELEASES_DIR" && pwd -P)"
# Canonicalize RELEASES_DIR itself: if "releases" is a symlink (e.g. an
# operator relocated it onto a larger volume after a full-disk incident),
# the glob below must walk the same canonical form that current_real was
# resolved to, or protected-set lookups never match and the live release
# gets deleted. See deploy/README.md, "Release retention".
RELEASES_DIR="$RELEASES_REAL"

CURRENT_LINK="$ROOT/current"
CURRENT_NEXT_LINK="$ROOT/current-next"

current_real=""
if [[ -e "$CURRENT_LINK" || -L "$CURRENT_LINK" ]]; then
  current_real="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
fi
if [[ -z "$current_real" || ! -d "$current_real" ]]; then
  echo "prune: refusing — '$CURRENT_LINK' does not resolve to a directory" >&2
  exit 2
fi
case "$current_real" in
  "$RELEASES_REAL"/*) ;;
  *)
    echo "prune: refusing — '$CURRENT_LINK' resolves to '$current_real', which is not inside '$RELEASES_DIR'" >&2
    exit 2
    ;;
esac

current_next_real=""
if [[ -e "$CURRENT_NEXT_LINK" || -L "$CURRENT_NEXT_LINK" ]]; then
  current_next_real="$(readlink -f "$CURRENT_NEXT_LINK" 2>/dev/null || true)"
  [[ -d "$current_next_real" ]] || current_next_real=""
fi

# All release directories, newest mtime first.
all_dirs=()
while IFS= read -r line; do
  all_dirs+=("$line")
done < <(
  for d in "$RELEASES_DIR"/*/; do
    [[ -d "$d" ]] || continue
    d="${d%/}"
    printf '%s\t%s\n' "$(mtime_of "$d")" "$d"
  done | sort -t $'\t' -k1,1nr | cut -f2-
)

declare -A protected
protected["$current_real"]=1
[[ -n "$current_next_real" ]] && protected["$current_next_real"]=1

keep_count=0
for d in "${all_dirs[@]}"; do
  [[ "$keep_count" -lt "$KEEP" ]] || break
  protected["$d"]=1
  keep_count=$((keep_count + 1))
done

if [[ "${#protected[@]}" -eq 0 ]]; then
  echo "prune: refusing — protected set would be empty" >&2
  exit 2
fi

kept=0
removed=0
freed_kb=0
for d in "${all_dirs[@]}"; do
  if [[ -n "${protected[$d]:-}" ]]; then
    kept=$((kept + 1))
    continue
  fi
  # `|| true` keeps a du failure (e.g. a concurrent manual cleanup racing
  # this loop) from tripping `set -e` mid-deletion via the command
  # substitution — the ${size_kb:-0} fallback already handles the empty
  # result, so a failed du only degrades the reported size, never aborts
  # the prune with releases half-deleted.
  size_kb="$(size_kb_of "$d" || true)"
  size_kb="${size_kb:-0}"
  size_mb=$((size_kb / 1024))
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "prune: would remove $d (${size_mb} MB)"
  else
    rm -rf -- "$d"
    echo "prune: removed $d (${size_mb} MB)"
  fi
  removed=$((removed + 1))
  freed_kb=$((freed_kb + size_kb))
done

# Stale deploy staging directories left behind under /tmp by manual releases.
stage_removed=0
now_epoch="$(date +%s)"
max_age_seconds=$((STAGE_MAX_AGE_HOURS * 3600))
for path in $STAGE_GLOB; do
  [[ -L "$path" ]] && continue
  [[ -d "$path" ]] || continue
  age=$((now_epoch - $(mtime_of "$path")))
  [[ "$age" -ge "$max_age_seconds" ]] || continue
  age_hours=$((age / 3600))
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "prune: would remove stage dir $path (age ${age_hours}h)"
  else
    rm -rf -- "$path"
    echo "prune: removed stage dir $path (age ${age_hours}h)"
  fi
  stage_removed=$((stage_removed + 1))
done

freed_mb=$((freed_kb / 1024))
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "prune: [dry-run] kept ${kept} releases, would remove ${removed}, would free ~${freed_mb} MB, stage dirs would remove ${stage_removed}"
else
  echo "prune: kept ${kept} releases, removed ${removed}, freed ~${freed_mb} MB, stage dirs removed ${stage_removed}"
fi
