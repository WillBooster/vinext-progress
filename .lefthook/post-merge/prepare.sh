#!/bin/bash

changed_files="$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD)"

run_if_changed() {
  if echo "$changed_files" | grep --quiet -E "$1"; then
    eval "$2"
  fi
}

run_if_changed "(mise\.toml|rust-toolchain(\.toml)?)" "mise install"
eval "$(mise env -s bash)"
if git diff --no-color -U0 ORIG_HEAD HEAD -- '*bunfig.toml' | grep --quiet -E '^[+-] *(globalStore|linker|publicHoistPattern)'; then rm -Rf -- e2e/fixture/node_modules node_modules; fi
run_if_changed "(package\.json|bun\.lock|bunfig\.toml|\.npmrc|patches/)" "bun install" || exit
[ -d node_modules ] || bun install --frozen-lockfile || exit
run_if_changed "(bunfig\.toml|\.npmrc)" "rm -Rf -- e2e/fixture/node_modules/.vite"
