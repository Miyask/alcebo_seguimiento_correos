const fs = require('fs');
const PizZip = require('pizzip');

try {
  const fileData = fs.readFileSync('Ppo-mail-2022.docx');
  const zip = new PizZip(fileData);
  const docXml = zip.file('word/document.xml').asText();

  // Simple XML parser to get w:p and w:t
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let match;
  let html = '';

  while ((match = pRegex.exec(docXml)) !== null) {
    const pContent = match[1];
    
    // Find all text runs
    const rRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    let rMatch;
    let pText = '';
    let isBold = false;
    let isHeading = false;

    while ((rMatch = rRegex.exec(pContent)) !== null) {
      const rContent = rMatch[1];
      
      // Check if bold
      const bold = rContent.includes('<w:b/>') || rContent.includes('<w:b ');
      
      // Get text
      const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(rContent)) !== null) {
        let text = tMatch[1];
        if (bold) {
          text = `<strong>${text}</strong>`;
        }
        pText += text;
      }
    }

    if (pText.trim()) {
      // Check if it's a heading
      if (pText.startsWith('1.-') || pText.startsWith('2.-') || pText.startsWith('3.-') || pText.startsWith('4.-') || pText.startsWith('5.-') || pText.startsWith('6.-') || pText.includes('CONTENIDO')) {
        html += `<h3 style="color:#009FE3; font-weight:bold; margin-top:20px; font-size:14px; border-bottom:1px solid #ddd; padding-bottom:5px;">${pText}</h3>\n`;
      } else {
        // Replace placeholders with template tags for easy replacement
        let clean = pText
          .replace(/Ref:\s*@@@@@@@@/g, 'Ref: <strong>[REF_CODE]</strong>')
          .replace(/Com\.\s*Prop\.\s*@@@@@@@@/g, 'Com. Prop. <strong>[CLIENT_NAME]</strong>')
          .replace(/C\/\s*@@@@@@@@/g, 'C/ <strong>[CLIENT_ADDRESS]</strong>')
          .replace(/28@@@@\s*Madrid/g, '<strong>[POSTAL_CODE]</strong> Madrid')
          .replace(/Att:\s*D\.\s*@@@@@@@@/g, 'Att: D. <strong>[ATT_NAME]</strong>')
          .replace(/pasado día @@ de @@@@@ de 20@@/g, 'pasado día <strong>[FECHA]</strong>')
          .replace(/presencia de @@@@palomas/g, 'presencia de <strong>[PLAGA]</strong>')
          .replace(/en @@@@@@@@ y @@@@@@@@/g, 'en <strong>[ZONAS_AFECTADAS]</strong>')
          .replace(/pudimos comprobar cómo @@@@@@@@\./g, 'pudimos comprobar cómo <strong>[INTRO_TECNICA]</strong>.')
          .replace(/El problema principal @@@@@@@@/g, 'El problema principal <strong>[PROBLEMA_PRINCIPAL]</strong>')
          .replace(/comprobar que @@@@@@@@/g, 'comprobar que <strong>[DETALLE_ADICIONAL]</strong>')
          .replace(/Protección de @@@@@@@@/g, 'Protección de <strong>[SISTEMA_RECOMENDADO]</strong>')
          .replace(/Técnico Comercial:\s*@@@@@@@@@@@\s*TlfMv\s*@@@@@@@@/g, 'Técnico Comercial: <strong>[TECNICO]</strong> TlfMv <strong>[TELEFONO]</strong>');
        
        html += `<p style="margin-bottom:10px; font-size:12px; line-height:1.6; text-align:justify;">${clean}</p>\n`;
      }
    }
  }

  fs.writeFileSync('scratch/template-body.html', html);
  console.log('HTML template body generated successfully.');
} catch (err) {
  console.error(err);
}
