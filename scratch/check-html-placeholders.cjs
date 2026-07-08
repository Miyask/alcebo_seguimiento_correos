const fs = require('fs');

try {
  const html = fs.readFileSync('scratch/template-body.html', 'utf8');
  const tags = [
    '[REF_CODE]',
    '[CLIENT_NAME]',
    '[CLIENT_ADDRESS]',
    '[POSTAL_CODE]',
    '[ATT_NAME]',
    '[DAY]',
    '[MONTH]',
    '[YEAR]',
    '[PLAGA]',
    '[ZONAS_AFECTADAS]',
    '[INTRO_TECNICA]',
    '[PROBLEMA_PRINCIPAL]',
    '[DETALLE_ADICIONAL]',
    '[ZONA_1]',
    '[ZONA_2]',
    '[ZONA_3]',
    '[POSTAL_CODE_PREFIX]',
    '[PRECIO_1]',
    '[PRECIO_2]',
    '[PRECIO_3]',
    '[TECNICO]',
    '[TELEFONO]'
  ];

  tags.forEach(tag => {
    const has = html.includes(tag);
    console.log(`Tag ${tag}: ${has ? 'FOUND' : 'NOT FOUND'}`);
  });
} catch (err) {
  console.error(err);
}
