#!/usr/bin/env bash
# Self-proof of every rule: each rule must FAIL its bad fixture and PASS its good one.
#   checks/selftest/run.sh [out-dir]   -> <out-dir>/selftest-py.json, selftest-page.json
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
export K_SELFTEST_OUT="${1:-${TMPDIR:-/tmp}}"
mkdir -p "$K_SELFTEST_OUT"
export NODE_PATH="${NODE_PATH:-$HERE/../../node_modules}"
python3 "$HERE/test_py.py"
node "$HERE/test_page.js"
