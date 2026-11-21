"""운영자(첫 사람용) 초대장을 만든다 — 아무도 가입하지 않은 상태에서 첫 팀원을 들이는 방법.
실행: D:\\Coding\\.venv\\Scripts\\python.exe scripts/make_invite.py [개수=1] [유효일=7]
링크의 도메인은 tnieping.com. 만든 초대장은 created_by=NULL(운영자)로 남는다."""
import os
import secrets
import sys
from pathlib import Path

import certifi
import pymysql

for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # api/invites.js 와 같은 글자 집합

db = pymysql.connect(host=os.environ["TIDB_HOST"], port=int(os.environ["TIDB_PORT"]), user=os.environ["TIDB_USER"],
                     password=os.environ["TIDB_PASSWORD"], database=os.environ["TIDB_DATABASE"],
                     ssl={"ca": certifi.where()}, connect_timeout=15)
with db.cursor() as cur:
    for _ in range(n):
        code = "".join(secrets.choice(ALPHA) for _ in range(12))
        cur.execute("INSERT INTO invites (code, created_by, expires_at) VALUES (%s, NULL, DATE_ADD(NOW(), INTERVAL %s DAY))", (code, days))
        print(f"https://tnieping.com/join?code={code}   ({days}일 안에, 한 번만)")
db.commit()
