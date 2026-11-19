// HR 용어 사전 공용 — 분류 순서와 검색용 정규화. 파일명이 _ 로 시작해 Vercel 이 라우트로 노출하지 않는다.
// 화면(glossary.html)의 norm() 과 scripts/load_glossary.js 의 별칭 충돌 검사가 같은 규칙을 쓴다 — 고치면 셋을 같이.
const CATS = ["급여·임금", "근로시간·휴가", "4대보험", "채용·계약", "노사·징계", "안전·보건", "평가·성장", "전략·시스템"];
const norm = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/[\s·\-/&().,]/g, "");
module.exports = { CATS, norm };
