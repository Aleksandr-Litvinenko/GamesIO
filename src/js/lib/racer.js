/* Общая модель езды для гонок на псевдо-3D дороге.
   Отсюда наследуются «Реальные мотоциклы» и «Реальные тачки»: физика,
   трафик и столкновения общие, а тюнинг, палитра и правила — свои. */
(function () {
  'use strict';

  const clamp = Arcade.roadClamp;

  class Racer {
    constructor(g, cfg) {
      this.g = g;
      this.cfg = cfg;
      this.W = cfg.width;
      this.H = cfg.height;
      const t = cfg.tuning;
      this.t = t;

      this.road = new Arcade.Road(
        Object.assign({ width: cfg.width, height: cfg.height, palette: cfg.palette }, cfg.road)
      );
      const rnd = this.road.build(cfg.seed, cfg.pieces || 16);
      this.road.decorate(rnd, cfg.decor, cfg.decorDensity || 10);
      this.rnd = rnd;

      this.position = 0;
      this.playerX = 0;
      this.speed = 0;
      this.lean = 0;
      this.distance = 0;
      this.lap = 1;
      this.timeLeft = cfg.startTime;
      this.nextCheckpoint = cfg.checkpointEvery;
      this.checkpointFlash = 0;
      this.crashCooldown = 0;
      this.overtakes = 0;

      this.spawnTraffic(cfg.trafficCount || 24);
    }

    spawnTraffic(count) {
      const kinds = this.cfg.traffic;
      const t = this.t;
      this.cars = [];
      for (let i = 0; i < count; i++) {
        const seg = this.road.segments[Math.floor(this.rnd() * this.road.segments.length)];
        const car = {
          offset: this.rnd() * 1.6 - 0.8,
          z: seg.index * this.road.segmentLength,
          kind: kinds[Math.floor(this.rnd() * kinds.length)],
          speed: t.maxSpeed / 5 + this.rnd() * (t.maxSpeed / 3.5),
          segment: seg,
          passed: false,
        };
        seg.cars.push(car);
        this.cars.push(car);
      }
    }

    /* ---------------- ввод ---------------- */

    readSteer() {
      const g = this.g;
      if (g.held('left')) return -1;
      if (g.held('right')) return 1;
      if (g.pointer.active && g.pointer.down) {
        return clamp((g.pointer.x - this.W / 2) / (this.W / 3), -1, 1);
      }
      return 0;
    }

    readThrottle() {
      const g = this.g;
      return {
        gas: g.held('up') || g.held('action') || (g.pointer.down && g.pointer.y < this.H * 0.6),
        brake: g.held('down') || (g.pointer.down && g.pointer.y >= this.H * 0.6),
      };
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      const t = this.t;
      const road = this.road;
      const start = this.position;
      const seg = road.findSegment(this.position + road.playerZ);
      const speedPercent = this.speed / t.maxSpeed;
      const dx = dt * 2 * speedPercent;

      const steer = this.readSteer();
      this.playerX += steer * dx * t.steer;
      this.lean += (steer - this.lean) * Math.min(1, dt * 6);

      const { gas, brake } = this.readThrottle();
      if (brake) this.speed += t.brake * dt;
      else if (gas) this.speed += t.accel * dt;
      else this.speed += t.decel * dt;

      // центробежная сила: чем быстрее в повороте, тем сильнее сносит наружу
      this.playerX -= dx * speedPercent * seg.curve * t.centrifugal;

      if (Math.abs(this.playerX) > 1 && this.speed > t.offRoadLimit) {
        this.speed += t.offRoadDecel * dt;
        this.g.shake(2 + speedPercent * 4);
        if (Math.random() < dt * 12) {
          this.g.fx.burst(this.W / 2 + this.playerX * 60, this.H * 0.86, {
            count: 3,
            color: ['#a3a3a3', '#78716c'],
            speed: 130,
            life: 0.35,
            size: 3,
          });
        }
      }

      this.playerX = clamp(this.playerX, -1.8, 1.8);
      this.speed = clamp(this.speed, 0, t.maxSpeed);

      this.updateTraffic(dt);
      this.crashCooldown = Math.max(0, this.crashCooldown - dt);
      if (this.crashCooldown <= 0) this.checkCollisions(seg);
      this.countOvertakes(seg);

      this.position = (this.position + this.speed * dt) % road.trackLength;
      let travelled = this.position - start;
      if (travelled < 0) {
        travelled += road.trackLength;
        this.lap += 1;
        this.nextCheckpoint = this.cfg.checkpointEvery;
        this.g.addScore(500);
        this.g.sfx('fanfare');
      }
      this.distance += travelled;

      const lapProgress = this.position / road.trackLength;
      if (lapProgress >= this.nextCheckpoint && this.nextCheckpoint < 1) {
        this.nextCheckpoint += this.cfg.checkpointEvery;
        this.timeLeft += this.cfg.checkpointBonus;
        this.checkpointFlash = 1.4;
        this.g.addScore(200);
        this.g.sfx('bonus');
      }
      if (this.checkpointFlash > 0) this.checkpointFlash -= dt;

      this.g.score += Math.round(speedPercent * 60 * dt);
      this.timeLeft -= dt;
      this.syncInfo();

      if (this.timeLeft <= 0) {
        this.g.gameOver({
          message: Arcade.t('distanceCovered', { n: (this.distance / 1000).toFixed(1) }),
        });
      }
    }

    updateTraffic(dt) {
      const road = this.road;
      for (const car of this.cars) {
        const oldSeg = car.segment;
        car.offset = clamp(car.offset + this.carSteer(car, oldSeg) * dt, -0.9, 0.9);
        car.z = (car.z + car.speed * dt) % road.trackLength;
        const newSeg = road.findSegment(car.z);
        if (newSeg !== oldSeg) {
          const i = oldSeg.cars.indexOf(car);
          if (i >= 0) oldSeg.cars.splice(i, 1);
          newSeg.cars.push(car);
          car.segment = newSeg;
        }
      }
    }

    // Трафик перестраивается сам, иначе машины слипаются в неподвижную пробку
    carSteer(car, seg) {
      const road = this.road;
      for (let i = 1; i < 20; i++) {
        const s = road.segments[(seg.index + i) % road.segments.length];
        for (const other of s.cars) {
          if (other === car || car.speed <= other.speed) continue;
          if (Math.abs(car.offset - other.offset) > 0.9) continue;
          return car.offset > other.offset ? 0.8 : -0.8;
        }
      }
      return 0;
    }

    checkCollisions(seg) {
      for (const car of seg.cars) {
        if (Math.abs(this.playerX - car.offset) >= 0.45) continue;
        if (this.speed <= car.speed) continue;
        this.crash(car);
        return;
      }
      for (const sp of seg.sprites) {
        if (Math.abs(this.playerX - sp.offset) >= 0.9) continue;
        this.crash(null);
        return;
      }
    }

    countOvertakes(seg) {
      for (const car of this.cars) {
        if (car.passed) continue;
        const ahead = (car.z - this.position + this.road.trackLength) % this.road.trackLength;
        if (ahead > this.road.trackLength * 0.9) {
          car.passed = true;
          this.overtakes += 1;
          this.g.addScore(50);
        }
      }
    }

    crash(car) {
      const t = this.t;
      this.speed = Math.min(this.speed, t.maxSpeed / 6);
      this.crashCooldown = 0.9;
      this.g.shake(20);
      this.g.sfx('crash');
      this.g.fx.burst(this.W / 2 + this.playerX * 90, this.H * 0.78, {
        count: 22,
        color: ['#fbbf24', '#f87171', '#ffffff'],
        speed: 260,
        life: 0.6,
        size: 4,
      });
      if (car) this.playerX += this.playerX > car.offset ? 0.4 : -0.4;
    }

    syncInfo() {
      this.g.setInfo({
        time: Math.max(0, Math.ceil(this.timeLeft)),
        speed: this.kmh() + ' km/h',
        lap: this.lap,
      });
    }

    kmh() {
      return Math.round((this.speed / this.t.maxSpeed) * this.cfg.topKmh);
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      this.road.render(ctx, {
        position: this.position,
        playerX: this.playerX,
        backdropOffset: this.position * 0.0016,
      });
      this.drawPlayer(ctx);
      this.drawHud(ctx);
    }

    drawPlayer(ctx) {
      const painter = Arcade.Sprites[this.cfg.playerSprite];
      if (!painter) return;
      const scale = this.cfg.playerScale || 2.6;
      const bob = Math.sin(this.position * 0.02) * (this.speed / this.t.maxSpeed) * 2;
      ctx.save();
      ctx.translate(
        this.W / 2 - (painter.w * scale) / 2 + this.lean * 6,
        this.H - painter.h * scale - 12 + bob
      );
      ctx.scale(scale, scale);
      painter.draw(ctx, { lean: this.lean });
      ctx.restore();
    }

    drawHud(ctx) {
      const W = this.W;
      const H = this.H;
      const speedPercent = this.speed / this.t.maxSpeed;

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(5,6,13,0.72)';
      Arcade.roundRect(ctx, 12, H - 40, 210, 28, 9);
      ctx.fill();
      ctx.fillStyle = this.cfg.accent;
      Arcade.roundRect(ctx, 17, H - 35, 200 * speedPercent, 10, 5);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillStyle = 'rgba(226,232,240,0.8)';
      ctx.fillText(this.kmh() + ' km/h', 17, H - 16);

      const t = Math.max(0, this.timeLeft);
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px ui-monospace, Menlo, monospace';
      ctx.fillStyle = t < 8 ? (Math.sin(t * 12) > 0 ? '#f87171' : '#fecaca') : '#f8fafc';
      ctx.fillText(t.toFixed(1), W / 2, 40);
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillStyle = 'rgba(226,232,240,0.75)';
      ctx.fillText(Arcade.t('time').toUpperCase(), W / 2, 54);

      ctx.textAlign = 'right';
      ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.fillStyle = 'rgba(226,232,240,0.8)';
      ctx.fillText(Arcade.t('overtakes') + ': ' + this.overtakes, W - 14, 30);

      if (this.checkpointFlash > 0) {
        ctx.globalAlpha = Math.min(1, this.checkpointFlash);
        ctx.textAlign = 'center';
        ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(Arcade.t('checkpoint'), W / 2, H / 2 - 40);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* Автопилот для превью на витрине: держится полосы и объезжает трафик */
  Racer.autopilot = function (r) {
    const road = r.road;
    const seg = road.findSegment(r.position + road.playerZ);
    let target = 0;
    for (let i = 0; i < 14; i++) {
      const s = road.segments[(seg.index + i) % road.segments.length];
      for (const car of s.cars) {
        if (Math.abs(car.offset - r.playerX) < 0.7) target = car.offset > 0 ? -0.6 : 0.6;
      }
    }
    target -= seg.curve * 0.06;
    r.playerX += clamp(target - r.playerX, -0.04, 0.04);
    r.speed = Math.min(r.t.maxSpeed * 0.82, r.speed + r.t.accel * 0.02);
    r.timeLeft = Math.max(r.timeLeft, 12);
  };

  Arcade.Racer = Racer;
})();
