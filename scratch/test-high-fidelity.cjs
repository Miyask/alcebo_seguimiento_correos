const fs = require('fs');
const PizZip = require('pizzip');

try {
  const fileData = fs.readFileSync('Ppo-mail-2022.docx');
  const zip = new PizZip(fileData);
  let docXml = zip.file('word/document.xml').asText();

  // Let's replace the specific paragraphs by replacing their XML structure
  // 1. Ref: @@@@@@@@
  docXml = docXml.replace(/(<w:t>Ref:\s*<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1ALC-2026-901$2');
  
  // 2. Com. Prop. @@@@@@@@
  docXml = docXml.replace(/(<w:t>Com\.\s*Prop\.\s*<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1Comunidad de Propietarios Calle Mayor 15$2');

  // 3. C/ @@@@@@@@
  docXml = docXml.replace(/(<w:t>C\/\s*<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1Calle Mayor 15, Madrid$2');

  // 4. 28@@@@   Madrid
  docXml = docXml.replace(/(<w:t>28)[^<]*(   Madrid<\/w:t>)/, '$1080$2');

  // 5. Att: D. @@@@@@@@
  docXml = docXml.replace(/(<w:t>Att:\s*D\.\s*<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1Administrador de Fincas$2');

  // 6. Date in paragraph: pasado día @@ de @@@@@ de 20@@
  // Let's find "pasado día" and the subsequent w:t elements
  docXml = docXml.replace(/(pasado día<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>[\s\S]*?<w:t> de <\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>[\s\S]*?<w:t> de 20<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, 
    '$107$2Julio$326$4');

  // 7. presencia de @@@@palomas
  docXml = docXml.replace(/(presencia de<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>[\s\S]*?<w:t>palomas<\/w:t>)/, '$150$2');

  // 8. en @@@@@@@@ y @@@@@@@@
  docXml = docXml.replace(/(<w:t>@@@@@@@@ y @@@@@@@@<\/w:t>)/, '<w:t>canalones y cornisas superiores</w:t>');

  // 9. pudimos comprobar cómo @@@@@@@@.
  docXml = docXml.replace(/(pudimos comprobar cómo<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1las aves anidaban activamente y dañaban la fachada con deyecciones$2');

  // 10. El problema principal @@@@@@@@
  docXml = docXml.replace(/(El problema principal<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1es el riesgo de desprendimiento de nidos y la corrosión ácida$2');

  // 11. Además, también pudimos comprobar que @@@@@@@@
  docXml = docXml.replace(/(pudimos comprobar que<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1los canalones estaban completamente obstruidos por plumas y detritos$2');

  // 12. Zonas de protección
  docXml = docXml.replace(/(Protección de<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1Canalones del tejado con red de polietileno$2');
  docXml = docXml.replace(/(Protección de<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1Cornisas superiores con varillas inoxidables$2');

  // 13. Presupuesto C/ @@@@@@@@
  docXml = docXml.replace(/(PRESUPUESTO Y GARANTÍAS\s+C\/\s*<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1Calle Mayor 15, Madrid$2');

  // 14. 280@@ Madrid    - Ref-@@@@@@@@@@@
  docXml = docXml.replace(/(280)[^<]*( Madrid\s+- Ref-)[^<]*(<\/w:t>)/, '$108$2ALC-2026-901$3');

  // 15. Prices:
  // - Protección canalones del tejado (Red Paloma)................... @@@@@ €
  docXml = docXml.replace(/(canalones del tejado \(Red Paloma\)<\/w:t>[\s\S]*?<w:t>\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\.\. <\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1 350$2');
  // - Protección de huecos de ventilación....................@@@@ €
  docXml = docXml.replace(/(huecos de ventilación\. <\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1120$2');
  // - Protección de las 2 cornisas superiores (Red y Varilla) ........... @@@@@ €
  docXml = docXml.replace(/(Red y Varilla\) <\/w:t>[\s\S]*?<w:t>\.\.\.\.\.\.\.\.\.\.\. <\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, '$1 470$2');

  // 16. Técnico Comercial: @@@@@@@@@@@ TlfMv @@@@@@@@
  docXml = docXml.replace(/(Técnico Comercial:\s*<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>[\s\S]*?<w:t>\s*TlfMv\s*<\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/, 
    '$1Juan Pérez$2600123456$3');

  // Save back and check
  zip.file('word/document.xml', docXml);
  const out = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync('Ppo-mail-2022-test-fidelity.docx', out);
  console.log('High-fidelity replacement complete. Remaining @:', (docXml.match(/@+/g) || []).length);
} catch (err) {
  console.error(err);
}
