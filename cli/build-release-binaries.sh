#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-dist/cli-release}"

mkdir -p "${OUT_DIR}"

TARGETS=(
  "bun-darwin-arm64:bri-darwin-arm64"
  "bun-darwin-x64:bri-darwin-x64"
  "bun-linux-arm64:bri-linux-arm64"
  "bun-linux-x64:bri-linux-x64"
  "bun-windows-x64:bri-windows-x64.exe"
)

for spec in "${TARGETS[@]}"; do
  target="${spec%%:*}"
  asset="${spec##*:}"

  echo "building ${asset} (${target})..."
  bun build --compile --target="${target}" --outfile="${OUT_DIR}/${asset}" ./cli/bri.ts
done

chmod +x "${OUT_DIR}"/bri-* || true

(
  cd "${OUT_DIR}"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum bri-* >SHA256SUMS
  else
    shasum -a 256 bri-* >SHA256SUMS
  fi
)

echo "release assets available in ${OUT_DIR}"
