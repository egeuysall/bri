#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-dist/cli-release}"
shift || true

if [ "$#" -gt 0 ]; then
  TARGETS=("$@")
else
  TARGETS=(
    "bun-darwin-arm64:bri-darwin-arm64"
    "bun-darwin-x64:bri-darwin-x64"
    "bun-linux-arm64:bri-linux-arm64"
    "bun-linux-x64:bri-linux-x64"
    "bun-windows-x64:bri-windows-x64.exe"
  )
fi

mkdir -p "${OUT_DIR}"

built_assets=()

resign_darwin_binary_if_available() {
  local target asset_path
  target="$1"
  asset_path="$2"

  case "${target}" in
    bun-darwin-*)
      if command -v codesign >/dev/null 2>&1; then
        # Bun-compiled macOS binaries may carry an invalid embedded signature.
        # Re-sign ad-hoc so Gatekeeper/loader can validate the executable.
        codesign --remove-signature "${asset_path}" >/dev/null 2>&1 || true
        codesign -f -s - --timestamp=none "${asset_path}"
        codesign --verify --verbose=2 "${asset_path}"
      fi
      ;;
  esac
}

for spec in "${TARGETS[@]}"; do
  if [[ "${spec}" != *:* ]]; then
    echo "invalid target specification: ${spec}" >&2
    echo "expected format: bun-target:asset-name" >&2
    exit 1
  fi

  target="${spec%%:*}"
  asset="${spec##*:}"
  asset_path="${OUT_DIR}/${asset}"

  echo "building ${asset} (${target})..."
  bun build --compile --target="${target}" --outfile="${asset_path}" ./cli/bri.ts
  resign_darwin_binary_if_available "${target}" "${asset_path}"

  built_assets+=("${asset}")
done

chmod +x "${OUT_DIR}"/bri-* "${OUT_DIR}"/bri-*.exe 2>/dev/null || true

(
  cd "${OUT_DIR}"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${built_assets[@]}" >SHA256SUMS
  else
    shasum -a 256 "${built_assets[@]}" >SHA256SUMS
  fi
)

echo "release assets available in ${OUT_DIR}"
