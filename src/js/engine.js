/* GamesIO — tiny arcade engine shared by every mini-game.
   Handles: registry, canvas fitting, game loop, input, audio, particles,
   HUD, overlays and high scores. Games stay pure gameplay. */
(function () {
  'use strict';

  const Arcade = (window.Arcade = {});

  /* ------------------------------------------------------------------ *
   * Локализация и отображаемые данные.
   * Механика игр живёт в JS, а названия, описания и подписи приходят
   * со страницы (window.GAMESIO) — чтобы одна сборка работала на любом языке.
   * ------------------------------------------------------------------ */
  const CFG = window.GAMESIO || {};
  const FALLBACK = {
    score: 'Score',
    best: 'Best',
    lives: 'Lives',
    level: 'Level',
    length: 'Length',
    apples: 'Apples',
    round: 'Round',
    play: 'Play',
    resume: 'Resume',
    restart: 'Restart',
    again: 'Play again',
    menu: 'Back to games',
    paused: 'Paused',
    gameOver: 'Game over',
    victory: 'You win!',
    newRecord: 'New best score!',
    recordIs: 'Best: {n}',
    launch: 'Space or tap to launch',
    boost: 'BOOST · SHIFT',
    roundClear: 'ROUND CLEARED',
    crashed: 'YOU CRASHED',
    nextRoundFaster: 'Round {n} — faster',
    livesLeft: 'Lives left: {n}',
    levelsCleared: 'Levels cleared: {n}',
    snakeLength: 'Snake length: {n}',
    roundsCleared: 'Rounds cleared: {n}',
    perfectSnake: 'Grid filled — a perfect snake!',
  };

  Arcade.t = function (key, params) {
    let s = (CFG.t && CFG.t[key]) || FALLBACK[key] || key;
    if (params) {
      for (const k in params) s = s.split('{' + k + '}').join(params[k]);
    }
    return s;
  };

  Arcade.meta = (id) => (CFG.games && CFG.games[id]) || {};
  Arcade.hubUrl = () => CFG.hub || './';

  /* ------------------------------------------------------------------ *
   * Registry
   * ------------------------------------------------------------------ */
  const games = [];
  const byId = new Map();

  Arcade.register = function (def) {
    games.push(def);
    byId.set(def.id, def);
  };
  Arcade.list = () => games.slice();
  Arcade.get = (id) => byId.get(id);

  /* ------------------------------------------------------------------ *
   * High scores
   * ------------------------------------------------------------------ */
  const HS_KEY = 'gamesio:highscores:v1';
  const MUTE_KEY = 'gamesio:muted:v1';

  function readScores() {
    try {
      return JSON.parse(localStorage.getItem(HS_KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  Arcade.highScore = (id) => readScores()[id] || 0;

  Arcade.submitScore = function (id, score) {
    const all = readScores();
    if (score > (all[id] || 0)) {
      all[id] = score;
      try {
        localStorage.setItem(HS_KEY, JSON.stringify(all));
      } catch (_) {}
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------------------ *
   * Audio — a few oscillator blips, no assets
   * ------------------------------------------------------------------ */
  let audioCtx = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch (_) {}

  Arcade.isMuted = () => muted;
  Arcade.toggleMute = function () {
    muted = !muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (_) {}
    return muted;
  };

  function getAudio() {
    if (muted) return null;
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(o) {
    const ac = getAudio();
    if (!ac) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const dur = o.dur || 0.08;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.vol || 0.07, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  const SFX = {
    blip: () => tone({ freq: 520, dur: 0.04, vol: 0.05 }),
    bounce: () => tone({ freq: 300, to: 480, dur: 0.06, vol: 0.06 }),
    brick: () => tone({ freq: 700, to: 1000, dur: 0.06, vol: 0.055 }),
    eat: () => tone({ freq: 440, to: 900, dur: 0.09, type: 'triangle', vol: 0.08 }),
    bonus: () => {
      tone({ freq: 660, to: 990, dur: 0.09, type: 'triangle', vol: 0.08 });
      tone({ freq: 990, to: 1320, dur: 0.1, type: 'triangle', vol: 0.07, delay: 0.08 });
    },
    power: () => tone({ freq: 480, to: 1100, dur: 0.16, type: 'triangle', vol: 0.09 }),
    bad: () => tone({ freq: 300, to: 130, dur: 0.2, type: 'sawtooth', vol: 0.08 }),
    die: () => tone({ freq: 260, to: 60, dur: 0.45, type: 'sawtooth', vol: 0.1 }),
    crash: () => tone({ freq: 180, to: 40, dur: 0.55, type: 'sawtooth', vol: 0.12 }),
    fanfare: () => {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, dur: i === 3 ? 0.24 : 0.1, type: 'triangle', vol: 0.08, delay: i * 0.09 })
      );
    },
  };

  Arcade.sfx = (name) => {
    const fn = SFX[name];
    if (fn) fn();
  };

  /* ------------------------------------------------------------------ *
   * Particles
   * ------------------------------------------------------------------ */
  class Particles {
    constructor() {
      this.list = [];
    }
    burst(x, y, opt) {
      const o = opt || {};
      const n = o.count || 12;
      const spread = o.spread == null ? Math.PI * 2 : o.spread;
      const dir = o.dir || 0;
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread;
        const sp = (o.speed || 130) * (0.35 + Math.random() * 0.85);
        this.list.push({
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: (o.life || 0.5) * (0.6 + Math.random() * 0.7),
          age: 0,
          size: (o.size || 3) * (0.6 + Math.random() * 0.8),
          color: Array.isArray(o.color)
            ? o.color[(Math.random() * o.color.length) | 0]
            : o.color || '#ffffff',
          gravity: o.gravity || 0,
        });
      }
    }
    update(dt) {
      const l = this.list;
      for (let i = l.length - 1; i >= 0; i--) {
        const p = l[i];
        p.age += dt;
        if (p.age >= p.life) {
          l.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 1.6 * dt;
        p.vy *= 1 - 1.6 * dt;
      }
    }
    draw(ctx) {
      for (const p of this.list) {
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        const s = p.size * k;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }
    clear() {
      this.list.length = 0;
    }
  }

  /* ------------------------------------------------------------------ *
   * Input mapping
   * ------------------------------------------------------------------ */
  const KEYMAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'action',
    Enter: 'action',
    ShiftLeft: 'boost',
    ShiftRight: 'boost',
    Escape: 'pause',
    KeyP: 'pause',
  };
  // Резерв по event.key — на случай, когда code недоступен, и для кириллической
  // раскладки, где WASD физически те же клавиши, но key приходит другой.
  const KEYMAP_ALT = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down',
    a: 'left',
    d: 'right',
    w: 'up',
    s: 'down',
    ф: 'left',
    в: 'right',
    ц: 'up',
    ы: 'down',
    ' ': 'action',
    spacebar: 'action',
    space: 'action',
    enter: 'action',
    shift: 'boost',
    escape: 'pause',
    esc: 'pause',
    p: 'pause',
    з: 'pause',
  };

  function actionFor(e) {
    return KEYMAP[e.code] || KEYMAP_ALT[String(e.key || '').toLowerCase()] || null;
  }

  const BLOCK_SCROLL = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Space',
  ]);

  /* ------------------------------------------------------------------ *
   * Host — owns one running game
   * ------------------------------------------------------------------ */
  class Host {
    constructor(def, els) {
      this.def = def;
      this.W = def.width;
      this.H = def.height;
      this.canvas = els.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.overlay = els.overlay;
      this.hudEl = els.hud;

      this.keys = new Set();
      this.just = new Set();
      this.pointer = { x: this.W / 2, y: this.H / 2, down: false, active: false };
      this.taps = [];
      this.swipes = [];
      this.fx = new Particles();

      this.state = 'ready'; // ready | playing | paused | over
      this.score = 0;
      this.info = {};
      this.shakeAmount = 0;
      this.game = null;
      this.rafId = 0;
      this.lastTs = 0;
      this.result = null;

      this._bind();
    }

    /* ---- lifecycle ---- */

    mount() {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      window.addEventListener('resize', this.onResize);
      this.canvas.addEventListener('pointerdown', this.onPointerDown);
      this.canvas.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      this.canvas.addEventListener('pointerleave', this.onPointerLeave);
      this.canvas.style.touchAction = 'none';
      this.fit();
      this.reset();
      this.lastTs = 0;
      this.rafId = requestAnimationFrame(this.tick);
    }

    unmount() {
      cancelAnimationFrame(this.rafId);
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      window.removeEventListener('resize', this.onResize);
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
      if (this.game && this.game.destroy) this.game.destroy();
      this.game = null;
    }

    reset() {
      this.score = 0;
      this.info = {};
      this.result = null;
      this.shakeAmount = 0;
      this.fx.clear();
      this.keys.clear();
      this.just.clear();
      this.taps.length = 0;
      this.swipes.length = 0;
      this.state = 'ready';
      if (this.game && this.game.destroy) this.game.destroy();
      this.game = this.def.create(this);
      this.renderHUD();
      this.renderOverlay();
    }

    play() {
      if (this.state === 'over') {
        this.reset();
      }
      if (this.state === 'ready' && this.game && this.game.onStart) this.game.onStart();
      this.state = 'playing';
      this.lastTs = 0;
      Arcade.sfx('blip');
      this.renderOverlay();
    }

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.renderOverlay();
    }

    togglePause() {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') {
        this.state = 'playing';
        this.lastTs = 0;
        this.renderOverlay();
      }
    }

    /* ---- API used by games ---- */

    addScore(n) {
      this.score += n;
      this.renderHUD();
    }
    setInfo(obj) {
      this.info = obj;
      this.renderHUD();
    }
    sfx(name) {
      Arcade.sfx(name);
    }
    shake(amount) {
      this.shakeAmount = Math.max(this.shakeAmount, amount);
    }
    held(action) {
      return this.keys.has(action);
    }
    pressed(action) {
      return this.just.has(action);
    }

    gameOver(payload) {
      if (this.state === 'over') return;
      this.state = 'over';
      this.result = payload || {};
      this.result.isRecord = Arcade.submitScore(this.def.id, this.score);
      Arcade.sfx(this.result.won ? 'fanfare' : 'die');
      this.renderOverlay();
      if (this.onGameOver) this.onGameOver(this.result);
    }

    /* ---- rendering ---- */

    fit() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.scale = w / this.W;
    }

    renderHUD() {
      if (!this.hudEl) return;
      const parts = [
        `<span class="hud-item"><b>${Arcade.t('score')}</b>${this.score}</span>`,
        `<span class="hud-item"><b>${Arcade.t('best')}</b>${Math.max(
          this.score,
          Arcade.highScore(this.def.id)
        )}</span>`,
      ];
      for (const k in this.info) {
        parts.push(`<span class="hud-item"><b>${Arcade.t(k)}</b>${this.info[k]}</span>`);
      }
      this.hudEl.innerHTML = parts.join('');
    }

    renderOverlay() {
      const o = this.overlay;
      if (!o) return;
      if (this.state === 'playing') {
        o.hidden = true;
        o.innerHTML = '';
        return;
      }
      o.hidden = false;
      const id = this.def.id;
      const m = Arcade.meta(id);
      let html = '';
      if (this.state === 'ready') {
        html = `
          <div class="panel">
            <div class="panel-emoji">${m.emoji || '🕹️'}</div>
            <h2>${m.title || id}</h2>
            <p class="panel-sub">${m.tagline || ''}</p>
            <ul class="controls">${(m.controls || [])
              .map((c) => `<li>${c}</li>`)
              .join('')}</ul>
            <button class="btn primary" data-act="play">${Arcade.t('play')}</button>
            <p class="hint">${Arcade.t('recordIs', { n: Arcade.highScore(id) })}</p>
          </div>`;
      } else if (this.state === 'paused') {
        html = `
          <div class="panel">
            <h2>${Arcade.t('paused')}</h2>
            <button class="btn primary" data-act="resume">${Arcade.t('resume')}</button>
            <button class="btn" data-act="restart">${Arcade.t('restart')}</button>
            <a class="btn ghost" href="${Arcade.hubUrl()}">${Arcade.t('menu')}</a>
          </div>`;
      } else {
        const r = this.result || {};
        html = `
          <div class="panel">
            <div class="panel-emoji">${r.won ? '🏆' : '💥'}</div>
            <h2>${r.won ? Arcade.t('victory') : Arcade.t('gameOver')}</h2>
            ${r.message ? `<p class="panel-sub">${r.message}</p>` : ''}
            <div class="final">
              <div><span>${Arcade.t('score')}</span><strong>${this.score}</strong></div>
              <div><span>${Arcade.t('best')}</span><strong>${Arcade.highScore(id)}</strong></div>
            </div>
            ${r.isRecord ? `<p class="record">${Arcade.t('newRecord')}</p>` : ''}
            <button class="btn primary" data-act="restart">${Arcade.t('again')}</button>
            <a class="btn ghost" href="${Arcade.hubUrl()}">${Arcade.t('menu')}</a>
          </div>`;
      }
      o.innerHTML = html;
    }

    render() {
      const ctx = this.ctx;
      const s = this.scale || 1;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.save();
      if (this.shakeAmount > 0.2) {
        ctx.translate(
          (Math.random() - 0.5) * this.shakeAmount,
          (Math.random() - 0.5) * this.shakeAmount
        );
      }
      if (this.game && this.game.draw) this.game.draw(ctx);
      this.fx.draw(ctx);
      ctx.restore();
    }

    /* ---- loop ---- */

    _bind() {
      this.tick = (ts) => {
        this.rafId = requestAnimationFrame(this.tick);
        if (!this.lastTs) this.lastTs = ts;
        let dt = (ts - this.lastTs) / 1000;
        this.lastTs = ts;
        if (dt > 0.05) dt = 0.05;

        this.fit();
        if (this.state === 'playing' && this.game && this.game.update) {
          this.game.update(dt);
        }
        this.fx.update(dt);
        this.shakeAmount *= Math.max(0, 1 - 6 * dt);
        this.render();

        this.just.clear();
        this.taps.length = 0;
        this.swipes.length = 0;
      };

      this.onKeyDown = (e) => {
        const action = actionFor(e);
        if (BLOCK_SCROLL.has(e.code)) e.preventDefault();
        if (!action) return;
        if (action === 'pause') {
          if (!e.repeat) this.togglePause();
          return;
        }
        if (action === 'action' && !e.repeat && this.state !== 'playing') {
          if (this.state === 'ready') this.play();
          else if (this.state === 'over') {
            this.reset();
            this.play();
          } else if (this.state === 'paused') this.togglePause();
          return;
        }
        if (!this.keys.has(action)) this.just.add(action);
        this.keys.add(action);
      };

      this.onKeyUp = (e) => {
        const action = actionFor(e);
        if (action) this.keys.delete(action);
      };

      this.onBlur = () => {
        this.keys.clear();
        this.pause();
      };

      this.onResize = () => this.fit();

      const toLocal = (e) => {
        const r = this.canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - r.left) / r.width) * this.W,
          y: ((e.clientY - r.top) / r.height) * this.H,
        };
      };

      this.onPointerDown = (e) => {
        e.preventDefault();
        const p = toLocal(e);
        this.pointer.x = p.x;
        this.pointer.y = p.y;
        this.pointer.down = true;
        this.pointer.active = true;
        this._swipeStart = { x: p.x, y: p.y, t: performance.now() };
        if (this.state === 'ready') this.play();
        else if (this.state === 'playing') this.just.add('action');
      };

      this.onPointerMove = (e) => {
        const p = toLocal(e);
        this.pointer.x = p.x;
        this.pointer.y = p.y;
        this.pointer.active = true;
      };

      this.onPointerUp = () => {
        this.pointer.down = false;
        const s = this._swipeStart;
        if (s) {
          const dx = this.pointer.x - s.x;
          const dy = this.pointer.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist > this.W * 0.06 && performance.now() - s.t < 600) {
            this.swipes.push(
              Math.abs(dx) > Math.abs(dy)
                ? dx > 0
                  ? 'right'
                  : 'left'
                : dy > 0
                ? 'down'
                : 'up'
            );
          } else if (dist < this.W * 0.04) {
            this.taps.push({ x: s.x, y: s.y });
          }
          this._swipeStart = null;
        }
      };

      this.onPointerLeave = () => {
        this.pointer.active = false;
        this.pointer.down = false;
      };
    }
  }

  Arcade.Host = Host;
  Arcade.Particles = Particles;

  /* ------------------------------------------------------------------ *
   * Превью — «режим аттракта» на витрине.
   * Крутит настоящую игру под управлением её же автопилота, без звука,
   * очков и ввода. Останавливается, когда карточка не видна.
   * ------------------------------------------------------------------ */
  Arcade.createPreview = function (def, canvas) {
    if (!def.autopilot) return null;
    const ctx = canvas.getContext('2d');
    const noop = () => {};
    const host = {
      W: def.width,
      H: def.height,
      state: 'playing',
      score: 0,
      pointer: { x: def.width / 2, y: def.height / 2, down: false, active: false },
      keys: new Set(),
      just: new Set(),
      taps: [],
      swipes: [],
      fx: new Particles(),
      addScore: noop,
      setInfo: noop,
      sfx: noop,
      shake: noop,
      held: () => false,
      pressed: () => false,
      gameOver: () => {
        host.state = 'over';
        host.restartIn = 1.2;
      },
    };

    function spawn() {
      host.state = 'playing';
      host.fx.clear();
      host.game = def.create(host);
    }
    spawn();

    let raf = 0;
    let last = 0;
    let running = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!last) last = ts;
      let dt = (ts - last) / 1000;
      last = ts;
      if (dt > 0.05) dt = 0.05;

      api.tick(dt);
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // вписываем поле целиком по центру, сохраняя пропорции
      const s = Math.min(w / def.width, h / def.height);
      ctx.setTransform(s, 0, 0, s, (w - def.width * s) / 2, (h - def.height * s) / 2);
      ctx.clearRect(0, 0, def.width, def.height);
      host.game.draw(ctx);
      host.fx.draw(ctx);
    }

    const api = {
      tick(dt) {
        if (host.state === 'playing') {
          def.autopilot(host.game, host);
          host.game.update(dt);
        } else {
          host.restartIn -= dt;
          if (host.restartIn <= 0) spawn();
        }
        host.fx.update(dt);
        draw();
      },
      start() {
        if (running) return;
        running = true;
        if (reduced) {
          draw();
          return;
        }
        last = 0;
        raf = requestAnimationFrame(frame);
      },
      stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
      },
      destroy() {
        api.stop();
        if (host.game && host.game.destroy) host.game.destroy();
      },
    };
    return api;
  };

  /* ------------------------------------------------------------------ *
   * Small drawing helpers shared by the games
   * ------------------------------------------------------------------ */
  Arcade.roundRect = function (ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  Arcade.glow = function (ctx, color, blur, fn) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    fn();
    ctx.restore();
  };

  Arcade.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
})();
