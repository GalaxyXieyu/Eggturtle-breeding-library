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
FAIL_ON_RESERVED_DNS="${FAIL_ON_RESERVED_DNS:-false}"

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
    if status="$(curl -I -m "${DOMAIN_CHECK_TIMEOUT_SECONDS}" -sS -o /dev/null -w "%{http_code}" "https://${host}" 2>/dev/null)"; then
      if [[ "${status}" =~ ^2|^3 ]]; then
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
  local cert
  local san

  cert="$(
    echo | openssl s_client -showcerts -servername "${host}" -connect "${host}:443" 2>/dev/null \
      | sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' || true
  )"

  if [ -z "${cert}" ]; then
    log_error "No TLS certificate can be fetched from ${host}:443."
    return
  fi

  san="$(printf '%s\n' "${cert}" | openssl x509 -noout -ext subjectAltName 2>/dev/null || true)"
  if ! printf '%s\n' "${san}" | grep -q "DNS:${host}"; then
    log_error "TLS SAN does not include ${host}."
    return
  fi

  log_info "TLS SAN covers ${host}."
}

check_redirect() {
  local url="$1"
  local expected_prefix="$2"
  local name="$3"
  local headers
  local status
  local location

  headers="$(curl -I -m "${DOMAIN_CHECK_TIMEOUT_SECONDS}" -sS "${url}" 2>&1 || true)"
  if ! printf '%s\n' "${headers}" | grep -q '^HTTP/'; then
    log_error "${name}: request failed for ${url}. Output: ${headers}"
    return
  fi

  status="$(printf '%s\n' "${headers}" | awk '/^HTTP\// { print $2; exit }')"
  location="$(printf '%s\n' "${headers}" | awk -F': ' 'tolower($1)=="location"{print $2; exit}' | tr -d '\r')"

  if [ "${status}" != "${EXPECTED_REDIRECT_CODE}" ]; then
    log_error "${name}: expected ${EXPECTED_REDIRECT_CODE}, got ${status} for ${url}."
    return
  fi

  if [ -z "${location}" ] || [[ "${location}" != ${expected_prefix}* ]]; then
    log_error "${name}: unexpected Location for ${url}. got='${location}', expected_prefix='${expected_prefix}'."
    return
  fi

  log_info "${name}: ${url} -> ${location} (${status})"
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
