// src/ の部品を1つのHTMLにまとめる。 node scripts/build.mjs
// index.html         … Excelの部品（ExcelJS）をCDNから読み込む
// index.offline.html … ExcelJSも内蔵（node_modules/exceljs がある場合のみ作る）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const JS = ['core', 'engine', 'sample', 'charts', 'excel', 'report', 'prompts', 'ui'];
const DEFS = ['questions', 'risks', 'coefficients', 'industries', 'chapters'];
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
function build(excelTag) {
  let h = rd('src/template.html');
  h = h.replace('/*__CSS__*/', () => rd('src/app.css'));
  for (const d of DEFS) { JSON.parse(rd(`src/defs/${d}.json`)); h = h.replace(`/*__DEF_${d}__*/`, () => '\n' + safe(rd(`src/defs/${d}.json`)).trim() + '\n'); }
  h = h.replace('<!--__EXCELJS__-->', () => excelTag);
  h = h.replace('/*__JS__*/', () => JS.map((n) => `/* ---- ${n}.js ---- */\n` + safe(rd(`src/js/${n}.js`))).join('\n'));
  return h;
}
fs.writeFileSync(path.join(root, 'index.html'), build(`<script src="${CDN}" crossorigin="anonymous"></script>`));
console.log('index.html', (fs.statSync(path.join(root, 'index.html')).size / 1024).toFixed(0) + ' KB');
const local = [process.env.EXCELJS, path.join(root, 'node_modules/exceljs/dist/exceljs.min.js')].find((p) => p && fs.existsSync(p));
if (local) {
  fs.writeFileSync(path.join(root, 'index.offline.html'), build('<script>\n/* ExcelJS 4.4.0 (MIT License) https://github.com/exceljs/exceljs */\n' + safe(fs.readFileSync(local, 'utf8')) + '\n</script>'));
  console.log('index.offline.html', (fs.statSync(path.join(root, 'index.offline.html')).size / 1024).toFixed(0) + ' KB');
} else console.log('index.offline.html は作っていません（npm i exceljs@4.4.0 の後に再実行すると作ります）');
