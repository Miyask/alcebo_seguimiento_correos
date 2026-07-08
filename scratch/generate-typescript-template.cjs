const fs = require('fs');

try {
  const html = fs.readFileSync('scratch/template-body.html', 'utf8');
  // Escape backticks and placeholders
  const escaped = html
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  
  const fileContent = `export const WORD_TEMPLATE_HTML = \`${escaped}\`;\n`;
  fs.writeFileSync('src/data/wordTemplateHtml.ts', fileContent);
  console.log('src/data/wordTemplateHtml.ts generated successfully.');
} catch (err) {
  console.error(err);
}
