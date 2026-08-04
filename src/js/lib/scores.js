/* Профили и таблицы лидеров.
 *
 * У сайта нет бэкенда, поэтому здесь два уровня:
 *
 *   локальный  — профили и рекорды в localStorage. Работает сразу, без
 *                регистрации, хранит несколько игроков на одном устройстве.
 *   общий      — data/leaderboard.json, который пересобирает GitHub Action
 *                из issue с меткой «score». Клиент его только читает.
 *
 * Результат публикуется через issue: игрок открывает GitHub, входит своим
 * аккаунтом и отправляет заранее заполненную форму. Пароли и токены здесь
 * не появляются вообще — авторизацию целиком выполняет GitHub.
 */
(function () {
  'use strict';

  const CFG = window.GAMESIO || {};
  const KEY_PROFILES = 'gamesio:profiles:v1';
  const KEY_SCORES = 'gamesio:scores:v1';
  const LOCAL_LIMIT = 25;

  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (_) {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  };

  const COLORS = ['#22d3ee', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa', '#fb923c'];
  const newId = () =>
    'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ------------------------------------------------------------------ *
   * Профили
   * ------------------------------------------------------------------ */

  const Profile = {
    state() {
      const s = read(KEY_PROFILES, null);
      if (s && s.list && s.list.length) return s;
      const first = {
        id: newId(),
        name: CFG.locale === 'ru' ? 'Игрок' : 'Player',
        color: COLORS[0],
        github: '',
      };
      const fresh = { list: [first], currentId: first.id };
      write(KEY_PROFILES, fresh);
      return fresh;
    },
    all() {
      return this.state().list;
    },
    current() {
      const s = this.state();
      return s.list.find((p) => p.id === s.currentId) || s.list[0];
    },
    save(profile) {
      const s = this.state();
      const i = s.list.findIndex((p) => p.id === profile.id);
      if (i >= 0) s.list[i] = profile;
      write(KEY_PROFILES, s);
      return profile;
    },
    create(name) {
      const s = this.state();
      const p = {
        id: newId(),
        name: (name || '').trim().slice(0, 24) || 'Player',
        color: COLORS[s.list.length % COLORS.length],
        github: '',
      };
      s.list.push(p);
      s.currentId = p.id;
      write(KEY_PROFILES, s);
      return p;
    },
    switchTo(id) {
      const s = this.state();
      if (!s.list.some((p) => p.id === id)) return;
      s.currentId = id;
      write(KEY_PROFILES, s);
    },
    remove(id) {
      const s = this.state();
      if (s.list.length <= 1) return;
      s.list = s.list.filter((p) => p.id !== id);
      if (s.currentId === id) s.currentId = s.list[0].id;
      write(KEY_PROFILES, s);
    },
  };

  /* ------------------------------------------------------------------ *
   * Таблицы лидеров
   * ------------------------------------------------------------------ */

  let globalCache = null;
  let globalPromise = null;

  const Scores = {
    /* Локальная таблица: одна на игру, отсортирована по убыванию */
    localTop(gameId, limit) {
      const all = read(KEY_SCORES, {});
      return (all[gameId] || []).slice(0, limit || 10);
    },

    /* Возвращает позицию в локальной таблице или 0, если не попал */
    submitLocal(gameId, score) {
      if (!score || score <= 0) return 0;
      const all = read(KEY_SCORES, {});
      const list = all[gameId] || [];
      const me = Profile.current();

      // одна строка на профиль: держим только его лучший результат
      const mine = list.findIndex((r) => r.pid === me.id);
      if (mine >= 0) {
        if (list[mine].score >= score) return 0;
        list.splice(mine, 1);
      }

      list.push({
        pid: me.id,
        name: me.name,
        color: me.color,
        score: score,
        at: new Date().toISOString().slice(0, 10),
      });
      list.sort((a, b) => b.score - a.score);
      all[gameId] = list.slice(0, LOCAL_LIMIT);
      write(KEY_SCORES, all);
      return all[gameId].findIndex((r) => r.pid === me.id && r.score === score) + 1;
    },

    /* Общая таблица: статический JSON, собранный Action'ом */
    loadGlobal() {
      if (globalCache) return Promise.resolve(globalCache);
      if (globalPromise) return globalPromise;
      const url = (CFG.dataUrl || './data/') + 'leaderboard.json';
      globalPromise = fetch(url, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          globalCache = data && data.games ? data : { games: {}, updated: null };
          return globalCache;
        })
        .catch(() => {
          // офлайн или файла ещё нет — общая таблица просто не показывается
          globalCache = { games: {}, updated: null, offline: true };
          return globalCache;
        });
      return globalPromise;
    },

    globalTop(gameId, limit) {
      return this.loadGlobal().then((data) =>
        (data.games[gameId] || []).slice(0, limit || 10)
      );
    },

    /* Ссылка на предзаполненный issue — это и есть «отправить результат» */
    publishUrl(gameId, score) {
      if (!CFG.repo) return null;
      const meta = (CFG.games && CFG.games[gameId]) || {};
      const title = `[score] ${meta.title || gameId} — ${score}`;
      const body = [
        '<!-- Не меняйте блок ниже: его читает бот. -->',
        '```yaml',
        'game: ' + gameId,
        'score: ' + score,
        '```',
        '',
        CFG.locale === 'ru'
          ? 'Результат отправлен со страницы игры. Ваш GitHub-логин станет именем в таблице.'
          : 'Submitted from the game page. Your GitHub username will appear in the table.',
      ].join('\n');
      return (
        CFG.repo +
        '/issues/new?labels=score&title=' +
        encodeURIComponent(title) +
        '&body=' +
        encodeURIComponent(body)
      );
    },
  };

  Arcade.Profile = Profile;
  Arcade.Scores = Scores;
})();
