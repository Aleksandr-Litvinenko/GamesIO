/* Мотоциклы — световые мотоциклы в стиле Tron.
   Игрок против трёх ботов, следы на сетке, буст, раунды с ростом скорости. */
(function () {
  'use strict';

  const GRID = 40;
  const CELL = 16;
  const W = GRID * CELL; // 640
  const H = GRID * CELL;

  const BASE_STEP = 0.075; // сек на клетку в 1-м раунде
  const MIN_STEP = 0.04;
  const BOOST_FACTOR = 0.52;
  const BOOST_MAX = 100;
  const BOOST_DRAIN = 46; // ед/сек
  const BOOST_REGEN = 13;

  const DIRS = [
    { x: 1, y: 0 }, // 0 вправо
    { x: 0, y: 1 }, // 1 вниз
    { x: -1, y: 0 }, // 2 влево
    { x: 0, y: -1 }, // 3 вверх
  ];
  const DIR_BY_NAME = { right: 0, down: 1, left: 2, up: 3 };

  const RIDERS = [
    { color: '#22d3ee', dim: '#0e7490', name: 'Ты' },
    { color: '#f472b6', dim: '#9d174d', name: 'Ро' },
    { color: '#fbbf24', dim: '#b45309', name: 'Сол' },
    { color: '#a78bfa', dim: '#6d28d9', name: 'Ви' },
  ];

  class Moto {
    constructor(g) {
      this.g = g;
      this.round = 1;
      this.lives = 3;
      this.trailCanvas = document.createElement('canvas');
      this.trailCanvas.width = W;
      this.trailCanvas.height = H;
      this.trailCtx = this.trailCanvas.getContext('2d');
      this.startRound();
      this.syncInfo();
    }

    get stepTime() {
      return Math.max(MIN_STEP, BASE_STEP - (this.round - 1) * 0.005);
    }

    syncInfo() {
      this.g.setInfo({
        round: this.round,
        lives: '❤'.repeat(Math.max(0, this.lives)) || '—',
      });
    }

    startRound() {
      this.occ = new Uint8Array(GRID * GRID); // 0 пусто, иначе id+1
      this.trailCtx.clearRect(0, 0, W, H);
      this.roundOver = 0;
      this.boost = BOOST_MAX;
      this.boosting = false;

      const m = 5;
      const starts = [
        { x: m, y: (GRID / 2) | 0, dir: 0 },
        { x: GRID - 1 - m, y: (GRID / 2) | 0, dir: 2 },
        { x: (GRID / 2) | 0, y: m, dir: 1 },
        { x: (GRID / 2) | 0, y: GRID - 1 - m, dir: 3 },
      ];

      this.bikes = starts.map((s, i) => ({
        id: i,
        x: s.x,
        y: s.y,
        dir: s.dir,
        pending: s.dir,
        alive: true,
        acc: 0,
        ai: i > 0,
        color: RIDERS[i].color,
        dim: RIDERS[i].dim,
        name: RIDERS[i].name,
        turnCooldown: 0,
      }));

      for (const b of this.bikes) this.stamp(b, b.x, b.y);
    }

    idx(x, y) {
      return y * GRID + x;
    }

    blocked(x, y) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
      return this.occ[this.idx(x, y)] !== 0;
    }

    stamp(b, x, y) {
      this.occ[this.idx(x, y)] = b.id + 1;
      const ctx = this.trailCtx;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.dim;
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
      ctx.restore();
    }

    /* ---------------- ввод ---------------- */

    readInput() {
      const g = this.g;
      const me = this.bikes[0];
      if (!me.alive) return;

      const set = (d) => {
        if ((d + 2) % 4 === me.dir) return; // разворот запрещён
        me.pending = d;
      };
      for (const name in DIR_BY_NAME) {
        if (g.pressed(name)) set(DIR_BY_NAME[name]);
      }
      for (const s of g.swipes) set(DIR_BY_NAME[s]);
      // тап по левой/правой половине — поворот относительно движения
      for (const tap of g.taps) {
        set(tap.x < W / 2 ? (me.dir + 3) % 4 : (me.dir + 1) % 4);
      }
      this.boosting = g.held('boost') && this.boost > 1;
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      this.readInput();

      if (this.boosting) {
        this.boost = Math.max(0, this.boost - BOOST_DRAIN * dt);
        if (this.boost <= 0) this.boosting = false;
      } else {
        this.boost = Math.min(BOOST_MAX, this.boost + BOOST_REGEN * dt);
      }

      const base = this.stepTime;
      for (const b of this.bikes) {
        if (!b.alive) continue;
        const interval = b.id === 0 && this.boosting ? base * BOOST_FACTOR : base;
        b.acc += dt;
        b.turnCooldown = Math.max(0, b.turnCooldown - dt);
        while (b.acc >= interval && b.alive) {
          b.acc -= interval;
          this.moveBike(b);
        }
      }

      if (this.roundOver > 0) {
        this.roundOver -= dt;
        if (this.roundOver <= 0) this.nextRound();
        return;
      }

      const me = this.bikes[0];
      const botsAlive = this.bikes.filter((b) => b.ai && b.alive).length;
      if (!me.alive) {
        this.lives -= 1;
        this.syncInfo();
        if (this.lives <= 0) {
          this.g.gameOver({ message: Arcade.t('roundsCleared', { n: this.round - 1 }) });
        } else {
          this.roundOver = 1.4;
          this.retry = true;
        }
      } else if (botsAlive === 0) {
        this.g.addScore(500 * this.round);
        this.g.sfx('fanfare');
        this.roundOver = 1.4;
        this.retry = false;
      }
    }

    moveBike(b) {
      if (b.ai || this.autoPlayer) this.think(b);
      b.dir = b.pending;
      const d = DIRS[b.dir];
      const nx = b.x + d.x;
      const ny = b.y + d.y;
      if (this.blocked(nx, ny)) return this.crash(b, nx, ny);
      b.x = nx;
      b.y = ny;
      this.stamp(b, nx, ny);
    }

    crash(b, nx, ny) {
      b.alive = false;
      const x = Arcade.clamp(nx, 0, GRID - 1) * CELL + CELL / 2;
      const y = Arcade.clamp(ny, 0, GRID - 1) * CELL + CELL / 2;
      this.g.fx.burst(x, y, {
        count: b.id === 0 ? 44 : 26,
        color: [b.color, '#ffffff'],
        speed: b.id === 0 ? 300 : 210,
        life: 0.8,
        size: 4,
      });
      this.g.shake(b.id === 0 ? 20 : 8);
      this.g.sfx('crash');
      if (b.ai) this.g.addScore(150);
    }

    nextRound() {
      if (!this.retry) this.round += 1;
      this.startRound();
      this.syncInfo();
    }

    /* ---------------- ИИ ---------------- */

    // Длина свободного коридора по направлению (не дальше max клеток).
    ray(x, y, dir, max) {
      const d = DIRS[dir];
      let n = 0;
      let cx = x;
      let cy = y;
      while (n < max) {
        cx += d.x;
        cy += d.y;
        if (this.blocked(cx, cy)) break;
        n++;
      }
      return n;
    }

    // Размер доступной области (ограниченный обход в ширину).
    space(x, y, cap) {
      if (this.blocked(x, y)) return 0;
      const seen = new Set([this.idx(x, y)]);
      const queue = [x, y];
      let count = 0;
      let head = 0;
      while (head < queue.length && count < cap) {
        const cx = queue[head++];
        const cy = queue[head++];
        count++;
        for (const d of DIRS) {
          const nx = cx + d.x;
          const ny = cy + d.y;
          if (this.blocked(nx, ny)) continue;
          const k = this.idx(nx, ny);
          if (seen.has(k)) continue;
          seen.add(k);
          queue.push(nx, ny);
        }
      }
      return count;
    }

    think(b) {
      const options = [b.dir, (b.dir + 1) % 4, (b.dir + 3) % 4];
      const cap = 55; // намеренно близорукий обзор — боты рискуют и раунд не тянется
      let best = null;
      let bestScore = -Infinity;

      for (const dir of options) {
        const d = DIRS[dir];
        const nx = b.x + d.x;
        const ny = b.y + d.y;
        if (this.blocked(nx, ny)) continue;

        const corridor = this.ray(b.x, b.y, dir, 16);
        const room = this.space(nx, ny, cap);
        let score = corridor * 1.5 + room * 0.8;
        if (dir === b.dir) score += 11; // инерция: ботам нравится ехать прямо
        score += Math.random() * 11;

        // немного агрессии: подрезать игрока, если он рядом
        const me = this.bikes[0];
        if (b.ai && me.alive) {
          const dist = Math.abs(nx - me.x) + Math.abs(ny - me.y);
          if (dist < 12) score += (12 - dist) * 0.9;
        }

        if (score > bestScore) {
          bestScore = score;
          best = dir;
        }
      }

      if (best === null) return; // тупик — врежется на следующем шаге
      // случайный манёвр, чтобы боты не ездили одинаково
      if (best === b.dir && b.turnCooldown <= 0 && Math.random() < 0.07) {
        const side = Math.random() < 0.5 ? 1 : 3;
        const dir = (b.dir + side) % 4;
        const d = DIRS[dir];
        if (!this.blocked(b.x + d.x, b.y + d.y) && this.ray(b.x, b.y, dir, 10) > 5) {
          best = dir;
          b.turnCooldown = 0.5;
        }
      }
      b.pending = best;
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, W, H);

      // сетка арены
      ctx.strokeStyle = 'rgba(56,189,248,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= GRID; i += 4) {
        ctx.moveTo(i * CELL + 0.5, 0);
        ctx.lineTo(i * CELL + 0.5, H);
        ctx.moveTo(0, i * CELL + 0.5);
        ctx.lineTo(W, i * CELL + 0.5);
      }
      ctx.stroke();

      ctx.drawImage(this.trailCanvas, 0, 0);

      // головы мотоциклов
      for (const b of this.bikes) {
        if (!b.alive) continue;
        const px = b.x * CELL;
        const py = b.y * CELL;
        Arcade.glow(ctx, b.color, b.id === 0 && this.boosting ? 22 : 12, () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px - 1, py - 1, CELL + 2, CELL + 2);
          ctx.fillStyle = b.color;
          ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        });
      }

      // рамка арены
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

      this.drawBoostBar(ctx);
      this.drawRoundBanner(ctx);
    }

    drawBoostBar(ctx) {
      // плашка с бустом — на тёмном фоне, чтобы читалась поверх следов
      const pw = 186;
      const ph = 30;
      const px = 12;
      const py = H - ph - 12;
      ctx.fillStyle = 'rgba(5,7,15,0.88)';
      Arcade.roundRect(ctx, px, py, pw, ph, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.font = '10px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(Arcade.t('boost'), px + 12, py + 13);

      const bw = pw - 24;
      const bh = 7;
      const bx = px + 12;
      const by = py + 18;
      ctx.fillStyle = 'rgba(148,163,184,0.18)';
      Arcade.roundRect(ctx, bx, by, bw, bh, 4);
      ctx.fill();
      ctx.fillStyle = this.boosting ? '#67e8f9' : '#0e7490';
      Arcade.roundRect(ctx, bx, by, Math.max(2, (bw * this.boost) / BOOST_MAX), bh, 4);
      ctx.fill();

      // кто ещё в игре
      const n = this.bikes.length - 1;
      const lw = 20 + n * 18;
      const lx = W - lw - 12;
      ctx.fillStyle = 'rgba(5,7,15,0.88)';
      Arcade.roundRect(ctx, lx, py, lw, ph, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.22)';
      ctx.stroke();
      for (let i = 1; i < this.bikes.length; i++) {
        const b = this.bikes[i];
        ctx.globalAlpha = b.alive ? 1 : 0.22;
        ctx.fillStyle = b.color;
        Arcade.roundRect(ctx, lx + 10 + (i - 1) * 18, py + ph / 2 - 6, 12, 12, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    drawRoundBanner(ctx) {
      if (this.roundOver <= 0) return;
      const me = this.bikes[0];
      ctx.fillStyle = 'rgba(5,7,15,0.7)';
      ctx.fillRect(0, H / 2 - 46, W, 92);
      ctx.textAlign = 'center';
      ctx.fillStyle = me.alive ? '#4ade80' : '#f87171';
      ctx.font = 'bold 30px ui-monospace, Menlo, monospace';
      ctx.fillText(me.alive ? Arcade.t('roundClear') : Arcade.t('crashed'), W / 2, H / 2);
      ctx.fillStyle = 'rgba(226,232,240,0.8)';
      ctx.font = '14px ui-monospace, Menlo, monospace';
      ctx.fillText(
        me.alive
          ? Arcade.t('nextRoundFaster', { n: this.round + 1 })
          : Arcade.t('livesLeft', { n: this.lives }),
        W / 2,
        H / 2 + 26
      );
    }
  }

  Arcade.register({
    id: 'moto',
    width: W,
    height: H,
    create: (g) => new Moto(g),
    // автопилот для превью: игрок ездит по той же логике, что и боты
    autopilot(m) {
      m.autoPlayer = true;
    },
  });
})();
