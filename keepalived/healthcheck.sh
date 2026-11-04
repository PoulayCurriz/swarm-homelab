#!/bin/bash
set -e
PING_HOSTNAME="traefik.home.arpa"

function do_ping() {
    local endpoint_hostname="$1"
    curl -k -s -o /dev/null -w "%{http_code}" --resolve "$endpoint_hostname:443:127.0.0.1" "https://$endpoint_hostname/ping"
}

test "$(do_ping "$PING_HOSTNAME")" = "404"