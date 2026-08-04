#!/usr/bin/env node
/* Сборка статического сайта.
 *
 *   docs/   — то, что отдаёт GitHub Pages (Settings → Pages → main → /docs)
 *   dist/   — однофайловая сборка для быстрого шаринга и Hugging Face Space
 *
 * Запуск: node build.js
 */
const fs = require('fs');
const path = require('path');

const { SITE, UI, GAMES } = require('./src/content');
const { hubPage, gamePage, hubPath, gamePath, absolute } = require('./src/templates');

const root = __dirname;
const docs = path.join(root, 'docs');
const dist = path.join(root, 'dist');

const SCRIPTS = [
  'src/js/engine.js',
  'src/js/games/arkanoid.js',
  'src/js/games/snake.js',
  'src/js/games/moto.js',
  'src/js/ads.js',
  'src/js/app.js',
];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const locales = Object.keys(SITE.locales);

function write(relPath, content) {
  const full = path.join(docs, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

/* ------------------------------------------------------------------ *
 * Чистая пересборка
 * ------------------------------------------------------------------ */
const keepOg = fs.existsSync(path.join(docs, 'og'))
  ? fs.readdirSync(path.join(docs, 'og')).map((f) => ({
      name: f,
      data: fs.readFileSync(path.join(docs, 'og', f)),
    }))
  : [];

fs.rmSync(docs, { recursive: true, force: true });
fs.mkdirSync(docs, { recursive: true });

// Картинки для соцсетей генерируются отдельным скриптом — переносим их обратно
for (const f of keepOg) {
  fs.mkdirSync(path.join(docs, 'og'), { recursive: true });
  fs.writeFileSync(path.join(docs, 'og', f.name), f.data);
}

/* ------------------------------------------------------------------ *
 * Страницы
 * ------------------------------------------------------------------ */
const pages = [];

for (const locale of locales) {
  write(hubPath(locale) + 'index.html', hubPage(locale));
  pages.push({ path: hubPath(locale), priority: locale === SITE.defaultLocale ? '1.0' : '0.9' });

  for (const game of GAMES) {
    write(gamePath(locale, game) + 'index.html', gamePage(locale, game));
    pages.push({ path: gamePath(locale, game), priority: '0.8' });
  }
}

/* ------------------------------------------------------------------ *
 * Ассеты
 * ------------------------------------------------------------------ */
write('assets/styles.css', read('src/styles.css'));
for (const s of SCRIPTS) {
  write('assets/' + path.basename(s), read(s));
}

// Jekyll на Pages не нужен и мешает файлам, начинающимся с подчёркивания
write('.nojekyll', '');

/* ------------------------------------------------------------------ *
 * Файлы для поисковых систем и AI-краулеров
 * ------------------------------------------------------------------ */
const today = new Date().toISOString().slice(0, 10);

write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages
  .map((p) => {
    const isHub = GAMES.every((g) => !p.path.endsWith(g.en.slug + '/') && !p.path.endsWith(g.ru.slug + '/'));
    const game = GAMES.find((g) => locales.some((l) => gamePath(l, g) === p.path));
    const alt = locales
      .map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${
            game ? absolute(gamePath(l, game)) : absolute(hubPath(l))
          }"/>`
      )
      .join('\n');
    return `  <url>
    <loc>${absolute(p.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${isHub ? 'weekly' : 'monthly'}</changefreq>
    <priority>${p.priority}</priority>
${alt}
  </url>`;
  })
  .join('\n')}
</urlset>
`
);

write(
  'robots.txt',
  `User-agent: *
Allow: /

# AI-краулеры: контент открыт для индексации и цитирования
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /

Sitemap: ${SITE.url}/sitemap.xml
`
);

// Машиночитаемый каталог: удобен и для AI-краулеров, и для будущего API витрины
write(
  'games.json',
  JSON.stringify(
    {
      site: SITE.name,
      url: SITE.url,
      updated: today,
      games: GAMES.map((g) => ({
        id: g.id,
        emoji: g.emoji,
        categories: g.categories,
        released: g.released,
        locales: Object.fromEntries(
          locales.map((l) => [
            l,
            {
              title: g[l].title,
              url: absolute(gamePath(l, g)),
              summary: g[l].short,
              keywords: g[l].keywords,
            },
          ])
        ),
      })),
    },
    null,
    2
  )
);

// llms.txt — краткая карта сайта для языковых моделей
write(
  'llms.txt',
  `# ${SITE.name}

> ${UI.en.siteDescription}

${SITE.name} is a free, open-source collection of browser mini-games written in
plain JavaScript. No sign-up, no install, no tracking. Every game runs entirely
client side and stores high scores in localStorage. The site is available in
English (default) and Russian.

## Games

${GAMES.map(
  (g) =>
    `- [${g.en.title}](${absolute(gamePath('en', g))}): ${g.en.short} Russian version: [${
      g.ru.title
    }](${absolute(gamePath('ru', g))}).`
).join('\n')}

## Catalogue

- [Machine-readable catalogue](${SITE.url}/games.json): every game with titles, URLs and keywords per locale.
- [English home](${absolute(hubPath('en'))})
- [Russian home](${absolute(hubPath('ru'))})

## Source

- [GitHub repository](${SITE.repo}): MIT licence, no build step, no dependencies.
`
);

// ads.txt читается только с корня домена — на github.io не сработает,
// файл заготовлен для переезда на собственный домен.
write(
  'ads.txt',
  `# Раскомментируйте и подставьте свой идентификатор после подключения рекламной сети.
# Файл действует только на собственном домене — на *.github.io он игнорируется.
# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
`
);

/* Страница 404 — тот же каркас, чтобы человек не вываливался из сайта */
write(
  '404.html',
  hubPage(SITE.defaultLocale)
    .replace(
      /<title>[\s\S]*?<\/title>/,
      '<title>404 — page not found | GamesIO</title>'
    )
    .replace(
      '<meta name="robots" content="index, follow, max-image-preview:large">',
      '<meta name="robots" content="noindex, follow">'
    )
);

/* ------------------------------------------------------------------ *
 * Однофайловая сборка
 * ------------------------------------------------------------------ */
const bundleLocale = 'en';
const bundleHtml = hubPage(bundleLocale);
const css = read('src/styles.css');
const js = SCRIPTS.map((f) => `/* ===== ${path.basename(f)} ===== */\n${read(f)}`).join('\n');

const bodyMatch = bundleHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const bodyInner = bodyMatch[1]
  .replace(/\s*<script src="[^"]+"><\/script>/g, '')
  .replace(/<link rel="stylesheet"[^>]*>/g, '')
  // в одном файле относительных страниц нет — уводим ссылки на живой сайт
  .replace(/href="\.\/(?!#)/g, `href="${SITE.url}/`)
  .replace(/href="\.\/#/g, `href="${SITE.url}/#`)
  .trim();

const runtimeMatch = bundleHtml.match(/<script>window\.GAMESIO=([\s\S]*?)<\/script>/);
const runtime = runtimeMatch ? runtimeMatch[1] : '{}';

const bundle = `<style>\n${css}\n</style>\n\n${bodyInner}\n\n<script>window.GAMESIO=${runtime}</script>\n<script>\n${js}\n</script>\n`;

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(
  path.join(dist, 'artifact.html'),
  `<title>${UI[bundleLocale].siteTitle}</title>\n${bundle}`
);
fs.writeFileSync(
  path.join(dist, 'index.html'),
  `<!doctype html>
<html lang="${bundleLocale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${UI[bundleLocale].siteTitle}</title>
<meta name="description" content="${UI[bundleLocale].siteDescription}">
<link rel="canonical" href="${SITE.url}/">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕹️</text></svg>">
</head>
<body>
${bundle}</body>
</html>
`
);

/* ------------------------------------------------------------------ *
 * Отчёт
 * ------------------------------------------------------------------ */
const count = (dir) =>
  fs
    .readdirSync(dir, { recursive: true })
    .filter((f) => fs.statSync(path.join(dir, f)).isFile()).length;

console.log(`docs/          ${count(docs)} файлов, ${pages.length} страниц`);
for (const p of pages) console.log('  ' + absolute(p.path));
console.log(
  `dist/index.html ${(fs.statSync(path.join(dist, 'index.html')).size / 1024).toFixed(1)} KB`
);
