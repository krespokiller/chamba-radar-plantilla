#!/usr/bin/env bash
# Rebuild every CV variant from cv/perfil.json and check each one fits on one Letter page.
# Needs python3, node with playwright (preinstalled in Claude sessions) and pdfinfo.
set -euo pipefail
cd "$(dirname "$0")"
out=${1:-out}; mkdir -p "$out"
python3 build.py 8.9 "$out" >/dev/null
name=$(python3 -c "import json;d=json.load(open('perfil.json',encoding='utf8'));print((d.get('short_name') or d['name']).replace(' ','_'))")
for html in "$out"/*.html; do
  k=$(basename "$html" .html)
  pdf="$out/${name}_CV_$k.pdf"
  node render.cjs "$html" "$pdf"
  pages=$(pdfinfo "$pdf" | awk '/Pages/ {print $2}')
  echo "$k: $pages page(s) -> $pdf"; [ "$pages" = 1 ] || { echo "  ⚠️ $k spills to $pages pages: shorten it"; exit 1; }
done
