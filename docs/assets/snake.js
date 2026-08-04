/* Змейка — классика на сетке 20×20 с плавной интерполяцией,
   очередью поворотов и золотым бонусом на таймере. */
(function () {
  'use strict';

  const GRID = 20;
  const CELL = 24;
  const W = GRID * CELL; // 480
  const H = GRID * CELL;

  const BASE_STEP = 0.145; // сек на клетку в начале
  const MIN_STEP = 0.058;
  const BONUS_EVERY = 5; // каждое N-е яблоко рождает золотое
  const BONUS_LIFE = 6.5; // сек

  const DIRS = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
  };

  class Snake {
    constructor(g) {
      this.g = g;
      const cx = (GRID / 2) | 0;
      const cy = (GRID / 2) | 0;
      this.cells = [
        { x: cx, y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy },
        { x: cx - 3, y: cy },
      ];
      this.dir = DIRS.right;
      this.queue = [];
      this.grew = false;
      this.acc = 0;
      this.eaten = 0;
      this.food = null;
      this.bonus = null;
      this.deathAt = null;
      this.spawnFood();
      this.syncInfo();
    }

    get stepTime() {
      return Math.max(MIN_STEP, BASE_STEP - this.eaten * 0.0026);
    }

    syncInfo() {
      this.g.setInfo({ length: this.cells.length, apples: this.eaten });
    }

    occupied(x, y) {
      return this.cells.some((c) => c.x === x && c.y === y);
    }

    freeCell() {
      const open = [];
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (!this.occupied(x, y)) open.push({ x, y });
        }
      }
      if (!open.length) return null;
      return open[(Math.random() * open.length) | 0];
    }

    spawnFood() {
      const c = this.freeCell();
      if (!c) {
        this.g.gameOver({ won: true, message: Arcade.t('perfectSnake') });
        return;
      }
      this.food = { x: c.x, y: c.y, born: 0 };
    }

    spawnBonus() {
      const c = this.freeCell();
      if (!c) return;
      this.bonus = { x: c.x, y: c.y, left: BONUS_LIFE };
    }

    /* ---------------- ввод ---------------- */

    readInput() {
      const g = this.g;
      const push = (name) => {
        const d = DIRS[name];
        if (!d) return;
        const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
        if (d.x === -last.x && d.y === -last.y) return; // разворот на 180° запрещён
        if (d.x === last.x && d.y === last.y) return;
        if (this.queue.length < 2) this.queue.push(d);
      };
      for (const name of ['left', 'right', 'up', 'down']) {
        if (g.pressed(name)) push(name);
      }
      for (const s of g.swipes) push(s);
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      this.readInput();

      if (this.bonus) {
        this.bonus.left -= dt;
        if (this.bonus.left <= 0) this.bonus = null;
      }
      if (this.food) this.food.born += dt;

      this.acc += dt;
      const st = this.stepTime;
      while (this.acc >= st) {
        this.acc -= st;
        this.step();
        if (this.g.state !== 'playing') return;
      }
    }

    step() {
      if (this.queue.length) this.dir = this.queue.shift();

      const head = this.cells[0];
      const nx = head.x + this.dir.x;
      const ny = head.y + this.dir.y;

      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) return this.die(nx, ny);

      // хвост освободится на этом же шаге, если мы не растём
      const ignoreTail = !this.grew;
      const limit = ignoreTail ? this.cells.length - 1 : this.cells.length;
      for (let i = 0; i < limit; i++) {
        if (this.cells[i].x === nx && this.cells[i].y === ny) return this.die(nx, ny);
      }

      this.cells.unshift({ x: nx, y: ny });
      const wasGrowing = this.grew;
      if (!this.grew) this.cells.pop();
      this.grew = false;
      this.lastGrew = wasGrowing;

      // еда
      if (this.food && nx === this.food.x && ny === this.food.y) {
        this.eaten += 1;
        this.grew = true;
        this.g.addScore(10);
        this.g.sfx('eat');
        this.g.fx.burst(nx * CELL + CELL / 2, ny * CELL + CELL / 2, {
          count: 12,
          color: ['#ef4444', '#fca5a5'],
          speed: 130,
          life: 0.4,
          size: 3,
        });
        this.spawnFood();
        if (this.eaten % BONUS_EVERY === 0 && !this.bonus) this.spawnBonus();
        this.syncInfo();
      }

      if (this.bonus && nx === this.bonus.x && ny === this.bonus.y) {
        this.grew = true;
        this.g.addScore(50);
        this.g.sfx('bonus');
        this.g.shake(5);
        this.g.fx.burst(nx * CELL + CELL / 2, ny * CELL + CELL / 2, {
          count: 22,
          color: ['#fbbf24', '#fde68a', '#ffffff'],
          speed: 190,
          life: 0.55,
          size: 3.5,
        });
        this.bonus = null;
        this.syncInfo();
      }
    }

    die(nx, ny) {
      const x = Arcade.clamp(nx, 0, GRID - 1) * CELL + CELL / 2;
      const y = Arcade.clamp(ny, 0, GRID - 1) * CELL + CELL / 2;
      this.deathAt = { x, y };
      this.g.shake(16);
      this.g.fx.burst(x, y, {
        count: 26,
        color: ['#4ade80', '#a7f3d0', '#ffffff'],
        speed: 210,
        life: 0.7,
        size: 4,
      });
      this.g.gameOver({ message: Arcade.t('snakeLength', { n: this.cells.length }) });
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      ctx.fillStyle = '#070c14';
      ctx.fillRect(0, 0, W, H);

      // шахматная подложка
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if ((x + y) % 2) continue;
          ctx.fillStyle = 'rgba(148,163,184,0.035)';
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
      ctx.strokeStyle = 'rgba(34,211,238,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      const t =
        this.g.state === 'playing'
          ? Arcade.clamp(this.acc / this.stepTime, 0, 1)
          : 1;

      // еда
      if (this.food) {
        const pulse = 1 + Math.sin(this.food.born * 6) * 0.08;
        this.drawDot(
          ctx,
          this.food.x,
          this.food.y,
          '#ef4444',
          CELL * 0.34 * pulse,
          '#fecaca'
        );
      }
      // золотое яблоко
      if (this.bonus) {
        const k = this.bonus.left / BONUS_LIFE;
        const blink = this.bonus.left < 2 ? (Math.sin(this.bonus.left * 18) > 0 ? 1 : 0.25) : 1;
        ctx.globalAlpha = blink;
        this.drawDot(ctx, this.bonus.x, this.bonus.y, '#fbbf24', CELL * 0.38, '#fef3c7');
        ctx.globalAlpha = 1;
        // таймер-дуга
        const cx = this.bonus.x * CELL + CELL / 2;
        const cy = this.bonus.y * CELL + CELL / 2;
        ctx.strokeStyle = 'rgba(251,191,36,0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.46, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
        ctx.stroke();
      }

      // тело
      const n = this.cells.length;
      for (let i = n - 1; i >= 0; i--) {
        const c = this.cells[i];
        let px = c.x * CELL;
        let py = c.y * CELL;

        if (i === 0 && n > 1) {
          const p = this.cells[1];
          px = (p.x + (c.x - p.x) * t) * CELL;
          py = (p.y + (c.y - p.y) * t) * CELL;
        } else if (i === n - 1 && n > 1 && !this.lastGrew) {
          const p = this.cells[n - 2];
          px = (c.x + (p.x - c.x) * t) * CELL;
          py = (c.y + (p.y - c.y) * t) * CELL;
        }

        // тело плавно темнеет от головы к хвосту, оставаясь зелёным
        const k = i / Math.max(1, n - 1);
        ctx.fillStyle =
          i === 0
            ? '#bbf7d0'
            : `rgb(${Math.round(74 - 53 * k)}, ${Math.round(222 - 94 * k)}, ${Math.round(
                128 - 67 * k
              )})`;
        Arcade.roundRect(ctx, px + 1.5, py + 1.5, CELL - 3, CELL - 3, 6);
        ctx.fill();

        if (i === 0) {
          // глаза по направлению движения
          const d = this.dir;
          const ex = px + CELL / 2 + d.x * 4;
          const ey = py + CELL / 2 + d.y * 4;
          const ox = d.x ? 0 : 4;
          const oy = d.y ? 0 : 4;
          ctx.fillStyle = '#052e16';
          ctx.beginPath();
          ctx.arc(ex - ox, ey - oy, 2.4, 0, 7);
          ctx.arc(ex + ox, ey + oy, 2.4, 0, 7);
          ctx.fill();
        }
      }
    }

    drawDot(ctx, gx, gy, color, r, hi) {
      const cx = gx * CELL + CELL / 2;
      const cy = gy * CELL + CELL / 2;
      Arcade.glow(ctx, color, 12, () => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 7);
        ctx.fill();
      });
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.32, r * 0.28, 0, 7);
      ctx.fill();
    }
  }

  Arcade.register({
    id: 'snake',
    width: W,
    height: H,
    create: (g) => new Snake(g),
    // автопилот для превью: жадный ход к ближайшей цели, если он не смертелен
    autopilot(s) {
      const goal = s.bonus || s.food;
      if (!goal) return;
      const head = s.cells[0];
      let best = null;
      let bestDist = Infinity;
      for (const name in DIRS) {
        const d = DIRS[name];
        if (d.x === -s.dir.x && d.y === -s.dir.y) continue;
        const nx = head.x + d.x;
        const ny = head.y + d.y;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        let hitsSelf = false;
        for (let i = 0; i < s.cells.length - 1; i++) {
          if (s.cells[i].x === nx && s.cells[i].y === ny) {
            hitsSelf = true;
            break;
          }
        }
        if (hitsSelf) continue;
        // считаем свободное пространство на шаг вперёд, чтобы не загонять себя в угол
        let room = 0;
        for (const e of Object.values(DIRS)) {
          const ax = nx + e.x;
          const ay = ny + e.y;
          if (ax < 0 || ay < 0 || ax >= GRID || ay >= GRID) continue;
          if (s.cells.some((c) => c.x === ax && c.y === ay)) continue;
          room++;
        }
        const dist = Math.abs(nx - goal.x) + Math.abs(ny - goal.y) - room * 1.5;
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      if (best) s.queue = [best];
    },
  });
})();
