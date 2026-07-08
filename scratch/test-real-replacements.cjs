const fs = require('fs');
const PizZip = require('pizzip');
const WordExtractor = require('word-extractor');

try {
  const fileData = fs.readFileSync('Ppo-mail-2022.docx');
  const zip = new PizZip(fileData);
  let docXml = zip.file('word/document.xml').asText();

  const payload = {
    clientName: 'COMUNIDAD EJEMPLO',
    clientAddress: 'Calle Mayor 100',
    postalCode: '28014',
    refCode: 'REF-TEST-999',
    attName: 'Presidente',
    day: '15',
    month: 'Julio',
    year: '26',
    pest: 'Palomas',
    affectedZones: 'coronaciones y voladizos',
    customDesc: 'Se detectó anidamiento masivo.',
    problemText: 'es la acumulación de excrementos.',
    customCheck: 'Se revisó toda la cubierta.',
    zone1: 'Zonas comunes',
    zone2: 'Techos del ático',
    zone3: 'Cornisas traseras',
    price1: '150.00',
    price2: '80.00',
    price3: '230.00',
    tecnico: 'Técnico Oficial',
    telefono: '600123456'
  };

  const replacements = [
    () => payload.refCode,
    () => payload.clientName,
    () => payload.clientAddress,
    () => `${payload.postalCode}   Madrid`,
    () => payload.attName,
    () => payload.day,
    () => payload.month,
    () => payload.year,
    () => payload.clientAddress,
    () => payload.pest,
    () => payload.affectedZones,
    () => payload.customDesc,
    () => `El problema principal ${payload.problemText}`,
    () => payload.customCheck,
    () => payload.zone1,
    () => payload.zone2,
    () => payload.zone3,
    () => payload.clientAddress,
    () => payload.postalCode,
    () => payload.refCode,
    () => `................... ${payload.price1}`,
    () => `${payload.price2}`,
    () => `........ ${payload.price3}`,
    () => payload.tecnico,
    () => payload.telefono
  ];

  let index = 0;
  docXml = docXml.replace(/<w:t([^>]*)>([^<]*?@[^<]*?)<\/w:t>/g, (match, attrs, content) => {
    if (index < replacements.length) {
      const val = replacements[index]();
      console.log(`Replacing tag ${index + 1} "${content}" with "${val}"`);
      index++;
      const escapedVal = val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      return `<w:t${attrs}>${escapedVal}</w:t>`;
    }
    return match;
  });

  zip.file('word/document.xml', docXml);
  const out = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync('Ppo-mail-2022-replaced-debug.docx', out);

  // Extract text of replaced docx to see if it contains the values
  const extractor = new WordExtractor();
  extractor.extract('Ppo-mail-2022-replaced-debug.docx').then(doc => {
    console.log('--- EXTRACTED TEXT ---');
    console.log(doc.getBody().substring(0, 1000));
  });

} catch (err) {
  console.error(err);
}
