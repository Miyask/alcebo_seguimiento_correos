const fs = require('fs');
const PizZip = require('pizzip');

try {
  const fileData = fs.readFileSync('Ppo-mail-2022.docx');
  const zip = new PizZip(fileData);
  let docXml = zip.file('word/document.xml').asText();

  const tRegex = /<w:t[^>]*>([^<]*?@[^<]*?)<\/w:t>/g;
  let match;
  let index = 1;
  while ((match = tRegex.exec(docXml)) !== null) {
    console.log(`t-tag ${index}: "${match[1]}"`);
    index++;
  }
} catch (err) {
  console.error(err);
}
