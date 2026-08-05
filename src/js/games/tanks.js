/* Танчики — сетка, кирпич, база и волны танков, как на Денди.

   Поле 13×13 клеток, но всё движение идёт с шагом в половину клетки: так
   танк проходит в однокирпичный проём и может стрелять точно в стык, как в
   оригинале 1985 года. Проиграть можно двумя способами — потерять все жизни
   или упустить базу, и второй обиднее. */
(function () {
  'use strict';

  const GRID = 13;
  const CELL = 40;
  const W = GRID * CELL; // 520
  const H = GRID * CELL;

  const HALF = CELL / 2; // шаг перемещения и размер кирпичного блока
  const TANK = CELL - 6;
  const BULLET_R = 4;

  const PLAYER_SPEED = 130;
  const BULLET_SPEED = 380;
  const ENEMY_BULLET_SPEED = 300;

  const MAX_ON_FIELD = 4;
  const PER_WAVE = 6;

  // Клетки поля. Кирпич делится на четыре четвертинки, как в оригинале.
  const EMPTY = 0;
  const BRICK = 1;
  const STEEL = 2;
  const WATER = 3;
  const TREE = 4;

  const DIRS = [
    { x: 0, y: -1 }, // 0 вверх
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  class Tanks {
    constructor(g) {
      this.g = g;
      this.lives = 3;
      this.wave = 0;
      this.baseAlive = true;
      this.buildField();
      this.player = this.makeTank(6 * CELL + 3, 12 * CELL + 3, true);
      this.enemies = [];
      this.bullets = [];
      this.spawnQueue = 0;
      this.spawnTimer = 1;
      this.waveBreak = 1.2;
      this.betweenWaves = true;
      this.syncInfo();
    }

    /* ---------------- поле ---------------- */

    // Сетка вдвое плотнее клеток: кирпич разрушается по четвертинкам
    buildField() {
      const n = GRID * 2;
      this.n = n;
      this.cell = HALF;
      this.field = new Uint8Array(n * n);

      const put = (col, row, kind) => {
        if (col < 0 || row < 0 || col >= n || row >= n) return;
        this.field[row * n + col] = kind;
      };
      const block = (col, row, kind) => {
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) put(col * 2 + dx, row * 2 + dy, kind);
      };

      // кирпичные «столбы» классической первой карты
      for (let row = 1; row < GRID - 2; row += 2) {
        for (let col = 1; col < GRID; col += 2) {
          if (row === 1 && (col === 5 || col === 7)) continue;
          block(col, row, BRICK);
        }
      }
      // немного брони и воды для разнообразия
      block(2, 5, STEEL);
      block(10, 5, STEEL);
      block(6, 7, WATER);
      block(4, 9, BRICK);
      block(8, 9, BRICK);
      block(3, 3, TREE);
      block(9, 3, TREE);

      // база в нижнем ряду по центру и кирпичная защита вокруг
      this.baseCol = 6;
      this.baseRow = 12;
      block(5, 11, BRICK);
      block(6, 11, BRICK);
      block(7, 11, BRICK);
      block(5, 12, BRICK);
      block(7, 12, BRICK);
      block(6, 12, EMPTY);
    }

    solidAt(px, py, forBullet) {
      if (px < 0 || py < 0 || px >= W || py >= H) return true;
      const c = Math.floor(px / HALF);
      const r = Math.floor(py / HALF);
      const v = this.field[r * this.n + c];
      if (v === EMPTY || v === TREE) return false;
      if (v === WATER) return !forBullet; // пуля летит над водой, танк — нет
      return true;
    }

    // Прямоугольник свободен? Нужно и танку, и проверке спавна
    canStand(x, y, size, forBullet) {
      const pts = [
        [x, y],
        [x + size - 1, y],
        [x, y + size - 1],
        [x + size - 1, y + size - 1],
      ];
      return !pts.some((p) => this.solidAt(p[0], p[1], forBullet));
    }

    /* ---------------- танки ---------------- */

    makeTank(x, y, isPlayer) {
      return {
        x: x,
        y: y,
        dir: isPlayer ? 0 : 2,
        isPlayer: isPlayer,
        cooldown: 0,
        moveTimer: 0,
        invuln: isPlayer ? 2 : 0,
        hp: 1,
        color: isPlayer ? '#fbbf24' : '#e2e8f0',
      };
    }

    startWave() {
      this.wave += 1;
      this.betweenWaves = false;
      this.spawnQueue = PER_WAVE + Math.floor(this.wave / 2);
      this.spawnTimer = 0.4;
      this.syncInfo();
      this.g.sfx('blip');
    }

    trySpawn() {
      const spots = [3, 6 * CELL + 3, W - CELL];
      for (let attempt = 0; attempt < 3; attempt++) {
        const x = spots[Math.floor(Math.random() * spots.length)];
        const y = 3;
        if (!this.canStand(x, y, TANK)) continue;
        if (this.enemies.some((e) => Math.abs(e.x - x) < CELL && Math.abs(e.y - y) < CELL))
          continue;
        const e = this.makeTank(x, y, false);
        e.hp = 1 + Math.floor(this.wave / 4);
        e.color = e.hp > 1 ? '#f472b6' : '#e2e8f0';
        e.speed = 60 + this.wave * 4 + Math.random() * 25;
        this.enemies.push(e);
        this.spawnQueue -= 1;
        this.g.fx.burst(x + TANK / 2, y + TANK / 2, {
          count: 10,
          color: '#94a3b8',
          speed: 120,
          life: 0.4,
          size: 3,
        });
        return;
      }
    }

    syncInfo() {
      this.g.setInfo({
        lives: '❤'.repeat(Math.max(0, this.lives)) || '—',
        wave: this.wave,
        base: this.baseAlive ? '🦅' : '💥',
      });
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateBullets(dt);

      if (this.betweenWaves) {
        this.waveBreak -= dt;
        if (this.waveBreak <= 0) this.startWave();
      } else {
        this.spawnTimer -= dt;
        if (this.spawnQueue > 0 && this.enemies.length < MAX_ON_FIELD && this.spawnTimer <= 0) {
          this.trySpawn();
          this.spawnTimer = 1.6;
        }
        if (this.spawnQueue <= 0 && this.enemies.length === 0) {
          this.betweenWaves = true;
          this.waveBreak = 1.6;
          this.g.addScore(200 * this.wave);
          this.g.sfx('fanfare');
        }
      }
    }

    updatePlayer(dt) {
      const g = this.g;
      const p = this.player;
      p.invuln = Math.max(0, p.invuln - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);

      let dir = -1;
      if (g.held('up')) dir = 0;
      else if (g.held('right')) dir = 1;
      else if (g.held('down')) dir = 2;
      else if (g.held('left')) dir = 3;

      // на телефоне ведём танк пальцем: он едет к точке касания
      if (dir < 0 && g.pointer.active && g.pointer.down) {
        const dx = g.pointer.x - (p.x + TANK / 2);
        const dy = g.pointer.y - (p.y + TANK / 2);
        if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
          dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
        }
      }

      if (dir >= 0) {
        p.dir = dir;
        this.moveTank(p, PLAYER_SPEED * dt);
      }
      if (g.held('action') || g.pressed('action')) this.fire(p);
    }

    moveTank(t, dist) {
      const d = DIRS[t.dir];
      const nx = t.x + d.x * dist;
      const ny = t.y + d.y * dist;
      if (!this.canStand(nx, ny, TANK)) {
        // Прилипание к сетке: без него танк цепляется углом за косяк проёма
        const snap = Math.round((d.x ? t.y : t.x) / HALF) * HALF;
        if (d.x) {
          if (this.canStand(nx, snap, TANK)) {
            t.x = nx;
            t.y = snap;
          }
        } else if (this.canStand(snap, ny, TANK)) {
          t.x = snap;
          t.y = ny;
        }
        return false;
      }
      const blocked = this.tanks().some(
        (o) => o !== t && Math.abs(o.x - nx) < TANK - 4 && Math.abs(o.y - ny) < TANK - 4
      );
      if (blocked) return false;
      t.x = nx;
      t.y = ny;
      return true;
    }

    tanks() {
      return this.player ? [this.player].concat(this.enemies) : this.enemies;
    }

    fire(t) {
      if (t.cooldown > 0) return;
      t.cooldown = t.isPlayer ? 0.36 : 0.9 + Math.random() * 0.7;
      const d = DIRS[t.dir];
      this.bullets.push({
        x: t.x + TANK / 2 + d.x * TANK * 0.55,
        y: t.y + TANK / 2 + d.y * TANK * 0.55,
        vx: d.x * (t.isPlayer ? BULLET_SPEED : ENEMY_BULLET_SPEED),
        vy: d.y * (t.isPlayer ? BULLET_SPEED : ENEMY_BULLET_SPEED),
        mine: t.isPlayer,
      });
      this.g.sfx('blip');
    }

    updateEnemies(dt) {
      for (const e of this.enemies) {
        e.cooldown = Math.max(0, e.cooldown - dt);
        e.moveTimer -= dt;

        if (e.moveTimer <= 0) {
          e.moveTimer = 0.5 + Math.random() * 1.4;
          e.dir = this.chooseDir(e);
        }
        if (!this.moveTank(e, e.speed * dt)) e.moveTimer = 0;

        // стреляет, если впереди игрок, база или просто изредка
        if (this.lineOfFire(e)) this.fire(e);
        else if (Math.random() < dt * 0.5) this.fire(e);
      }
    }

    // Танки идут к базе, но иногда сворачивают за игроком
    chooseDir(e) {
      const targetX = Math.random() < 0.3 ? this.player.x : this.baseCol * CELL;
      const targetY = Math.random() < 0.3 ? this.player.y : this.baseRow * CELL;
      const options = [];
      if (targetY < e.y - 4) options.push(0);
      if (targetY > e.y + 4) options.push(2);
      if (targetX > e.x + 4) options.push(1);
      if (targetX < e.x - 4) options.push(3);
      if (!options.length || Math.random() < 0.25) return Math.floor(Math.random() * 4);
      return options[Math.floor(Math.random() * options.length)];
    }

    lineOfFire(e) {
      const d = DIRS[e.dir];
      let x = e.x + TANK / 2;
      let y = e.y + TANK / 2;
      for (let i = 0; i < GRID * 2; i++) {
        x += d.x * HALF;
        y += d.y * HALF;
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        if (this.solidAt(x, y, true)) return false;
        if (
          Math.abs(x - (this.player.x + TANK / 2)) < TANK / 2 &&
          Math.abs(y - (this.player.y + TANK / 2)) < TANK / 2
        )
          return true;
        if (
          Math.abs(x - (this.baseCol * CELL + CELL / 2)) < CELL / 2 &&
          Math.abs(y - (this.baseRow * CELL + CELL / 2)) < CELL / 2
        )
          return true;
      }
      return false;
    }

    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        // мелкими шагами, чтобы пуля не проскочила кирпич насквозь
        const steps = 4;
        let dead = false;
        for (let s = 0; s < steps && !dead; s++) {
          b.x += (b.vx * dt) / steps;
          b.y += (b.vy * dt) / steps;
          dead = this.bulletHits(b);
        }
        if (dead) this.bullets.splice(i, 1);
      }
    }

    bulletHits(b) {
      if (b.x < 0 || b.y < 0 || b.x >= W || b.y >= H) {
        this.g.fx.burst(b.x, b.y, { count: 5, color: '#94a3b8', speed: 90, life: 0.2, size: 2 });
        return true;
      }

      // база
      const bx = this.baseCol * CELL;
      const by = this.baseRow * CELL;
      if (this.baseAlive && b.x > bx && b.x < bx + CELL && b.y > by && b.y < by + CELL) {
        this.baseAlive = false;
        this.g.shake(24);
        this.g.sfx('crash');
        this.g.fx.burst(bx + CELL / 2, by + CELL / 2, {
          count: 40,
          color: ['#fbbf24', '#f87171', '#ffffff'],
          speed: 260,
          life: 0.9,
          size: 5,
        });
        this.syncInfo();
        this.g.gameOver({ message: Arcade.t('baseLost') });
        return true;
      }

      // стены
      const c = Math.floor(b.x / HALF);
      const r = Math.floor(b.y / HALF);
      const v = this.field[r * this.n + c];
      if (v === BRICK) {
        this.field[r * this.n + c] = EMPTY;
        this.g.fx.burst(c * HALF + HALF / 2, r * HALF + HALF / 2, {
          count: 6,
          color: ['#b45309', '#f59e0b'],
          speed: 130,
          life: 0.3,
          size: 3,
        });
        this.g.sfx('brick');
        return true;
      }
      if (v === STEEL) {
        this.g.sfx('bounce');
        this.g.fx.burst(b.x, b.y, { count: 6, color: '#e2e8f0', speed: 140, life: 0.25, size: 2.5 });
        return true;
      }

      // танки
      if (b.mine) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (b.x < e.x || b.x > e.x + TANK || b.y < e.y || b.y > e.y + TANK) continue;
          e.hp -= 1;
          if (e.hp > 0) {
            e.color = '#e2e8f0';
            this.g.sfx('bounce');
            return true;
          }
          this.enemies.splice(i, 1);
          this.g.addScore(100);
          this.g.sfx('bounce');
          this.g.shake(5);
          this.g.fx.burst(e.x + TANK / 2, e.y + TANK / 2, {
            count: 20,
            color: ['#fbbf24', '#ffffff'],
            speed: 200,
            life: 0.5,
            size: 4,
          });
          return true;
        }
      } else {
        const p = this.player;
        if (p && b.x > p.x && b.x < p.x + TANK && b.y > p.y && b.y < p.y + TANK) {
          this.hitPlayer();
          return true;
        }
      }
      return false;
    }

    hitPlayer() {
      const p = this.player;
      if (p.invuln > 0) return;
      this.lives -= 1;
      this.syncInfo();
      this.g.shake(16);
      this.g.sfx('die');
      this.g.fx.burst(p.x + TANK / 2, p.y + TANK / 2, {
        count: 26,
        color: ['#fbbf24', '#f87171', '#ffffff'],
        speed: 230,
        life: 0.7,
        size: 4,
      });
      if (this.lives <= 0) {
        this.g.gameOver({ message: Arcade.t('wavesCleared', { n: Math.max(0, this.wave - 1) }) });
        return;
      }
      p.x = 6 * CELL + 3;
      p.y = 12 * CELL + 3;
      p.dir = 0;
      p.invuln = 2;
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      ctx.fillStyle = '#0a0d16';
      ctx.fillRect(0, 0, W, H);

      const n = this.n;
      const s = HALF;
      const trees = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const v = this.field[r * n + c];
          if (!v) continue;
          const x = c * s;
          const y = r * s;
          if (v === BRICK) {
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(x, y, s, s);
            ctx.fillStyle = '#c2410c';
            for (let i = 0; i < 2; i++)
              for (let j = 0; j < 2; j++)
                ctx.fillRect(x + 1 + j * (s / 2), y + 1 + i * (s / 2), s / 2 - 2, s / 2 - 2);
          } else if (v === STEEL) {
            ctx.fillStyle = '#64748b';
            ctx.fillRect(x, y, s, s);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(x + 5, y + 5, s - 10, s - 10);
          } else if (v === WATER) {
            ctx.fillStyle = '#0c4a6e';
            ctx.fillRect(x, y, s, s);
            ctx.fillStyle = '#0ea5e9';
            const wob = Math.sin(Date.now() / 300 + c) * 2;
            ctx.fillRect(x + 2, y + s / 2 + wob, s - 4, 2);
          } else if (v === TREE) {
            trees.push([x, y]);
          }
        }
      }

      this.drawBase(ctx);
      for (const t of this.tanks()) this.drawTank(ctx, t);

      ctx.fillStyle = '#fde68a';
      for (const b of this.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_R, 0, 7);
        ctx.fill();
      }

      // кусты рисуются поверх всего — под ними можно спрятаться
      for (const [x, y] of trees) {
        ctx.fillStyle = '#166534';
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, s * 0.38, 0, 7);
        ctx.fill();
      }

      if (this.betweenWaves && this.waveBreak > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(Arcade.t('waveN', { n: this.wave + 1 }), W / 2, H / 2);
      }
    }

    drawBase(ctx) {
      const x = this.baseCol * CELL;
      const y = this.baseRow * CELL;
      ctx.fillStyle = this.baseAlive ? '#1e293b' : '#450a0a';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.font = Math.round(CELL * 0.7) + 'px system-ui, "Apple Color Emoji"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.baseAlive ? '🦅' : '💥', x + CELL / 2, y + CELL / 2);
    }

    drawTank(ctx, t) {
      if (t.invuln > 0 && Math.floor(t.invuln * 12) % 2 === 0) return;
      const s = TANK;
      ctx.save();
      ctx.translate(t.x + s / 2, t.y + s / 2);
      ctx.rotate((t.dir * Math.PI) / 2);

      ctx.fillStyle = '#0f172a'; // гусеницы
      ctx.fillRect(-s / 2, -s / 2, s * 0.24, s);
      ctx.fillRect(s / 2 - s * 0.24, -s / 2, s * 0.24, s);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-s / 2 + 1, -s / 2 + 3 + i * (s / 4), s * 0.24 - 2, 2);
        ctx.fillRect(s / 2 - s * 0.24 + 1, -s / 2 + 3 + i * (s / 4), s * 0.24 - 2, 2);
      }

      ctx.fillStyle = t.color; // корпус
      ctx.fillRect(-s * 0.28, -s * 0.42, s * 0.56, s * 0.84);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-s * 0.28, -s * 0.42, s * 0.56, s * 0.12);

      ctx.fillStyle = t.color; // ствол
      ctx.fillRect(-3, -s * 0.62, 6, s * 0.3);
      ctx.fillStyle = '#0f172a'; // башня
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }

  Arcade.register({
    id: 'tanks',
    width: W,
    height: H,
    create: (g) => new Tanks(g),
    // Витрина: танк едет к ближайшему врагу и стреляет
    autopilot(t) {
      const p = t.player;
      if (!p) return;
      const target = t.enemies[0];
      if (target) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 1 : 3;
        else p.dir = dy > 0 ? 2 : 0;
      }
      t.moveTank(p, 1.4);
      if (Math.random() < 0.08) t.fire(p);
      // демо не должно заканчиваться через полминуты: держим базу и жизни
      t.lives = Math.max(t.lives, 2);
      t.baseAlive = true;
    },
  });
})();
