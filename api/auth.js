// POST /api/auth?a=signup|login|logout   (JSON 만 받는다) — 가입은 초대장 코드가 있어야 한다.
const L = require("./_lib");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUMMY = "s1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64"); // 없는 이메일도 같은 시간이 걸리게

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return L.json(res, 405, { error: "POST 로 요청해 주세요." });
    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });
    const a = req.query.a, b = L.readBody(req);

    if (a === "logout") { L.clearSession(req, res); return L.json(res, 200, { ok: true }); }

    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");

    if (a === "signup") {
      const nickname = String(b.nickname || "").trim(), code = L.normCode(b.code);
      if (code.length !== 12) return L.json(res, 403, { error: "초대장 코드를 확인해 주세요." });
      if (!EMAIL.test(email) || email.length > 190) return L.json(res, 400, { error: "이메일 형식을 확인해 주세요." });
      if (password.length < 8 || password.length > 100) return L.json(res, 400, { error: "비밀번호는 8자 이상으로 정해 주세요." });
      if (L.len(nickname) < 2 || L.len(nickname) > 20) return L.json(res, 400, { error: "닉네임은 2~20자로 정해 주세요." });
      const pwHash = await L.hashPw(password); // 오래 걸리는 계산은 트랜잭션 밖에서

      // 초대장 확인·사용 처리와 가입을 한 트랜잭션으로 묶는다 — 같은 초대장으로 두 명이 가입할 수 없다.
      const conn = await L.db().getConnection();
      try {
        await conn.beginTransaction();
        const [inv] = await conn.query("SELECT id, created_by FROM invites WHERE code = ? AND used_by IS NULL AND revoked = 0 AND expires_at > NOW() FOR UPDATE", [code]);
        if (!inv[0]) { await conn.rollback(); return L.json(res, 403, { error: "사용할 수 없는 초대장이에요. 이미 쓰였거나 기한이 지났을 수 있어요." }); }
        const [r] = await conn.query("INSERT INTO users (email, pw_hash, nickname, invited_by) VALUES (?, ?, ?, ?)", [email, pwHash, nickname, inv[0].created_by]);
        await conn.query("UPDATE invites SET used_by = ?, used_at = NOW() WHERE id = ?", [r.insertId, inv[0].id]);
        await conn.commit();
        L.setSession(req, res, r.insertId);
        return L.json(res, 201, { user: { id: r.insertId, email, nickname, bio: "", photoUrl: null } });
      } catch (e) {
        await conn.rollback().catch(() => {});
        if (e.code === "ER_DUP_ENTRY") return L.json(res, 409, { error: "이미 가입된 이메일이에요. 로그인해 주세요." });
        throw e;
      } finally { conn.release(); }
    }

    if (a === "login") {
      const [rows] = await L.db().query("SELECT id, email, nickname, bio, photo_v, pw_hash FROM users WHERE email = ?", [email]);
      const u = rows[0];
      const ok = await L.checkPw(password, u ? u.pw_hash : DUMMY);
      if (!u || !ok) return L.json(res, 401, { error: "이메일 또는 비밀번호가 맞지 않습니다." });
      L.setSession(req, res, u.id);
      return L.json(res, 200, { user: L.publicUser(u) });
    }

    return L.json(res, 400, { error: "알 수 없는 요청입니다." });
  } catch (e) {
    console.error("auth", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
