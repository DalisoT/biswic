#!/usr/bin/env bash
set -e
cd /tmp
rm -f cookies.txt
CSRF=$(curl -s -c cookies.txt http://localhost:3001/api/auth/csrf | python -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
echo "CSRF=$CSRF"
echo "--- POST /api/auth/callback/credentials ---"
curl -s -b cookies.txt -c cookies.txt -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "serviceNumber=CHAIR-001" \
  --data-urlencode "password=ChangeMe123!" \
  --data-urlencode "redirect=false" \
  http://localhost:3001/api/auth/callback/credentials \
  -w "\nHTTP %{http_code}\n"
echo "--- GET /api/auth/session ---"
curl -s -b cookies.txt http://localhost:3001/api/auth/session -w "\nHTTP %{http_code}\n"
