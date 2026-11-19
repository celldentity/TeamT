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
    # 회의록(비공개 페이지 /minutes): 요약·시간대별 이야기·전사 본문을 JSON 글자로 담는다. 내용은 저장소에 없고 DB 에만 있다(scripts/add_meeting.js 로 넣는다).
    """CREATE TABLE IF NOT EXISTS meetings (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title      VARCHAR(120) NOT NULL,
      held_at    DATETIME NOT NULL,            -- 시작 시각(UTC)
      duration_s INT NOT NULL,
      summary    MEDIUMTEXT NOT NULL,          -- JSON: 한눈에·결정·할 일·시간대별·발언 비중 …
      transcript LONGTEXT NOT NULL,            -- JSON: [{s, e, sp, t}]  (초, 초, 발언자 이름, 글)
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_meetings_held (held_at)
    ) CHARACTER SET utf8mb4""",
    # 폰 푸시 알림 구독(브라우저·기기마다 하나). endpoint 는 길어서 해시로 중복을 막는다.
    """CREATE TABLE IF NOT EXISTS push_subs (
      id            BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id       BIGINT NOT NULL,
      endpoint      VARCHAR(1000) NOT NULL,
      endpoint_hash CHAR(64) NOT NULL,
      p256dh        VARCHAR(200) NOT NULL,
      auth          VARCHAR(100) NOT NULL,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_push_endpoint (endpoint_hash),
      KEY ix_push_user (user_id)
    ) CHARACTER SET utf8mb4""",
    # 글에 붙은 사진·동영상. 파일은 R2 media/<id>/full(원본 크기로 줄인 사진 또는 동영상)·media/<id>/thumb.jpg(목록 썸네일)에 있다.
    # post_id NULL = 글쓰기 중 올려 둔 것(아직 글에 안 붙음, status 0 = 올리는 중). 하루가 지나도 안 붙으면 올린 사람이 다음에 올릴 때 지운다.
    """CREATE TABLE IF NOT EXISTS post_media (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      post_id    BIGINT NULL,
      owner_id   BIGINT NOT NULL,
      kind       VARCHAR(5) NOT NULL,
      mime       VARCHAR(40) NOT NULL,
      size       BIGINT NOT NULL,
      has_thumb  TINYINT NOT NULL DEFAULT 0,
      w          INT NOT NULL DEFAULT 0,
      h          INT NOT NULL DEFAULT 0,
      pos        INT NOT NULL DEFAULT 0,
      status     TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_media_post (post_id, pos),
      KEY ix_media_owner (owner_id, status, created_at)
    ) CHARACTER SET utf8mb4""",
    # 예약 질문: 어느 날 누구에게 어떤 질문을 올릴지 미리 정해 둔다(있으면 아침 크론이 이것을 쓰고, 없으면 자동으로 뽑는다)
    """CREATE TABLE IF NOT EXISTS daily_plan (
      qdate      DATE NOT NULL PRIMARY KEY,
      target_id  BIGINT NOT NULL,
      category   VARCHAR(20)  NOT NULL,
      title      VARCHAR(120) NOT NULL,
      body       TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4""",
    # 크론 실행 기록: Vercel 이 정말 부르고 있는지 확인용(2주 뒤 자동 정리)
    """CREATE TABLE IF NOT EXISTS cron_runs (
      id     BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      job    VARCHAR(10) NOT NULL,
      ran_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note   VARCHAR(300) NOT NULL DEFAULT '',
      KEY ix_cron_ran (ran_at)
    ) CHARACTER SET utf8mb4""",
    # 자료실(/library): 유튜브·인스타그램·스레드 링크 카드. 같은 게시물은 한 번만(platform+ext_id 유니크), 미리보기 이미지는 R2 library/<id>.jpg
    """CREATE TABLE IF NOT EXISTS library (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id    BIGINT NOT NULL,
      platform   VARCHAR(12)  NOT NULL,
      ext_id     VARCHAR(40)  NOT NULL,
      url        VARCHAR(400) NOT NULL,
      title      VARCHAR(300) NOT NULL DEFAULT '',
      author     VARCHAR(120) NOT NULL DEFAULT '',
      has_thumb  TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_library (platform, ext_id),
      KEY ix_library_created (created_at)
    ) CHARACTER SET utf8mb4""",
    # HR 일력(홈): 그날(한국 날짜) 한 장. 처음 요청될 때 만들고(Claude 또는 문구 은행) 같은 날은 한 장만
    """CREATE TABLE IF NOT EXISTS daily_cards (
      qdate      DATE NOT NULL PRIMARY KEY,
      category   VARCHAR(8)   NOT NULL,
      quote      VARCHAR(200) NOT NULL,
      note       VARCHAR(600) NOT NULL,
      question   VARCHAR(200) NOT NULL,
      source     VARCHAR(8)   NOT NULL DEFAULT 'bank',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4""",
    # AI 도우미(/ai) 사용 기록: 하루 질문 수 제한용(30일이 지나면 자동 정리)
    """CREATE TABLE IF NOT EXISTS ai_usage (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id    BIGINT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY ix_ai_usage (user_id, created_at)
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
    # 포인트(2026-11-19): 한 줄 = 한 번의 적립. kind = daily(오늘의 질문 답변) | w_join·w_top·w_key(주간 토론 참여·댓글 최다·핵심 역할). 같은 일로 두 번 받지 않게 유니크.
    # yr = 받은 해(한국 시각) — 해가 바뀌면 «올해 포인트»는 새로 시작하고 옛 줄은 누적 기록으로 남는다. 규칙은 api/_points.js
    """CREATE TABLE IF NOT EXISTS points (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id    BIGINT NOT NULL,
      kind       VARCHAR(8) NOT NULL,
      post_id    BIGINT NOT NULL,
      comment_id BIGINT NULL,
      pts        INT NOT NULL,
      yr         SMALLINT NOT NULL,
      note       VARCHAR(200) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_points (user_id, kind, post_id),
      KEY ix_points_year (yr, user_id),
      KEY ix_points_comment (comment_id)
    ) CHARACTER SET utf8mb4""",
    # HR 용어 사전(2026-11-19): 법령 확인을 통과한 용어(status VERIFIED)만 화면에 나간다. 내용은 scripts/load_glossary.js 가 terms.json 에서 넣는다(원문 아닌 우리 문장).
    # alias_norm = 검색용 정규화(api/_gl.js norm) — 전체에서 유일해야 한다(같은 별칭이 두 용어를 가리키면 적재가 멈춘다).
    """CREATE TABLE IF NOT EXISTS gl_term (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      slug       VARCHAR(80) NOT NULL,
      name       VARCHAR(80) NOT NULL,
      abbr       VARCHAR(30) NULL,
      en         VARCHAR(100) NULL,
      category   VARCHAR(20) NOT NULL,
      summary    VARCHAR(200) NOT NULL,
      body       TEXT NOT NULL,
      needs_law  TINYINT NOT NULL DEFAULT 0,
      status     VARCHAR(10) NOT NULL DEFAULT 'DRAFT',   -- DRAFT | VERIFIED | REJECTED
      check_note VARCHAR(500) NOT NULL DEFAULT '',        -- 탈락·보류 사유, 확인 메모(화면에 안 나감)
      checked_on DATE NULL,                               -- 법령을 마지막으로 확인한 날
      version    VARCHAR(10) NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_gl_slug (slug),
      KEY ix_gl_status (status, category)
    ) CHARACTER SET utf8mb4""",
    """CREATE TABLE IF NOT EXISTS gl_alias (
      term_id    BIGINT NOT NULL,
      alias      VARCHAR(80) NOT NULL,
      alias_norm VARCHAR(80) NOT NULL,
      PRIMARY KEY (term_id, alias_norm),
      UNIQUE KEY uq_gl_alias (alias_norm)
    ) CHARACTER SET utf8mb4""",
    """CREATE TABLE IF NOT EXISTS gl_link (
      term_id  BIGINT NOT NULL,
      other_id BIGINT NOT NULL,
      diff     VARCHAR(200) NOT NULL,                    -- «헷갈리는 짝» 의 한 문장 차이
      PRIMARY KEY (term_id, other_id)
    ) CHARACTER SET utf8mb4""",
    """CREATE TABLE IF NOT EXISTS gl_law (
      id          BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      term_id     BIGINT NOT NULL,
      seq         SMALLINT NOT NULL,
      law_name    VARCHAR(80) NOT NULL,
      article     VARCHAR(80) NOT NULL,
      url         VARCHAR(600) NOT NULL,
      effective   VARCHAR(20) NOT NULL DEFAULT '',        -- 시행일
      verified_on DATE NULL,
      KEY ix_gl_law_term (term_id)
    ) CHARACTER SET utf8mb4""",
    # 변하는 숫자(보험료율·한도·일수)는 정의 문장이 아니라 여기 — 기간(valid_from~valid_to)과 근거 법령(law_seq)이 같이 간다.
    """CREATE TABLE IF NOT EXISTS gl_figure (
      id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      term_id    BIGINT NOT NULL,
      label      VARCHAR(80) NOT NULL,
      value      VARCHAR(60) NOT NULL,
      unit       VARCHAR(20) NOT NULL DEFAULT '',
      valid_from DATE NOT NULL,
      valid_to   DATE NULL,
      law_seq    SMALLINT NULL,
      KEY ix_gl_fig_term (term_id)
    ) CHARACTER SET utf8mb4""",
]
# 이미 만들어진 users 표에 새 칸 덧붙이기(있으면 1060 오류라 건너뜀)
ALTER = [
    "ALTER TABLE users ADD COLUMN bio VARCHAR(200) NOT NULL DEFAULT '' AFTER nickname",
    "ALTER TABLE users ADD COLUMN invited_by BIGINT NULL AFTER photo_v",
    "ALTER TABLE users ADD COLUMN cover_v INT NOT NULL DEFAULT 0 AFTER photo_v",   # 커버 사진(0 = 없음, 올릴 때마다 +1)
    "ALTER TABLE users ADD COLUMN notif_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",   # 알림을 마지막으로 확인한 시각(이후 생긴 것이 «새 알림»)
    "ALTER TABLE post_media ADD COLUMN comment_id BIGINT NULL AFTER post_id",   # 댓글에 붙인 사진·동영상(글에 붙은 것은 post_id, 둘 다 NULL = 올려 두기만 한 것)
    "ALTER TABLE post_media ADD KEY ix_media_comment (comment_id)",
    "ALTER TABLE users ADD COLUMN presenter TINYINT NOT NULL DEFAULT 0",   # 1 = 발표 버튼이 보이는 사람. 칸을 처음 만들 때 «그때 가입해 있던 사람 전원» 만 1 로 하고(아래), 이후 가입자는 0
    # 오늘의 질문·주간 토론: posts.kind = post(일반)|daily(오늘의 질문)|weekly(이번 주 토론)|digest(AI가 정리한 아티클)
    "ALTER TABLE posts ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'post'",
    "ALTER TABLE posts ADD COLUMN target_id BIGINT NULL",              # daily: 오늘 지목된 사람
    "ALTER TABLE posts ADD COLUMN qdate DATE NULL",                    # daily: 그날 / weekly: 그 주 월요일 (같은 날 두 번 만들지 않게 아래 유니크 키)
    "ALTER TABLE posts ADD COLUMN goal INT NOT NULL DEFAULT 0",        # weekly: 진척도 100% 가 되는 댓글 수
    "ALTER TABLE posts ADD COLUMN stage VARCHAR(10) NOT NULL DEFAULT ''",   # weekly: open → review(AI 가 요약·반문) → done
    "ALTER TABLE posts ADD COLUMN ai_round TINYINT NOT NULL DEFAULT 0",     # weekly: AI 가 이미 던진 반문 차례 수
    "ALTER TABLE posts ADD COLUMN ai_at TIMESTAMP NULL",               # weekly: AI 가 마지막으로 댓글 단 시각(이후 댓글 수를 센다)
    "ALTER TABLE posts ADD COLUMN ai_try_at TIMESTAMP NULL",           # weekly: AI 호출을 마지막으로 시도한 시각(실패해도 30분은 다시 안 부른다)
    "ALTER TABLE posts ADD COLUMN ref_post_id BIGINT NULL",            # weekly ↔ digest 서로 가리킴
    "ALTER TABLE posts ADD UNIQUE KEY uq_posts_kind_date (kind, qdate)",
    "ALTER TABLE comments MODIFY author_id BIGINT NULL",
    # 저장 요청 중복 방지(2026-11-19): 브라우저가 «먼저 보여 주고 뒤에서 저장»(assets/outbox.js)하다가 같은 요청을 다시 보내도 글·댓글이 하나만 생기게 하는 클라이언트 키
    "ALTER TABLE posts ADD COLUMN client_id VARCHAR(24) NULL",
    "ALTER TABLE posts ADD UNIQUE KEY uq_posts_client (author_id, client_id)",
    "ALTER TABLE comments ADD COLUMN client_id VARCHAR(24) NULL",
    "ALTER TABLE comments ADD UNIQUE KEY uq_comments_client (author_id, client_id)",               # NULL = T조 AI 가 단 댓글
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
            if "presenter" in s:   # 칸이 방금 처음 만들어졌을 때만 — 지금 가입한 사람 전원이 발표자
                cur.execute("UPDATE users SET presenter = 1")
                db.commit()
        except pymysql.err.OperationalError as e:
            if e.args[0] not in (1060, 1061):
                raise
    for t in ("users", "invites", "posts", "comments", "likes", "post_media", "meetings", "library"):
        cur.execute(f"SHOW COLUMNS FROM {t}")
        print(t, [r[0] for r in cur.fetchall()])
