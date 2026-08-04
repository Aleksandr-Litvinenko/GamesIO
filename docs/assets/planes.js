/* Самолётики — вертикальный скролл-шутер в духе 1942.
   Волны противников, три типа поведения, босс каждую пятую волну, бонусы.
   Поле вытянуто по вертикали: так удобнее играть с телефона одним пальцем. */
(function () {
  'use strict';

  const W = 480;
  const H = 640;

  const PLAYER_SPEED = 330;
  const PLAYER_R = 13;
  const FIRE_RATE = 0.14;
  const BULLET_SPEED = -620;
  const ENEMY_BULLET_SPEED = 230;

  const WAVE_BREAK = 1.6; // пауза между волнами
  const BOSS_EVERY = 5;

  /* Типы противников. hp/score/скорость растут с номером волны. */
  const KINDS = {
    straight: { hp: 1, r: 14, score: 10, color: '#f472b6', fire: 0 },
    zigzag: { hp: 2, r: 15, score: 25, color: '#fbbf24', fire: 2.4 },
    diver: { hp: 1, r: 13, score: 35, color: '#4ade80', fire: 0 },
    boss: { hp: 40, r: 46, score: 500, color: '#a78bfa', fire: 0.9 },
  };

  const POWERS = ['spread', 'shield', 'life'];

  class Planes {
    constructor(g) {
      this.g = g;
      this.player = { x: W / 2, y: H - 80, vx: 0, invuln: 1.2, shield: 0 };
      this.lives = 3;
      this.wave = 0;
      this.spread = 0;
      this.bullets = [];
      this.enemyBullets = [];
      this.enemies = [];
      this.powerups = [];
      this.clouds = [];
      this.fireCooldown = 0;
      this.waveTimer = 0.8;
      this.betweenWaves = true;
      this.bossAlive = false;
      this.scroll = 0;
      for (let i = 0; i < 14; i++) {
        this.clouds.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 14 + Math.random() * 30,
          a: 0.03 + Math.random() * 0.045,
          s: 22 + Math.random() * 40,
        });
      }
      this.syncInfo();
    }

    syncInfo() {
      this.g.setInfo({
        lives: '❤'.repeat(Math.max(0, this.lives)) || '—',
        wave: this.wave,
      });
    }

    /* ---------------- волны ---------------- */

    startWave() {
      this.wave += 1;
      this.betweenWaves = false;
      this.syncInfo();

      if (this.wave % BOSS_EVERY === 0) {
        this.spawnBoss();
        return;
      }

      const count = Math.min(14, 4 + Math.floor(this.wave * 1.3));
      const kinds = this.wave < 3 ? ['straight'] : this.wave < 6 ? ['straight', 'zigzag'] : ['straight', 'zigzag', 'diver'];
      for (let i = 0; i < count; i++) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        this.spawnEnemy(kind, i, count);
      }
      this.g.sfx('blip');
    }

    spawnEnemy(kind, i, count) {
      const base = KINDS[kind];
      const lane = (i % 7) + 1;
      const e = {
        kind: kind,
        x: (W / 8) * lane,
        y: -40 - Math.floor(i / 7) * 60 - Math.random() * 40,
        hp: base.hp + Math.floor(this.wave / 4),
        r: base.r,
        color: base.color,
        vy: 70 + this.wave * 5 + Math.random() * 20,
        vx: 0,
        phase: Math.random() * 6.28,
        fireTimer: base.fire ? base.fire * (0.5 + Math.random()) : 0,
        fireEvery: base.fire,
        score: base.score,
        hitFlash: 0,
      };
      if (kind === 'diver') e.vy *= 1.8;
      this.enemies.push(e);
    }

    spawnBoss() {
      const base = KINDS.boss;
      this.enemies.push({
        kind: 'boss',
        x: W / 2,
        y: -70,
        hp: base.hp + this.wave * 8,
        maxHp: base.hp + this.wave * 8,
        r: base.r,
        color: base.color,
        vy: 40,
        vx: 90,
        phase: 0,
        fireTimer: 1.2,
        fireEvery: Math.max(0.35, base.fire - this.wave * 0.03),
        score: base.score * (1 + Math.floor(this.wave / BOSS_EVERY)),
        hitFlash: 0,
      });
      this.bossAlive = true;
      this.g.sfx('bad');
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      const g = this.g;
      this.scroll += dt * 60;

      for (const c of this.clouds) {
        c.y += c.s * dt;
        if (c.y - c.r > H) {
          c.y = -c.r;
          c.x = Math.random() * W;
        }
      }

      this.updatePlayer(dt);
      this.updateBullets(dt);
      this.updateEnemies(dt);
      this.updatePowerups(dt);

      if (!this.betweenWaves && this.enemies.length === 0) {
        this.betweenWaves = true;
        this.waveTimer = WAVE_BREAK;
        this.g.addScore(100 * this.wave);
        this.g.sfx('fanfare');
      }
      if (this.betweenWaves) {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) this.startWave();
      }
    }

    updatePlayer(dt) {
      const g = this.g;
      const p = this.player;
      p.invuln = Math.max(0, p.invuln - dt);
      p.shield = Math.max(0, p.shield - dt);

      let dir = 0;
      if (g.held('left')) dir -= 1;
      if (g.held('right')) dir += 1;
      p.x += dir * PLAYER_SPEED * dt;

      // палец или мышь ведут самолёт напрямую — так играть куда приятнее
      if (g.pointer.active && g.pointer.down) {
        p.x += (g.pointer.x - p.x) * Math.min(1, dt * 14);
        p.y += (g.pointer.y - 40 - p.y) * Math.min(1, dt * 10);
      } else {
        let dy = 0;
        if (g.held('up')) dy -= 1;
        if (g.held('down')) dy += 1;
        p.y += dy * PLAYER_SPEED * dt;
      }

      p.x = Arcade.clamp(p.x, PLAYER_R, W - PLAYER_R);
      p.y = Arcade.clamp(p.y, H * 0.35, H - PLAYER_R - 6);

      // огонь идёт сам: держать ещё и кнопку стрельбы на телефоне невозможно
      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0) {
        this.fire();
        this.fireCooldown = FIRE_RATE;
      }
      this.spread = Math.max(0, this.spread - dt);
    }

    fire() {
      const p = this.player;
      const add = (vx, vy, x) => this.bullets.push({ x: x, y: p.y - 16, vx: vx, vy: vy });
      add(0, BULLET_SPEED, p.x);
      if (this.spread > 0) {
        add(-150, BULLET_SPEED * 0.94, p.x - 6);
        add(150, BULLET_SPEED * 0.94, p.x + 6);
      }
      this.g.sfx('blip');
    }

    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -20 || b.x < -20 || b.x > W + 20) {
          this.bullets.splice(i, 1);
          continue;
        }
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Math.hypot(b.x - e.x, b.y - e.y) > e.r) continue;
          this.bullets.splice(i, 1);
          this.damage(e, j);
          break;
        }
      }

      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > H + 20 || b.x < -20 || b.x > W + 20) {
          this.enemyBullets.splice(i, 1);
          continue;
        }
        const p = this.player;
        if (Math.hypot(b.x - p.x, b.y - p.y) < PLAYER_R + 4) {
          this.enemyBullets.splice(i, 1);
          this.hitPlayer();
        }
      }
    }

    damage(e, index) {
      e.hp -= 1;
      e.hitFlash = 0.12;
      this.g.sfx('brick');
      this.g.fx.burst(e.x, e.y, { count: 4, color: e.color, speed: 110, life: 0.25, size: 2.5 });
      if (e.hp > 0) return;

      this.enemies.splice(index, 1);
      this.g.addScore(e.score);
      this.g.shake(e.kind === 'boss' ? 18 : 3);
      this.g.sfx(e.kind === 'boss' ? 'fanfare' : 'bounce');
      this.g.fx.burst(e.x, e.y, {
        count: e.kind === 'boss' ? 40 : 14,
        color: [e.color, '#ffffff', '#fbbf24'],
        speed: e.kind === 'boss' ? 300 : 180,
        life: 0.6,
        size: 4,
      });
      if (e.kind === 'boss') this.bossAlive = false;
      if (Math.random() < (e.kind === 'boss' ? 1 : 0.12)) this.dropPower(e.x, e.y);
    }

    dropPower(x, y) {
      this.powerups.push({
        x: x,
        y: y,
        kind: POWERS[Math.floor(Math.random() * POWERS.length)],
        spin: 0,
      });
    }

    updateEnemies(dt) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        e.phase += dt * 3;

        if (e.kind === 'zigzag') e.x += Math.sin(e.phase) * 90 * dt;
        else if (e.kind === 'diver' && e.y > H * 0.25) {
          const dx = this.player.x - e.x;
          e.x += Arcade.clamp(dx, -120, 120) * dt;
        } else if (e.kind === 'boss') {
          e.x += e.vx * dt;
          if (e.x < e.r || e.x > W - e.r) e.vx *= -1;
          if (e.y < 110) e.y += e.vy * dt;
          else e.y += Math.sin(e.phase * 0.4) * 12 * dt;
        }
        if (e.kind !== 'boss') e.y += e.vy * dt;

        if (e.fireEvery) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0 && e.y > 0) {
            e.fireTimer = e.fireEvery;
            this.enemyFire(e);
          }
        }

        if (e.y - e.r > H + 40) {
          this.enemies.splice(i, 1);
          continue;
        }

        const p = this.player;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + PLAYER_R - 4) {
          if (e.kind !== 'boss') this.damage(e, i);
          this.hitPlayer();
        }
      }
    }

    enemyFire(e) {
      const p = this.player;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const shots = e.kind === 'boss' ? 3 : 1;
      for (let i = 0; i < shots; i++) {
        const spread = (i - (shots - 1) / 2) * 0.28;
        this.enemyBullets.push({
          x: e.x,
          y: e.y + e.r * 0.6,
          vx: Math.cos(a + spread) * ENEMY_BULLET_SPEED,
          vy: Math.sin(a + spread) * ENEMY_BULLET_SPEED,
        });
      }
      this.g.sfx('bad');
    }

    updatePowerups(dt) {
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pw = this.powerups[i];
        pw.y += 110 * dt;
        pw.spin += dt * 4;
        if (pw.y > H + 20) {
          this.powerups.splice(i, 1);
          continue;
        }
        if (Math.hypot(pw.x - this.player.x, pw.y - this.player.y) < PLAYER_R + 14) {
          this.applyPower(pw.kind);
          this.powerups.splice(i, 1);
        }
      }
    }

    applyPower(kind) {
      if (kind === 'spread') this.spread = 12;
      else if (kind === 'shield') this.player.shield = 8;
      else if (kind === 'life') this.lives += 1;
      this.g.addScore(50);
      this.g.sfx('power');
      this.syncInfo();
    }

    hitPlayer() {
      const p = this.player;
      if (p.invuln > 0) return;
      if (p.shield > 0) {
        p.shield = 0;
        p.invuln = 1;
        this.g.sfx('bad');
        this.g.shake(8);
        return;
      }
      this.lives -= 1;
      p.invuln = 1.8;
      this.spread = 0;
      this.syncInfo();
      this.g.shake(18);
      this.g.sfx('die');
      this.g.fx.burst(p.x, p.y, {
        count: 26,
        color: ['#22d3ee', '#ffffff', '#f87171'],
        speed: 240,
        life: 0.7,
        size: 4,
      });
      if (this.lives <= 0) {
        this.g.gameOver({ message: Arcade.t('wavesCleared', { n: Math.max(0, this.wave - 1) }) });
      }
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0b1a3a');
      sky.addColorStop(1, '#071021');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      for (const c of this.clouds) {
        ctx.fillStyle = `rgba(226,232,240,${c.a})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, 7);
        ctx.fill();
      }

      for (const pw of this.powerups) this.drawPower(ctx, pw);
      for (const e of this.enemies) this.drawEnemy(ctx, e);

      ctx.fillStyle = '#fde68a';
      for (const b of this.bullets) ctx.fillRect(b.x - 2, b.y - 9, 4, 12);
      ctx.fillStyle = '#fca5a5';
      for (const b of this.enemyBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 7);
        ctx.fill();
      }

      this.drawPlayer(ctx);
      this.drawHud(ctx);
    }

    drawPlane(ctx, x, y, r, color, flip, accent) {
      const d = flip ? -1 : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.beginPath(); // крылья
      ctx.moveTo(-r, 2 * d);
      ctx.lineTo(0, -r * 0.35 * d);
      ctx.lineTo(r, 2 * d);
      ctx.lineTo(0, r * 0.3 * d);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent; // фюзеляж
      ctx.beginPath();
      ctx.moveTo(0, -r * d);
      ctx.lineTo(r * 0.28, r * 0.55 * d);
      ctx.lineTo(-r * 0.28, r * 0.55 * d);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(15,23,42,0.65)'; // кабина
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.18 * d, r * 0.16, r * 0.26, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }

    drawEnemy(ctx, e) {
      if (e.kind === 'boss') {
        this.drawPlane(ctx, e.x, e.y, e.r, e.hitFlash > 0 ? '#ffffff' : e.color, true, '#6d28d9');
        // полоса здоровья босса
        const w = 200;
        ctx.fillStyle = 'rgba(5,6,13,0.75)';
        Arcade.roundRect(ctx, W / 2 - w / 2 - 3, 14, w + 6, 12, 6);
        ctx.fill();
        ctx.fillStyle = '#a78bfa';
        Arcade.roundRect(ctx, W / 2 - w / 2, 17, w * (e.hp / e.maxHp), 6, 3);
        ctx.fill();
        return;
      }
      this.drawPlane(
        ctx,
        e.x,
        e.y,
        e.r,
        e.hitFlash > 0 ? '#ffffff' : e.color,
        true,
        e.hitFlash > 0 ? '#ffffff' : '#0f172a'
      );
    }

    drawPlayer(ctx) {
      const p = this.player;
      if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
      if (p.shield > 0) {
        ctx.strokeStyle = `rgba(34,211,238,${0.4 + Math.sin(p.shield * 8) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_R + 9, 0, 7);
        ctx.stroke();
      }
      // выхлоп
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y + 12);
      ctx.lineTo(p.x, p.y + 20 + Math.random() * 8);
      ctx.lineTo(p.x + 4, p.y + 12);
      ctx.closePath();
      ctx.fill();
      this.drawPlane(ctx, p.x, p.y, PLAYER_R + 8, '#22d3ee', false, '#e2e8f0');
    }

    drawPower(ctx, pw) {
      const meta = {
        spread: { c: '#fbbf24', t: 'W' },
        shield: { c: '#22d3ee', t: 'S' },
        life: { c: '#f472b6', t: '♥' },
      }[pw.kind];
      ctx.save();
      ctx.translate(pw.x, pw.y);
      ctx.scale(Math.max(0.3, Math.abs(Math.cos(pw.spin))), 1);
      ctx.fillStyle = meta.c;
      Arcade.roundRect(ctx, -12, -10, 24, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#0b1120';
      ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.t, 0, 1);
      ctx.restore();
    }

    drawHud(ctx) {
      if (this.betweenWaves && this.waveTimer > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(Arcade.t('waveN', { n: this.wave + 1 }), W / 2, H / 2 - 20);
        if ((this.wave + 1) % BOSS_EVERY === 0) {
          ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
          ctx.fillStyle = '#a78bfa';
          ctx.fillText(Arcade.t('bossIncoming'), W / 2, H / 2 + 12);
        }
      }
      if (this.spread > 0) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '11px ui-monospace, Menlo, monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('W ' + this.spread.toFixed(1), 12, H - 14);
      }
    }
  }

  Arcade.register({
    id: 'planes',
    width: W,
    height: H,
    create: (g) => new Planes(g),
    // Автопилот для витрины: уклоняется от пуль и подбирает бонусы
    autopilot(p) {
      const me = p.player;
      let target = me.x;
      let danger = null;
      let best = 1e9;
      for (const b of p.enemyBullets) {
        if (b.y > me.y || b.y < me.y - 220) continue;
        const d = Math.abs(b.x - me.x);
        if (d < 60 && d < best) {
          best = d;
          danger = b;
        }
      }
      if (danger) target = danger.x > me.x ? me.x - 80 : me.x + 80;
      else if (p.powerups.length) target = p.powerups[0].x;
      else if (p.enemies.length) {
        const e = p.enemies.reduce((a, b) => (a.y > b.y ? a : b));
        target = e.x;
      }
      me.x += Arcade.clamp(target - me.x, -6, 6);
      me.x = Arcade.clamp(me.x, 20, W - 20);
    },
  });
})();
