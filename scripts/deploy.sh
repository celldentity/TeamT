#!/usr/bin/env bash
# 긴급용 수동 배포. 평소 배포는 `git push`(main) 한 번이면 Vercel 이 자동으로 한다.
# 이 PC 의 Vercel CLI 로그인은 전역 파일 하나이므로, 먼저 `vercel whoami` 가 ADMIN 인지 확인할 것.
# 실행: bash scripts/deploy.sh   (.git 없는 복사본에서 올린다 — 커밋 작성자 검사에 걸리지 않게)
set -euo pipefail
export PATH="/d/Coding/.tools/node:/d/Coding/.tools/npm-global:$PATH"
cd "$(dirname "$0")/.."
[ "$(vercel whoami 2>/dev/null | tail -1)" = "ADMIN" ] || { echo "vercel 로그인이 ADMIN 이 아니다 — 중단"; exit 1; }
D=/d/Coding/.cache/temp/teamt-deploy
rm -rf "$D"; mkdir -p "$D/.vercel"
cp -r *.html api assets vercel.json package.json package-lock.json "$D/"; cp .vercel/project.json "$D/.vercel/"
cd "$D"
timeout 240 vercel deploy --prod --yes --scope mn-t 2>&1 | grep -E 'Production|Error' | head -3
echo "대표 주소 https://t-niping.vercel.app 는 프로덕션 배포에 자동으로 붙는다"
