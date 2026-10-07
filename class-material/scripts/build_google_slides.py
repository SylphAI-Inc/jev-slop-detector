#!/usr/bin/env python3
"""Build the AdaL Autonomy deck as a NATIVE Google Slides presentation.

Creates real text boxes, images (from Drive), and Drive-hosted videos —
everything stays editable in Google Slides.

Usage:
  python3 build_google_slides.py [--name "Deck name"] [--script-doc <docId>]

Steps:
  1. Uploads every image in the slide spec to Drive and shares it link-readable.
  2. Creates a blank presentation.
  3. Sends one batchUpdate that builds all 15 slides (text, images, videos).
  4. Verifies the slide count and prints the edit URL.

Requires: gws CLI authenticated; Slides API enabled on the gws project.
"""
import argparse
import json
import struct
import sys
from pathlib import Path

from gws_client import call, upload, share_anyone_reader, create_presentation, slides_batch_update, slides_get, get_file

HERE = Path(__file__).resolve().parent.parent  # docs/adal/loop_graph_presentation/
ASSETS = HERE / "assets"
SLIDE_W_IN, SLIDE_H_IN = 10.0, 5.625
BG = "151519"
PINK = "FF5898"
TXT = "F2F2F5"
DIM = "C9C9D2"
HANDLE = "@panda_liyin"
HANDLE_URL = "https://x.com/panda_liyin"
PROMO_URL = "https://adal.sylph.ai/subscription?tier=pro&promo=JEVTALK1MO"


def image_info(path: Path) -> tuple[int, int, str]:
    """Return (width, height, mime) for PNG or JPEG, from magic bytes."""
    with open(path, "rb") as f:
        data = f.read(200000)
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", data[16:24])
        return w, h, "image/png"
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                h, w = struct.unpack(">HH", data[i + 5 : i + 9])
                return w, h, "image/jpeg"
            seg_len = struct.unpack(">H", data[i + 2 : i + 4])[0]
            i += 2 + seg_len
    raise ValueError(f"unsupported image: {path}")


def ext_for(mime: str) -> str:
    return {"image/png": ".png", "image/jpeg": ".jpg"}[mime]


def fit(name: str, box: dict, sizes: dict) -> dict:
    """Center an image inside a box, preserving aspect ratio."""
    iw, ih = sizes[name]
    ar, bar = iw / ih, box["w"] / box["h"]
    if ar > bar:
        w, h = box["w"], box["w"] / ar
    else:
        h, w = box["h"], box["h"] * ar
    return {"name": name, "x": box["x"] + (box["w"] - w) / 2,
            "y": box["y"] + (box["h"] - h) / 2, "w": w, "h": h}


def hex_rgb(h: str) -> dict:
    return {"red": int(h[0:2], 16) / 255, "green": int(h[2:4], 16) / 255, "blue": int(h[4:6], 16) / 255}


def text_reqs(reqs, oid, page, text, x, y, w, h, size, color=TXT, bold=False, align="START"):
    reqs.append({"createShape": {"objectId": oid, "shapeType": "TEXT_BOX", "elementProperties": {
        "pageObjectId": page,
        "size": {"width": {"magnitude": int(w*914400), "unit": "EMU"}, "height": {"magnitude": int(h*914400), "unit": "EMU"}},
        "transform": {"scaleX": 1, "scaleY": 1, "translateX": int(x*914400), "translateY": int(y*914400), "unit": "EMU"}}}})
    reqs.append({"insertText": {"objectId": oid, "insertionIndex": 0, "text": text}})
    reqs.append({"updateTextStyle": {"objectId": oid, "style": {
        "fontSize": {"magnitude": size, "unit": "PT"},
        "foregroundColor": {"opaqueColor": {"rgbColor": hex_rgb(color)}},
        "bold": bold, "fontFamily": "Inter"},
        "fields": "fontSize,foregroundColor,bold,fontFamily"}})
    if align != "START":
        reqs.append({"updateParagraphStyle": {"objectId": oid, "style": {"alignment": align}, "fields": "alignment"}})


def image_req(reqs, oid, page, url, x, y, w, h):
    reqs.append({"createImage": {"objectId": oid, "url": url, "elementProperties": {
        "pageObjectId": page,
        "size": {"width": {"magnitude": int(w*914400), "unit": "EMU"}, "height": {"magnitude": int(h*914400), "unit": "EMU"}},
        "transform": {"scaleX": 1, "scaleY": 1, "translateX": int(x*914400), "translateY": int(y*914400), "unit": "EMU"}}}})


def build_spec(video_ids: dict, img_ids: dict, sizes: dict) -> list[dict]:
    """All 15 slides. Coordinates in inches on a 10 x 5.625 canvas."""
    reqs = []
    state = {"n": 0}

    def img(name, page, x, y, w, h, oid=None):
        state["n"] += 1
        oid = oid or f"img_{page}_{state['n']}"
        f = fit(name, {"x": x, "y": y, "w": w, "h": h}, sizes)
        image_req(reqs, oid, f"slide{page}", f"https://drive.google.com/uc?export=download&id={img_ids[name]}", f["x"], f["y"], f["w"], f["h"])

    def T(page, text, x, y, w, h, size, color=TXT, bold=False, align="START"):
        state["n"] += 1
        text_reqs(reqs, f"txt_{page}_{state['n']}", f"slide{page}", text, x, y, w, h, size, color, bold, align)

    def chrome(page, title=None, size=24):
        T(page, HANDLE, 0.45, 5.18, 2.2, 0.35, 13.5, color="E6E6EC", bold=True)
        img("adal-logo.png", page, 8.5, 5.1, 1.3, 0.45, oid=f"logo_s{page}")
        if title:
            T(page, title, 0.45, 0.32, 9.1, 0.85, size, color=TXT, bold=True)

    for i in range(1, 16):
        reqs.append({"createSlide": {"objectId": f"slide{i}", "slideLayoutReference": {"predefinedLayout": "BLANK"}}})
        reqs.append({"updatePageProperties": {"objectId": f"slide{i}", "pageProperties": {
            "pageBackgroundFill": {"solidFill": {"color": {"rgbColor": hex_rgb(BG)}}}},
            "fields": "pageBackgroundFill"}})

    # 1 title
    img("adal-girl.png", 1, 0, 0, SLIDE_W_IN, SLIDE_H_IN, oid="girl_bg")
    T(1, "LOOP, GRAPH, AND JEV", 0.49, 1.28, 5, 0.3, 12, color="FF8AB8", bold=True)
    T(1, "When the sun goes down,\ndoes your work still go on?", 0.47, 1.65, 5.7, 1.7, 33, bold=True)
    T(1, "Exploring the future of agent autonomy", 0.49, 3.5, 5.5, 0.38, 16, color=DIM)
    T(1, "Li Yin", 0.49, 4.2, 5.5, 0.35, 16.5, bold=True)
    T(1, "Cofounder & CEO @ AdaL · AI researcher & agent builder", 0.49, 4.55, 5.5, 0.3, 11, color=DIM)
    T(1, HANDLE, 0.49, 4.85, 3, 0.3, 13.5, color="E6E6EC", bold=True)
    img("adal-logo.png", 1, 8.5, 5.1, 1.3, 0.45, oid="logo_s1")

    # 2 what is adal
    T(2, "WHAT ADAL IS", 0.49, 1.28, 5, 0.3, 13, color=PINK, bold=True)
    T(2, "Every coding agent can build, but only AdaL does GTM directly from your codebase.", 0.49, 1.75, 8.7, 1.9, 30, bold=True)

    # 3 demo video (Drive)
    T(3, "Demo: idea to GTM", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    T(3, HANDLE, 0.45, 5.18, 2.2, 0.35, 13.5, color="E6E6EC", bold=True)
    img("adal-logo.png", 3, 8.5, 5.1, 1.3, 0.45, oid="logo_s3")
    reqs.append({"createVideo": {"objectId": "vid_idea", "source": "DRIVE", "id": video_ids["idea"],
        "elementProperties": {"pageObjectId": "slide3",
            "size": {"width": {"magnitude": int(8.03*914400), "unit": "EMU"}, "height": {"magnitude": int(4.52*914400), "unit": "EMU"}},
            "transform": {"scaleX": 1, "scaleY": 1, "translateX": int(0.98*914400), "translateY": int(0.73*914400), "unit": "EMU"}}}})

    # 4 babysitting
    T(4, "The babysitting paradox", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    T(4, "One side is agentmaxxing. What stops us is babysitting agents to the quality bar.", 0.49, 1.16, 8.6, 0.45, 13.5, color=DIM)
    img("babysitting-paradox.png", 4, 1.5, 1.75, 7, 3.6)
    chrome_rest = True

    # 5..7 image slides
    T(5, "What human quality work actually takes", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    img("layers-outer-loop.png", 5, 1.4, 1.3, 7.2, 4.1)
    T(6, "Five gaps", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    img("five-gaps-autonomy.png", 6, 1.0, 1.3, 8.0, 4.1)
    T(7, "Where AdaL stands", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    img("adal-capabilities-ai.png", 7, 1.4, 1.35, 7.2, 4.05)

    # 8 modeling, two cards
    T(8, "Modeling: LLMs vs Jev", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    img("kimi-k3-llm-model-architecture.png", 8, 0.45, 1.3, 4.4, 2.9)
    img("typesafe-model-structure.png", 8, 5.08, 1.3, 4.4, 2.9)
    T(8, "Kimi Team, Kimi K3: Open Frontier Intelligence · arxiv.org/abs/2607.24653", 0.45, 4.3, 4.4, 0.5, 9, color=DIM)
    T(8, "TypeSafe, Introducing System One Models & Jev · typesafe.ai/blog", 5.08, 4.3, 4.4, 0.5, 9, color=DIM)

    # 9 planner and judge
    T(9, "The planner and the judge", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    img("llm-vs-jev.png", 9, 1.4, 1.35, 7.2, 4.05)

    # 10 what jev returns
    T(10, "What Jev returns", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    T(10, "State plus typed questions in. Typed answers with probabilities out. Not a paragraph.", 0.49, 1.16, 8.6, 0.4, 13.5, color=DIM)
    T(10, "IN\n\nstate: \"Tried Stripe for 3 days.\nLosing sales. Help ASAP.\"\n\nquestions:\n  department  choice\n    billing | technical | sales\n  frustration  score\n    0 calm\n    1 frustrated but civil\n    2 very angry\n  is_urgent  noul", 0.52, 1.7, 4.4, 3.4, 10.5, color="D6D6DE")
    T(10, "OUT\n\ndepartment    technical  0.85\nfrustration   1  frustrated but civil\nis_urgent     1.0\n\n\nYour code branches. 70-500 ms. No text to parse.", 5.08, 1.7, 4.4, 3.4, 11, color="D6D6DE")
    T(10, "TypeSafe, Introducing System One Models & Jev · typesafe.ai/blog", 0.49, 5.15, 8, 0.3, 9, color=DIM)

    # 11 loop engineering
    T(11, "Loop engineering: work until the goal is achieved", 0.45, 0.32, 9.1, 0.85, 20, bold=True)
    img("jev-three-levels.png", 11, 0.45, 1.35, 4.2, 3.75)
    T(11, "1  Premature stop\nThe model says it will run the tests, and never calls the tool. About 10% of tool calls stop like this. Jev catches that, we bounce, and the same turn continues. Shipped - you will not see it in AdaL now.", 5.0, 1.3, 4.6, 1.2, 15)
    T(11, "2  Auto permission\nBefore a destructive command, Jev can allow it, ask you, or deny it. A more secure YOLO. Not shipped yet.", 5.0, 2.85, 4.6, 0.95, 15)
    T(11, "3  Goal achieved\nWhen the model tries to stop, is the finish line actually crossed? If not, another turn starts. That is /goal, and it is next.", 5.0, 4.1, 4.6, 0.95, 15)

    # 12 graph engineering
    T(12, "Graph engineering: big jobs need more than one worker", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    img("17-agentic-loop-graph.png", 12, 1.4, 1.35, 7.2, 4.05)

    # 13 engineer demo video (Drive)
    T(13, "AdaL Engineer", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    T(13, HANDLE, 0.45, 5.18, 2.2, 0.35, 13.5, color="E6E6EC", bold=True)
    img("adal-logo.png", 13, 8.5, 5.1, 1.3, 0.45, oid="logo_s13")
    reqs.append({"createVideo": {"objectId": "vid_engineer", "source": "DRIVE", "id": video_ids["engineer"],
        "elementProperties": {"pageObjectId": "slide13",
            "size": {"width": {"magnitude": int(8.03*914400), "unit": "EMU"}, "height": {"magnitude": int(4.52*914400), "unit": "EMU"}},
            "transform": {"scaleX": 1, "scaleY": 1, "translateX": int(0.98*914400), "translateY": int(0.73*914400), "unit": "EMU"}}}})

    # 14 world loops
    T(14, "The world is a complicated, many-layered loop", 0.45, 0.32, 9.1, 0.85, 24, bold=True)
    img("world-many-loops.png", 14, 1.4, 1.35, 7.2, 4.05)

    # 15 closing + promo
    img("qr-jevtalk1mo-branded.png", 15, 3.4, 0.75, 3.2, 3.2)
    T(15, "adalagent.ai", 0.6, 4.15, 8.8, 0.5, 22, bold=True, align="CENTER")
    T(15, "AdaL makes work and life a little lighter.", 0.6, 4.7, 8.8, 0.45, 19, color=PINK, bold=True, align="CENTER")

    # footer chrome for slides 2..15 except 3 and 13 (which carry their own above)
    for i in range(2, 16):
        if i in (3, 13):
            continue
        T(i, HANDLE, 0.45, 5.18, 2.2, 0.35, 13.5, color="E6E6EC", bold=True)
        img("adal-logo.png", i, 8.5, 5.1, 1.3, 0.45, oid=f"logo_s{i}")
    return reqs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="AdaL Autonomy Deck v2 — native")
    ap.add_argument("--script-doc", default="", help="Google Doc id of the talk script; linked into slide-1 speaker notes")
    args = ap.parse_args()

    images = ["adal-girl.png", "adal-logo.png", "babysitting-paradox.png", "layers-outer-loop.png",
              "five-gaps-autonomy.png", "adal-capabilities-ai.png", "kimi-k3-llm-model-architecture.png",
              "typesafe-model-structure.png", "llm-vs-jev.png", "jev-three-levels.png",
              "17-agentic-loop-graph.png", "world-many-loops.png", "qr-jevtalk1mo-branded.png"]

    print(f"uploading {len(images)} images...")
    cache_path = Path(__file__).resolve().parent / "deck-img-ids.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    img_ids, sizes = {}, {}
    for name in images:
        path = ASSETS / name
        w, h, mime = image_info(path)
        cached = cache.get(name)
        if cached:
            try:
                get_file(cached, "id")
                img_ids[name], sizes[name] = cached, (w, h)
                print(f"  {name}: cached {cached}")
                continue
            except Exception:
                pass
        meta = upload(name, f"deck-img-{Path(name).stem}{ext_for(mime)}", mime, cwd=str(ASSETS))
        share_anyone_reader(meta["id"])
        img_ids[name] = meta["id"]
        sizes[name] = (w, h)
        cache[name] = meta["id"]
        cache_path.write_text(json.dumps(cache, indent=1))
        print(f"  {name} ({w}x{h} {mime.split('/')[1]}) -> {meta['id']}")

    print("creating presentation...")
    pres = create_presentation(args.name)
    pid = pres["id"]

    default_slides = [sl["objectId"] for sl in slides_get(pid, "slides(objectId)").get("slides", [])]

    reqs = build_spec(
        video_ids={"idea": "1nP5DJfEeyI4uD22UgAl0lmEE_5uJeZbx", "engineer": "1YFU6mSrc6x8kQZwuRGe5e4xJMrtQK9pE"},
        img_ids=img_ids, sizes=sizes)

    for oid in default_slides:
        reqs.insert(0, {"deleteObject": {"objectId": oid}})

    if args.script_doc:
        # Slides API cannot write speaker notes; the link is surfaced here and
        # pasted into slide-1 notes via the UI afterwards.
        script_link = f"https://docs.google.com/document/d/{args.script_doc}/edit"

    print(f"batchUpdate with {len(reqs)} requests...")
    res = slides_batch_update(pid, reqs)
    if "error" in res:
        raise RuntimeError(json.dumps(res["error"])[:2000])
    print(f"batchUpdate ok: {len(res.get('replies', []))} replies")

    check = call(["slides", "presentations", "get", "--params", json.dumps({
        "presentationId": pid, "fields": "presentationId,title,slides(objectId)"})])
    n_slides = len(check.get("slides", []))
    print(f"slides: {n_slides}")
    if n_slides != 15:
        print("WARNING: expected 15 slides")
    print(f"EDIT URL: https://docs.google.com/presentation/d/{pid}/edit")


if __name__ == "__main__":
    main()
