const fs = require('fs');

try {
  const content = fs.readFileSync('d:/gurupro/pembuat_soal_otomatis.html', 'utf8');
  // Extract URL encoded string between decodeURIComponent(" and ")
  const match = content.match(/decodeURIComponent\("([^"]+)"\)/);
  if (match && match[1]) {
    const encoded = match[1];
    const decoded = decodeURIComponent(encoded);
    fs.writeFileSync('d:/gurupro/decoded_pembuat_soal_otomatis.html', decoded, 'utf8');
    console.log("SUKSES: File berhasil didekode ke d:/gurupro/decoded_pembuat_soal_otomatis.html");
  } else {
    console.error("Gagal mencocokkan decodeURIComponent di dalam file!");
  }
} catch (e) {
  console.error("Error:", e.message);
}
