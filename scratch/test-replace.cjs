const fs = require('fs');
const PizZip = require('pizzip');

try {
  const fileData = fs.readFileSync('Ppo-mail-2022.docx');
  const zip = new PizZip(fileData);
  let docXml = zip.file('word/document.xml').asText();

  console.log('Original occurrences of @@@@:', (docXml.match(/@+/g) || []).length);

  let count = 0;
  docXml = docXml.replace(/<w:t>@@@@@@@@<\/w:t>/g, (match) => {
    count++;
    if (count === 1) return '<w:t>{clientName}</w:t>';
    if (count === 2) return '<w:t>{clientAddress}</w:t>';
    return `<w:t>{address_${count}}</w:t>`;
  });

  zip.file('word/document.xml', docXml);
  const out = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync('Ppo-mail-2022-test-out.docx', out);
  console.log('Test docx saved. Remaining @:', (docXml.match(/@+/g) || []).length);
} catch (err) {
  console.error(err);
}
