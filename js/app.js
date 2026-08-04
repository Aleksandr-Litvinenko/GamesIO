/* GamesIO — оболочка сервиса: витрина, hash-роутер, HUD-кнопки. */
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const hubView = el('hub');
  const playView = el('play');
  const grid = el('grid');
  const canvas = el('canvas');
  const overlay = el('overlay');
  const hud = el('hud');
  const gameTitle = el('game-title');
  const stage = el('stage');
  const muteBtn = el('mute');

  let host = null;
  const previews = []; // ссылка стабильна: чистим на месте, не пересоздаём массив
  const onScreen = new Set(); // превью, которые сейчас видно
  let observer = null;

  /* ---------------- витрина ---------------- */

  function clearPreviews() {
    previews.forEach((p) => p.destroy());
    previews.length = 0;
    onScreen.clear();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function renderHub() {
    clearPreviews();
    grid.innerHTML = Arcade.list()
      .map((g) => {
        const hs = Arcade.highScore(g.id);
        return `
        <a class="card" href="#/${g.id}" style="--accent:${g.accent}">
          <div class="screen">
            <canvas data-game="${g.id}" aria-hidden="true"></canvas>
            <span class="scanlines"></span>
          </div>
          <div class="card-body">
            <span class="demo-tag"><i></i>Демо-режим</span>
            <h3>${g.emoji} ${g.title}</h3>
            <p>${g.tagline}</p>
          </div>
          <div class="card-foot">
            <span class="badge">${hs ? 'Рекорд ' + hs : 'Ещё не играли'}</span>
            <span class="play-cta">Играть →</span>
          </div>
        </a>`;
      })
      .join('');

    // Живой «режим аттракта» в карточках: крутится, только пока карточка видна.
    const map = new Map();
    grid.querySelectorAll('canvas[data-game]').forEach((cv) => {
      const def = Arcade.get(cv.dataset.game);
      const p = def && Arcade.createPreview(def, cv);
      if (!p) return;
      previews.push(p);
      map.set(cv, p);
    });
    Arcade.previews = previews; // удобно для отладки из консоли
    if (!previews.length) return;

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const p = map.get(e.target);
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
      map.forEach((_, cv) => observer.observe(cv));
    } else {
      previews.forEach((p) => {
        onScreen.add(p);
        p.start();
      });
    }
  }

  // во вкладке в фоне не жжём батарею
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) previews.forEach((p) => p.stop());
    else onScreen.forEach((p) => p.start());
  });

  /* ---------------- роутер ---------------- */

  function stopGame() {
    if (host) {
      host.unmount();
      host = null;
    }
  }

  function startGame(def) {
    stopGame();
    gameTitle.textContent = def.title;
    stage.style.setProperty('--accent', def.accent);
    stage.style.setProperty('--ratio', def.width + ' / ' + def.height);
    host = new Arcade.Host(def, { canvas, overlay, hud });
    host.onGameOver = renderHub;
    host.mount();
    Arcade.currentHost = host; // удобно для отладки из консоли
  }

  function route() {
    const id = (location.hash || '').replace(/^#\/?/, '');
    const def = id && Arcade.get(id);
    if (def) {
      clearPreviews();
      hubView.hidden = true;
      playView.hidden = false;
      document.body.classList.add('in-game');
      startGame(def);
    } else {
      stopGame();
      playView.hidden = true;
      hubView.hidden = false;
      document.body.classList.remove('in-game');
      renderHub();
      if (location.hash && location.hash !== '#/') location.hash = '';
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- кнопки оверлея ---------------- */

  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !host) return;
    const act = btn.dataset.act;
    if (act === 'play') host.play();
    else if (act === 'resume') host.togglePause();
    else if (act === 'restart') {
      host.reset();
      host.play();
    } else if (act === 'menu') location.hash = '';
  });

  el('back').addEventListener('click', () => {
    location.hash = '';
  });
  el('pause').addEventListener('click', () => host && host.togglePause());
  el('restart').addEventListener('click', () => {
    if (!host) return;
    host.reset();
    host.play();
  });

  function paintMute() {
    muteBtn.textContent = Arcade.isMuted() ? '🔇' : '🔊';
    muteBtn.setAttribute(
      'aria-label',
      Arcade.isMuted() ? 'Включить звук' : 'Выключить звук'
    );
  }
  muteBtn.addEventListener('click', () => {
    Arcade.toggleMute();
    paintMute();
  });

  window.addEventListener('hashchange', route);
  paintMute();
  route();
})();
