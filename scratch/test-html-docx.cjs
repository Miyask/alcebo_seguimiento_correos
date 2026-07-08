const fs = require('fs');
const htmlToDocx = require('html-to-docx');

async function run() {
  try {
    const htmlContent = '<h1>Documento de Prueba</h1><p>Hola Mundo, esto es un documento generado desde HTML.</p>';
    const fileBuffer = await htmlToDocx(htmlContent, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      header: true,
      pageNumber: true,
    });
    fs.writeFileSync('scratch/test-out.docx', fileBuffer);
    console.log('DOCX generated successfully from HTML!');
  } catch (err) {
    console.error(err);
  }
}

run();
