import re, json, sys

# Read extracted OCR text
with open('extracted_agama_override_ocr.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

full_text = ''.join(lines)

# Kristen section: lines 450-1000 (0-indexed)
# Katolik section: lines 1000-1465

def get_section(start, end):
    return ''.join(lines[start:end])

# Kristen: table rows contain | separators with Elemen | CP or Elemen | Sub | CP
KRISTEN_FASES = ['A','B','C','D','E','F']
KATOLIK_FASES = ['A','B','C','D','E','F']

# Extract Kristen table content per fase
def extract_kristen():
    text = get_section(450, 1000)
    results = []

    # Find fase boundaries
    fase_pattern = re.compile(r'(\d+)\.\s*Fase\s+([A-F])\s*\(', re.MULTILINE)
    fase_matches = list(fase_pattern.finditer(text))

    FASE_KELAS = {'A':'I-II','B':'III-IV','C':'V-VI','D':'VII-IX','E':'X-XI','F':'XII'}

    for i, m in enumerate(fase_matches):
        fase_letter = m.group(2)
        start = m.start()
        end = fase_matches[i+1].start() if i+1 < len(fase_matches) else len(text)
        fase_text = text[start:end]

        # Find table start
        table_start = fase_text.find('Capaian Pembelajaran')
        if table_start < 0:
            continue
        table_text = fase_text[table_start:]

        # Extract rows: look for pattern "Elemen | Content" or "Sub | Content"
        # Rows are in format: ELEMEN | sub-elemen text | CP text
        # or: ELEMEN | CP text (single column)

        # Split by double newline (row boundaries)
        raw_rows = table_text.split('\n\n')

        elemen_list = []
        current_elem = ''
        current_cp = ''

        for row in raw_rows:
            row = row.strip().replace('\n', ' ').replace('| ', '|').replace(' |', '|')
            if not row or 'Capaian Pembelajaran' in row[:50] or row.startswith('--- PAGE'):
                continue

            # Check for pipe separator
            if '|' in row:
                parts = [p.strip() for p in row.split('|')]
                parts = [p for p in parts if p]

                if len(parts) >= 2:
                    left = parts[0].strip()
                    right = ' '.join(parts[1:]).strip()

                    # Left part could be element name or sub-element
                    # Element names: Allah Pencipta, Allah Pemelihara, etc.
                    is_elem = left in ['Allah Pencipta','Allah Pemelihara','Allah Penyelamat','Allah Pembaru',
                                       'Allah Berkarya','Manusia dan Hakikat Manusia','Nilai-Nilai Kristiani',
                                       'Gereja dan Masyarakat Majemuk','Alam dan Lingkungan Hidup',
                                       'Pribadi Murid','Iman dan Ibadah','Gereja dan Masyarakat','Alam dan Lingkungan']

                    if is_elem:
                        # Previous element done
                        if current_elem and current_cp:
                            elemen_list.append({'nama_elemen': current_elem, 'capaian_pembelajaran': current_cp.strip()})
                        current_elem = left
                        current_cp = right
                    else:
                        # Continuation or sub-element
                        if current_elem:
                            current_cp += ' ' + left + ' ' + right
                        else:
                            current_cp += ' ' + right
                elif len(parts) == 1:
                    if current_elem:
                        current_cp += ' ' + parts[0]
            elif row.strip():
                # Plain text continuation
                if current_elem:
                    current_cp += ' ' + row.strip()

        # Don't forget last element
        if current_elem and current_cp:
            elemen_list.append({'nama_elemen': current_elem, 'capaian_pembelajaran': current_cp.strip()})

        if elemen_list:
            results.append({
                'mapel': 'Kristen',
                'fase': fase_letter,
                'kelas': FASE_KELAS[fase_letter],
                'elemen': elemen_list
            })

    return results

def extract_katolik():
    text = get_section(1000, 1465)
    results = []

    fase_pattern = re.compile(r'(\d+)\.\s*Fase\s+([A-F])\s*\(', re.MULTILINE)
    fase_matches = list(fase_pattern.finditer(text))

    FASE_KELAS = {'A':'I-II','B':'III-IV','C':'V-VI','D':'VII-IX','E':'X-XI','F':'XII'}

    for i, m in enumerate(fase_matches):
        fase_letter = m.group(2)
        start = m.start()
        end = fase_matches[i+1].start() if i+1 < len(fase_matches) else len(text)
        fase_text = text[start:end]

        # Find table start - Katolik has 'Capaian Pembelajaran' table too
        table_start = fase_text.find('Capaian Pembelajaran')
        if table_start < 0:
            continue
        table_text = fase_text[table_start:]

        raw_rows = table_text.split('\n\n')
        elemen_list = []
        current_elem = ''
        current_cp = ''

        KATOLIK_ELEMEN = ['Pribadi Murid','Iman dan Ibadah','Gereja dan Masyarakat','Alam dan Lingkungan']

        for row in raw_rows:
            row = row.strip().replace('\n', ' ').replace('| ', '|').replace(' |', '|')
            if not row or row.startswith('--- PAGE'):
                continue

            if '|' in row:
                parts = [p.strip() for p in row.split('|')]
                parts = [p for p in parts if p]

                if len(parts) >= 2:
                    left = parts[0].strip()
                    right = ' '.join(parts[1:]).strip()

                    if left in KATOLIK_ELEMEN:
                        if current_elem and current_cp:
                            elemen_list.append({'nama_elemen': current_elem, 'capaian_pembelajaran': current_cp.strip()})
                        current_elem = left
                        current_cp = right
                    else:
                        if current_elem:
                            current_cp += ' ' + left + ' ' + right
                        else:
                            current_cp += ' ' + right
                elif len(parts) == 1:
                    if current_elem:
                        current_cp += ' ' + parts[0]
            elif row.strip():
                if current_elem:
                    current_cp += ' ' + row.strip()

        if current_elem and current_cp:
            elemen_list.append({'nama_elemen': current_elem, 'capaian_pembelajaran': current_cp.strip()})

        if elemen_list:
            results.append({
                'mapel': 'Katolik',
                'fase': fase_letter,
                'kelas': FASE_KELAS[fase_letter],
                'elemen': elemen_list
            })

    return results

kristen = extract_kristen()
katolik = extract_katolik()

print(f"Kristen: {len(kristen)} fases", file=sys.stderr)
for r in kristen:
    print(f"  Fase {r['fase']}: {len(r['elemen'])} elemen", file=sys.stderr)
    for e in r['elemen']:
        print(f"    [{e['nama_elemen']}]: {e['capaian_pembelajaran'][:80]}", file=sys.stderr)

print(f"\nKatolik: {len(katolik)} fases", file=sys.stderr)
for r in katolik:
    print(f"  Fase {r['fase']}: {len(r['elemen'])} elemen", file=sys.stderr)
    for e in r['elemen']:
        print(f"    [{e['nama_elemen']}]: {e['capaian_pembelajaran'][:80]}", file=sys.stderr)

print('\n---JSON---')
all_results = kristen + katolik
print(json.dumps(all_results, indent=2, ensure_ascii=False))
