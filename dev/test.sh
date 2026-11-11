#!/usr/bin/env bash
# Alle Tests von Sabrly: Bau, Widget (Scriptable-Nachbau), Garmin-Logik, Web-App im Browser.
# Aufruf: bash dev/test.sh   (von überall). Ergebnis am Ende: "ALLES GRÜN" oder "FEHLER".
set -u
cd "$(dirname "$0")"
PORT="${PORT:-8766}"; fail=0
echo "== Bau (dev/src → index.html)"
python3 build.py >/dev/null || { echo "Bau fehlgeschlagen"; fail=1; }
if git -C .. diff --quiet -- index.html; then echo "index.html unverändert"; else echo "index.html neu gebaut (geändert)"; fi
echo "== Widget"
out=$(node tests/widget/run.js ../widget/sabrly-widget.js ../widget/loader.js 2>&1); echo "$out" | grep -E '^FAIL' ; echo "$out" | tail -1
echo "$out" | tail -1 | grep -q ' FAIL 0$' || fail=1
echo "== Garmin-Logik"
if node -e "require.resolve('@garmin/fitsdk'); require.resolve('fflate')" 2>/dev/null || [ -d node_modules/@garmin/fitsdk ]; then
  for t in detect_test.mjs pace_test.mjs fit_test.mjs; do (cd tests/garmin && node "$t" > /tmp/sabrly_$t.out 2>&1); r=$?; grep -E '^FAIL' /tmp/sabrly_$t.out; echo "$t: $(tail -1 /tmp/sabrly_$t.out)"; [ $r -eq 0 ] || fail=1; done
else echo "übersprungen: erst 'npm install' in dev/ ausführen"; fail=1; fi
echo "== Web-App (Browser)"
if node -e "require('playwright')" 2>/dev/null; then
  python3 tests/web/build_harness.py >/dev/null
  (cd tests/web && exec python3 -m http.server "$PORT" >/dev/null 2>&1) & srv=$!; sleep 1
  out=$(PORT="$PORT" node tests/web/runweb.js 2>&1); kill $srv 2>/dev/null
  echo "$out" | grep -E 'FAIL [^0]|^ +FAIL|TIMEOUT|pageerrors' ; echo "$out" | tail -1
  echo "$out" | tail -1 | grep -q ' FAIL 0$' || fail=1
else echo "übersprungen: Playwright fehlt ('npm install' in dev/, dann 'npx playwright install chromium')"; fail=1; fi
[ $fail -eq 0 ] && echo "ALLES GRÜN" || echo "FEHLER – siehe oben"
exit $fail
