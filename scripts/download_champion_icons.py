#!/usr/bin/env python3
"""Telecharge et prepare les portraits champions (wiki TFM2, pixel art net)."""

from __future__ import annotations

import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow requis: python -m pip install pillow") from exc

ROOT = Path(__file__).resolve().parent.parent
CHAMPIONS_JSON = ROOT / "public" / "data" / "champions.json"
ICONS_DIR = ROOT / "public" / "icons"
API = "https://tfm2.miraheze.org/w/api.php"
USER_AGENT = "tfm2-coach/1.0 (personal dashboard; wiki asset mirror)"
MIN_OUTPUT_HEIGHT = 192


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def resolve_wiki_image(name_en: str) -> tuple[str, int, int] | None:
    """Retourne (url, width, height) en privilegiant @4x puis @3x puis base."""
    for filename in (f"{name_en}@4x.png", f"{name_en}@3x.png", f"{name_en}.png"):
        title = urllib.parse.quote(f"File:{filename}", safe="")
        url = (
            f"{API}?action=query&titles={title}"
            f"&prop=imageinfo&iiprop=url|size&format=json"
        )
        data = fetch_json(url)
        for page in data.get("query", {}).get("pages", {}).values():
            if page.get("missing") or "imageinfo" not in page:
                continue
            info = page["imageinfo"][0]
            return info["url"], int(info["width"]), int(info["height"])
    return None


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def upscale_pixel_art(raw: bytes, min_height: int = MIN_OUTPUT_HEIGHT) -> bytes:
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    w, h = im.size
    scale = max(1, (min_height + h - 1) // h)
    if scale > 1:
        im = im.resize((w * scale, h * scale), Image.Resampling.NEAREST)
    out = io.BytesIO()
    im.save(out, format="PNG", optimize=True)
    return out.getvalue()


def main() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads(CHAMPIONS_JSON.read_text(encoding="utf-8"))
    champions = data["champions"]

    ok = 0
    missing = []

    for champ in champions:
        name_en = champ.get("nameEn")
        champ_id = champ["id"]
        dest = ICONS_DIR / f"{champ_id}.png"

        if not name_en:
            missing.append((champ["name"], "no nameEn"))
            continue

        try:
            resolved = resolve_wiki_image(name_en)
            if not resolved:
                missing.append((champ["name"], name_en))
                continue

            image_url, src_w, src_h = resolved
            raw = download_bytes(image_url)
            prepared = upscale_pixel_art(raw)
            dest.write_bytes(prepared)

            out_im = Image.open(io.BytesIO(prepared))
            champ["icon"] = f"icons/{champ_id}.png"
            ok += 1
            print(
                f"OK  {champ['name']} ({name_en}) "
                f"{src_w}x{src_h} -> {out_im.size[0]}x{out_im.size[1]}"
            )
            time.sleep(0.12)
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            missing.append((champ["name"], f"{name_en}: {err}"))

    CHAMPIONS_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    mirror = ROOT / "data" / "champions.json"
    if mirror.parent.exists():
        mirror.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    print(f"\n{ok}/{len(champions)} icones -> {ICONS_DIR}")
    if missing:
        print("Manquantes :")
        for name, reason in missing:
            print(f"  - {name}: {reason}")


if __name__ == "__main__":
    main()
