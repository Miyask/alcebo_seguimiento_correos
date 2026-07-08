const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

try {
  const fileData = fs.readFileSync('Ppo-mail-2022.docx');
  const zip = new PizZip(fileData);
  const mediaDir = path.join('src', 'assets', 'template');
  
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  Object.keys(zip.files).forEach(f => {
    if (f.startsWith('word/media/')) {
      const filename = path.basename(f);
      const buffer = zip.files[f].asNodeBuffer();
      fs.writeFileSync(path.join(mediaDir, filename), buffer);
      console.log(`Extracted: ${filename} (${buffer.length} bytes)`);
    }
  });
} catch (err) {
  console.error(err);
}
