"""Build supabase/functions/_shared/srd/srd-5.2.1.json from the official SRD 5.2.1 PDF.

The SRD 5.2.1 is CC-BY-4.0 (attribution is written into the JSON and the README).
Needs Python 3 and poppler-utils (pdftohtml). Run from the repo root:

    python3 scripts/build-srd.py

It downloads the PDF to a temp folder, reads the headings by font (red GillSans = heading),
and writes one chunk per rule, spell, monster, item, or glossary entry, with its
breadcrumb path and PDF page, so the Sage can cite where an answer came from.
"""
import os, subprocess, tempfile, urllib.request
PDF_URL = "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "functions", "_shared", "srd", "srd-5.2.1.json")
ATTRIBUTION = ('This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the '
    'Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons '
    'Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.')
_tmp = tempfile.mkdtemp()
_pdf = os.path.join(_tmp, "srd.pdf")
urllib.request.urlretrieve(PDF_URL, _pdf)
subprocess.run(["pdftohtml", "-xml", "-i", "-q", "-nodrm", _pdf, os.path.join(_tmp, "srd")], check=True)
import re, json, html
src = open(os.path.join(_tmp, 'srd.xml'), encoding='utf-8').read()
fonts = {}
for m in re.finditer(r'<fontspec id="(\d+)" size="(\d+)" family="([^"]+)" color="([^"]+)"', src):
    fonts[m.group(1)] = (int(m.group(2)), m.group(3), m.group(4))
def level(fid):
    size, fam, color = fonts[fid]
    if color != '#88191f': return 0
    if 'SemiBold' not in fam: return 0
    if size >= 39: return 1
    if size == 27: return 2
    if size in (21, 23): return 3
    if size == 18 and 'SC700' not in fam: return 4
    if 'SC700' in fam: return 5  # small caps table/sub titles
    return 0
SKIP = re.compile(r'^\s*(\d+|System Reference Document 5\.2\.1)\s*$')
items = []  # (page, kind, level, text, top, fid)
for pm in re.finditer(r'<page number="(\d+)".*?</page>', src, re.S):
    page = int(pm.group(1))
    for t in re.finditer(r'<text top="(\d+)" left="(\d+)" width="\d+" height="\d+" font="(\d+)">(.*?)</text>', pm.group(0), re.S):
        top, left, fid, raw = int(t.group(1)), int(t.group(2)), t.group(3), t.group(4)
        txt = html.unescape(re.sub(r'<[^>]+>', '', raw))
        if top > 1100 and (SKIP.match(txt) or fonts[fid][0] == 17): continue
        if not txt.strip(): 
            continue
        items.append((page, level(fid), txt, top, fid))
# merge heading fragments
chunks = []
path = {}
cur = None
def flush():
    global cur
    if cur and cur['text'].strip():
        chunks.append(cur)
    cur = None
def join_line(buf, line):
    if not buf: return line.strip()
    if buf.endswith('-') and line[:1].islower():
        return buf[:-1] + line.strip()
    return buf + ' ' + line.strip() if not buf.endswith('\n') else buf + line.strip()
i = 0
pending = None  # (level, text, top, fid, page)
while i < len(items):
    page, lv, txt, top, fid = items[i]
    if lv:
        # gather fragments of same heading (same font, same or next line)
        parts = [txt]; j = i + 1; last_top = top
        while j < len(items) and items[j][4] == fid and (items[j][3] == last_top or 0 < items[j][3] - last_top <= 30):
            if items[j][3] == last_top: parts.append(items[j][2])
            else: parts.append(' ' + items[j][2])
            last_top = items[j][3]; j += 1
        head = re.sub(r'\s+', ' ', ''.join(parts)).strip()
        i = j
        if lv == 5:
            # table / small heading: keep inline in current chunk
            if cur is not None: cur['text'] += '\n' + head.title() + ':\n'
            continue
        flush()
        if lv == 4 and fonts[fid][0] == 18 and 3 in path and path.get('_block'):
            del path[3]; path.pop('_block', None)
        if lv == 3:
            path['_block'] = fonts[fid][0] == 23
        elif lv < 3:
            path.pop('_block', None)
        path[lv] = head
        for k in [k for k in path if k != '_block']:
            if k > lv: del path[k]
        crumbs = [path[k] for k in sorted(k for k in path if k != '_block') if k < lv]
        cur = {'title': head, 'path': crumbs, 'page': page, 'text': ''}
        continue
    if cur is None:
        cur = {'title': 'Legal Information', 'path': [], 'page': page, 'text': ''}
    line = txt
    if line.startswith('  '):  # paragraph indent
        cur['text'] = cur['text'].rstrip() + '\n'
    cur['text'] = join_line(cur['text'], line) if not cur['text'].endswith('\n') else cur['text'] + line.strip()
    i += 1
flush()
# drop table of contents / index noise
out = []
for c in chunks:
    t = re.sub(r'[ \t]+', ' ', c['text']).strip()
    t = re.sub(r'\.{4,}\s*\d+', '', t)
    t = re.sub(r'\b(S tr|D ex|C on|I nt|W IS|C ha)\b', lambda m: m.group(1).replace(' ', '').title(), t)
    t = t.replace('MOD SAVE MOD SAVE MOD SAVE ', '(score mod save) ')
    if len(t) < 20: continue
    title = c['title']
    # condition tag
    kind = 'rule'
    top = (c['path'][0] if c['path'] else title)
    if re.search(r'\[Condition\]', title): kind = 'condition'
    elif top.startswith('Spells') or re.match(r'^Level \d|^.*Cantrip', t[:60]): kind = 'spell'
    elif top.startswith('Monsters') or top.startswith('Animals'): kind = 'monster'
    elif top.startswith('Classes'): kind = 'class'
    elif top.startswith('Magic Items'): kind = 'item'
    elif top.startswith('Equipment'): kind = 'equipment'
    elif top.startswith('Rules Glossary'): kind = 'glossary'
    out.append({'title': title, 'path': c['path'], 'page': c['page'], 'kind': kind, 'text': t})
# split long chunks
final = []
for c in out:
    t = c['text']
    if len(t) <= 2400:
        final.append(c); continue
    paras = re.split(r'\n', t); buf = ''; part = 1
    for p in paras:
        if len(buf) + len(p) > 2000 and buf:
            final.append({**c, 'text': buf.strip(), 'part': part}); part += 1; buf = ''
        buf += p + '\n'
    if buf.strip(): final.append({**c, 'text': buf.strip(), 'part': part})
chunks = []
for c in final:
    if c['title'] == 'Legal Information':
        continue
    row = {"t": c['title'], "p": c['path'], "pg": c['page'], "k": c['kind'], "x": c['text']}
    if 'part' in c:
        row["n"] = c['part']
    chunks.append(row)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({"source": "System Reference Document 5.2.1", "attribution": ATTRIBUTION, "chunks": chunks}, f, ensure_ascii=False, separators=(',', ':'))
print(f"{len(chunks)} chunks written to {OUT}")
