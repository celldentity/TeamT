// 초대장 서비스
//   GET    /api/invites?check=<코드>  (로그인 불필요) → {valid, inviter}   가입 화면에서 코드를 미리 확인
//   GET    /api/invites               내가 만든 초대장 목록
//   POST   /api/invites               새 초대장 만들기(동시에 INVITE_MAX_ACTIVE 장까지, INVITE_DAYS 일 안에 사용)
//   DELETE /api/invites?id=<번호>     아직 안 쓴 내 초대장 취소
const crypto = require("crypto");
const L = require("./_lib");

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 헷갈리는 0 O 1 I L 제외
const newCode = () => Array.from(crypto.randomBytes(12), (b) => ALPHA[b % ALPHA.length]).join("");
const ACTIVE = "used_by IS NULL AND revoked = 0 AND expires_at > NOW()";

module.exports = async (req, res) => {
  try {
    if (req.method === "GET" && req.query.check !== undefined) {
      const code = L.normCode(req.query.check);
      const [rows] = await L.db().query("SELECT i.id, u.nickname AS inviter FROM invites i LEFT JOIN users u ON u.id = i.created_by WHERE i.code = ? AND i.used_by IS NULL AND i.revoked = 0 AND i.expires_at > NOW()", [code]);
      return L.json(res, 200, rows[0] ? { valid: true, inviter: rows[0].inviter } : { valid: false });
    }

    const u = await L.currentUser(req);
    if (!u) return L.json(res, 401, { error: "로그인이 필요합니다." });

    if (req.method === "GET") {
      const [rows] = await L.db().query(
        `SELECT i.id, i.code, i.used_at, i.expires_at, i.created_at, v.nickname AS used_nick,
                (i.used_by IS NOT NULL) AS used, i.revoked, (i.expires_at <= NOW()) AS expired
           FROM invites i LEFT JOIN users v ON v.id = i.used_by WHERE i.created_by = ? ORDER BY i.id DESC LIMIT 30`, [u.id]);
      return L.json(res, 200, { max: L.INVITE_MAX_ACTIVE, days: L.INVITE_DAYS, invites: rows.map((r) => {
        const status = r.used ? "used" : r.revoked ? "revoked" : r.expired ? "expired" : "active";
        return { id: r.id, status, code: status === "active" ? r.code : null, usedBy: r.used_nick || null, expiresAt: r.expires_at, createdAt: r.created_at };
      }) });
    }

    if (!L.isJson(req)) return L.json(res, 415, { error: "JSON 으로 요청해 주세요." });

    if (req.method === "POST") {
      const [[c]] = await L.db().query(`SELECT COUNT(*) AS n FROM invites WHERE created_by = ? AND ${ACTIVE}`, [u.id]);
      if (c.n >= L.INVITE_MAX_ACTIVE) return L.json(res, 429, { error: `쓰지 않은 초대장은 ${L.INVITE_MAX_ACTIVE}장까지 가질 수 있어요. 쓰거나 취소한 뒤 만들어 주세요.` });
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        try {
          const [r] = await L.db().query("INSERT INTO invites (code, created_by, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))", [code, u.id, L.INVITE_DAYS]);
          return L.json(res, 201, { invite: { id: r.insertId, status: "active", code, usedBy: null } });
        } catch (e) { if (e.code !== "ER_DUP_ENTRY") throw e; }
      }
      throw new Error("초대 코드 생성 충돌");
    }

    if (req.method === "DELETE") {
      const [r] = await L.db().query("UPDATE invites SET revoked = 1 WHERE id = ? AND created_by = ? AND used_by IS NULL", [Number(req.query.id), u.id]);
      return L.json(res, r.affectedRows ? 200 : 404, r.affectedRows ? { ok: true } : { error: "취소할 수 있는 초대장이 아니에요." });
    }
    return L.json(res, 405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    console.error("invites", e);
    return L.json(res, 500, { error: "서버에 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." });
  }
};
