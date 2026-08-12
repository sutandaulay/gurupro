import re, json, sys

with open('extracted_agama_override_ocr.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

full_text = ''.join(lines)

def get_section(start, end):
    return ''.join(lines[start:end])

FASE_KELAS = {'A':'I-II','B':'III-IV','C':'V-VI','D':'VII-IX','E':'X-XI','F':'XII'}

KRISTEN_ELEMEN = [
    'Allah Pencipta', 'Allah Pemelihara', 'Allah Penyelamat',
    'Allah Pembaru', 'Allah Berkarya',
    'Manusia dan Hakikat Manusia', 'Nilai-Nilai Kristiani',
    'Gereja dan Masyarakat Majemuk', 'Alam dan Lingkungan Hidup'
]

KATOLIK_ELEMEN = [
    'Pribadi Murid', 'Iman dan Ibadah',
    'Gereja dan Masyarakat', 'Alam dan Lingkungan'
]

def escape_re(s):
    return re.escape(s)

def extract_table_content(text, elems, fase_letter):
    """Extract CP content by finding each element header and content until next element."""
    # Clean up: remove page markers and repeated headers
    text = re.sub(r'--- PAGE \d+ ---[\s\S]*?---\d+-[\s\S]*?\n', ' ', text)
    text = re.sub(r'--- PAGE \d+ ---\s*\n?\s*-?\d+-', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    elemen_list = []
    for elem in elems:
        # Find element header - could be "Elem | Sub" or "Elem" at start of line
        elem_re = re.compile(
            r'(?:^|\n)(' + escape_re(elem) + r')\s*\|?\s*([^\n]*)',
            re.MULTILINE | re.IGNORECASE
        )
        m = elem_re.search(text)
        if not m:
            continue

        elem_pos = m.start()
        elem_header = m.group(0).strip()

        # Get content from end of header to next element header (or end)
        remaining = text[elem_pos + len(elem_header):]

        # Find next element
        next_elem_pos = len(remaining)
        for next_elem in elems:
            if next_elem == elem:
                continue
            next_m = re.search(
                r'(?:^|\n)(' + escape_re(next_elem) + r')\b',
                remaining, re.MULTILINE | re.IGNORECASE
            )
            if next_m and next_m.start() < next_elem_pos:
                next_elem_pos = next_m.start()

        # Also stop at next fase
        next_fase_m = re.search(r'\n\d+\.\s*Fase\s+[A-F]\s*\(', remaining)
        if next_fase_m and next_fase_m.start() < next_elem_pos:
            next_elem_pos = next_fase_m.start()

        content = remaining[:next_elem_pos].strip()
        content = content.replace('\n', ' ').replace('  ', ' ').strip()
        # Remove trailing element/phrase artifacts
        content = re.sub(r'\s*[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}\s*$', '', content).strip()

        if len(content) > 5:
            elemen_list.append({'nama_elemen': elem, 'capaian_pembelajaran': content})

    return elemen_list

def extract_mapel(text, elems, mapel_name):
    results = []
    fase_pattern = re.compile(r'(\d+)\.\s*Fase\s+([A-F])\s*\(', re.MULTILINE)
    fase_matches = list(fase_pattern.finditer(text))

    for i, m in enumerate(fase_matches):
        fase_letter = m.group(2)
        start = m.start()
        end = fase_matches[i+1].start() if i+1 < len(fase_matches) else len(text)
        fase_text = text[start:end]

        # Find CP table section
        cp_idx = fase_text.find('Capaian Pembelajaran')
        if cp_idx < 0:
            continue
        table_text = fase_text[cp_idx:]

        elems_found = extract_table_content(table_text, elems, fase_letter)
        if elems_found:
            results.append({
                'mapel': mapel_name,
                'fase': fase_letter,
                'kelas': FASE_KELAS[fase_letter],
                'elemen': elems_found
            })

    return results

# Kristen
kristen_text = get_section(450, 1000)
kristen = extract_mapel(kristen_text, KRISTEN_ELEMEN, 'Kristen')
print(f"Kristen: {len(kristen)} fases", file=sys.stderr)
for r in kristen:
    print(f"  Fase {r['fase']}: {len(r['elemen'])}/{len(KRISTEN_ELEMEN)} elemen", file=sys.stderr)
    for e in r['elemen']:
        print(f"    [{e['nama_elemen']}]: {e['capaian_pembelajaran'][:100]}", file=sys.stderr)

# Katolik
katolik_text = get_section(1000, 1465)
katolik = extract_mapel(katolik_text, KATOLIK_ELEMEN, 'Katolik')
print(f"\nKatolik: {len(katolik)} fases", file=sys.stderr)
for r in katolik:
    print(f"  Fase {r['fase']}: {len(r['elemen'])}/{len(KATOLIK_ELEMEN)} elemen", file=sys.stderr)
    for e in r['elemen']:
        print(f"    [{e['nama_elemen']}: {e['capaian_pembelajaran'][:100]}", file=sys.stderr)

print('\n---JSON---')
print(json.dumps(kristen + katolik, indent=2, ensure_ascii=False))
