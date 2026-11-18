"""TeamT TiDB 에 표를 만든다(있으면 그대로, 새 칸은 덧붙인다). 실행: D:\\Coding\\.venv\\Scripts\\python.exe scripts/init_db.py"""
import os
from pathlib import Path

import certifi
import pymysql

for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

CREATE = [
    """CREATE TABLE IF NOT EXISTS users (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email      VARCHAR(190) NOT NULL,
      pw_hash    VARCHAR(255) NOT NULL,
      nickname   VARCHAR(80)  NOT NULL,
      bio        VARCHAR(200) NOT NULL DEFAULT '',   -- 한 줄 소개(T조 소개 페이지에 보임)
      photo_v    INT NOT NULL DEFAULT 0,             -- 0 = 사진 없음, 올릴 때마다 +1 (브라우저 캐시 갱신용)
      invited_by BIGINT NULL,                        -- 초대한 사람 users.id, NULL = 운영자 초대장
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_email (email)
    ) CHARACTER SET utf8mb4""",
    """CREATE TABLE IF NOT EXISTS invites (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code       CHAR(12) NOT NULL,
      created_by BIGINT NULL,                        -- NULL = 운영자(scripts/make_invite.py)가 만든 첫 초대장
      used_by    BIGINT NULL,
      used_at    TIMESTAMP NULL,
      expires_at TIMESTAMP NOT NULL,
      revoked    TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_invites_code (code),
      KEY ix_invites_creator (created_by)
    ) CHARACTER SET utf8mb4""",
    # 아티클: author_id NULL = T조 AI 가 쓴 글, ai=1 이면 «AI 와 함께 썼어요» 표시
    """CREATE TABLE IF NOT EXISTS posts (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      author_id  BIGINT NULL,
      ai         TINYINT NOT NULL DEFAULT 0,
      category   VARCHAR(20)  NOT NULL,
      title      VARCHAR(120) NOT NULL,
      body       TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      KEY ix_posts_created (created_at),
      KEY ix_posts_author (author_id)
    ) CHARACTER SET utf8mb4""",
    # 댓글: parent_id NULL = 댓글, 값이 있으면 그 댓글의 답글(한 단계). 답글이 달린 댓글을 지우면 deleted=1 로 자리만 남긴다.
    """CREATE TABLE IF NOT EXISTS comments (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      post_id    BIGINT NOT NULL,
      parent_id  BIGINT NULL,
      author_id  BIGINT NOT NULL,
      body       VARCHAR(4000) NOT NULL,
      deleted    TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL,
      KEY ix_comments_post (post_id),
      KEY ix_comments_parent (parent_id)
    ) CHARACTER SET utf8mb4""",
    # 좋아요: 누가 언제 눌렀는지 남긴다(트래킹). target_type 'p' = 글, 'c' = 댓글
    """CREATE TABLE IF NOT EXISTS likes (
      target_type CHAR(1) NOT NULL,
      target_id   BIGINT NOT NULL,
      user_id     BIGINT NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (target_type, target_id, user_id),
      KEY ix_likes_user (user_id)
    ) CHARACTER SET utf8mb4""",
]
# 이미 만들어진 users 표에 새 칸 덧붙이기(있으면 1060 오류라 건너뜀)
ALTER = [
    "ALTER TABLE users ADD COLUMN bio VARCHAR(200) NOT NULL DEFAULT '' AFTER nickname",
    "ALTER TABLE users ADD COLUMN invited_by BIGINT NULL AFTER photo_v",
    "ALTER TABLE users ADD COLUMN cover_v INT NOT NULL DEFAULT 0 AFTER photo_v",   # 커버 사진(0 = 없음, 올릴 때마다 +1)
]

db = pymysql.connect(host=os.environ["TIDB_HOST"], port=int(os.environ["TIDB_PORT"]), user=os.environ["TIDB_USER"],
                     password=os.environ["TIDB_PASSWORD"], database=os.environ["TIDB_DATABASE"],
                     ssl={"ca": certifi.where()}, connect_timeout=15)
with db.cursor() as cur:
    for s in CREATE:
        cur.execute(s)
    for s in ALTER:
        try:
            cur.execute(s)
        except pymysql.err.OperationalError as e:
            if e.args[0] != 1060:
                raise
    for t in ("users", "invites", "posts", "comments", "likes"):
        cur.execute(f"SHOW COLUMNS FROM {t}")
        print(t, [r[0] for r in cur.fetchall()])
