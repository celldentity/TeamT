r"""PWA 아이콘(홈 화면 바로가기)을 만든다. 원본은 로컬 FLUX(ComfyUI, flux1-dev Q4)로 그린 마스코트 `scripts/icon_source.png` (1024x1024).
  프롬프트 요지: «귀여운 오리지널 키치 마스코트, 파스텔 라벤더 몸통에 하트 볼, 날개, 분홍-라벤더 바탕, 글자·로고 없음»
  (HR 미드필더 → 축구공을 안은 마스코트, 팔레트 = 핑크·라벤더). 티니핑 캐릭터를 흉내 내지 않은 자체 제작 그림.
실행: python scripts/make_icons.py   → assets/icons/*-v3.png
- 마스코트는 가운데 80% 원(maskable 안전 영역) 안에 들어 있어 안드로이드가 원·둥근 사각으로 잘라도 안 잘린다. 바탕은 불투명(iOS 는 투명을 검게 칠함).
- 파일명에 버전(v3)을 붙였다. 아이콘을 또 바꾸면 v4 로 올리고 manifest·각 페이지 머리말·sw.js 의 이름도 같이 바꾼다
  (같은 이름이면 캐시 때문에 이미 설치한 사람의 아이콘이 안 바뀐다)."""
from pathlib import Path

from PIL import Image

here = Path(__file__).resolve().parent
out = here.parent / "assets" / "icons"
out.mkdir(parents=True, exist_ok=True)
src = Image.open(here / "icon_source.png").convert("RGB")
assert src.size[0] == src.size[1], "정사각형 원본이어야 한다"
for name, px in (("icon-v3-512.png", 512), ("icon-v3-192.png", 192), ("apple-touch-icon-v3.png", 180)):
    src.resize((px, px), Image.LANCZOS).save(out / name, optimize=True)
    print(out / name)
