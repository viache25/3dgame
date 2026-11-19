// node build.cjs  -> out/game.html (the page as a fragment, for publishing and for the tests) and index.html (the same as a complete page)
const fs = require('fs'), path = require('path');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
const libs = ['build/three.min.js', 'examples/js/shaders/CopyShader.js', 'examples/js/shaders/LuminosityHighPassShader.js', 'examples/js/postprocessing/EffectComposer.js', 'examples/js/postprocessing/RenderPass.js', 'examples/js/postprocessing/ShaderPass.js', 'examples/js/postprocessing/UnrealBloomPass.js'];
const src = ['world', 'models', 'fx', 'audio', 'game'].map((n) => fs.readFileSync(path.join(__dirname, 'src', n + '.js'), 'utf8')).join('\n');
const scripts = libs.map((l) => `<script src="${CDN}${l}"></script>`).join('\n') + `\n<script>\n${src}\n</script>`;
const html = fs.readFileSync(path.join(__dirname, 'src/page.html'), 'utf8').replace('__SCRIPTS__', () => scripts);
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out/game.html'), html);
const cut = html.indexOf('<div id="stage">');
const page = `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{box-sizing:border-box;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>\n${html.slice(0, cut)}</head>\n<body>\n${html.slice(cut)}</body>\n</html>\n`;
fs.writeFileSync(path.join(__dirname, 'index.html'), page);
console.log('built out/game.html and index.html', (page.length / 1024).toFixed(1), 'kB');
