import fetch from 'node-fetch'; // or global fetch in Node 18+

async function test() {
  try {
    const res = await fetch('https://alcebo-normal-ms4l.vercel.app/');
    const html = await res.text();
    console.log('HTML Length:', html.length);
    
    // Simple regex search without complex characters
    const index = html.indexOf('/assets/index-');
    if (index === -1) {
      console.log('No JS bundle path found in HTML');
      return;
    }
    
    const end = html.indexOf('.js', index);
    const bundlePath = html.substring(index, end + 3);
    const jsUrl = 'https://alcebo-normal-ms4l.vercel.app' + bundlePath;
    console.log('Found JS bundle URL:', jsUrl);
    
    const jsRes = await fetch(jsUrl);
    const jsText = await jsRes.text();
    
    console.log('Bundle contains production tracker URL:', jsText.includes('alcebo-seguimiento-correos.vercel.app'));
    console.log('Bundle contains old preview tracker URL:', jsText.includes('alcebo-seguimiento-correos-1bt9utc85-miyasks-projects.vercel.app'));
  } catch(e) {
    console.error('Error during testing:', e);
  }
}
test();
