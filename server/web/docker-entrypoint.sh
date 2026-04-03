#!/bin/sh
set -e

USE_HTTPS="${REACT_APP_USE_HTTPS:-false}"

if [ "$USE_HTTPS" = "true" ]; then
  API_URL="${REACT_APP_API_URL_S:-https://localhost:4043/api}"
  RTC_URL="${REACT_APP_RTC_URL_S:-https://localhost:5051}"
else
  API_URL="${REACT_APP_API_URL:-http://localhost:4040/api}"
  RTC_URL="${REACT_APP_RTC_URL:-http://localhost:5050}"
fi

echo ""
echo "USE_HTTPS=$USE_HTTPS"
echo "API_URL=$API_URL"
echo "RTC_URL=$RTC_URL"
echo ""

find /usr/share/nginx/html -name "*.js" -type f | while read f; do
  sed -i \
    -e "s|__REACT_APP_API_URL__|$API_URL|g" \
    -e "s|__REACT_APP_RTC_URL__|$RTC_URL|g" \
    -e "s|__REACT_APP_API_URL_S__|$API_URL|g" \
    -e "s|__REACT_APP_RTC_URL_S__|$RTC_URL|g" \
    -e "s|__REACT_APP_USE_HTTPS__|$USE_HTTPS|g" \
    "$f"
done

echo "Done. Starting nginx..."
exec nginx -g "daemon off;"