// بناء نسخة جاهزة تشتغل من غير نت: الكود متجمّع مسبقًا، والمكتبات والخطوط جوه الملف
// الاستخدام: npm install && npm run build  →  dist/index.html
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import babel from '@babel/core';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { minify } from 'terser';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcPath = path.join(root, 'src', 'nawalty.html');
const outDir = path.join(root, 'dist');
const src = fs.readFileSync(srcPath, 'utf8');
const read = p => fs.readFileSync(path.join(root, 'node_modules', p), 'utf8');

// 1) كود التطبيق: JSX → JavaScript عادي
const babelOpen = '<script type="text/babel" data-presets="react">';
const appStart = src.indexOf(babelOpen);
const appEnd = src.indexOf('</script>', appStart);
const jsx = src.slice(appStart + babelOpen.length, appEnd);
const { code: compiled } = babel.transformSync(jsx, { presets: ['@babel/preset-react'], filename: 'nawalty.jsx', babelrc: false, configFile: false });
const appJs = (await minify(compiled, { compress: true, mangle: true, format: { ascii_only: false } })).code;

// 2) Tailwind: نفس الألوان والخطوط اللي في الصفحة، بس متجمّعة مرة واحدة
const cfgMatch = src.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\n\})\s*<\/script>/);
const twConfig = Function('return ' + cfgMatch[1])();
twConfig.content = [{ raw: src, extension: 'html' }];
const twCss = (await postcss([tailwindcss(twConfig)]).process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined })).css;

// 3) الخطوط (الحروف العربية بس) جوه الملف
const font = (pkg, family, weight) => {
  const file = path.join(root, 'node_modules', pkg, 'files', `${pkg.split('/')[1]}-arabic-${weight}-normal.woff2`);
  const b64 = fs.readFileSync(file).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
const fonts = [400, 500, 700, 800].map(w => font('@fontsource/tajawal', 'Tajawal', w)).join('') + font('@fontsource/lalezar', 'Lalezar', 400);

// 4) المكتبات
const libs = [
  read('react/umd/react.production.min.js'),
  read('react-dom/umd/react-dom.production.min.js'),
  read('html2canvas/dist/html2canvas.min.js'),
  read('jspdf/dist/jspdf.umd.min.js'),
].map(c => c.replace(/<\/script/gi, '<\\/script'));

// 5) تجميع الصفحة
let head = src.slice(0, src.indexOf('<body'));
head = head
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis[^>]*>\s*/g, '')
  .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*/, '')
  .replace(/<script>\s*tailwind\.config[\s\S]*?<\/script>\s*/, '')
  .replace('</head>', `<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon.svg" type="image/svg+xml">\n<style>${fonts}${twCss}</style>\n</head>`);
const sw = `<script>if('serviceWorker' in navigator && location.protocol.startsWith('http')){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}</script>`;
const html = `${head}<body class="bg-cream text-ink">\n<div id="root"></div>\n${libs.map(l => `<script>${l}</script>`).join('\n')}\n<script>${appJs.replace(/<\/script/gi, '<\\/script')}</script>\n${sw}\n</body>\n</html>\n`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) fs.copyFileSync(path.join(root, 'public', f), path.join(outDir, f));
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
