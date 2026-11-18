"""TeamT 전용 TiDB·R2 연결 점검. 실행: D:\\Coding\\.venv\\Scripts\\python.exe scripts/check_connections.py
.env 를 읽어 (1) TiDB 에 붙어 teamt DB 를 보장하고 (2) R2 버킷에 쓰기·읽기·삭제를 한 번 해 본다."""
import os
from pathlib import Path

import boto3
import certifi
import pymysql

for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

db = pymysql.connect(host=os.environ["TIDB_HOST"], port=int(os.environ["TIDB_PORT"]),
                     user=os.environ["TIDB_USER"], password=os.environ["TIDB_PASSWORD"],
                     ssl={"ca": certifi.where()}, connect_timeout=15)
with db.cursor() as cur:
    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{os.environ['TIDB_DATABASE']}` CHARACTER SET utf8mb4")
    cur.execute("SELECT VERSION()")
    print("TiDB OK:", cur.fetchone()[0], "| host:", os.environ["TIDB_HOST"])

s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"], region_name="auto",
                  aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                  aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
b, key = os.environ["R2_BUCKET"], "_healthcheck.txt"
s3.put_object(Bucket=b, Key=key, Body=b"ok")
assert s3.get_object(Bucket=b, Key=key)["Body"].read() == b"ok"
s3.delete_object(Bucket=b, Key=key)
print("R2 OK: bucket", b, "(put/get/delete)")
