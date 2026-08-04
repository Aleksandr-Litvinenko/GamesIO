/* Оболочка сайта.
   На витрине: живые превью в карточках, поиск и фильтр по категориям, рекорды.
   На странице игры: запуск одной игры, объявленной в <body data-game="…">. */
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);

  /* ---------------- звук (есть на всех страницах) ---------------- */

  const muteBtn = el('mute');
  if (muteBtn) {
    const paint = () => {
      muteBtn.textContent = Arcade.isMuted() ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-pressed', String(Arcade.isMuted()));
    };
    muteBtn.addEventListener('click', () => {
      Arcade.toggleMute();
      paint();
    });
    paint();
  }

  /* ---------------- запуск игры ---------------- */

  // Один и тот же код обслуживает отдельную страницу игры и однофайловую
  // сборку, где игра открывается прямо на витрине.
  function mountGame(gameId) {
    const def = Arcade.get(gameId);
    const canvas = el('canvas');
    if (!def || !canvas) return null;

    el('stage').style.setProperty('--ratio', def.width + ' / ' + def.height);

    const host = new Arcade.Host(def, {
      canvas: canvas,
      overlay: el('overlay'),
      hud: el('hud'),
    });
    host.mount();
    Arcade.currentHost = host;

    el('overlay').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'play') host.play();
      else if (act === 'resume') host.togglePause();
      else if (act === 'restart') {
        host.reset();
        host.play();
      }
    });
    el('pause').addEventListener('click', () => host.togglePause());
    el('restart').addEventListener('click', () => {
      host.reset();
      host.play();
    });
    return host;
  }

  const pageGame = document.body.dataset.game;
  if (pageGame) {
    mountGame(pageGame);
    return;
  }

  /* ---------------- витрина ---------------- */

  const grid = el('grid');
  if (!grid) return;

  // Рекорды лежат в localStorage, поэтому в статический HTML их не вписать
  document.querySelectorAll('[data-record]').forEach((node) => {
    const score = Arcade.highScore(node.dataset.record);
    if (score > 0) node.textContent = Arcade.t('best') + ' ' + score;
  });

  // Живые превью: крутятся, только пока карточка видна и вкладка активна
  const previews = [];
  const onScreen = new Set();
  const byCanvas = new Map();

  grid.querySelectorAll('canvas[data-game]').forEach((cv) => {
    const def = Arcade.get(cv.dataset.game);
    const p = def && Arcade.createPreview(def, cv);
    if (!p) return;
    previews.push(p);
    byCanvas.set(cv, p);
  });
  Arcade.previews = previews;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const p = byCanvas.get(e.target);
          if (!p) continue;
          if (e.isIntersecting) {
            onScreen.add(p);
            if (!document.hidden) p.start();
          } else {
            onScreen.delete(p);
            p.stop();
          }
        }
      },
      { threshold: 0.15 }
    );
    byCanvas.forEach((_, cv) => io.observe(cv));
  } else {
    previews.forEach((p) => {
      onScreen.add(p);
      p.start();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) previews.forEach((p) => p.stop());
    else onScreen.forEach((p) => p.start());
  });

  /* ---------------- поиск и фильтр по категориям ---------------- */

  const search = el('game-search');
  const empty = el('empty');
  const chips = Array.from(document.querySelectorAll('.chip'));
  const cards = Array.from(grid.querySelectorAll('.card'));
  let activeCat = '';

  function applyFilter() {
    const q = (search ? search.value : '').trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const matchesText = !q || card.dataset.search.indexOf(q) !== -1;
      const matchesCat = !activeCat || card.dataset.cats.split(' ').indexOf(activeCat) !== -1;
      const visible = matchesText && matchesCat;
      card.hidden = !visible;
      if (visible) shown++;
      // превью спрятанной карточки останавливаем, чтобы не тратить кадры впустую
      const cv = card.querySelector('canvas[data-game]');
      const p = cv && byCanvas.get(cv);
      if (p) {
        if (visible && onScreen.has(p) && !document.hidden) p.start();
        else if (!visible) p.stop();
      }
    }
    if (empty) empty.hidden = shown > 0;
  }

  if (search) search.addEventListener('input', applyFilter);
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeCat = chip.dataset.cat;
      chips.forEach((c) => c.classList.toggle('is-on', c === chip));
      applyFilter();
    });
  });

  /* ---------------- однофайловая сборка ---------------- */

  const bundleStage = el('bundle-stage');
  if (!bundleStage) return;

  const hero = document.querySelector('.hero');
  const catalog = el('catalog');
  let bundleHost = null;

  function closeGame() {
    if (bundleHost) {
      bundleHost.unmount();
      bundleHost = null;
    }
    bundleStage.hidden = true;
    if (hero) hero.hidden = false;
    catalog.hidden = false;
    onScreen.forEach((p) => p.start());
  }

  function openGame(id) {
    previews.forEach((p) => p.stop());
    if (hero) hero.hidden = true;
    catalog.hidden = true;
    bundleStage.hidden = false;
    bundleStage.style.setProperty('--accent', (Arcade.meta(id) || {}).accent || '#22d3ee');
    if (bundleHost) bundleHost.unmount();
    bundleHost = mountGame(id);
    window.scrollTo(0, 0);
  }

  grid.addEventListener('click', (e) => {
    const link = e.target.closest('.card-link');
    if (!link) return;
    const cv = link.querySelector('canvas[data-game]');
    if (!cv) return;
    e.preventDefault();
    openGame(cv.dataset.game);
  });

  el('bundle-back').addEventListener('click', closeGame);
  // «В меню» внутри оверлея игры
  el('overlay').addEventListener('click', (e) => {
    if (e.target.closest('a.btn')) {
      e.preventDefault();
      closeGame();
    }
  });
})();
