// 시스템 알림(운영자 한 사람 전용) — 지금은 «도메인 만료 임박» 하나뿐. 파일명이 _ 로 시작해 라우트로 노출되지 않는다.
// 도메인 tnieping.com 은 1년짜리(Hostinger, 만료 2027-11-19)라서, 만료 «한 달 전»(달력 기준 — 2027-10-19)부터 만료일까지 매일 한 번 알려 준다:
//   ① 앱 안 알림(알림 페이지·상단 종 숫자) — 표 notices 에 하루 한 줄(user_id, kind, day 가 유일 → 같은 날 여러 번 불려도 한 번만)
//   ② 폰 푸시(알림을 켠 기기가 있으면) — 앱 아이콘 숫자도 같이 오른다
// 받는 사람은 환경변수 DOMAIN_NOTICE_EMAIL 의 이메일(그 이메일로 가입한 팀원). 코드·저장소에 이메일을 두지 않는다.
// 갱신해서 만료일이 바뀌면 환경변수 DOMAIN_EXPIRES(YYYY-MM-DD)를 고치거나 아래 기본값을 고칠 것.
const DOMAIN = "tnieping.com", EXPIRES_DEFAULT = "2027-11-19";

const kstDay = (t = Date.now()) => new Date(t + 9 * 36e5).toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5);
const monthBefore = (d) => { const t = new Date(d + "T00:00:00Z"); t.setUTCMonth(t.getUTCMonth() - 1); return t.toISOString().slice(0, 10); };   // 만료일의 한 달 전 같은 날
const kr = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${y}년 ${m}월 ${dd}일`; };

function text(left, expires) {
  const title = left === 0 ? `오늘 도메인이 만료돼요` : `도메인 만료 ${left}일 전`;
  const body = left === 0 ? `${DOMAIN} 이 오늘(${kr(expires)}) 만료돼요. 지금 Hostinger 에서 갱신해 주세요.` : `${DOMAIN} 이 ${kr(expires)}에 만료돼요. Hostinger 에서 갱신해 주세요.`;
  return { title, body };
}

// today: 시험용으로 날짜를 넣을 수 있다(기본 = 한국 시각의 오늘). push:false 면 푸시는 보내지 않는다(시험용).
async function domainExpiry(db, { today = kstDay(), push = true } = {}) {
  const email = String(process.env.DOMAIN_NOTICE_EMAIL || "").trim().toLowerCase();
  if (!email) return { skip: "받을 사람(DOMAIN_NOTICE_EMAIL)이 정해지지 않았어요" };
  const expires = process.env.DOMAIN_EXPIRES || EXPIRES_DEFAULT, left = days(expires, today), from = days(expires, monthBefore(expires));
  if (left > from || left < 0) return { skip: `알릴 기간이 아니에요(만료까지 ${left}일)`, left };
  const [[u]] = await db.query("SELECT id FROM users WHERE LOWER(email) = ?", [email]);
  if (!u) return { skip: "그 이메일로 가입한 팀원이 없어요", left };
  const t = text(left, expires);
  const [r] = await db.query("INSERT IGNORE INTO notices (user_id, kind, day, title, body) VALUES (?, 'domain', ?, ?, ?)", [u.id, today, t.title, t.body]);
  if (!r.affectedRows) return { left, made: false };   // 오늘 건 이미 만들었다
  let sent;
  if (push) sent = await require("./_push").notify([u.id], () => ({ title: t.title, body: t.body, url: "/notifications", tag: "domain-expiry", badge: "auto" }));
  return { left, made: true, push: sent };
}

module.exports = { domainExpiry, text, kstDay, days, monthBefore, DOMAIN };
