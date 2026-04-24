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

NODE_BUNDLE_PATH="${OUT_DIR}/.bri-node-bundle.js"
NODE_BUNDLE_CLEAN_PATH="${OUT_DIR}/.bri-node-bundle.clean.js"
built_assets=()

build_node_bundle() {
  echo "building node bundle..."
  bun build --target=node --format=esm --outfile="${NODE_BUNDLE_PATH}" ./cli/bri.ts

  # Bun preserves the source shebang from cli/bri.ts; remove it for node execution.
  sed '1{/^#!\/usr\/bin\/env bun$/d;}' "${NODE_BUNDLE_PATH}" >"${NODE_BUNDLE_CLEAN_PATH}"
}

create_posix_asset() {
  local asset_path
  asset_path="$1"

  cat >"${asset_path}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "[error] node runtime not found; install Node.js 20+ and rerun installer" >&2
  exit 1
fi

if [ -z "${BRI_INSTALL_PATH:-}" ]; then
  export BRI_INSTALL_PATH="$(cd -- "$(dirname -- "$0")" && pwd)/$(basename -- "$0")"
fi
exec /usr/bin/env node - "$@" <<'__BRI_CLI__'
EOF

  cat "${NODE_BUNDLE_CLEAN_PATH}" >>"${asset_path}"

  cat >>"${asset_path}" <<'EOF'
__BRI_CLI__
EOF

  chmod +x "${asset_path}"
}

build_node_bundle

for spec in "${TARGETS[@]}"; do
  if [[ "${spec}" != *:* ]]; then
    echo "invalid target specification: ${spec}" >&2
    echo "expected format: bun-target:asset-name" >&2
    exit 1
  fi

  target="${spec%%:*}"
  asset="${spec##*:}"

  if [[ "${asset}" == *.exe ]]; then
    echo "building ${asset} (${target})..."
    bun build --compile --target="${target}" --outfile="${OUT_DIR}/${asset}" ./cli/bri.ts
  else
    echo "building ${asset} (node launcher)"
    create_posix_asset "${OUT_DIR}/${asset}"
  fi

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

rm -f "${NODE_BUNDLE_PATH}" "${NODE_BUNDLE_CLEAN_PATH}"

echo "release assets available in ${OUT_DIR}"
