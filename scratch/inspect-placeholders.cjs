const fs = require('fs');
const PizZip = require('pizzip');

try {
  const fileData = fs.readFileSync('Ppo-mail-2022.docx');
  const zip = new PizZip(fileData);
  let docXml = zip.file('word/document.xml').asText();

  // Find all <w:p> elements containing @
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let match;
  let index = 1;
  while ((match = pRegex.exec(docXml)) !== null) {
    const content = match[1];
    if (content.includes('@')) {
      // Strip XML tags to see clean text
      const cleanText = content.replace(/<[^>]+>/g, '');
      console.log(`Paragraph ${index}:`, cleanText);
      index++;
    }
  }
} catch (err) {
  console.error(err);
}
