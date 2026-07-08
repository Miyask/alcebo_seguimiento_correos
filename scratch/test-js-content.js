import fetch from 'node-fetch';

async function test() {
  try {
    const url = 'https://alcebo-normal-ms4l.vercel.app/assets/index-D7xnElbM.js';
    const res = await fetch(url);
    const text = await res.text();
    
    const term = 'enviarAlSeguimiento';
    const idx = text.indexOf(term);
    if (idx === -1) {
      console.log('enviarAlSeguimiento not found in JS bundle');
      return;
    }
    
    // Print 500 characters around the term
    const start = Math.max(0, idx - 100);
    const end = Math.min(text.length, idx + 600);
    console.log('MATCHING CODE IN VERCEL JS BUNDLE:');
    console.log(text.substring(start, end));
  } catch(e) {
    console.error(e);
  }
}
test();
