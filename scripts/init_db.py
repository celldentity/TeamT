"""TeamT TiDB 에 표를 만든다(있으면 그대로). 실행: D:\\Coding\\.venv\\Scripts\\python.exe scripts/init_db.py"""
import os
from pathlib import Path

import certifi
import pymysql

for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

SQL = """
CREATE TABLE IF NOT EXISTS users (
  id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(190) NOT NULL,
  pw_hash    VARCHAR(255) NOT NULL,
  nickname   VARCHAR(80)  NOT NULL,
  photo_v    INT NOT NULL DEFAULT 0,          -- 0 = 사진 없음, 올릴 때마다 +1 (브라우저 캐시 갱신용)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) CHARACTER SET utf8mb4
"""

db = pymysql.connect(host=os.environ["TIDB_HOST"], port=int(os.environ["TIDB_PORT"]), user=os.environ["TIDB_USER"],
                     password=os.environ["TIDB_PASSWORD"], database=os.environ["TIDB_DATABASE"],
                     ssl={"ca": certifi.where()}, connect_timeout=15)
with db.cursor() as cur:
    cur.execute(SQL)
    cur.execute("SHOW TABLES")
    print("tables:", [r[0] for r in cur.fetchall()])
