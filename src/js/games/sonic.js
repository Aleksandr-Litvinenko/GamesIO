/* Ёжик — скоростной платформер в духе Sonic.

   Тайловой сетки здесь нет: уровень — это кривая рельефа, высота земли для
   каждой колонки. Так работает главное в жанре — уклон. Вниз по склону ёж
   разгоняется сам, вверх теряет скорость, а в клубке трение почти исчезает,
   и накопленная скорость несёт через горку. Кольца работают как броня:
   пока есть хоть одно, попадание не убивает, а рассыпает их по земле. */
(function () {
  'use strict';

  const W = 640;
  const H = 400;

  const STEP = 4; // разрешение рельефа в пикселях
  const PIT = 3000; // «высота» дна пропасти

  const ACCEL = 700;
  const FRICTION = 420;
  const ROLL_FRICTION = 90;
  const TOP_SPEED = 460;
  const GRAVITY = 1700;
  const JUMP = 560;
  const SLOPE_RUN = 320; // тяга склона; должна быть заметно меньше ACCEL,
  // иначе крутую горку невозможно взять ни бегом, ни с разгона
  const SLOPE_ROLL = 640; // в клубке — вдвое сильнее: в этом весь смысл клубка

  const BODY = 26;

  class Sonic {
    constructor(g) {
      this.g = g;
      this.buildLevel();
      this.x = 120;
      this.y = this.heightAt(120) - BODY;
      this.vx = 0;
      this.vy = 0;
      this.onGround = true;
      this.rolling = false;
      this.facing = 1;
      this.rings = 0;
      this.lives = 3;
      this.invuln = 0;
      this.camX = 0;
      this.time = 0;
      this.finished = false;
      this.spin = 0;
      this.syncInfo();
    }

    /* ---------------- рельеф ---------------- */

    buildLevel() {
      const h = [];
      const base = 300;
      let y = base;

      const flat = (len) => {
        for (let i = 0; i < len; i++) h.push(y);
      };
      const hill = (len, amp) => {
        for (let i = 0; i < len; i++) h.push(y - Math.sin((i / len) * Math.PI) * amp);
      };
      const dip = (len, amp) => {
        for (let i = 0; i < len; i++) h.push(y + Math.sin((i / len) * Math.PI) * amp);
      };
      const ramp = (len, dy) => {
        const from = y;
        for (let i = 0; i < len; i++) {
          h.push(from + (dy * (1 - Math.cos((i / len) * Math.PI))) / 2);
        }
        y = from + dy;
      };
      const gap = (len) => {
        for (let i = 0; i < len; i++) h.push(PIT);
      };

      flat(60);
      hill(70, 90);
      flat(20);
      dip(60, 70);
      flat(15);
      hill(90, 150); // разгонная горка
      flat(20);
      gap(14);
      flat(30);
      ramp(50, -110); // подъём на верхний ярус
      flat(30);
      hill(60, 70);
      dip(70, 90);
      flat(20);
      gap(16);
      flat(25);
      hill(110, 190); // главный трамплин
      flat(20);
      ramp(60, 120); // спуск обратно
      dip(80, 110);
      flat(25);
      gap(18);
      flat(30);
      hill(80, 120);
      flat(30);
      dip(60, 60);
      hill(70, 100);
      flat(80);

      this.h = h;
      this.levelW = h.length * STEP;

      // кольца, пружины, шипы и враги расставляются по готовому рельефу
      this.rings = 0;
      this.ringList = [];
      this.springs = [];
      this.spikes = [];
      this.badniks = [];
      this.goalX = this.levelW - 140;

      for (let i = 40; i < h.length - 40; i += 6) {
        const x = i * STEP;
        const gy = this.heightAt(x);
        if (gy >= PIT) continue;
        // дуга колец над каждой горкой и цепочка на прямых
        const above = this.heightAt(x - 40) - gy;
        if (above > 12 || i % 24 === 0) {
          this.ringList.push({ x: x, y: gy - 46, taken: false });
        }
      }

      const place = (frac, arr, extra) => {
        const x = Math.round(this.levelW * frac);
        const gy = this.heightAt(x);
        if (gy >= PIT) return;
        arr.push(Object.assign({ x: x, y: gy }, extra || {}));
      };
      [0.16, 0.42, 0.68].forEach((f) => place(f, this.springs, { phase: 0 }));
      [0.24, 0.35, 0.55, 0.74, 0.86].forEach((f) => place(f, this.spikes));
      [0.2, 0.3, 0.46, 0.6, 0.72, 0.82, 0.9].forEach((f) =>
        place(f, this.badniks, { dir: -1, phase: Math.random() * 6, alive: true })
      );
    }

    heightAt(x) {
      const i = x / STEP;
      const a = Math.floor(i);
      if (a < 0) return this.h[0];
      if (a >= this.h.length - 1) return this.h[this.h.length - 1];
      const t = i - a;
      const h0 = this.h[a];
      const h1 = this.h[a + 1];
      // на краю пропасти не интерполируем, иначе появляется невидимый скат
      if (h0 >= PIT || h1 >= PIT) return Math.max(h0, h1);
      return h0 + (h1 - h0) * t;
    }

    slopeAt(x) {
      const d = 12;
      const a = this.heightAt(x - d);
      const b = this.heightAt(x + d);
      if (a >= PIT || b >= PIT) return 0;
      return (b - a) / (2 * d);
    }

    syncInfo() {
      this.g.setInfo({
        rings: this.rings,
        lives: '❤'.repeat(Math.max(0, this.lives)) || '—',
        time: this.time.toFixed(1),
      });
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      if (this.finished) return;
      this.time += dt;
      this.invuln = Math.max(0, this.invuln - dt);

      const g = this.g;
      let dir = 0;
      if (g.held('left')) dir -= 1;
      if (g.held('right')) dir += 1;
      if (g.pointer.active && g.pointer.down) {
        dir = g.pointer.x > W * 0.5 ? 1 : -1;
      }
      const crouch = g.held('down');

      if (this.onGround) {
        const slope = this.slopeAt(this.x);
        // уклон тянет всегда: вниз разгоняет, вверх тормозит
        this.vx += slope * (this.rolling ? SLOPE_ROLL : SLOPE_RUN) * dt;

        if (this.rolling) {
          // в клубке рулить нельзя, только терять скорость на трении
          const f = ROLL_FRICTION * dt;
          this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), f);
          if (Math.abs(this.vx) < 40) this.rolling = false;
        } else if (dir) {
          this.facing = dir;
          // разворот на скорости тормозит сильнее, чем разгон
          const k = Math.sign(this.vx) && Math.sign(this.vx) !== dir ? 2.4 : 1;
          this.vx += dir * ACCEL * k * dt;
        } else {
          const f = FRICTION * dt;
          this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), f);
        }

        if (crouch && Math.abs(this.vx) > 90) this.rolling = true;

        if (g.pressed('action') || (g.held('up') && !this.jumpHeld)) {
          this.vy = -JUMP;
          this.onGround = false;
          this.rolling = false;
          this.g.sfx('bounce');
        }
      } else {
        this.vy += GRAVITY * dt;
        if (dir && !this.rolling) {
          this.facing = dir;
          this.vx += dir * ACCEL * 0.55 * dt;
        }
      }
      this.jumpHeld = g.held('up');

      const cap = this.rolling ? TOP_SPEED * 1.5 : TOP_SPEED;
      this.vx = Arcade.clamp(this.vx, -cap, cap);

      this.x += this.vx * dt;
      this.x = Arcade.clamp(this.x, 20, this.levelW - 20);
      this.y += this.vy * dt;

      const ground = this.heightAt(this.x) - BODY;
      if (this.y >= ground && this.vy >= 0) {
        if (ground > H + 400) {
          // провалились в пропасть
          this.hurt(true);
          return;
        }
        this.y = ground;
        this.vy = 0;
        this.onGround = true;
      } else if (this.y < ground) {
        this.onGround = false;
      }

      if (this.rolling || !this.onGround) this.spin += Math.abs(this.vx) * dt * 0.02;

      this.collect();
      this.updateBadniks(dt);
      this.checkHazards();

      const target = this.x - W * 0.35 + Math.sign(this.vx) * 40;
      this.camX += (target - this.camX) * Math.min(1, dt * 4);
      this.camX = Arcade.clamp(this.camX, 0, this.levelW - W);

      if (this.x >= this.goalX) this.finish();
      this.syncInfo();
    }

    collect() {
      for (const r of this.ringList) {
        if (r.taken) continue;
        if (Math.abs(r.x - this.x) > 24 || Math.abs(r.y - (this.y + BODY / 2)) > 34) continue;
        r.taken = true;
        this.rings += 1;
        this.g.addScore(10);
        this.g.sfx('eat');
        this.g.fx.burst(r.x, r.y, { count: 5, color: '#fbbf24', speed: 120, life: 0.3, size: 3 });
      }
      for (const s of this.springs) {
        if (Math.abs(s.x - this.x) > 26) continue;
        if (this.y + BODY < s.y - 22 || this.y + BODY > s.y + 8) continue;
        this.vy = -JUMP * 1.65;
        this.onGround = false;
        this.rolling = false;
        s.phase = 0.35;
        this.g.sfx('power');
        this.g.shake(5);
      }
    }

    updateBadniks(dt) {
      for (const b of this.badniks) {
        if (!b.alive) continue;
        b.phase += dt;
        b.x += Math.cos(b.phase * 0.8) * 40 * dt;
        b.y = this.heightAt(b.x);
        if (Math.abs(b.x - this.x) > 26 || Math.abs(b.y - 18 - (this.y + BODY / 2)) > 30) continue;

        // сверху или в клубке — убиваем, иначе получаем урон
        if (this.vy > 60 || this.rolling) {
          b.alive = false;
          this.g.addScore(200);
          this.g.sfx('bounce');
          this.vy = -JUMP * 0.6;
          this.onGround = false;
          this.g.fx.burst(b.x, b.y - 18, {
            count: 16,
            color: ['#f472b6', '#ffffff'],
            speed: 200,
            life: 0.5,
            size: 4,
          });
        } else {
          this.hurt(false);
        }
      }
    }

    checkHazards() {
      for (const s of this.spikes) {
        if (Math.abs(s.x - this.x) > 22) continue;
        if (Math.abs(s.y - 14 - (this.y + BODY)) > 20) continue;
        this.hurt(false);
      }
    }

    hurt(fatal) {
      if (this.invuln > 0 && !fatal) return;

      if (!fatal && this.rings > 0) {
        // кольца рассыпаются — классическая «броня» жанра
        this.g.fx.burst(this.x, this.y + BODY / 2, {
          count: Math.min(20, this.rings * 2),
          color: ['#fbbf24', '#fde68a'],
          speed: 240,
          life: 0.8,
          size: 4,
          gravity: 500,
        });
        this.rings = 0;
        this.invuln = 1.8;
        this.vx = -this.facing * 180;
        this.vy = -260;
        this.onGround = false;
        this.rolling = false;
        this.g.sfx('bad');
        this.g.shake(10);
        this.syncInfo();
        return;
      }

      this.lives -= 1;
      this.rings = 0;
      this.invuln = 2;
      this.g.shake(20);
      this.g.sfx('die');
      this.syncInfo();
      if (this.lives <= 0) {
        const pct = Math.round((this.x / this.goalX) * 100);
        this.g.gameOver({ message: Arcade.t('levelProgress', { n: Math.min(100, pct) }) });
        return;
      }
      // отступаем к последнему безопасному месту
      let bx = this.x;
      while (bx > 60 && this.heightAt(bx) >= PIT) bx -= STEP;
      this.x = Math.max(60, bx - 60);
      this.y = this.heightAt(this.x) - BODY;
      this.vx = 0;
      this.vy = 0;
      this.onGround = true;
    }

    finish() {
      this.finished = true;
      const timeBonus = Math.max(0, Math.round((120 - this.time) * 50));
      this.g.addScore(1000 + this.rings * 100 + timeBonus);
      this.g.sfx('fanfare');
      this.g.gameOver({
        won: true,
        message: Arcade.t('finishedIn', { n: this.time.toFixed(1) }),
      });
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0ea5e9');
      sky.addColorStop(1, '#a5f3fc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // облака и дальние холмы
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 10; i++) {
        const x = ((i * 210 - this.camX * 0.15) % (W + 420)) - 210;
        const y = 40 + (i % 3) * 34;
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, 7);
        ctx.arc(x + 24, y + 5, 18, 0, 7);
        ctx.arc(x - 22, y + 6, 16, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = '#166534';
      for (let i = 0; i < 12; i++) {
        const x = ((i * 190 - this.camX * 0.35) % (W + 380)) - 190;
        ctx.beginPath();
        ctx.moveTo(x - 110, H);
        ctx.quadraticCurveTo(x, H - 150 - (i % 3) * 40, x + 110, H);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(-Math.round(this.camX), 0);
      this.drawTerrain(ctx);
      for (const r of this.ringList) if (!r.taken) this.drawRing(ctx, r);
      for (const s of this.springs) this.drawSpring(ctx, s);
      for (const s of this.spikes) this.drawSpikes(ctx, s);
      for (const b of this.badniks) if (b.alive) this.drawBadnik(ctx, b);
      this.drawGoal(ctx);
      this.drawHero(ctx);
      ctx.restore();

      this.drawHud(ctx);
    }

    drawTerrain(ctx) {
      const c0 = Math.max(0, Math.floor(this.camX / STEP) - 2);
      const c1 = Math.min(this.h.length - 1, Math.ceil((this.camX + W) / STEP) + 2);

      // земля рисуется кусками между пропастями
      let run = [];
      const flush = () => {
        if (run.length < 2) {
          run = [];
          return;
        }
        ctx.beginPath();
        ctx.moveTo(run[0][0], H + 10);
        for (const [x, y] of run) ctx.lineTo(x, y);
        ctx.lineTo(run[run.length - 1][0], H + 10);
        ctx.closePath();
        ctx.fillStyle = '#3f6212';
        ctx.fill();
        // травяная кромка
        ctx.beginPath();
        ctx.moveTo(run[0][0], run[0][1]);
        for (const [x, y] of run) ctx.lineTo(x, y);
        ctx.strokeStyle = '#65a30d';
        ctx.lineWidth = 9;
        ctx.stroke();
        run = [];
      };

      for (let i = c0; i <= c1; i++) {
        const gy = this.h[i];
        if (gy >= PIT) {
          flush();
          continue;
        }
        run.push([i * STEP, gy]);
      }
      flush();
    }

    drawRing(ctx, r) {
      const t = Date.now() / 200 + r.x * 0.02;
      const sx = Math.max(0.25, Math.abs(Math.cos(t)));
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(sx, 1);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, 7);
      ctx.stroke();
      ctx.restore();
    }

    drawSpring(ctx, s) {
      const squash = s.phase > 0 ? 0.55 : 1;
      if (s.phase > 0) s.phase -= 0.02;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(s.x - 16, s.y - 12 * squash, 32, 12 * squash);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(s.x - 16, s.y - 12 * squash, 32, 4);
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(s.x - 12, s.y - 3, 24, 4);
    }

    drawSpikes(ctx, s) {
      ctx.fillStyle = '#94a3b8';
      for (let i = 0; i < 3; i++) {
        const x = s.x - 18 + i * 14;
        ctx.beginPath();
        ctx.moveTo(x, s.y);
        ctx.lineTo(x + 7, s.y - 16);
        ctx.lineTo(x + 14, s.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    drawBadnik(ctx, b) {
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 16, 14, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(b.x + 5, b.y - 19, 4, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#be185d';
      ctx.fillRect(b.x - 14, b.y - 6, 28, 6);
    }

    drawGoal(ctx) {
      const gy = this.heightAt(this.goalX);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(this.goalX - 3, gy - 90, 6, 90);
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(this.goalX + 3, gy - 88);
      ctx.lineTo(this.goalX + 52, gy - 74);
      ctx.lineTo(this.goalX + 3, gy - 60);
      ctx.closePath();
      ctx.fill();
    }

    drawHero(ctx) {
      if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) return;
      const cx = this.x;
      const cy = this.y + BODY / 2;

      if (this.rolling || !this.onGround) {
        // клубок: вращающийся шар с «шипами» иголок
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.spin * this.facing);
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(0, 0, BODY / 2 + 2, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#1d4ed8';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.lineTo(Math.cos(a + 0.5) * 17, Math.sin(a + 0.5) * 17);
          ctx.lineTo(Math.cos(a - 0.5) * 17, Math.sin(a - 0.5) * 17);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(this.facing, 1);
      // иголки за спиной
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(-20, 2);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(0, -2, 12, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#f5d0a9';
      ctx.beginPath();
      ctx.arc(5, 0, 7, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(7, -3, 2, 0, 7);
      ctx.fill();
      // ноги: мельтешат тем быстрее, чем выше скорость
      const t = Math.sin(Date.now() / 40) * Math.min(1, Math.abs(this.vx) / 200);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-6, 8, 6, 5 + t * 3);
      ctx.fillRect(2, 8, 6, 5 - t * 3);
      ctx.restore();
    }

    drawHud(ctx) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(5,6,13,0.65)';
      Arcade.roundRect(ctx, 12, 12, 150, 26, 8);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(28, 25, 7, 0, 7);
      ctx.stroke();
      ctx.font = 'bold 15px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('× ' + this.rings, 42, 30);

      // полоса пройденного пути
      const pct = Arcade.clamp(this.x / this.goalX, 0, 1);
      ctx.fillStyle = 'rgba(5,6,13,0.6)';
      Arcade.roundRect(ctx, 12, H - 24, 200, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      Arcade.roundRect(ctx, 15, H - 21, 194 * pct, 4, 2);
      ctx.fill();

      if (this.rolling) {
        ctx.font = '11px ui-monospace, Menlo, monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(Arcade.t('rolling'), 220, H - 15);
      }
    }
  }

  Arcade.register({
    id: 'sonic',
    width: W,
    height: H,
    create: (g) => new Sonic(g),
    // Витрина: бежит вправо через клавиши хоста — так же, как живой игрок.
    // Задавать скорость напрямую нельзя: update пересчитывает её из ввода.
    autopilot(s, host) {
      host.keys.add('right');

      if (s.onGround && s.jumpCooldown === undefined) s.jumpCooldown = 0;
      s.jumpCooldown = Math.max(0, (s.jumpCooldown || 0) - 1 / 60);

      const gapAhead = s.heightAt(s.x + 110) >= 3000;
      const enemyAhead = s.badniks.some((b) => b.alive && b.x - s.x > 10 && b.x - s.x < 90);
      const spikeAhead = s.spikes.some((k) => k.x - s.x > 10 && k.x - s.x < 80);
      if (s.onGround && s.jumpCooldown <= 0 && (gapAhead || enemyAhead || spikeAhead)) {
        s.vy = -560;
        s.onGround = false;
        s.jumpCooldown = 0.5;
      }

      // кольца работают как броня — держим запас вместо мигающей неуязвимости
      s.rings = Math.max(s.rings, 5);
      s.lives = Math.max(s.lives, 2);

      // добежав до финиша, начинаем круг заново, чтобы демо не замирало
      if (s.x >= s.goalX - 20) {
        s.x = 120;
        s.y = s.heightAt(120) - 26;
        s.vx = 0;
        s.vy = 0;
        s.time = 0;
        s.finished = false;
        s.ringList.forEach((r) => (r.taken = false));
        s.badniks.forEach((b) => (b.alive = true));
      }
    },
  });
})();
