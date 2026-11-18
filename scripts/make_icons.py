"""PWA 아이콘(홈 화면 바로가기)을 만든다. 핑크→라벤더 그라데이션 바탕 위에 하얀 하트, 그 안에 검정 «T»(HR T 의 T), 반짝이.
실행: D:\\Coding\\.venv\\Scripts\\python.exe scripts/make_icons.py   → assets/icons/*-v2.png
- 바탕은 가장자리까지 채우고 그림은 가운데 70% 안에 둔다 — 안드로이드가 원·둥근 사각으로 잘라도 안 잘린다(maskable).
  iOS 는 투명 바탕을 검게 칠하므로 바탕이 불투명해야 한다.
- 파일명에 버전(v2)을 붙였다. 아이콘을 또 바꾸면 v3 으로 올리고 manifest·각 페이지 머리말·sw.js 의 이름도 같이 바꾼다
  (같은 이름이면 브라우저·서버 캐시 때문에 이미 설치한 사람의 아이콘이 안 바뀔 수 있다)."""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

S = 2048                      # 2배로 그린 뒤 줄여서 가장자리를 매끄럽게
INK = (23, 23, 25)
out = Path(__file__).resolve().parent.parent / "assets" / "icons"
out.mkdir(parents=True, exist_ok=True)

# 1) 바탕: 왼쪽 위 핑크 → 오른쪽 아래 라벤더 대각선 그라데이션
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
t = np.clip((xx + yy) / (2 * S), 0, 1)[..., None]
c0, c1 = np.array([255, 170, 208], np.float32), np.array([190, 170, 255], np.float32)
bg = Image.fromarray((c0 * (1 - t) + c1 * t).astype(np.uint8), "RGB").convert("RGBA")
glow = Image.new("L", (S, S), 0)                                   # 왼쪽 위에서 비치는 부드러운 빛
ImageDraw.Draw(glow).ellipse((-S * 0.25, -S * 0.3, S * 0.75, S * 0.6), fill=95)
bg.alpha_composite(Image.merge("RGBA", (*[Image.new("L", (S, S), 255)] * 3, glow.filter(ImageFilter.GaussianBlur(S * 0.09)))))


# 2) 하트 마스크(매개변수 곡선)
def heart(cx, cy, width):
    s = width / 32
    pts = []
    for i in range(720):
        a = i / 720 * 2 * math.pi
        x = 16 * math.sin(a) ** 3
        y = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        pts.append((cx + x * s, cy - y * s))
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


H = heart(S / 2, S / 2 + S * 0.04, S * 0.65)
# 그림자(아래로 살짝, 보라빛)
sh = ImageChops.offset(H, 0, int(S * 0.028)).filter(ImageFilter.GaussianBlur(S * 0.022))
shadow = Image.new("RGBA", (S, S), (110, 60, 170, 0))
shadow.putalpha(sh.point(lambda v: int(v * 0.30)))
bg.alpha_composite(shadow)
# 하얀 하트 + 위쪽에 아주 옅은 핑크 기운
white = Image.new("RGBA", (S, S), (255, 255, 255, 255))
white.putalpha(H)
bg.alpha_composite(white)
tint = Image.new("RGBA", (S, S), (255, 214, 232, 0))
ty = np.clip((yy - S * 0.38) / (S * 0.36), 0, 1)
tint.putalpha(Image.fromarray((ty * 150).astype(np.uint8), "L"))
tint.putalpha(ImageChops.multiply(tint.getchannel("A"), H))
bg.alpha_composite(tint)

# 3) 하트 안의 «T» (굵은 가로대 + 줄기, 둥근 모서리)
d = ImageDraw.Draw(bg)
cx, top = S / 2, S * 0.385
bar_w, bar_h, stem_w, stem_h, r = S * 0.23, S * 0.062, S * 0.066, S * 0.23, S * 0.024
d.rounded_rectangle((cx - bar_w / 2, top, cx + bar_w / 2, top + bar_h), radius=r, fill=INK)
d.rounded_rectangle((cx - stem_w / 2, top, cx + stem_w / 2, top + stem_h), radius=r, fill=INK)

# 4) 반짝이 두 개(하얀색)
def sparkle(x, y, r):
    k = r * 0.22
    d.polygon([(x, y - r), (x + k, y - k), (x + r, y), (x + k, y + k), (x, y + r), (x - k, y + k), (x - r, y), (x - k, y - k)], fill=(255, 255, 255, 255))


sparkle(S * 0.745, S * 0.285, S * 0.062)
sparkle(S * 0.285, S * 0.715, S * 0.034)

img = bg.convert("RGB")
for name, px in (("icon-v2-512.png", 512), ("icon-v2-192.png", 192), ("apple-touch-icon-v2.png", 180)):
    img.resize((px, px), Image.LANCZOS).save(out / name, optimize=True)
    print(out / name)
