// POST /api/auth?a=enter|signup|login|logout   (JSON 만 받는다)
//   enter  : 한 번에 들어가기 — 이미 가입한 이메일이면 로그인, 처음이면 초대장으로 가입(code·nickname 필요)
//   signup : 초대장 코드로 가입만 / login : 로그인만 (enter 가 둘을 합친 것)
const L = require("./_lib");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUMMY = "s1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64"); // 없는 이메일도 같은 시간이 걸리게
const BAD_LOGIN = "이메일 또는 비밀번호가 맞지 않아요. 처음이라면 ‘처음이에요’를 눌러 초대장 코드와 닉네임을 적어 주세요.";

const checkFields = (email, password, nickname) =>
  !EMAIL.test(email) || email.length > 190 ? "이메일 형식을 확인해 주세요."
  : password.length < 8 || password.length > 100 ? "비밀번호는 8자 이상으로 정해 주세요."
  : L.len(nickname) < 2 || L.len(nickname) > 20 ? "닉네임은 2~20자로 정해 주세요." : null;

// 초대장 확인·사용 처리와 가입을 한 트랜잭션으로 묶는다 — 같은 초대장으로 두 명이 가입할 수 없다.
// 반환: {user} 성공 | {error, status}
async function signup(req, res, { email, password, nickname, code }) {
  const pwHash = await L.hashPw(password); // 오래 걸리는 계산은 트랜잭션 밖에서
  const conn = await L.db().getConnection();
  try {
    await conn.beginTransaction();
    const [inv] = await conn.query("SELECT id, created_by FROM invites WHERE code = ? AND used_by IS NULL AND revoked = 0 AND expires_at > NOW() FOR UPDATE", [code]);
    if (!inv[0]) { await conn.rollback(); return { status: 403, error: "사용할 수 없는 초대장이에요. 이미 쓰였거나 기한이 지났을 수 있어요." }; }
    const [r] = await conn.query("INSERT INTO users (email, pw_hash, nickname, invited_by) VALUES (?, ?, ?, ?)", [email, pwHash, nickname, inv[0].created_by]);
    await conn.query("UPDATE invites SET used_by = ?, used_at = NOW() WHERE id = ?", [r.insertId, inv[0].id]);
    await conn.commit();
    L.setSession(req, res, r.insertId);
    return { user: { id: r.insertId, email, nickname, bio: "", photoUrl: null }, created: true };
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e.code === "ER_DUP_ENTRY") return { status: 409, error: "이미 가입된 이메일이에요. 로그인해 주세요." };
    throw e;
  } finally { conn.release(); }
}

async function login(req, res, { email, password }) {
  const [rows] = await L.db().query("SELECT id, email, nickname, bio, photo_v, pw_hash FROM users WHERE email = ?", [email]);
  const u = rows[0];
  const ok = await L.checkPw(password, u ? u.pw_hash : DUMMY);
  if (!u || !ok) return { status: 401, error: "이메일 또는 비밀번호가 맞지 않습니다." };
  L.setSession(req, res, u.id);
  return { user: L.publicUser(u), created: false };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return L.json(res, 405, { error: "POST 로 요청해 주세요." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const a = req.query.a, b = L.readBody(req);
    const send = (r) => (r.error ? L.json(res, r.status, { error: r.error }) : L.json(res, r.created ? 201 : 200, { user: r.user, created: !!r.created }));

    if (a === "logout") { L.clearSession(req, res); return L.json(res, 200, { ok: true }); }

    const email = String(b.email || "").trim().toLowerCase(), password = String(b.password || "");
    const nickname = String(b.nickname || "").trim(), code = L.normCode(b.code);

    if (a === "login") return send(await login(req, res, { email, password }));

    if (a === "signup") {
      if (code.length !== 12) return L.json(res, 403, { error: "초대장 코드를 확인해 주세요." });
      const bad = checkFields(email, password, nickname);
      if (bad) return L.json(res, 400, { error: bad });
      return send(await signup(req, res, { email, password, nickname, code }));
    }

    if (a === "enter") {
      const [rows] = await L.db().query("SELECT 1 FROM users WHERE email = ?", [email]);
      if (rows[0] || code.length !== 12 || checkFields(email, password, nickname)) {
        // 가입된 이메일이거나 가입에 필요한 값이 모자라면 로그인으로 처리한다.
        // 실패 문구는 항상 같게 해서 이메일이 가입돼 있는지 새어 나가지 않게 한다.
        const r = await login(req, res, { email, password });
        return r.error ? L.json(res, 401, { error: BAD_LOGIN }) : send(r);
      }
      const r = await signup(req, res, { email, password, nickname, code });
      return r.status === 409 ? L.json(res, 401, { error: BAD_LOGIN }) : send(r);
    }

    return L.json(res, 400, { error: "알 수 없는 요청입니다." });
  } catch (e) {
    console.error("auth", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
