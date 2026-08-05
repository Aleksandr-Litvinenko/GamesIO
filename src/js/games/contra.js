/* Десант — беги-и-стреляй в духе Contra на Денди.

   Три вещи делают жанр собой: стрельба в восьми направлениях, смерть от
   одного попадания и уровень, который тянется вправо и заканчивается боссом.
   Всё три здесь есть. Прыжок на сквозной платформе с зажатым «вниз»
   проваливает вниз — без этого на многоярусной карте не развернуться. */
(function () {
  'use strict';

  const W = 640;
  const H = 400;
  const TILE = 32;

  const GRAVITY = 1500;
  const RUN = 190;
  const JUMP = 470;
  const BULLET_SPEED = 520;
  const FIRE_RATE = 0.16;
  const SPREAD_TIME = 14;

  /* Карта строится кодом, а не литералом: считать колонки в строке из
     девяноста символов — верный способ поставить пропасть не туда.

     Пропасти сквозные до самого низа: упасть в них — значит потерять жизнь,
     как и положено жанру. Ширина в три тайла подобрана под дальность прыжка
     (около 120 px), чтобы перелетать можно было без разбега. */
  const COLS = 96;
  const GROUND_ROW = 7;
  const GAPS = [[10, 3], [26, 3], [44, 3], [62, 3], [78, 3]];
  const LEDGES = [[16, 2], [34, 3], [52, 2], [68, 4]]; // возвышения на земле
  const PLATFORMS = [
    [8, 4, 4], [20, 2, 3], [30, 4, 5], [42, 2, 3], [50, 4, 4], [60, 2, 3], [72, 4, 5], [84, 2, 3],
  ]; // [колонка, ряд, длина]

  const START_COL = 3;
  const BOSS_COL = COLS - 8;

  function buildLevel() {
    const rows = [];
    for (let r = 0; r < 10; r++) rows.push(new Array(COLS).fill(' '));

    const inGap = (c) => GAPS.some(([g, len]) => c >= g && c < g + len);

    // земля: три ряда камня, разорванные пропастями
    for (let c = 0; c < COLS; c++) {
      if (inGap(c)) continue;
      for (let r = GROUND_ROW; r < 10; r++) rows[r][c] = '#';
    }
    // возвышения, через которые надо перепрыгивать
    for (const [c0, len] of LEDGES) {
      for (let c = c0; c < c0 + len && c < COLS; c++) {
        if (!inGap(c)) rows[GROUND_ROW - 1][c] = '#';
      }
    }
    // сквозные платформы верхнего яруса
    for (const [c0, r, len] of PLATFORMS) {
      for (let c = c0; c < c0 + len && c < COLS; c++) rows[r][c] = '=';
    }
    return rows.map((r) => r.join(''));
  }

  const LEVEL = buildLevel();

  const ENEMY_KINDS = {
    runner: { w: 22, h: 30, hp: 1, score: 100, color: '#f472b6' },
    turret: { w: 26, h: 26, hp: 3, score: 200, color: '#fbbf24' },
    boss: { w: 74, h: 96, hp: 30, score: 2000, color: '#a78bfa' },
  };

  class Contra {
    constructor(g) {
      this.g = g;
      this.map = new Arcade.TileMap(LEVEL.slice(), TILE);
      this.cam = new Arcade.Camera(W, H);
      this.lives = 3;
      this.spread = 0;
      this.bullets = [];
      this.enemyBullets = [];
      this.enemies = [];
      this.pickups = [];
      this.bossSpawned = false;
      this.aim = { x: 1, y: 0 };
      this.facing = 1;
      this.fireCooldown = 0;
      this.invuln = 1.5;

      this.spawnFromLevel();
      this.player = new Arcade.Body(this.startX, this.startY, 20, 30);
      this.cam.snap(this.player, this.map, 80);
      this.syncInfo();
    }

    spawnFromLevel() {
      this.startX = START_COL * TILE;
      this.startY = (GROUND_ROW - 2) * TILE;
      this.bossX = BOSS_COL * TILE;
      this.bossY = (GROUND_ROW - 1) * TILE;

      // пехота и турели — только на твёрдой земле, подальше от пропастей
      for (let c = 8; c < COLS - 10; c += 6) {
        if (this.map.at(c, GROUND_ROW) !== '#') continue;
        const top = this.map.at(c, GROUND_ROW - 1) === '#' ? GROUND_ROW - 1 : GROUND_ROW;
        this.addEnemy(c % 12 === 0 ? 'turret' : 'runner', c * TILE, top * TILE);
      }
    }

    addEnemy(kind, x, y) {
      const base = ENEMY_KINDS[kind];
      const e = new Arcade.Body(x, y - (base.h - TILE), base.w, base.h);
      e.kind = kind;
      e.hp = base.hp;
      e.score = base.score;
      e.color = base.color;
      e.dir = -1;
      e.fireTimer = 0.8 + Math.random() * 1.6;
      e.hitFlash = 0;
      e.phase = Math.random() * 6.28;
      if (kind === 'boss') {
        e.maxHp = base.hp;
        e.y = y - base.h + TILE;
      }
      this.enemies.push(e);
      return e;
    }

    syncInfo() {
      this.g.setInfo({
        lives: '❤'.repeat(Math.max(0, this.lives)) || '—',
        weapon: this.spread > 0 ? 'S' : '·',
      });
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      this.invuln = Math.max(0, this.invuln - dt);
      this.updatePlayer(dt);
      this.updateBullets(dt);
      this.updateEnemies(dt);
      this.updatePickups(dt);
      this.cam.follow(this.player, this.map, dt, this.facing * 70);

      if (!this.bossSpawned && this.player.x > this.bossX - W * 0.7) {
        this.bossSpawned = true;
        const b = this.addEnemy('boss', this.bossX, this.bossY);
        b.fireTimer = 1.4;
        this.g.sfx('bad');
      }

      // упал в пропасть
      if (this.player.y > this.map.pixelH + 40) this.killPlayer();
    }

    updatePlayer(dt) {
      const g = this.g;
      const p = this.player;

      let dx = 0;
      if (g.held('left')) dx -= 1;
      if (g.held('right')) dx += 1;
      const up = g.held('up');
      const down = g.held('down');

      if (dx) this.facing = dx;
      p.vx = dx * RUN;
      p.vy += GRAVITY * dt;

      // Прицел: восемь направлений, как на крестовине
      if (up && dx) this.aim = { x: dx, y: -0.75 };
      else if (up) this.aim = { x: 0, y: -1 };
      else if (down && dx && !p.onGround) this.aim = { x: dx, y: 0.75 };
      else if (down && !p.onGround) this.aim = { x: 0, y: 1 };
      else this.aim = { x: this.facing, y: 0 };

      if (g.pressed('action') && p.onGround) {
        // «вниз + прыжок» проваливает сквозь платформу
        if (down) p.y += 3;
        else {
          p.vy = -JUMP;
          this.g.sfx('bounce');
        }
      }
      p.move(this.map, dt);
      p.x = Arcade.clamp(p.x, 0, this.map.pixelW - p.w);

      this.fireCooldown -= dt;
      const shooting = g.held('boost') || g.pointer.down || g.held('action');
      if (shooting && this.fireCooldown <= 0) {
        this.fire();
        this.fireCooldown = FIRE_RATE;
      }
      this.spread = Math.max(0, this.spread - dt);
    }

    fire() {
      const p = this.player;
      const a = this.aim;
      const len = Math.hypot(a.x, a.y) || 1;
      const ux = a.x / len;
      const uy = a.y / len;
      const shots = this.spread > 0 ? [-0.25, 0, 0.25] : [0];
      for (const off of shots) {
        const ang = Math.atan2(uy, ux) + off;
        this.bullets.push({
          x: p.cx + ux * 12,
          y: p.cy + uy * 8,
          vx: Math.cos(ang) * BULLET_SPEED,
          vy: Math.sin(ang) * BULLET_SPEED,
        });
      }
      this.g.sfx('blip');
    }

    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (
          this.map.solidAtPixel(b.x, b.y) ||
          b.x < this.cam.x - 40 ||
          b.x > this.cam.x + W + 40 ||
          b.y < -40 ||
          b.y > this.map.pixelH + 40
        ) {
          this.bullets.splice(i, 1);
          continue;
        }
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (b.x < e.x || b.x > e.x + e.w || b.y < e.y || b.y > e.y + e.h) continue;
          this.bullets.splice(i, 1);
          this.damage(e, j);
          break;
        }
      }

      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (
          this.map.solidAtPixel(b.x, b.y) ||
          b.x < this.cam.x - 60 ||
          b.x > this.cam.x + W + 60
        ) {
          this.enemyBullets.splice(i, 1);
          continue;
        }
        const p = this.player;
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          this.enemyBullets.splice(i, 1);
          this.killPlayer();
        }
      }
    }

    damage(e, index) {
      e.hp -= 1;
      e.hitFlash = 0.1;
      this.g.sfx('brick');
      this.g.fx.burst(e.cx, e.cy, { count: 4, color: e.color, speed: 110, life: 0.25, size: 2.5 });
      if (e.hp > 0) return;

      this.enemies.splice(index, 1);
      this.g.addScore(e.score);
      this.g.shake(e.kind === 'boss' ? 24 : 4);
      this.g.sfx(e.kind === 'boss' ? 'fanfare' : 'bounce');
      this.g.fx.burst(e.cx, e.cy, {
        count: e.kind === 'boss' ? 50 : 16,
        color: [e.color, '#ffffff', '#fbbf24'],
        speed: e.kind === 'boss' ? 320 : 190,
        life: 0.7,
        size: 4,
      });
      if (e.kind === 'boss') {
        this.g.addScore(3000 + this.lives * 500);
        this.g.gameOver({ won: true, message: Arcade.t('bossDown') });
        return;
      }
      if (Math.random() < 0.25) {
        this.pickups.push({ x: e.cx - 10, y: e.cy - 10, w: 20, h: 20, vy: -80, spin: 0 });
      }
    }

    updateEnemies(dt) {
      const p = this.player;
      for (const e of this.enemies) {
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        // за экраном враги спят: иначе весь уровень бегает и стреляет разом
        if (e.x < this.cam.x - 80 || e.x > this.cam.x + W + 80) continue;

        if (e.kind === 'runner') {
          e.vy += GRAVITY * dt;
          e.vx = e.dir * 70;
          const hit = e.move(this.map, dt);
          // разворачиваемся у стены и на краю площадки
          const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
          const floorAhead = this.map.solidAtPixel(aheadX, e.y + e.h + 4);
          if (hit.left || hit.right || (!floorAhead && e.onGround)) e.dir *= -1;
        } else if (e.kind === 'boss') {
          e.phase += dt;
          e.y += Math.sin(e.phase * 1.2) * 18 * dt;
        }

        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = e.kind === 'boss' ? 0.5 : e.kind === 'turret' ? 1.5 : 2.2;
          this.enemyFire(e, p);
        }

        if (this.invuln <= 0 && e.overlaps(p, -4)) this.killPlayer();
      }
    }

    enemyFire(e, p) {
      const a = Math.atan2(p.cy - e.cy, p.cx - e.cx);
      const shots = e.kind === 'boss' ? 3 : 1;
      const speed = e.kind === 'boss' ? 240 : 200;
      for (let i = 0; i < shots; i++) {
        const spread = (i - (shots - 1) / 2) * 0.3;
        this.enemyBullets.push({
          x: e.cx,
          y: e.cy,
          vx: Math.cos(a + spread) * speed,
          vy: Math.sin(a + spread) * speed,
        });
      }
    }

    updatePickups(dt) {
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.vy += GRAVITY * 0.5 * dt;
        pk.y += pk.vy * dt;
        pk.spin += dt * 4;
        if (this.map.solidAtPixel(pk.x + pk.w / 2, pk.y + pk.h + 1) && pk.vy > 0) pk.vy = 0;
        if (pk.y > this.map.pixelH + 40) {
          this.pickups.splice(i, 1);
          continue;
        }
        const p = this.player;
        if (pk.x < p.x + p.w && pk.x + pk.w > p.x && pk.y < p.y + p.h && pk.y + pk.h > p.y) {
          this.pickups.splice(i, 1);
          this.spread = SPREAD_TIME;
          this.g.addScore(150);
          this.g.sfx('power');
          this.syncInfo();
        }
      }
    }

    killPlayer() {
      if (this.invuln > 0) return;
      this.lives -= 1;
      this.spread = 0;
      this.invuln = 2;
      this.syncInfo();
      this.g.shake(20);
      this.g.sfx('die');
      this.g.fx.burst(this.player.cx, this.player.cy, {
        count: 26,
        color: ['#22d3ee', '#ffffff', '#f87171'],
        speed: 240,
        life: 0.7,
        size: 4,
      });
      if (this.lives <= 0) {
        const progress = Math.round((this.player.x / this.map.pixelW) * 100);
        this.g.gameOver({ message: Arcade.t('levelProgress', { n: progress }) });
        return;
      }
      // возрождаемся чуть позади, но не в начале уровня
      this.player.x = Math.max(this.startX, this.player.x - 120);
      this.player.y = 0;
      this.player.vx = 0;
      this.player.vy = 0;
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(1, '#1e293b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // дальние джунгли — простой параллакс
      ctx.fillStyle = '#132a20';
      for (let i = 0; i < 16; i++) {
        const x = ((i * 90 - this.cam.x * 0.3) % (W + 180)) - 90;
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + 45, H - 120 - (i % 3) * 30);
        ctx.lineTo(x + 90, H);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
      this.drawMap(ctx);
      for (const pk of this.pickups) this.drawPickup(ctx, pk);
      for (const e of this.enemies) this.drawEnemy(ctx, e);

      ctx.fillStyle = '#fde68a';
      for (const b of this.bullets) ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
      ctx.fillStyle = '#fca5a5';
      for (const b of this.enemyBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 7);
        ctx.fill();
      }

      this.drawPlayer(ctx);
      ctx.restore();

      this.drawHud(ctx);
    }

    drawMap(ctx) {
      const t = TILE;
      const c0 = Math.max(0, Math.floor(this.cam.x / t) - 1);
      const c1 = Math.min(this.map.w, Math.ceil((this.cam.x + W) / t) + 1);
      for (let r = 0; r < this.map.h; r++) {
        for (let c = c0; c < c1; c++) {
          const ch = this.map.at(c, r);
          if (ch === '#') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(c * t, r * t, t, t);
            ctx.fillStyle = '#475569';
            ctx.fillRect(c * t + 2, r * t + 2, t - 4, t - 4);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(c * t + 2, r * t + t - 7, t - 4, 5);
          } else if (ch === '=') {
            ctx.fillStyle = '#a16207';
            ctx.fillRect(c * t, r * t, t, 9);
            ctx.fillStyle = '#ca8a04';
            ctx.fillRect(c * t + 1, r * t + 1, t - 2, 4);
          }
        }
      }
    }

    drawPlayer(ctx) {
      const p = this.player;
      if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) return;
      const x = p.x;
      const y = p.y;

      ctx.fillStyle = '#0f172a'; // ноги
      ctx.fillRect(x + 3, y + 20, 6, 10);
      ctx.fillRect(x + 11, y + 20, 6, 10);
      ctx.fillStyle = '#22d3ee'; // корпус
      ctx.fillRect(x + 2, y + 8, 16, 14);
      ctx.fillStyle = '#f5d0a9'; // голова
      ctx.fillRect(x + 5, y, 10, 9);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 4, y - 2, 12, 4); // бандана

      // ствол смотрит туда же, куда прицел
      const a = this.aim;
      const len = Math.hypot(a.x, a.y) || 1;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.cx, p.cy - 2);
      ctx.lineTo(p.cx + (a.x / len) * 16, p.cy - 2 + (a.y / len) * 16);
      ctx.stroke();
    }

    drawEnemy(ctx, e) {
      const c = e.hitFlash > 0 ? '#ffffff' : e.color;
      if (e.kind === 'boss') {
        ctx.fillStyle = c;
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(e.x + 10, e.y + 16, e.w - 20, 22);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(e.x + 16, e.y + 22, 12, 10);
        ctx.fillRect(e.x + e.w - 28, e.y + 22, 12, 10);
        ctx.fillStyle = '#334155';
        ctx.fillRect(e.x - 8, e.y + e.h * 0.55, e.w + 16, 14);
        // полоса здоровья
        const bw = 220;
        ctx.fillStyle = 'rgba(5,6,13,0.8)';
        ctx.fillRect(this.cam.x + W / 2 - bw / 2 - 3, this.cam.y + 14, bw + 6, 12);
        ctx.fillStyle = '#a78bfa';
        ctx.fillRect(this.cam.x + W / 2 - bw / 2, this.cam.y + 17, bw * (e.hp / e.maxHp), 6);
        return;
      }
      if (e.kind === 'turret') {
        ctx.fillStyle = c;
        ctx.fillRect(e.x, e.y + 8, e.w, e.h - 8);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(e.cx, e.y + 10, 8, 0, 7);
        ctx.fill();
        return;
      }
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(e.x + 3, e.y + 20, 5, 10);
      ctx.fillRect(e.x + 13, e.y + 20, 5, 10);
      ctx.fillStyle = c;
      ctx.fillRect(e.x + 2, e.y + 8, 18, 14);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(e.x + 5, e.y, 12, 9);
    }

    drawPickup(ctx, pk) {
      ctx.save();
      ctx.translate(pk.x + pk.w / 2, pk.y + pk.h / 2);
      ctx.scale(Math.max(0.3, Math.abs(Math.cos(pk.spin))), 1);
      ctx.fillStyle = '#fbbf24';
      Arcade.roundRect(ctx, -10, -10, 20, 20, 5);
      ctx.fill();
      ctx.fillStyle = '#0b1120';
      ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 1);
      ctx.restore();
    }

    drawHud(ctx) {
      // полоса пройденного пути
      const pct = Arcade.clamp(this.player.x / (this.map.pixelW - W), 0, 1);
      ctx.fillStyle = 'rgba(5,6,13,0.7)';
      Arcade.roundRect(ctx, 12, H - 26, 200, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      Arcade.roundRect(ctx, 15, H - 23, 194 * pct, 6, 3);
      ctx.fill();
      if (this.spread > 0) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '11px ui-monospace, Menlo, monospace';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('S ' + this.spread.toFixed(1), 220, H - 16);
      }
    }
  }

  Arcade.register({
    id: 'contra',
    width: W,
    height: H,
    create: (g) => new Contra(g),
    // Витрина: бежит вправо, перепрыгивает пропасти и уступы, стреляет.
    // Управляем через клавиши хоста: update перетрёт любую скорость, которую
    // выставить напрямую.
    autopilot(c, host) {
      const p = c.player;
      host.keys.add('right');
      host.keys.add('boost');

      const holeAhead = !c.map.solidAtPixel(p.x + p.w + 34, p.y + p.h + 8);
      const wallAhead = c.map.solidAtPixel(p.x + p.w + 4, p.y + p.h - 10);
      if ((holeAhead || wallAhead) && p.onGround) {
        p.vy = -JUMP;
        p.onGround = false;
      }
      c.lives = Math.max(c.lives, 2); // мигающую неуязвимость в демо не держим
      // демо не заканчивается: добежав до конца, начинаем заново
      if (p.x > c.map.pixelW - W - 60) {
        p.x = c.startX;
        p.y = c.startY;
        p.vy = 0;
      }
    },
  });
})();
