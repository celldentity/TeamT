"""PWA 아이콘을 만든다(홈 화면 바로가기용). 마스코트(분홍 바탕 + 하얀 카드 얼굴)를 그린다.
실행: D:\\Coding\\.venv\\Scripts\\python.exe scripts/make_icons.py   → assets/icons/*.png
바탕을 가장자리까지 채우고 그림은 가운데 70% 안에 둔다 — 안드로이드가 원·둥근 사각으로 잘라도 안 잘리고,
iOS 는 투명 바탕을 검게 칠하므로 바탕이 불투명해야 한다."""
from pathlib import Path

from PIL import Image, ImageDraw

S = 1024
PINK, LAV, INK, WHITE = "#F9A8CD", "#B9A6F0", "#2B2540", "#FFFFFF"
out = Path(__file__).resolve().parent.parent / "assets" / "icons"
out.mkdir(parents=True, exist_ok=True)

im = Image.new("RGB", (S, S), PINK)
d = ImageDraw.Draw(im)
d.rounded_rectangle((292, 250, 732, 750), radius=72, fill=WHITE)          # 하얀 카드
for cx in (410, 614):
    d.ellipse((cx - 24, 440 - 24, cx + 24, 440 + 24), fill=INK)            # 눈
d.arc((432, 440, 592, 560), 20, 160, fill=INK, width=22)                  # 웃는 입
d.rounded_rectangle((372, 620, 652, 664), radius=22, fill=LAV)            # 라벤더 띠
d.polygon([(800, 190), (822, 258), (890, 280), (822, 302), (800, 370), (778, 302), (710, 280), (778, 258)], fill=LAV)  # 반짝이

for name, px in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
    im.resize((px, px), Image.LANCZOS).save(out / name, optimize=True)
    print(out / name)
