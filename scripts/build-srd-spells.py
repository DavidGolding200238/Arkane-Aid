"""Builds src/lib/srdSpells.json, the spell picker list for the Codex, from the SRD 5.2.1 extract
(supabase/functions/_shared/srd/srd-5.2.1.json). Run from the repo root: python3 scripts/build-srd-spells.py

Each spell keeps its level, school, casting time, range, components, duration and a short opening
description (the player can edit it). Spells whose heading did not survive the PDF extract are skipped.
"""
import json
import re

SRC = "supabase/functions/_shared/srd/srd-5.2.1.json"
OUT = "src/lib/srdSpells.json"
DESC_MAX = 320

HEAD = re.compile(
    r"^(?:Level (\d) (\w+)|(\w+) Cantrip) \(([^)]*)\) Casting Time: (.*?) Range: (.*?) Components?: (.*?) Duration: (.*)$",
    re.S,
)
DUR = re.compile(
    r"^(Instantaneous|Concentration,? up to \d+ (?:minutes?|hours?|rounds?|days?)|Up to \d+ (?:minutes?|hours?)|"
    r"\d+ (?:minutes?|hours?|rounds?|days?)|Until dispelled or triggered|Until dispelled|Special)\s*"
)
# A second spell heading inside a chunk (the PDF merged two spells): cut the description there.
NEXT = re.compile(r"\n[A-Za-z]:\n|(?:Level \d \w+|\w+ Cantrip) \([^)]*\) Casting Time:")


def short(text: str) -> str:
    text = NEXT.split(text)[0]
    text = text.split("\nUsing a Higher-Level Spell Slot.")[0].split("\nCantrip Upgrade.")[0]
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= DESC_MAX:
        return text
    cut = text[:DESC_MAX]
    end = cut.rfind(". ")
    return cut[: end + 1] if end > 120 else cut.rstrip() + "…"


# The PDF extract sometimes runs a spell into the one before it, its name split into letter
# fragments ("A:\n\nCid:\n\nS:\n\nPlash:\n" for Acid Splash). Those spells are split back out here.
INNER = re.compile(r"\n((?:[A-Za-z]+:\n+){2,})(?=(?:Level \d \w+|\w+ Cantrip) \()")


def pieces(chunk: dict) -> list[tuple[str, str]]:
    text = chunk["x"]
    out = []
    start, name = 0, chunk["t"]
    for m in INNER.finditer(text):
        out.append((name, text[start : m.start()]))
        bits = [b for b in re.split(r":\n+", m.group(1)) if b]
        words = []
        for i in range(0, len(bits) - 1, 2):
            words.append(bits[i].upper() + bits[i + 1].lower())
        name, start = " ".join(words), m.end()
    out.append((name, text[start:]))
    return out


def main() -> None:
    chunks = json.load(open(SRC, encoding="utf-8"))["chunks"]
    seen = set()
    spells = []
    parts = [
        piece
        for chunk in chunks
        if chunk["k"] == "spell" and chunk["p"] == ["Spells", "Spell Descriptions"]
        for piece in pieces(chunk)
    ]
    for name, text in parts:
        if name in seen:
            continue
        m = HEAD.match(text)
        if not m:
            continue
        rest = m.group(8)
        dm = DUR.match(rest)
        if not dm:
            continue
        seen.add(name)
        comp = m.group(7).strip()
        material = re.search(r"M \((.*)\)", comp)
        spells.append(
            {
                "name": name,
                "level": int(m.group(1)) if m.group(1) else 0,
                "school": m.group(2) or m.group(3),
                "time": re.sub(r"\s+", " ", m.group(5)).strip(),
                "range": re.sub(r"\s+", " ", m.group(6)).strip(),
                "v": bool(re.match(r"V\b", comp)),
                "s": bool(re.search(r"(?:^|, )S\b", comp)),
                "m": material.group(1).strip() if material else ("" if not re.search(r"\bM\b", comp) else " "),
                "duration": re.sub(r"\s+", " ", dm.group(1)).replace("Concentration up", "Concentration, up").strip(),
                "desc": short(rest[dm.end():]),
            }
        )
    spells.sort(key=lambda s: (s["level"], s["name"]))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(spells, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"{len(spells)} spells -> {OUT}")


if __name__ == "__main__":
    main()
