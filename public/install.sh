#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO="${BRI_GITHUB_REPO:-egeuysall/bri}"
BIN_DIR="${BRI_INSTALL_DIR:-${HOME}/.local/bin}"
TARGET="${BIN_DIR}/bri"
TMP_TARGET="$(mktemp "${TMPDIR:-/tmp}/bri.XXXXXX")"
TMP_CHECKSUMS="$(mktemp "${TMPDIR:-/tmp}/bri-sha.XXXXXX")"
DEFAULT_RELEASE_BASE_URL="https://github.com/${GITHUB_REPO}/releases/latest/download"
DEFAULT_RELEASE_SOURCE_URL="https://github.com/${GITHUB_REPO}/releases/latest"
RELEASE_BASE_URL="${BRI_RELEASE_BASE_URL:-}"
RELEASE_SOURCE_URL="${BRI_RELEASE_SOURCE_URL:-}"
RELEASE_API_URL="${BRI_RELEASE_API_URL:-https://api.github.com/repos/${GITHUB_REPO}/releases/latest}"

info() {
  echo "[info] $*"
}

ok() {
  echo "[ok] $*"
}

warn() {
  echo "[warn] $*"
}

fail() {
  echo "[error] $*" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
  fi
}

cleanup() {
  rm -f "${TMP_TARGET}" "${TMP_CHECKSUMS}"
}
trap cleanup EXIT

extract_json_string() {
  local json key compact
  json="$1"
  key="$2"
  compact="$(printf '%s' "${json}" | tr -d '\r\n')"
  printf '%s' "${compact}" | sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/p" | head -n1
}

detect_asset_name() {
  local os arch normalized_arch

  os="$(uname -s)"
  arch="$(uname -m)"
  normalized_arch=""

  case "${os}" in
    Darwin)
      os="darwin"
      ;;
    Linux)
      os="linux"
      ;;
    *)
      fail "unsupported operating system: ${os}"
      ;;
  esac

  case "${arch}" in
    x86_64|amd64)
      normalized_arch="x64"
      ;;
    arm64|aarch64)
      normalized_arch="arm64"
      ;;
    *)
      fail "unsupported architecture: ${arch}"
      ;;
  esac

  printf 'bri-%s-%s' "${os}" "${normalized_arch}"
}

detect_profile_file() {
  local shell_name

  shell_name="$(basename "${SHELL:-}")"

  case "${shell_name}" in
    zsh)
      printf '%s' "${ZDOTDIR:-${HOME}}/.zshrc"
      ;;
    bash)
      if [ -f "${HOME}/.bashrc" ]; then
        printf '%s' "${HOME}/.bashrc"
      else
        printf '%s' "${HOME}/.bash_profile"
      fi
      ;;
    fish)
      printf '%s' "${HOME}/.config/fish/config.fish"
      ;;
    *)
      printf '%s' "${HOME}/.profile"
      ;;
  esac
}

ensure_path_persisted() {
  local profile shell_name marker entry

  case ":${PATH}:" in
    *":${BIN_DIR}:"*)
      return 0
      ;;
  esac

  export PATH="${BIN_DIR}:${PATH}"

  profile="$(detect_profile_file)"
  shell_name="$(basename "${SHELL:-}")"

  mkdir -p "$(dirname "${profile}")"

  if [ "${shell_name}" = "fish" ]; then
    marker="# bri-cli-path"
    entry="fish_add_path -g \"${BIN_DIR}\""
  else
    marker="# bri-cli-path"
    entry="export PATH=\"${BIN_DIR}:\$PATH\""
  fi

  if [ -f "${profile}" ] && grep -Fq "${entry}" "${profile}"; then
    info "PATH updated for current session (${BIN_DIR})"
    return 0
  fi

  {
    printf '\n%s\n' "${marker}"
    printf '%s\n' "${entry}"
  } >>"${profile}"

  ok "persisted PATH update in ${profile}"
}

sha256_file() {
  local file_path
  file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file_path}" | awk '{print tolower($1)}'
    return 0
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${file_path}" | awk '{print tolower($1)}'
    return 0
  fi

  fail "no sha256 tool available (need sha256sum or shasum)"
}

expected_checksum_for_asset() {
  local asset_name
  asset_name="$1"

  awk -v asset="${asset_name}" '
    {
      hash=$1
      name=$2
      gsub(/^\*/, "", name)
      if (tolower(name) == tolower(asset)) {
        print tolower(hash)
        exit 0
      }
    }
  ' "${TMP_CHECKSUMS}"
}

verify_download_checksum() {
  local asset_name expected actual
  asset_name="$1"

  expected="$(expected_checksum_for_asset "${asset_name}")"
  if [ -z "${expected}" ]; then
    fail "SHA256SUMS missing entry for ${asset_name}"
  fi

  actual="$(sha256_file "${TMP_TARGET}")"
  if [ "${actual}" != "${expected}" ]; then
    fail "checksum mismatch for ${asset_name} (expected ${expected}, got ${actual})"
  fi

  ok "verified checksum for ${asset_name}"
}

is_local_http_url() {
  case "$1" in
    http://localhost/*|http://localhost:*/*|http://127.0.0.1/*|http://127.0.0.1:*/*|http://[::1]/*|http://[::1]:*/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

download_to_file() {
  local url output
  url="$1"
  output="$2"

  if is_local_http_url "${url}"; then
    curl --fail --location --retry 3 --retry-connrefused --silent --show-error "${url}" -o "${output}"
    return 0
  fi

  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --retry-connrefused --silent --show-error "${url}" -o "${output}"
}

fetch_text_url() {
  local url
  url="$1"

  if is_local_http_url "${url}"; then
    curl --fail --location --retry 3 --retry-connrefused --silent --show-error "${url}"
    return 0
  fi

  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --retry-connrefused --silent --show-error "${url}"
}

resolve_release_urls() {
  local release_json release_tag

  if [ -n "${RELEASE_BASE_URL}" ]; then
    if [ -z "${RELEASE_SOURCE_URL}" ]; then
      RELEASE_SOURCE_URL="${DEFAULT_RELEASE_SOURCE_URL}"
    fi
    return 0
  fi

  release_json="$(fetch_text_url "${RELEASE_API_URL}" 2>/dev/null || true)"
  release_tag="$(extract_json_string "${release_json}" "tag_name")"

  if [ -n "${release_tag}" ]; then
    RELEASE_BASE_URL="https://github.com/${GITHUB_REPO}/releases/download/${release_tag}"
    if [ -z "${RELEASE_SOURCE_URL}" ]; then
      RELEASE_SOURCE_URL="https://github.com/${GITHUB_REPO}/releases/tag/${release_tag}"
    fi
    info "resolved release tag: ${release_tag}"
    return 0
  fi

  RELEASE_BASE_URL="${DEFAULT_RELEASE_BASE_URL}"
  if [ -z "${RELEASE_SOURCE_URL}" ]; then
    RELEASE_SOURCE_URL="${DEFAULT_RELEASE_SOURCE_URL}"
  fi
  warn "unable to resolve latest release tag via API, using latest alias"
}

setup_daily_autoupdate() {
  local os marker cron_line current_cron filtered_cron uid launch_agents_dir plist_path
  local command_string

  os="$(uname -s)"
  command_string="\"${TARGET}\" self-update --yes --quiet --install-path \"${TARGET}\""

  if [ "${os}" = "Darwin" ]; then
    launch_agents_dir="${HOME}/Library/LaunchAgents"
    plist_path="${launch_agents_dir}/com.bri.cli.autoupdate.plist"
    mkdir -p "${launch_agents_dir}"

    cat >"${plist_path}" <<EOF2
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.bri.cli.autoupdate</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>${command_string}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>86400</integer>
    <key>StandardOutPath</key>
    <string>/tmp/bri-autoupdate.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/bri-autoupdate.log</string>
  </dict>
</plist>
EOF2

    if command -v launchctl >/dev/null 2>&1; then
      uid="$(id -u)"
      launchctl bootout "gui/${uid}" "${plist_path}" >/dev/null 2>&1 || true
      launchctl bootstrap "gui/${uid}" "${plist_path}" >/dev/null 2>&1 || true
    fi

    ok "configured daily background auto-update (launchd)"
    return 0
  fi

  if [ "${os}" = "Linux" ] && command -v crontab >/dev/null 2>&1; then
    marker="# bri-cli-auto-update"
    cron_line="17 4 * * * /bin/bash -lc '${command_string}' >/dev/null 2>&1 ${marker}"
    current_cron="$(crontab -l 2>/dev/null || true)"
    filtered_cron="$(printf '%s\n' "${current_cron}" | grep -v "${marker}" || true)"

    {
      printf '%s\n' "${filtered_cron}"
      printf '%s\n' "${cron_line}"
    } | awk 'NF > 0' | crontab -

    ok "configured daily background auto-update (cron)"
    return 0
  fi

  warn "background auto-update scheduler unavailable on this platform"
}

finalize_binary() {
  if [ "$(uname -s)" = "Darwin" ] && command -v xattr >/dev/null 2>&1; then
    xattr -d com.apple.quarantine "${TARGET}" >/dev/null 2>&1 || true
    xattr -d com.apple.provenance "${TARGET}" >/dev/null 2>&1 || true
  fi
}

run_startup_probe() {
  local first_line timeout_seconds elapsed pid process_state

  timeout_seconds=8
  first_line="$(head -n 1 "${TARGET}" 2>/dev/null || true)"

  if [[ "${first_line}" == '#!'* ]]; then
    (/bin/bash "${TARGET}" --version >/dev/null 2>&1) &
  else
    ("${TARGET}" --version >/dev/null 2>&1) &
  fi

  pid=$!
  elapsed=0

  while kill -0 "${pid}" >/dev/null 2>&1; do
    process_state="$(ps -p "${pid}" -o stat= 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ "${process_state}" == Z* || "${process_state}" == *Z* ]]; then
      break
    fi

    if [ "${elapsed}" -ge "${timeout_seconds}" ]; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
      wait "${pid}" 2>/dev/null || true
      return 124
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  wait "${pid}"
}

verify_binary() {
  if run_startup_probe; then
    ok "verified CLI startup"
    return 0
  fi

  return 1
}

require_cmd curl
mkdir -p "${BIN_DIR}"
resolve_release_urls

ASSET_NAME="$(detect_asset_name)"
DOWNLOAD_URL="${RELEASE_BASE_URL}/${ASSET_NAME}"
CHECKSUMS_URL="${RELEASE_BASE_URL}/SHA256SUMS"

info "downloading ${ASSET_NAME} from ${GITHUB_REPO}..."
download_to_file "${DOWNLOAD_URL}" "${TMP_TARGET}"

info "downloading SHA256SUMS from ${GITHUB_REPO}..."
download_to_file "${CHECKSUMS_URL}" "${TMP_CHECKSUMS}"

verify_download_checksum "${ASSET_NAME}"

chmod +x "${TMP_TARGET}"
mv "${TMP_TARGET}" "${TARGET}"
chmod 755 "${TARGET}"
finalize_binary

info "release source: ${RELEASE_SOURCE_URL}"

if ! verify_binary; then
  fail "installed asset failed startup check for ${ASSET_NAME}; no runtime fallback is configured"
fi

ok "bri installed at ${TARGET}"
ensure_path_persisted
setup_daily_autoupdate
ok "run: bri --help"
