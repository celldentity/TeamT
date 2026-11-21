"""질문 일러스트 생성 — 로컬 FLUX(ComfyUI, 환경변수 QIMG_WORKER_DIR 폴더의 flux_gen.py)로 질문마다 한 장.
  python scripts/qimg/gen_qimg.py [--only d0001,d0002] [--redo d0003] [--limit N]
입력: scripts/qimg/scenes.json  {id: "영어 장면 묘사"}   (질문 본문은 api/_qbank.json — scripts/qimg/merge_qbank.js 가 둘을 같이 만든다)
출력: 환경변수 QIMG_DIR 폴더(없으면 저장소 안 .cache/teamt-qimg)의 <id>.jpg (768x576) · <id>.t.jpg (320 정사각 썸네일) · progress.jsonl (id·시드·초)
이어하기: 이미 <id>.jpg 가 있으면 건너뛴다. 이상한 그림은 --redo <id> (다른 시드로 다시 뽑는다).
"""
import argparse, hashlib, io, json, os, sys, time
from pathlib import Path

sys.path.insert(0, os.environ["QIMG_WORKER_DIR"])  # flux_gen.py 가 있는 폴더(이 PC 전용)
from flux_gen import gen  # noqa: E402
from PIL import Image, ImageStat  # noqa: E402

HERE = Path(__file__).parent
OUT = Path(os.environ.get("QIMG_DIR") or HERE.parent.parent / ".cache" / "teamt-qimg")
STYLE = ("cute kawaii anime-style flat illustration, soft pastel pink and lavender palette, thick soft outlines, "
         "round chubby characters with tiny dot eyes and pink cheeks, clean simple pastel background, centered composition "
         "with the characters and props filling the frame, no text, no letters, no numbers, no logo, no watermark. ")
W, H = 768, 576            # FLUX 는 16 의 배수. 이 크기 그대로 저장(가로 800 안팎). 시험: 832x624·20단계 54초, 768x576·16단계 42초
STEPS = 16


def seed_for(qid, attempt):
    return int(hashlib.sha256(f"{qid}:{attempt}".encode()).hexdigest()[:8], 16)


def save(png, qid):
    im = Image.open(png).convert("RGB")
    if max(ImageStat.Stat(im).stddev) < 12:      # 거의 한 색 = 실패한 그림
        raise RuntimeError("blank")
    full = im
    full.save(OUT / f"{qid}.jpg", quality=80, optimize=True, progressive=True)
    s = min(full.size)
    sq = full.crop(((W - s) // 2, (H - s) // 2, (W + s) // 2, (H + s) // 2)).resize((320, 320), Image.LANCZOS)
    sq.save(OUT / f"{qid}.t.jpg", quality=80, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only"); ap.add_argument("--redo"); ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--until", help='이 시각("2026-11-20 08:30", 로컬)이 지나면 새 그림을 시작하지 않고 끝낸다 — 예약 실행용')
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    scenes = json.loads((HERE / "scenes.json").read_text(encoding="utf-8"))
    prog = OUT / "progress.jsonl"
    tries = {}
    if prog.exists():
        for line in prog.read_text(encoding="utf-8").splitlines():
            r = json.loads(line); tries[r["id"]] = tries.get(r["id"], 0) + 1
    ids = a.only.split(",") if a.only else list(scenes)
    redo = set(a.redo.split(",")) if a.redo else set()
    n = 0
    for qid in ids:
        if qid in redo:
            for f in (OUT / f"{qid}.jpg", OUT / f"{qid}.t.jpg"): f.unlink(missing_ok=True)
        if (OUT / f"{qid}.jpg").exists(): continue
        if a.limit and n >= a.limit: break
        if a.until and time.time() >= time.mktime(time.strptime(a.until, "%Y-%m-%d %H:%M")):
            print("--until 시각이 지나 멈춤", flush=True); break
        attempt = tries.get(qid, 0)
        tmp = OUT / "_tmp.png"
        try:
            sec = gen(STYLE + scenes[qid], str(tmp), seed=seed_for(qid, attempt), w=W, h=H, steps=STEPS)
            save(tmp, qid)
        except Exception as e:  # ComfyUI 가 잠깐 끊겨도 다음 id 로 간다
            print("실패", qid, str(e)[:120], flush=True); time.sleep(5); continue
        tries[qid] = attempt + 1; n += 1
        with prog.open("a", encoding="utf-8") as f: f.write(json.dumps({"id": qid, "seed": seed_for(qid, attempt), "sec": round(sec, 1), "t": int(time.time())}) + "\n")
        print(f"{qid} {sec:.0f}s", flush=True)


if __name__ == "__main__":
    main()
