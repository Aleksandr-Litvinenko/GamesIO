#!/usr/bin/env node
/* Собирает многофайловый проект в один самодостаточный HTML.
 *   dist/index.html    — обычная страница (GitHub Pages, Hugging Face Space, файл на диске)
 *   dist/artifact.html — только содержимое <body> + <title>, для публикации Artifact'ом
 * Запуск: node build.js
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');

const SOURCES = [
  'js/engine.js',
  'js/games/arkanoid.js',
  'js/games/snake.js',
  'js/games/moto.js',
  'js/app.js',
];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const css = read('styles.css');
const js = SOURCES.map((f) => `/* ===== ${f} ===== */\n${read(f)}`).join('\n');

// содержимое <body> без тега
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('index.html: не найден <body>');
const bodyInner = bodyMatch[1]
  .replace(/\s*<script src="[^"]+"><\/script>/g, '')
  .trim();

const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
const title = titleMatch ? titleMatch[1] : 'GamesIO';

const bundle = `<style>\n${css}\n</style>\n\n${bodyInner}\n\n<script>\n${js}\n</script>\n`;

fs.mkdirSync(dist, { recursive: true });

// 1. Полноценная автономная страница
const head = html
  .slice(0, html.indexOf('</head>'))
  .replace(/\s*<link rel="stylesheet" href="[^"]+">/g, '');
fs.writeFileSync(
  path.join(dist, 'index.html'),
  `${head}</head>\n<body>\n${bundle}</body>\n</html>\n`
);

// 2. Версия для Artifact: обёртку <html>/<head>/<body> добавит публикатор
fs.writeFileSync(
  path.join(dist, 'artifact.html'),
  `<title>${title}</title>\n${bundle}`
);

const kb = (p) => (fs.statSync(path.join(dist, p)).size / 1024).toFixed(1) + ' KB';
console.log('dist/index.html    ', kb('index.html'));
console.log('dist/artifact.html ', kb('artifact.html'));
