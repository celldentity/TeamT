"""전역 로더 캐릭터를 assets/shell.js 안에 «데이터 주소(base64)» 로 박아 넣는다.

로더는 인터넷이 느려도 바로 떠야 하므로 이미지를 따로 내려받지 않는다 — 144px WebP 를 코드 안에 직접 넣는다(10장 ≈ 18KB).
캐릭터를 바꾸려면: scripts/loader_chars/ 의 NN.webp 를 갈아 끼우고(정사각 144px, 장당 2KB 안팎) 이 스크립트를 다시 돌린다.
    D:\\Coding\\.venv\\Scripts\\python.exe scripts/make_loader_chars.py
원본 PNG → WebP 줄이기는 한 번만 하면 된다(자르기·144px·quality 62, PIL).
"""
import base64
import glob
import os
import re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
imgs = sorted(glob.glob(os.path.join(root, "scripts", "loader_chars", "*.webp")))
assert imgs, "scripts/loader_chars/*.webp 가 없습니다"
data = ",".join('"data:image/webp;base64,%s"' % base64.b64encode(open(f, "rb").read()).decode() for f in imgs)
block = "  // CHARS:begin (scripts/make_loader_chars.py 가 만든다 — 직접 고치지 말 것)\n  const CHARS = [%s];\n  // CHARS:end" % data

p = os.path.join(root, "assets", "shell.js")
s = open(p, encoding="utf8").read()
if "// CHARS:begin" in s:
    s = re.sub(r"  // CHARS:begin.*?// CHARS:end", lambda m: block, s, flags=re.S)
else:  # 처음 한 번: 예전 로더 그림(입체 하트)을 이 블록으로 바꾼다
    s = re.sub(r"  // 로더의 입체 하트:[^\n]*\n  const HEART = [^\n]*\n", lambda m: block + "\n", s)
    s = s.replace('<div class="gl__3d">${HEART}</div>', '<div class="gl__card">${CHARS.map((c) => `<img src="${c}" alt="" width="96" height="96">`).join("")}</div>')
assert "const CHARS" in s and "${HEART}" not in s
open(p, "w", encoding="utf8", newline="").write(s)
print("캐릭터 %d장, shell.js 반영 완료" % len(imgs))
