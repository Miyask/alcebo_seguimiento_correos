const fs = require('fs');
const mammoth = require('mammoth');

async function run() {
  try {
    const result = await mammoth.convertToHtml({ path: 'Ppo-mail-2022.docx' });
    let html = result.value;

    console.log('Original conversion warnings:', result.messages);

    // We can do a sequential search or a global replace on known placeholder patterns:
    let clean = html
      .replace(/Ref:\s*@@@@@@@@/g, 'Ref: <strong>[REF_CODE]</strong>')
      .replace(/Com\.\s*Prop\.\s*@@@@@@@@/g, 'Com. Prop. <strong>[CLIENT_NAME]</strong>')
      .replace(/C\/\s*@@@@@@@@/g, 'C/ <strong>[CLIENT_ADDRESS]</strong>')
      .replace(/28@@@@\s+Madrid/g, '<strong>[POSTAL_CODE]</strong> Madrid')
      .replace(/Att:\s*D\.\s*@@@@@@@@/g, 'Att: D. <strong>[ATT_NAME]</strong>')
      
      // Date: día @@ de @@@@@ de 20@@
      .replace(/día\s+@@\s+de\s+@@@@@\s+de\s+20@@/g, 'día <strong>[DAY]</strong> de <strong>[MONTH]</strong> de 20<strong>[YEAR]</strong>')
      
      // Pest: presencia de @@@@palomas
      .replace(/presencia\s+de\s+@@@@palomas/g, 'presencia de <strong>[PLAGA]</strong>')
      
      // Affected: en @@@@@@@@ y @@@@@@@@
      .replace(/en\s+@@@@@@@@\s+y\s+@@@@@@@@/g, 'en <strong>[ZONAS_AFECTADAS]</strong>')
      
      // Intro: comprobar cómo @@@@@@@@
      .replace(/comprobar\s+cómo\s+@@@@@@@@\./g, 'comprobar cómo <strong>[INTRO_TECNICA]</strong>.')
      
      // Problem: El problema principal @@@@@@@@
      .replace(/El\s+problema\s+principal\s+@@@@@@@@/g, 'El problema principal <strong>[PROBLEMA_PRINCIPAL]</strong>')
      
      // Detail: comprobar que @@@@@@@@
      .replace(/comprobar\s+que\s+@@@@@@@@/g, 'comprobar que <strong>[DETALLE_ADICIONAL]</strong>')
      
      // Section 6 header
      .replace(/C\/\s+@@@@@@@@/g, 'C/ <strong>[CLIENT_ADDRESS]</strong>')
      .replace(/280@@/g, '<strong>[POSTAL_CODE_PREFIX]</strong>')
      .replace(/Ref-@@@@@@@@@@@/g, 'Ref-<strong>[REF_CODE]</strong>')
      
      // Tecnico / Telefono
      .replace(/Técnico\s+Comercial:\s*@@@@@@@@@@@/g, 'Técnico Comercial: <strong>[TECNICO]</strong>')
      .replace(/TlfMv\s*@@@@@@@@/g, 'TlfMv <strong>[TELEFONO]</strong>');

    // Replace the three protection zones sequentially
    let zoneIndex = 1;
    clean = clean.replace(/<strong>Protección de <\/strong>@@@@@@@@/g, (match) => {
      const replaced = `<strong>Protección de </strong><strong>[ZONA_${zoneIndex}]</strong>`;
      zoneIndex++;
      return replaced;
    });

    // Replace the three price lines sequentially
    clean = clean.replace(/\.\.\.[\s\t\.]*@@@@@\s*€/, '................... <strong>[PRECIO_1]</strong> €');
    clean = clean.replace(/\.\.\.[\s\t\.]*@@@@\s*€/, '...................................... <strong>[PRECIO_2]</strong> €');
    clean = clean.replace(/\.\.\.[\s\t\.]*@@@@@\s*€/, '........... <strong>[PRECIO_3]</strong> €');

    // Add CSS stylesheet styling for Mammoth HTML inside the editor
    const styledHtml = `
      <div class="word-docx-high-fidelity" style="font-family: 'Calibri', 'Arial', sans-serif; font-size: 11.5pt; line-height: 1.5; color: #333;">
        ${clean}
      </div>
    `;

    fs.writeFileSync('scratch/template-body.html', styledHtml);
    console.log('High-fidelity HTML generated successfully.');
  } catch (err) {
    console.error(err);
  }
}

run();
