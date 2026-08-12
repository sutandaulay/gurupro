const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Use dynamic require for pdfplumber to avoid issues
let fitz;
try {
  // Try to use PyMuPDF via child process since Node can't load it directly
  fitz = null;
} catch (e) {}

// Instead, use Python to render + tesseract.js to OCR
// The pipeline: Python renders PDF pages -> PNG -> tesseract.js OCR

async function run() {
  const { createWorker } = Tesseract;
  const { execSync } = require('child_process');

  const pdfPath = process.argv[2] || 'Kepka BKPDM No 020 Tahun 2026 tentang Perubahan a_260620_091552.pdf';
  const outputFile = process.argv[3] || 'extracted_agama_override_ocr.txt';
  const startPage = parseInt(process.argv[4] || '1');
  const endPage = parseInt(process.argv[5] || '79');

  console.log(`OCR: ${pdfPath}`);
  console.log(`Pages: ${startPage}-${endPage}`);
  console.log(`Output: ${outputFile}`);

  // Create temp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-ocr-'));
  console.log(`Temp dir: ${tmpDir}`);

  // Use Python to render PDF pages to PNG
  console.log('Rendering PDF pages to PNG...');
  const renderScript = `
import sys
import fitz
pdf_path = sys.argv[1]
tmp_dir = sys.argv[2]
start = int(sys.argv[3])
end = int(sys.argv[4])
doc = fitz.open(pdf_path)
for i in range(start - 1, min(end, len(doc))):
    page = doc[i]
    mat = fitz.Matrix(2.5, 2.5)
    pix = page.get_pixmap(matrix=mat)
    pix.save(f"{tmp_dir}/page_{i+1:03d}.png")
    if (i + 1) % 10 == 0:
        print(f"Rendered {i+1} pages...")
print(f"DONE:{len(doc)}")
doc.close()
`;

  const scriptPath = path.join(tmpDir, 'render.py');
  fs.writeFileSync(scriptPath, renderScript);

  try {
    const pyOut = execSync(
      `python "${scriptPath}" "${pdfPath}" "${tmpDir}" ${startPage} ${endPage}`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8', timeout: 300000 }
    );
    console.log('Python output:', pyOut.trim());
  } catch (e) {
    console.error('Python render error:', e.message);
    fs.rmSync(tmpDir, { recursive: true });
    return;
  }

  // Get list of rendered pages
  const pages = fs.readdirSync(tmpDir)
    .filter(f => f.endsWith('.png'))
    .map(f => parseInt(f.match(/(\d+)/)[1]))
    .sort((a, b) => a - b);

  console.log(`Rendered ${pages.length} pages. Starting OCR...`);

  // OCR each page
  const worker = await createWorker('ind+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        process.stdout.write('.');
      }
    }
  });

  let fullText = '';
  for (const pageNum of pages) {
    const imgPath = path.join(tmpDir, `page_${String(pageNum).padStart(3, '0')}.png`);
    try {
      const { data: { text } } = await worker.recognize(imgPath);
      fullText += `\n--- PAGE ${pageNum} ---\n${text}`;
      process.stdout.write(`\nPage ${pageNum}: ${text.trim().split('\n').length} lines\n`);
    } catch (e) {
      console.error(`\nOCR error page ${pageNum}: ${e.message}`);
    }
  }

  await worker.terminate();

  // Clean up temp files
  for (const pageNum of pages) {
    const imgPath = path.join(tmpDir, `page_${String(pageNum).padStart(3, '0')}.png`);
    try { fs.unlinkSync(imgPath); } catch (e) {}
  }
  fs.rmSync(tmpDir, { recursive: true });

  fs.writeFileSync(outputFile, fullText);
  console.log(`\n\nTotal: ${fullText.length} chars, ${fullText.split('\n').length} lines`);
  console.log(`Saved to ${outputFile}`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
