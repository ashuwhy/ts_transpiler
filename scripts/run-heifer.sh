#!/bin/sh
# Wrapper that mirrors what works in the terminal:
#   cd Heifer-type && eval $(opam env) && dune exec main/hip.exe FILE
set -e
HEIFER_DIR="$(cd "$(dirname "$0")/../Heifer-type" && pwd)"
cd "$HEIFER_DIR"
eval "$(opam env)"
exec dune exec main/hip.exe "$@"
