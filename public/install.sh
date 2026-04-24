#!/bin/bash
set -euo pipefail

GITHUB_REPO="${BRI_GITHUB_REPO:-egeuysall/bri}"
BIN_DIR="${BRI_INSTALL_DIR:-${HOME}/.local/bin}"
TARGET="${BIN_DIR}/bri"
SOURCE_ROOT="${BRI_SOURCE_ROOT:-${HOME}/.local/share/bri-cli}"
INSTALLER_URL="${BRI_INSTALLER_URL:-https://bri.egeuysal.com/install.sh}"
RELEASE_API_URL="${BRI_RELEASE_API_URL:-https://api.github.com/repos/${GITHUB_REPO}/releases/latest}"
RELEASE_TAG="${BRI_RELEASE_TAG:-}"

TMP_ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/bri-source.XXXXXX.tar.gz")"
TMP_JSON="$(mktemp "${TMPDIR:-/tmp}/bri-release.XXXXXX.json")"

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
  rm -f "${TMP_ARCHIVE}" "${TMP_JSON}"
}
trap cleanup EXIT

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

extract_json_string() {
  local json key compact
  json="$1"
  key="$2"
  compact="$(printf '%s' "${json}" | tr -d '\r\n')"
  printf '%s' "${compact}" | sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/p" | head -n1
}

resolve_release_tag() {
  local json tag

  if [ -n "${RELEASE_TAG}" ]; then
    printf '%s' "${RELEASE_TAG}"
    return 0
  fi

  json="$(fetch_text_url "${RELEASE_API_URL}" 2>/dev/null || true)"
  tag="$(extract_json_string "${json}" "tag_name")"

  if [ -z "${tag}" ]; then
    fail "failed to resolve latest release tag from ${RELEASE_API_URL}"
  fi

  printf '%s' "${tag}"
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

ensure_bun_runtime() {
  if command -v bun >/dev/null 2>&1; then
    return 0
  fi

  info "bun runtime not found, installing bun..."
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --retry-connrefused --silent --show-error https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"

  if command -v bun >/dev/null 2>&1; then
    ok "bun runtime installed"
    return 0
  fi

  fail "bun runtime installation failed"
}

setup_daily_reinstall() {
  local os marker cron_line current_cron filtered_cron uid launch_agents_dir plist_path
  local command_string

  os="$(uname -s)"
  command_string="curl -fsSL ${INSTALLER_URL} | bash"

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

    ok "configured daily background auto-update (launchd reinstall mode)"
    return 0
  fi

  if [ "${os}" = "Linux" ] && command -v crontab >/dev/null 2>&1; then
    marker="# bri-cli-auto-update"
    cron_line="17 4 * * * ${command_string} >/dev/null 2>&1 ${marker}"
    current_cron="$(crontab -l 2>/dev/null || true)"
    filtered_cron="$(printf '%s\n' "${current_cron}" | grep -v "${marker}" || true)"

    {
      printf '%s\n' "${filtered_cron}"
      printf '%s\n' "${cron_line}"
    } | awk 'NF > 0' | crontab -

    ok "configured daily background auto-update (cron reinstall mode)"
    return 0
  fi

  warn "background auto-update scheduler unavailable on this platform"
}

write_wrapper() {
  local source_dir
  source_dir="$1"

  cat >"${TARGET}" <<EOF2
#!/bin/bash
set -euo pipefail
if command -v bun >/dev/null 2>&1; then
  exec bun "${source_dir}/cli/bri.ts" "\$@"
fi
if [ -x "\${HOME}/.bun/bin/bun" ]; then
  exec "\${HOME}/.bun/bin/bun" "${source_dir}/cli/bri.ts" "\$@"
fi
echo "[error] bun runtime not found; rerun installer" >&2
exit 1
EOF2

  chmod 755 "${TARGET}"
}

install_from_source() {
  local tag source_url archive_root extracted_dir current_dir

  ensure_bun_runtime

  tag="$(resolve_release_tag)"
  source_url="https://github.com/${GITHUB_REPO}/archive/refs/tags/${tag}.tar.gz"

  info "resolved release tag: ${tag}"
  info "downloading source bundle ${tag} from ${GITHUB_REPO}..."
  download_to_file "${source_url}" "${TMP_ARCHIVE}"

  mkdir -p "${SOURCE_ROOT}"

  archive_root="$(tar -tzf "${TMP_ARCHIVE}" | head -n1 | cut -d'/' -f1)"
  if [ -z "${archive_root}" ]; then
    fail "failed to inspect source archive root"
  fi

  rm -rf "${SOURCE_ROOT:?}/${archive_root}"
  tar -xzf "${TMP_ARCHIVE}" -C "${SOURCE_ROOT}"

  extracted_dir="${SOURCE_ROOT}/${archive_root}"
  current_dir="${SOURCE_ROOT}/current"

  info "installing source dependencies with bun..."
  (
    cd "${extracted_dir}"
    bun install --frozen-lockfile --ignore-scripts
  )

  rm -rf "${current_dir}"
  mv "${extracted_dir}" "${current_dir}"

  write_wrapper "${current_dir}"
}

require_cmd curl
require_cmd tar
mkdir -p "${BIN_DIR}"

install_from_source

ok "installed bun runtime wrapper at ${TARGET}"
ensure_path_persisted
setup_daily_reinstall
ok "run: bri --help"
