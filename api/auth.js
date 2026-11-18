// POST /api/auth?a=signup|login|logout   (JSON 만 받는다)
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
      const nickname = String(b.nickname || "").trim();
      if (!L.same(String(b.code || "").trim(), L.env.SIGNUP_CODE || "")) return L.json(res, 403, { error: "가입 코드가 맞지 않습니다." });
      if (!EMAIL.test(email) || email.length > 190) return L.json(res, 400, { error: "이메일 형식을 확인해 주세요." });
      if (password.length < 8 || password.length > 100) return L.json(res, 400, { error: "비밀번호는 8자 이상으로 정해 주세요." });
      if ([...nickname].length < 2 || [...nickname].length > 20) return L.json(res, 400, { error: "닉네임은 2~20자로 정해 주세요." });
      try {
        const [r] = await L.db().query("INSERT INTO users (email, pw_hash, nickname) VALUES (?, ?, ?)", [email, await L.hashPw(password), nickname]);
        L.setSession(req, res, r.insertId);
        return L.json(res, 201, { user: { id: r.insertId, email, nickname, photoUrl: null } });
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY") return L.json(res, 409, { error: "이미 가입된 이메일입니다. 로그인해 주세요." });
        throw e;
      }
    }

    if (a === "login") {
      const [rows] = await L.db().query("SELECT id, email, nickname, photo_v, pw_hash FROM users WHERE email = ?", [email]);
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
