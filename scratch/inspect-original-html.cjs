const fs = require('fs');
const mammoth = require('mammoth');

async function run() {
  try {
    const result = await mammoth.convertToHtml({ path: 'Ppo-mail-2022.docx' });
    const html = result.value;

    const regex = /@@@@/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const index = match.index;
      const start = Math.max(0, index - 80);
      const end = Math.min(html.length, index + 80);
      console.log(`Match at index ${index}:`);
      console.log(`   ... ${html.substring(start, end)} ...`);
      console.log('----------------------------------------------------');
    }
  } catch (err) {
    console.error(err);
  }
}

run();
