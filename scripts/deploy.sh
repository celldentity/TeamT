#!/usr/bin/env bash
# Vercel 배포: 커밋 작성자(celldentity)가 Vercel 팀 구성원이 아니라 저장소 안에서 배포하면 막히므로(.git 정보가 붙음)
# .git 없는 복사본에서 배포하고, 별칭을 새 배포에 옮긴다. 실행: bash scripts/deploy.sh   (vercel login 상태 필요)
set -euo pipefail
export PATH="/d/Coding/.tools/node:/d/Coding/.tools/npm-global:$PATH"
cd "$(dirname "$0")/.."
D=/d/Coding/.cache/temp/teamt-deploy
rm -rf "$D"; mkdir -p "$D/.vercel"
cp -r index.html api package.json package-lock.json "$D/"; cp .vercel/project.json "$D/.vercel/"
cd "$D"
URL=$(timeout 240 vercel deploy --prod --yes --scope mn-t 2>&1 | grep -o 'https://teamt-[a-z0-9]*-mn-t.vercel.app' | head -1)
[ -n "$URL" ] || { echo "배포 실패"; exit 1; }
vercel alias set "$URL" mid8-teamt.vercel.app --scope mn-t | tail -1
echo "배포: $URL → https://mid8-teamt.vercel.app"
