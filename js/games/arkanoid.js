/* Арканоид — платформа, мяч, кирпичи, бонусы, 5 уровней с зацикливанием. */
(function () {
  'use strict';

  const W = 480;
  const H = 640;
  const MX = 22; // боковые поля
  const TOP = 84; // отступ до первого ряда
  const COLS = 10;
  const GAP = 4;
  const BRICK_H = 20;
  const BRICK_W = (W - 2 * MX - (COLS - 1) * GAP) / COLS;

  const PADDLE_Y = H - 46;
  const PADDLE_H = 12;
  const PADDLE_BASE_W = 92;

  const BALL_R = 7;
  const BASE_SPEED = 300;

  const COLORS = {
    1: { fill: '#22d3ee', edge: '#0891b2' },
    2: { fill: '#f472b6', edge: '#be185d' },
    3: { fill: '#fbbf24', edge: '#b45309' },
    X: { fill: '#64748b', edge: '#334155' },
  };

  const LEVELS = [
    ['1111111111', '1111111111', '2222222222'],
    ['..111111..', '.22222222.', '1133113311', '.22222222.', '..111111..'],
    ['....11....', '...2222...', '..333333..', '.22222222.', '1111111111'],
    ['.X111111X.', '.22222222.', '.33333333.', '.X111111X.'],
    ['3.3.3.3.3.', '.3.3.3.3.3', '2222222222', '1.1.1.1.1.', '.1.1.1.1.1'],
  ];

  // Бонусы: буква -> {цвет, подпись, добрый ли}
  const POWERS = {
    E: { color: '#4ade80', label: 'E', good: true }, // шире платформа
    M: { color: '#22d3ee', label: 'M', good: true }, // мультимяч
    L: { color: '#f472b6', label: 'L', good: true }, // жизнь
    W: { color: '#60a5fa', label: 'W', good: true }, // замедление
    S: { color: '#ef4444', label: 'S', good: false }, // уже платформа
  };
  const POWER_KEYS = ['E', 'E', 'M', 'M', 'L', 'W', 'S', 'S'];

  class Arkanoid {
    constructor(g) {
      this.g = g;
      this.lives = 3;
      this.levelIndex = 0;
      this.loop = 0;
      this.paddle = { x: W / 2, w: PADDLE_BASE_W, targetW: PADDLE_BASE_W };
      this.balls = [];
      this.powers = [];
      this.bricks = [];
      this.stuck = true;
      this.slowTimer = 0;
      this.widthTimer = 0;
      this.flash = 0;
      this.buildLevel();
      this.syncInfo();
    }

    /* ---------------- уровень ---------------- */

    buildLevel() {
      const pattern = LEVELS[this.levelIndex % LEVELS.length];
      this.bricks = [];
      pattern.forEach((row, r) => {
        for (let c = 0; c < COLS; c++) {
          const ch = row[c];
          if (!ch || ch === '.') continue;
          this.bricks.push({
            x: MX + c * (BRICK_W + GAP),
            y: TOP + r * (BRICK_H + GAP),
            w: BRICK_W,
            h: BRICK_H,
            hp: ch === 'X' ? Infinity : parseInt(ch, 10),
            max: ch === 'X' ? Infinity : parseInt(ch, 10),
            solid: ch === 'X',
            hit: 0,
          });
        }
      });
      this.powers = [];
      this.resetBall();
    }

    get speed() {
      return BASE_SPEED + this.levelIndex * 14 + this.loop * 45;
    }

    resetBall() {
      this.balls = [
        {
          x: this.paddle.x,
          y: PADDLE_Y - BALL_R - 1,
          vx: 0,
          vy: 0,
          trail: [],
        },
      ];
      this.stuck = true;
      this.slowTimer = 0;
    }

    launch() {
      if (!this.stuck) return;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      const s = this.speed;
      const b = this.balls[0];
      b.vx = Math.cos(angle) * s;
      b.vy = Math.sin(angle) * s;
      this.stuck = false;
      this.g.sfx('bounce');
    }

    syncInfo() {
      this.g.setInfo({
        Жизни: '❤'.repeat(Math.max(0, this.lives)) || '—',
        Уровень: this.levelIndex + 1 + (this.loop ? `·${this.loop + 1}` : ''),
      });
    }

    onStart() {
      // мяч ждёт запуска пробелом/тапом
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      const g = this.g;
      this.flash = Math.max(0, this.flash - dt * 3);

      // --- платформа ---
      const p = this.paddle;
      p.w += (p.targetW - p.w) * Math.min(1, dt * 10);
      if (g.pointer.active) {
        p.x += (g.pointer.x - p.x) * Math.min(1, dt * 22);
      }
      if (g.held('left')) p.x -= 540 * dt;
      if (g.held('right')) p.x += 540 * dt;
      p.x = Arcade.clamp(p.x, MX + p.w / 2, W - MX - p.w / 2);

      if (this.widthTimer > 0) {
        this.widthTimer -= dt;
        if (this.widthTimer <= 0) p.targetW = PADDLE_BASE_W;
      }
      if (this.slowTimer > 0) {
        this.slowTimer -= dt;
        if (this.slowTimer <= 0) this.rescale(1 / 0.65);
      }

      if (g.pressed('action')) this.launch();

      // --- мячи ---
      if (this.stuck) {
        const b = this.balls[0];
        b.x = p.x;
        b.y = PADDLE_Y - BALL_R - 1;
        b.trail.length = 0;
      } else {
        for (let i = this.balls.length - 1; i >= 0; i--) {
          if (!this.stepBall(this.balls[i], dt)) this.balls.splice(i, 1);
        }
        if (this.balls.length === 0) this.loseLife();
      }

      // --- бонусы ---
      for (let i = this.powers.length - 1; i >= 0; i--) {
        const pw = this.powers[i];
        pw.y += 145 * dt;
        pw.spin += dt * 4;
        if (pw.y > H + 20) {
          this.powers.splice(i, 1);
          continue;
        }
        if (
          pw.y + 9 > PADDLE_Y &&
          pw.y - 9 < PADDLE_Y + PADDLE_H &&
          Math.abs(pw.x - p.x) < p.w / 2 + 10
        ) {
          this.applyPower(pw.kind);
          this.powers.splice(i, 1);
        }
      }
    }

    stepBall(b, dt) {
      // подшагиваем, чтобы мяч не проскакивал кирпичи на высокой скорости
      const dist = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;

        if (b.x - BALL_R < 0) {
          b.x = BALL_R;
          b.vx = Math.abs(b.vx);
          this.g.sfx('bounce');
        } else if (b.x + BALL_R > W) {
          b.x = W - BALL_R;
          b.vx = -Math.abs(b.vx);
          this.g.sfx('bounce');
        }
        if (b.y - BALL_R < 0) {
          b.y = BALL_R;
          b.vy = Math.abs(b.vy);
          this.g.sfx('bounce');
        }
        if (b.y - BALL_R > H) return false;

        this.hitPaddle(b);
        this.hitBricks(b);
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();
      return true;
    }

    hitPaddle(b) {
      const p = this.paddle;
      if (b.vy <= 0) return;
      if (b.y + BALL_R < PADDLE_Y || b.y - BALL_R > PADDLE_Y + PADDLE_H) return;
      if (Math.abs(b.x - p.x) > p.w / 2 + BALL_R) return;

      const t = Arcade.clamp((b.x - p.x) / (p.w / 2), -1, 1);
      const angle = -Math.PI / 2 + t * (Math.PI / 3);
      const speed = Math.max(this.speed * 0.9, Math.hypot(b.vx, b.vy));
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      b.y = PADDLE_Y - BALL_R - 0.5;
      this.g.sfx('bounce');
      this.g.fx.burst(b.x, PADDLE_Y, {
        count: 5,
        color: '#22d3ee',
        speed: 90,
        life: 0.25,
        size: 2.5,
      });
    }

    hitBricks(b) {
      for (let i = 0; i < this.bricks.length; i++) {
        const br = this.bricks[i];
        if (
          b.x + BALL_R < br.x ||
          b.x - BALL_R > br.x + br.w ||
          b.y + BALL_R < br.y ||
          b.y - BALL_R > br.y + br.h
        )
          continue;

        // с какой стороны меньше перекрытие — оттуда и пришли
        const overlapL = b.x + BALL_R - br.x;
        const overlapR = br.x + br.w - (b.x - BALL_R);
        const overlapT = b.y + BALL_R - br.y;
        const overlapB = br.y + br.h - (b.y - BALL_R);
        const min = Math.min(overlapL, overlapR, overlapT, overlapB);
        if (min === overlapL) {
          b.vx = -Math.abs(b.vx);
          b.x = br.x - BALL_R;
        } else if (min === overlapR) {
          b.vx = Math.abs(b.vx);
          b.x = br.x + br.w + BALL_R;
        } else if (min === overlapT) {
          b.vy = -Math.abs(b.vy);
          b.y = br.y - BALL_R;
        } else {
          b.vy = Math.abs(b.vy);
          b.y = br.y + br.h + BALL_R;
        }

        br.hit = 1;
        if (br.solid) {
          this.g.sfx('bounce');
          return;
        }

        br.hp -= 1;
        this.g.sfx('brick');
        const col = COLORS[Math.max(1, br.hp || br.max)].fill;
        if (br.hp <= 0) {
          this.g.addScore(10 * br.max);
          this.g.fx.burst(br.x + br.w / 2, br.y + br.h / 2, {
            count: 14,
            color: [col, '#ffffff'],
            speed: 170,
            life: 0.5,
            size: 4,
            gravity: 220,
          });
          this.bricks.splice(i, 1);
          this.maybeDropPower(br);
          if (!this.bricks.some((x) => !x.solid)) this.completeLevel();
        } else {
          this.g.addScore(5);
          this.g.fx.burst(b.x, b.y, {
            count: 5,
            color: col,
            speed: 110,
            life: 0.3,
            size: 3,
          });
        }
        return; // не больше одного кирпича за подшаг
      }
    }

    maybeDropPower(br) {
      if (Math.random() > 0.19) return;
      const kind = POWER_KEYS[(Math.random() * POWER_KEYS.length) | 0];
      this.powers.push({
        x: br.x + br.w / 2,
        y: br.y + br.h / 2,
        kind: kind,
        spin: 0,
      });
    }

    applyPower(kind) {
      const p = this.paddle;
      switch (kind) {
        case 'E':
          p.targetW = Math.min(160, p.targetW + 34);
          this.widthTimer = 14;
          this.g.sfx('power');
          break;
        case 'S':
          p.targetW = Math.max(52, p.targetW - 26);
          this.widthTimer = 10;
          this.g.sfx('bad');
          break;
        case 'M':
          this.splitBalls();
          this.g.sfx('power');
          break;
        case 'L':
          this.lives += 1;
          this.g.sfx('power');
          break;
        case 'W':
          if (this.slowTimer <= 0) this.rescale(0.65);
          this.slowTimer = 8;
          this.g.sfx('power');
          break;
      }
      this.g.addScore(50);
      this.flash = 1;
      this.syncInfo();
    }

    rescale(k) {
      for (const b of this.balls) {
        b.vx *= k;
        b.vy *= k;
      }
    }

    splitBalls() {
      if (this.stuck) this.launch();
      const extra = [];
      for (const b of this.balls) {
        if (this.balls.length + extra.length >= 5) break;
        for (const sign of [-1, 1]) {
          if (this.balls.length + extra.length >= 5) break;
          const a = Math.atan2(b.vy, b.vx) + sign * 0.45;
          const s = Math.hypot(b.vx, b.vy);
          extra.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s,
            trail: [],
          });
        }
      }
      this.balls.push(...extra);
    }

    completeLevel() {
      this.g.addScore(200 + 60 * this.lives);
      this.levelIndex += 1;
      if (this.levelIndex % LEVELS.length === 0) this.loop += 1;
      this.paddle.targetW = PADDLE_BASE_W;
      this.widthTimer = 0;
      this.g.sfx('fanfare');
      this.g.shake(6);
      this.buildLevel();
      this.syncInfo();
    }

    loseLife() {
      this.lives -= 1;
      this.syncInfo();
      this.g.shake(14);
      this.paddle.targetW = PADDLE_BASE_W;
      this.widthTimer = 0;
      if (this.lives <= 0) {
        this.g.fx.burst(this.paddle.x, PADDLE_Y, {
          count: 30,
          color: ['#22d3ee', '#ffffff'],
          speed: 240,
          life: 0.8,
          size: 4,
          gravity: 260,
        });
        this.g.gameOver({
          message: `Пройдено уровней: ${this.levelIndex + this.loop * LEVELS.length}`,
        });
      } else {
        this.g.sfx('die');
        this.resetBall();
      }
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      // фон
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#0b1020');
      grd.addColorStop(1, '#070812');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.06})`;
        ctx.fillRect(0, 0, W, H);
      }

      // рамка игрового поля
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      // кирпичи
      for (const br of this.bricks) {
        const key = br.solid ? 'X' : Math.max(1, br.hp);
        const c = COLORS[key];
        ctx.fillStyle = c.fill;
        Arcade.roundRect(ctx, br.x, br.y, br.w, br.h, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(br.x + 3, br.y + 3, br.w - 6, 3);
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 1;
        Arcade.roundRect(ctx, br.x + 0.5, br.y + 0.5, br.w - 1, br.h - 1, 4);
        ctx.stroke();
        if (br.solid) {
          ctx.fillStyle = 'rgba(15,23,42,0.5)';
          for (let i = 0; i < br.w; i += 8) ctx.fillRect(br.x + i, br.y, 2, br.h);
        }
      }

      // бонусы
      for (const pw of this.powers) {
        const meta = POWERS[pw.kind];
        ctx.save();
        ctx.translate(pw.x, pw.y);
        const sx = Math.cos(pw.spin);
        ctx.scale(Math.max(0.25, Math.abs(sx)), 1);
        ctx.fillStyle = meta.color;
        Arcade.roundRect(ctx, -11, -9, 22, 18, 5);
        ctx.fill();
        ctx.fillStyle = '#0b1020';
        ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.label, 0, 1);
        ctx.restore();
      }

      // платформа
      const p = this.paddle;
      Arcade.glow(ctx, '#22d3ee', 14, () => {
        const pg = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
        pg.addColorStop(0, '#67e8f9');
        pg.addColorStop(1, '#0891b2');
        ctx.fillStyle = pg;
        Arcade.roundRect(ctx, p.x - p.w / 2, PADDLE_Y, p.w, PADDLE_H, 6);
        ctx.fill();
      });

      // мячи
      for (const b of this.balls) {
        for (let i = 0; i < b.trail.length; i++) {
          const t = b.trail[i];
          ctx.globalAlpha = (i / b.trail.length) * 0.4;
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.arc(t.x, t.y, BALL_R * (0.35 + (i / b.trail.length) * 0.6), 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        Arcade.glow(ctx, '#ffffff', 12, () => {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(b.x, b.y, BALL_R, 0, 7);
          ctx.fill();
        });
      }

      if (this.stuck) {
        ctx.fillStyle = 'rgba(226,232,240,0.75)';
        ctx.font = '13px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Пробел или тап — запуск', W / 2, PADDLE_Y - 34);
      }
    }
  }

  Arcade.register({
    id: 'arkanoid',
    title: 'Арканоид',
    emoji: '🧱',
    accent: '#22d3ee',
    tagline: 'Разбей все кирпичи, лови бонусы и не теряй мяч.',
    controls: [
      '← → или мышь — двигать платформу',
      'Пробел / тап — запустить мяч',
      'P или Esc — пауза',
    ],
    width: W,
    height: H,
    create: (g) => new Arkanoid(g),
    // автопилот для превью на витрине: платформа тянется к самому нижнему мячу
    autopilot(a) {
      if (a.stuck) {
        a.launch();
        return;
      }
      let target = a.paddle.x;
      let lowest = -Infinity;
      for (const b of a.balls) {
        if (b.y > lowest) {
          lowest = b.y;
          target = b.x;
        }
      }
      a.paddle.x += (target - a.paddle.x) * 0.16;
    },
  });
})();
