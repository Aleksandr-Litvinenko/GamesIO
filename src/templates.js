/* Шаблоны страниц. Чистые функции: получают данные из content.js и отдают HTML. */

const { SITE, UI, CATEGORIES, GAMES } = require('./content');

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* Текст без разметки — для мета-тегов и JSON-LD */
const plain = (s) => String(s).replace(/<[^>]+>/g, '');

/* ------------------------------------------------------------------ *
 * Адреса
 * ------------------------------------------------------------------ */

// Путь страницы относительно корня сайта: '' | 'ru/' | 'breakout/' | 'ru/zmeyka/'
function hubPath(locale) {
  const prefix = SITE.locales[locale];
  return prefix ? prefix + '/' : '';
}
function gamePath(locale, game) {
  return hubPath(locale) + game[locale].slug + '/';
}
const absolute = (path) => SITE.url + '/' + path;
// Сколько уровней вверх до корня сайта
const upTo = (path) => '../'.repeat(path.split('/').filter(Boolean).length) || './';

/* ------------------------------------------------------------------ *
 * Каркас страницы
 * ------------------------------------------------------------------ */

function layout(o) {
  const t = UI[o.locale];
  const rel = upTo(o.path);
  const canonical = absolute(o.path);

  const alternates = Object.keys(SITE.locales)
    .map(
      (loc) =>
        `<link rel="alternate" hreflang="${loc}" href="${esc(absolute(o.alternates[loc]))}">`
    )
    .join('\n  ');

  return `<!doctype html>
<html lang="${t.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}">
  ${o.keywords ? `<meta name="keywords" content="${esc(o.keywords.join(', '))}">` : ''}
  <link rel="canonical" href="${esc(canonical)}">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${esc(absolute(o.alternates[SITE.defaultLocale]))}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="${esc(SITE.author)}">
  <meta name="theme-color" content="#05060d">
  <meta name="color-scheme" content="dark">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE.name)}">
  <meta property="og:locale" content="${t.localeTag}">
  <meta property="og:title" content="${esc(o.title)}">
  <meta property="og:description" content="${esc(o.description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(absolute(o.image || 'og/cover.png'))}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(o.title)}">
  <meta name="twitter:description" content="${esc(o.description)}">
  <meta name="twitter:image" content="${esc(absolute(o.image || 'og/cover.png'))}">

  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕹️</text></svg>">
  <link rel="stylesheet" href="${rel}assets/styles.css">
  <script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>
  <script>window.GAMESIO=${JSON.stringify(runtimeConfig(o.locale, rel))}</script>
</head>
<body${o.bodyAttrs || ''}>
<a class="skip-link" href="#main">${o.locale === 'ru' ? 'Перейти к содержимому' : 'Skip to content'}</a>

<header class="site-head">
  <div class="shell head-inner">
    <a class="brand" href="${rel}${hubPath(o.locale)}">
      <span class="brand-mark">Games<span>IO</span></span>
      <span class="brand-sub">${esc(t.tagline)}</span>
    </a>
    <nav class="head-nav" aria-label="${o.locale === 'ru' ? 'Основная навигация' : 'Main navigation'}">
      <a href="${rel}${hubPath(o.locale)}#catalog">${esc(t.games)}</a>
      <a href="${SITE.repo}" rel="noopener">GitHub</a>
    </nav>
    <div class="head-actions">
      <a class="lang-switch" href="${rel}${o.alternates[o.locale === 'ru' ? 'en' : 'ru']}" hreflang="${o.locale === 'ru' ? 'en' : 'ru'}" rel="alternate">${esc(t.langSwitch)}</a>
      <button class="icon-btn" id="mute" type="button" aria-label="${esc(t.sound)}">🔊</button>
    </div>
  </div>
</header>

${adSlot('top', t)}

<main id="main">
${o.body}
</main>

<footer class="site-foot">
  <div class="shell foot-inner">
    <div class="foot-col">
      <span class="brand-mark">Games<span>IO</span></span>
      <p>${esc(t.footerAbout)}</p>
    </div>
    <div class="foot-col">
      <h2>${esc(t.footerLinks)}</h2>
      <ul>
        <li><a href="${rel}${hubPath(o.locale)}">${esc(t.home)}</a></li>
        ${GAMES.map(
          (g) => `<li><a href="${rel}${gamePath(o.locale, g)}">${esc(g[o.locale].title)}</a></li>`
        ).join('\n        ')}
      </ul>
    </div>
    <div class="foot-col">
      <h2>${esc(t.footerLinks === 'Разделы' ? 'Проект' : 'Project')}</h2>
      <ul>
        <li><a href="${SITE.repo}" rel="noopener">${esc(t.footerSource)}</a></li>
        <li><a href="${rel}${o.alternates[o.locale === 'ru' ? 'en' : 'ru']}" hreflang="${o.locale === 'ru' ? 'en' : 'ru'}">${esc(t.langSwitch)}</a></li>
      </ul>
      <p class="foot-fine">© ${new Date().getFullYear()} ${esc(SITE.author)}. ${esc(t.footerRights)}</p>
    </div>
  </div>
</footer>

${adSlot('bottom', t)}

<script src="${rel}assets/engine.js"></script>
<script src="${rel}assets/arkanoid.js"></script>
<script src="${rel}assets/snake.js"></script>
<script src="${rel}assets/moto.js"></script>
<script src="${rel}assets/ads.js"></script>
<script src="${rel}assets/app.js"></script>
</body>
</html>
`;
}

/* Данные, которые нужны скриптам в рантайме: язык, путь до витрины,
   строки для канваса и оверлеев, отображаемые названия игр. */
function runtimeConfig(locale, rel) {
  const t = UI[locale];
  return {
    locale,
    hub: rel + hubPath(locale),
    t: t.game,
    games: Object.fromEntries(
      GAMES.map((g) => [
        g.id,
        {
          title: g[locale].title,
          emoji: g.emoji,
          accent: g.accent,
          tagline: g[locale].short,
          controls: g[locale].controls,
          url: rel + gamePath(locale, g),
        },
      ])
    ),
  };
}

/* Рекламный слот. По умолчанию скрыт — ads.js показывает его,
   только когда в конфиге задан идентификатор площадки. */
function adSlot(position, t) {
  return `<aside class="ad ad--${position}" data-ad="${position}" aria-label="${esc(t.adLabel)}" hidden>
  <div class="shell"><span class="ad-label">${esc(t.adLabel)}</span><div class="ad-box"></div></div>
</aside>`;
}

/* ------------------------------------------------------------------ *
 * Витрина
 * ------------------------------------------------------------------ */

function hubPage(locale) {
  const t = UI[locale];
  const rel = upTo(hubPath(locale));
  const cats = CATEGORIES[locale];
  const usedCats = [...new Set(GAMES.flatMap((g) => g.categories))];

  const cards = GAMES.map((g) => {
    const c = g[locale];
    return `
      <article class="card" style="--accent:${g.accent}"
               data-search="${esc([c.title, c.short, ...c.keywords].join(' ').toLowerCase())}"
               data-cats="${esc(g.categories.join(' '))}">
        <a class="card-link" href="${rel}${gamePath(locale, g)}">
          <span class="screen">
            <canvas data-game="${g.id}" aria-hidden="true"></canvas>
            <span class="scanlines"></span>
          </span>
          <span class="card-body">
            <span class="demo-tag"><i></i>${esc(t.demoMode)}</span>
            <h3>${g.emoji} ${esc(c.title)}</h3>
            <span class="card-text">${esc(c.short)}</span>
          </span>
          <span class="card-foot">
            <span class="badge" data-record="${g.id}">${esc(t.noRecord)}</span>
            <span class="play-cta">${esc(t.playCta)} →</span>
          </span>
        </a>
        <ul class="card-cats">${g.categories
          .map((k) => `<li>${esc(cats[k])}</li>`)
          .join('')}</ul>
      </article>`;
  }).join('\n');

  const body = `
<section class="hero">
  <div class="shell">
    <p class="eyebrow">${esc(t.heroEyebrow)}</p>
    <h1>${t.heroTitle}</h1>
    <p class="hero-text">${esc(t.heroText)}</p>
  </div>
</section>

<section class="catalog" id="catalog">
  <div class="shell">
    <div class="catalog-head">
      <h2>${esc(t.catalogTitle)}</h2>
      <div class="catalog-tools">
        <label class="search">
          <span class="visually-hidden">${esc(t.searchLabel)}</span>
          <input type="search" id="game-search" placeholder="${esc(t.searchPlaceholder)}" autocomplete="off">
        </label>
        <div class="chips" role="group" aria-label="${esc(t.catalogTitle)}">
          <button type="button" class="chip is-on" data-cat="">${esc(t.filterAll)}</button>
          ${usedCats
            .map((k) => `<button type="button" class="chip" data-cat="${k}">${esc(cats[k])}</button>`)
            .join('\n          ')}
        </div>
      </div>
    </div>
    <div class="grid" id="grid">${cards}
    </div>
    <p class="empty" id="empty" hidden>${esc(t.nothingFound)}</p>
  </div>
</section>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': absolute(hubPath(locale)) + '#website',
        url: absolute(hubPath(locale)),
        name: SITE.name,
        description: t.siteDescription,
        inLanguage: t.lang,
        publisher: { '@id': SITE.url + '/#person' },
      },
      {
        '@type': 'Person',
        '@id': SITE.url + '/#person',
        name: SITE.author,
        url: SITE.repo,
      },
      {
        '@type': 'ItemList',
        name: t.catalogTitle,
        numberOfItems: GAMES.length,
        itemListElement: GAMES.map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absolute(gamePath(locale, g)),
          name: g[locale].title,
        })),
      },
    ],
  };

  return layout({
    locale,
    path: hubPath(locale),
    title: t.siteTitle,
    description: t.siteDescription,
    keywords: GAMES.flatMap((g) => g[locale].keywords).slice(0, 12),
    alternates: Object.fromEntries(Object.keys(SITE.locales).map((l) => [l, hubPath(l)])),
    jsonLd,
    body,
  });
}

/* ------------------------------------------------------------------ *
 * Страница игры
 * ------------------------------------------------------------------ */

function gamePage(locale, game) {
  const t = UI[locale];
  const c = game[locale];
  const path = gamePath(locale, game);
  const rel = upTo(path);
  const others = GAMES.filter((g) => g.id !== game.id);

  const body = `
<nav class="crumbs" aria-label="${locale === 'ru' ? 'Хлебные крошки' : 'Breadcrumb'}">
  <div class="shell">
    <a href="${rel}${hubPath(locale)}">${esc(t.home)}</a>
    <span aria-hidden="true">/</span>
    <span aria-current="page">${esc(c.title)}</span>
  </div>
</nav>

<div class="shell game-wrap" style="--accent:${game.accent}">
  <div class="game-col">
    <header class="game-head">
      <h1>${game.emoji} ${esc(c.title)}</h1>
      <p class="game-short">${esc(c.short)} <span class="pill">${esc(t.freeOnline)}</span></p>
    </header>

    <div class="playbar">
      <a class="icon-btn" href="${rel}${hubPath(locale)}">${esc(t.backToCatalog)}</a>
      <span class="spacer"></span>
      <button class="icon-btn" id="restart" type="button">${esc(t.restart)}</button>
      <button class="icon-btn" id="pause" type="button">${esc(t.pause)}</button>
    </div>
    <div class="hud" id="hud"></div>
    <div class="stage" id="stage">
      <canvas id="canvas"></canvas>
      <div class="overlay" id="overlay"></div>
    </div>
  </div>

  <aside class="game-side">
    ${adSlot('side', t).replace('<div class="shell">', '<div>')}
    <section class="side-card">
      <h2>${esc(t.tips)}</h2>
      <ul class="tips">${c.tips.map((x) => `<li>${x}</li>`).join('\n        ')}</ul>
    </section>
  </aside>
</div>

<div class="shell prose">
  <section>
    <h2>${esc(t.controls)}</h2>
    <ul class="controls-list">${c.controls.map((x) => `<li>${x}</li>`).join('\n      ')}</ul>
  </section>

  <section>
    <h2>${esc(t.about)}</h2>
    ${c.about.map((p) => `<p>${esc(p)}</p>`).join('\n    ')}
  </section>

  <section>
    <h2>${esc(t.faq)}</h2>
    <div class="faq">
      ${c.faq
        .map(
          (f) => `<details>
        <summary>${esc(f.q)}</summary>
        <p>${esc(f.a)}</p>
      </details>`
        )
        .join('\n      ')}
    </div>
  </section>

  <section class="wide">
    <h2>${esc(t.otherGames)}</h2>
    <div class="mini-grid">
      ${others
        .map(
          (g) => `<a class="mini-card" style="--accent:${g.accent}" href="${rel}${gamePath(locale, g)}">
        <span class="mini-emoji">${g.emoji}</span>
        <span><strong>${esc(g[locale].title)}</strong><span>${esc(g[locale].short)}</span></span>
      </a>`
        )
        .join('\n      ')}
    </div>
  </section>
</div>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoGame',
        '@id': absolute(path) + '#game',
        name: c.title,
        url: absolute(path),
        description: plain(c.metaDescription),
        inLanguage: t.lang,
        genre: game.categories.map((k) => CATEGORIES[locale][k]),
        gamePlatform: 'Web browser',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any (web browser)',
        playMode: game.id === 'moto' ? 'SinglePlayer' : 'SinglePlayer',
        datePublished: game.released,
        author: { '@id': SITE.url + '/#person' },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: absolute(hubPath(locale)) },
          { '@type': 'ListItem', position: 2, name: c.title, item: absolute(path) },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'HowTo',
        name: `${t.howToPlay}: ${c.title}`,
        step: c.controls.map((x, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text: plain(x),
        })),
      },
    ],
  };

  return layout({
    locale,
    path,
    title: c.metaTitle,
    description: c.metaDescription,
    keywords: c.keywords,
    image: `og/${game.id}.png`,
    alternates: Object.fromEntries(
      Object.keys(SITE.locales).map((l) => [l, gamePath(l, game)])
    ),
    jsonLd,
    bodyAttrs: ` data-game="${game.id}"`,
    body,
  });
}

/* ------------------------------------------------------------------ *
 * Однофайловая сборка
 * ------------------------------------------------------------------ */

/* В одном файле отдельных страниц нет, поэтому игра открывается прямо на
   витрине: этот блок скрыт, пока не выбрана карточка. */
function bundleStage(locale) {
  const t = UI[locale];
  return `
<div class="shell game-wrap" id="bundle-stage" hidden>
  <div class="game-col">
    <div class="playbar">
      <button class="icon-btn" id="bundle-back" type="button">${esc(t.backToCatalog)}</button>
      <span class="spacer"></span>
      <button class="icon-btn" id="restart" type="button">${esc(t.restart)}</button>
      <button class="icon-btn" id="pause" type="button">${esc(t.pause)}</button>
    </div>
    <div class="hud" id="hud"></div>
    <div class="stage" id="stage">
      <canvas id="canvas"></canvas>
      <div class="overlay" id="overlay"></div>
    </div>
  </div>
</div>`;
}

module.exports = {
  layout,
  hubPage,
  gamePage,
  bundleStage,
  runtimeConfig,
  hubPath,
  gamePath,
  absolute,
  esc,
};
