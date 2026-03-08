#!/usr/bin/env bash
set -euo pipefail

PUBLIC_CANONICAL_HOST="${PUBLIC_CANONICAL_HOST:-}"
PUBLIC_ALT_HOST="${PUBLIC_ALT_HOST:-}"
DOMAIN_CHECK_RETRIES="${DOMAIN_CHECK_RETRIES:-20}"
DOMAIN_CHECK_TIMEOUT_SECONDS="${DOMAIN_CHECK_TIMEOUT_SECONDS:-8}"
DOMAIN_MIN_SUCCESS_RATE="${DOMAIN_MIN_SUCCESS_RATE:-0.95}"
REQUIRE_HTTP_TO_HTTPS="${REQUIRE_HTTP_TO_HTTPS:-true}"
REQUIRE_ALT_TO_CANONICAL="${REQUIRE_ALT_TO_CANONICAL:-true}"
EXPECTED_REDIRECT_CODE="${EXPECTED_REDIRECT_CODE:-301}"
EXPECTED_REDIRECT_CODES="${EXPECTED_REDIRECT_CODES:-${EXPECTED_REDIRECT_CODE}}"
FAIL_ON_RESERVED_DNS="${FAIL_ON_RESERVED_DNS:-false}"
HTTPS_REQUEST_RETRIES="${HTTPS_REQUEST_RETRIES:-5}"
TLS_SAN_CHECK_RETRIES="${TLS_SAN_CHECK_RETRIES:-5}"
REDIRECT_CHECK_RETRIES="${REDIRECT_CHECK_RETRIES:-5}"

if [ -z "${PUBLIC_CANONICAL_HOST}" ]; then
  echo "::error::PUBLIC_CANONICAL_HOST is required."
  exit 1
fi

FAILURES=0

log_info() {
  echo "[info] $*"
}

log_warn() {
  echo "::warning::$*"
}

log_error() {
  echo "::error::$*"
  FAILURES=$((FAILURES + 1))
}

check_dns_risk() {
  local host="$1"
  local records
  records="$(dig +short A "${host}" | tr -d '\r' | sed '/^$/d' || true)"
  if [ -z "${records}" ]; then
    log_error "No A record found for ${host}."
    return
  fi

  log_info "A records for ${host}:"
  printf '%s\n' "${records}" | sed 's/^/  - /'

  while IFS= read -r ip; do
    if [[ "${ip}" =~ ^198\.(18|19)\. ]]; then
      if [ "${FAIL_ON_RESERVED_DNS}" = "true" ]; then
        log_error "${host} resolves to reserved benchmarking range ${ip} (RFC 2544)."
      else
        log_warn "${host} resolves to reserved benchmarking range ${ip} (RFC 2544). Confirm with CDN/cloud provider this is intentional."
      fi
    fi
  done <<< "${records}"
}

check_https_stability() {
  local host="$1"
  local ok=0
  local fail=0
  local i
  local status

  for i in $(seq 1 "${DOMAIN_CHECK_RETRIES}"); do
    if status="$(curl -I -m "${DOMAIN_CHECK_TIMEOUT_SECONDS}" --retry "${HTTPS_REQUEST_RETRIES}" --retry-all-errors -sS -o /dev/null -w "%{http_code}" "https://${host}" 2>/dev/null)"; then
      if [[ "${status}" =~ ^[23] ]]; then
        ok=$((ok + 1))
      else
        fail=$((fail + 1))
      fi
    else
      fail=$((fail + 1))
    fi
  done

  local rate
  rate="$(awk -v o="${ok}" -v t="${DOMAIN_CHECK_RETRIES}" 'BEGIN { if (t==0) { print "0.00" } else { printf "%.2f", o/t } }')"
  log_info "HTTPS stability for ${host}: ok=${ok} fail=${fail} success_rate=${rate}"

  if ! awk -v r="${rate}" -v m="${DOMAIN_MIN_SUCCESS_RATE}" 'BEGIN { exit !(r >= m) }'; then
    log_error "HTTPS stability below threshold for ${host} (rate=${rate}, min=${DOMAIN_MIN_SUCCESS_RATE})."
  fi
}

check_tls_san() {
  local host="$1"
  local cert=""
  local san=""
  local attempt=1

  while [ "${attempt}" -le "${TLS_SAN_CHECK_RETRIES}" ]; do
    cert="$(
      echo | openssl s_client -showcerts -servername "${host}" -connect "${host}:443" 2>/dev/null \
        | sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' || true
    )"

    if [ -n "${cert}" ]; then
      san="$(printf '%s\n' "${cert}" | openssl x509 -noout -ext subjectAltName 2>/dev/null || true)"
      if printf '%s\n' "${san}" | grep -q "DNS:${host}"; then
        if [ "${attempt}" -gt 1 ]; then
          log_warn "TLS SAN check for ${host} passed after retry ${attempt}/${TLS_SAN_CHECK_RETRIES}."
        else
          log_info "TLS SAN covers ${host}."
        fi
        return
      fi
    fi

    attempt=$((attempt + 1))
  done

  if [ -z "${cert}" ]; then
    log_error "No TLS certificate can be fetched from ${host}:443 after ${TLS_SAN_CHECK_RETRIES} retries."
    return
  fi

  log_error "TLS SAN does not include ${host}."
}

check_redirect() {
  local url="$1"
  local expected_prefix="$2"
  local name="$3"
  local headers
  local status=""
  local location=""
  local matched_code=false
  local codes_csv
  local code
  local expected_codes=()
  local redirect_codes_ifs=','
  local attempt=1

  codes_csv="${EXPECTED_REDIRECT_CODES// /}"

  while [ "${attempt}" -le "${REDIRECT_CHECK_RETRIES}" ]; do
    headers="$(curl -I -m "${DOMAIN_CHECK_TIMEOUT_SECONDS}" --retry "${HTTPS_REQUEST_RETRIES}" --retry-all-errors -sS "${url}" 2>&1 || true)"
    if ! printf '%s\n' "${headers}" | grep -q '^HTTP/'; then
      attempt=$((attempt + 1))
      continue
    fi

    status="$(printf '%s\n' "${headers}" | awk '/^HTTP\// { print $2; exit }')"
    location="$(printf '%s\n' "${headers}" | awk -F': ' 'tolower($1)=="location"{print $2; exit}' | tr -d '\r')"

    matched_code=false
    IFS="${redirect_codes_ifs}" read -r -a expected_codes <<< "${codes_csv}"
    for code in "${expected_codes[@]}"; do
      if [ "${status}" = "${code}" ]; then
        matched_code=true
        break
      fi
    done

    if [ "${matched_code}" = true ] && [ -n "${location}" ] && [[ "${location}" == ${expected_prefix}* ]]; then
      if [ "${attempt}" -gt 1 ]; then
        log_warn "${name}: passed after retry ${attempt}/${REDIRECT_CHECK_RETRIES}."
      fi
      log_info "${name}: ${url} -> ${location} (${status})"
      return
    fi

    attempt=$((attempt + 1))
  done

  if [ "${matched_code}" != true ]; then
    log_error "${name}: expected status in [${EXPECTED_REDIRECT_CODES}], got ${status:-<none>} for ${url}."
    return
  fi

  log_error "${name}: unexpected Location for ${url}. got='${location}', expected_prefix='${expected_prefix}'."
}

log_info "Starting domain hardening check"
log_info "canonical=${PUBLIC_CANONICAL_HOST} alt=${PUBLIC_ALT_HOST:-<empty>}"

check_dns_risk "${PUBLIC_CANONICAL_HOST}"
check_https_stability "${PUBLIC_CANONICAL_HOST}"
check_tls_san "${PUBLIC_CANONICAL_HOST}"

if [ "${REQUIRE_HTTP_TO_HTTPS}" = "true" ]; then
  check_redirect "http://${PUBLIC_CANONICAL_HOST}" "https://${PUBLIC_CANONICAL_HOST}" "http-to-https"
fi

if [ -n "${PUBLIC_ALT_HOST}" ] && [ "${REQUIRE_ALT_TO_CANONICAL}" = "true" ]; then
  check_dns_risk "${PUBLIC_ALT_HOST}"
  check_tls_san "${PUBLIC_ALT_HOST}"
  check_redirect "https://${PUBLIC_ALT_HOST}" "https://${PUBLIC_CANONICAL_HOST}" "alt-to-canonical"
fi

if [ "${FAILURES}" -gt 0 ]; then
  log_error "Domain hardening check failed with ${FAILURES} issue(s)."
  exit 1
fi

log_info "Domain hardening check passed."
