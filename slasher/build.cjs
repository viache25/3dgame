// node build.cjs  -> out/game.html (the page as a fragment, for publishing and for the tests), index.html (the same as a complete page
//                    that takes three.js from a CDN) and dist/ (a site with everything in it, for a static host)
const fs = require('fs'), path = require('path');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
const libs = ['build/three.min.js', 'examples/js/shaders/CopyShader.js', 'examples/js/shaders/LuminosityHighPassShader.js', 'examples/js/postprocessing/EffectComposer.js', 'examples/js/postprocessing/RenderPass.js', 'examples/js/postprocessing/ShaderPass.js', 'examples/js/postprocessing/UnrealBloomPass.js'];
const src = ['geo', 'phys', 'render', 'fx', 'models', 'world', 'audio', 'game'].map((n) => fs.readFileSync(path.join(__dirname, 'src', n + '.js'), 'utf8')).join('\n');
const scripts = libs.map((l) => `<script src="${CDN}${l}"></script>`).join('\n') + `\n<script>\n${src}\n</script>`;
const html = fs.readFileSync(path.join(__dirname, 'src/page.html'), 'utf8').replace('__SCRIPTS__', () => scripts);
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out/game.html'), html);
const cut = html.indexOf('<div id="stage">');
const page = `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{box-sizing:border-box;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n${html.slice(0, cut)}</head>\n<body>\n${html.slice(cut)}</body>\n</html>\n`;
fs.writeFileSync(path.join(__dirname, 'index.html'), page);
console.log('built out/game.html and index.html', (page.length / 1024).toFixed(1), 'kB');

// dist/: the same game as a site that needs nothing from outside: three.js is copied in next to the page instead of coming from a CDN.
// This is the folder a static host (Cloudflare, or any other) serves.
const three = path.join(__dirname, 'node_modules/three');
if (fs.existsSync(three)) {
  const dist = path.join(__dirname, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const lib = libs.map((l) => '// ' + l + '\n' + fs.readFileSync(path.join(three, l), 'utf8')).join('\n');
  fs.writeFileSync(path.join(dist, 'lib.js'), '// three.js 0.147.0 and its post-processing passes, MIT licence, https://threejs.org\n' + lib);
  fs.writeFileSync(path.join(dist, 'game.js'), src);
  const body = fs.readFileSync(path.join(__dirname, 'src/page.html'), 'utf8').replace('__SCRIPTS__', () => '<script src="lib.js"></script>\n<script src="game.js"></script>');
  const at = body.indexOf('<div id="stage">');
  const meta = '<meta name="description" content="Слэшер, где разрез проходит по линии, которую ты провёл.">\n<meta name="theme-color" content="#170f20">\n';
  fs.writeFileSync(path.join(dist, 'index.html'), `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${meta}<style>:root{box-sizing:border-box;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n${body.slice(0, at)}</head>\n<body>\n${body.slice(at)}</body>\n</html>\n`);
  console.log('built dist/ (index.html, game.js, lib.js)', ((lib.length + src.length) / 1024).toFixed(0), 'kB of script');
} else console.log('dist/ skipped: run npm install first, it needs three.js from node_modules');
