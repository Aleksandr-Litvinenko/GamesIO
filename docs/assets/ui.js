/* Интерфейс профиля, таблиц лидеров и установки.
   Работает поверх Arcade.Profile / Arcade.Scores / Arcade.PWA. */
(function () {
  'use strict';

  const CFG = window.GAMESIO || {};
  const el = (id) => document.getElementById(id);
  const t = (k, p) => Arcade.t(k, p);
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- профиль в шапке ---------------- */

  const chip = el('profile-chip');
  const dlg = el('profile-dialog');

  function paintChip() {
    if (!chip) return;
    const p = Arcade.Profile.current();
    chip.innerHTML =
      `<i style="background:${p.color}"></i><span>${esc(p.name)}</span>`;
    chip.setAttribute('aria-label', t('profileOf', { n: p.name }));
  }

  function paintDialog() {
    if (!dlg) return;
    const cur = Arcade.Profile.current();
    const list = Arcade.Profile.all();
    const pwa = Arcade.PWA || {};

    dlg.querySelector('[data-slot="body"]').innerHTML = `
      <label class="field">
        <span>${t('yourName')}</span>
        <input id="profile-name" type="text" maxlength="24" value="${esc(cur.name)}">
      </label>
      <div class="swatches" role="group" aria-label="${t('color')}">
        ${['#22d3ee', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa', '#fb923c']
          .map(
            (c) =>
              `<button type="button" class="swatch${
                c === cur.color ? ' is-on' : ''
              }" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`
          )
          .join('')}
      </div>

      <h3>${t('profilesOnDevice')}</h3>
      <ul class="profile-list">
        ${list
          .map(
            (p) => `<li${p.id === cur.id ? ' class="is-on"' : ''}>
              <button type="button" data-switch="${p.id}">
                <i style="background:${p.color}"></i>${esc(p.name)}
              </button>
              ${
                list.length > 1
                  ? `<button type="button" class="tiny" data-remove="${p.id}" aria-label="${t(
                      'remove'
                    )}">✕</button>`
                  : ''
              }
            </li>`
          )
          .join('')}
      </ul>
      <button type="button" class="btn" data-act="add">${t('addProfile')}</button>

      <h3>${t('offlineTitle')}</h3>
      <p class="dim">${
        pwa.ready ? t('offlineReady') : t('offlineCaching')
      }</p>
      ${
        pwa.installable
          ? `<button type="button" class="btn primary" data-act="install">${t('installApp')}</button>`
          : pwa.standalone
          ? `<p class="dim">${t('installedAlready')}</p>`
          : `<p class="dim">${t('installHint')}</p>`
      }
    `;
  }

  if (chip && dlg) {
    paintChip();
    chip.addEventListener('click', () => {
      paintDialog();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    });

    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) return dlg.close();
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.dataset.color) {
        const p = Arcade.Profile.current();
        p.color = btn.dataset.color;
        Arcade.Profile.save(p);
        paintChip();
        paintDialog();
      } else if (btn.dataset.switch) {
        Arcade.Profile.switchTo(btn.dataset.switch);
        paintChip();
        paintDialog();
        paintBoards();
      } else if (btn.dataset.remove) {
        Arcade.Profile.remove(btn.dataset.remove);
        paintChip();
        paintDialog();
      } else if (btn.dataset.act === 'add') {
        Arcade.Profile.create(t('newPlayer'));
        paintChip();
        paintDialog();
        paintBoards();
      } else if (btn.dataset.act === 'install') {
        Arcade.PWA.install();
      } else if (btn.dataset.act === 'close') {
        dlg.close();
      }
    });

    dlg.addEventListener('input', (e) => {
      if (e.target.id !== 'profile-name') return;
      const p = Arcade.Profile.current();
      p.name = e.target.value.trim().slice(0, 24) || 'Player';
      Arcade.Profile.save(p);
      paintChip();
    });
  }

  /* ---------------- индикатор офлайна ---------------- */

  const badge = el('offline-badge');
  if (badge && Arcade.PWA) {
    Arcade.PWA.onChange((pwa) => {
      badge.hidden = !pwa.ready;
      badge.title = t('offlineReady');
    });
  }

  /* ---------------- таблицы лидеров ---------------- */

  const board = el('leaderboard');
  const gameId = document.body.dataset.game;

  function row(i, name, score, color, avatar) {
    const medal = ['🥇', '🥈', '🥉'][i] || i + 1;
    return `<li>
      <span class="place">${medal}</span>
      ${
        avatar
          ? `<img class="ava" src="${esc(avatar)}" alt="" width="20" height="20" loading="lazy">`
          : `<i class="ava dot" style="background:${color || '#64748b'}"></i>`
      }
      <span class="who">${esc(name)}</span>
      <span class="pts">${score}</span>
    </li>`;
  }

  function paintBoards() {
    if (!board || !gameId) return;
    const local = Arcade.Scores.localTop(gameId, 10);
    const localHtml = local.length
      ? `<ol class="board">${local
          .map((r, i) => row(i, r.name, r.score, r.color))
          .join('')}</ol>`
      : `<p class="dim">${t('noScoresYet')}</p>`;
    board.querySelector('[data-pane="local"]').innerHTML = localHtml;

    const globalPane = board.querySelector('[data-pane="global"]');
    Arcade.Scores.globalTop(gameId, 10).then((rows) => {
      globalPane.innerHTML = rows.length
        ? `<ol class="board">${rows
            .map((r, i) => row(i, r.name, r.score, null, r.avatar))
            .join('')}</ol>`
        : `<p class="dim">${t('globalEmpty')}</p>`;
    });
  }

  if (board) {
    paintBoards();
    board.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;
      board.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-on', b === tab));
      board.querySelectorAll('[data-pane]').forEach((p) => {
        p.hidden = p.dataset.pane !== tab.dataset.tab;
      });
    });
  }

  /* ---------------- итог партии ---------------- */

  // Движок зовёт этот хук, когда рисует экран окончания игры
  Arcade.overlayExtra = function (host) {
    const place = host.lastPlace;
    const url = Arcade.Scores.publishUrl(host.def.id, host.score);
    const parts = [];
    if (place > 0) {
      parts.push(`<p class="place-note">${t('placeInTable', { n: place })}</p>`);
    }
    if (url && host.score > 0) {
      parts.push(
        `<a class="btn ghost publish" href="${url}" target="_blank" rel="noopener">${t(
          'publishScore'
        )}</a>`
      );
    }
    return parts.join('');
  };

  Arcade.onGameFinished = function (host) {
    host.lastPlace = Arcade.Scores.submitLocal(host.def.id, host.score);
    paintBoards();
  };
})();
