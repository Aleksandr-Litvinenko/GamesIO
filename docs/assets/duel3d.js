/* Дуэль — псевдо-3D гонка на двоих за одной клавиатурой.
   Экран поделён пополам: верхняя половина — первый игрок, нижняя — второй.
   Трасса одна на двоих, поэтому соперника видно впереди как настоящую цель,
   и его можно подрезать. Побеждает тот, кто первым пройдёт три круга. */
(function () {
  'use strict';

  const W = 640;
  const H = 480;
  const VIEW_H = H / 2;
  const MAX = 12500;
  const LAPS = 3;

  const T = {
    maxSpeed: MAX,
    accel: MAX / 4.6,
    brake: -MAX / 1.5,
    decel: -MAX / 6.5,
    offRoadDecel: -MAX / 2,
    offRoadLimit: MAX / 3.2,
    centrifugal: 0.38,
    steer: 2.4,
  };

  const PALETTE = {
    sky: ['#0b1120', '#3b1d5e'],
    sun: null,
    hills: ['#1e1b4b', '#151233'],
    ground: '#101a30',
    grass: ['#111c34', '#131f38'],
    rumble: ['#22d3ee', '#f472b6'],
    road: ['#1c2230', '#212838'],
    lane: '#64748b',
    fog: '#0b1120',
  };

  /* Машины игроков: одинаковый силуэт, разный цвет — чтобы не путаться */
  function racer(color, dark) {
    return {
      w: 96,
      h: 62,
      draw(ctx, extra) {
        const lean = (extra && extra.lean) || 0;
        ctx.save();
        ctx.translate(48, 62);
        ctx.rotate((lean * 3 * Math.PI) / 180);
        ctx.translate(-48, -62);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(48, 60, 44, 6, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 40, 16, 20);
        ctx.fillRect(80, 40, 16, 20);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(4, 50);
        ctx.lineTo(12, 24);
        ctx.lineTo(84, 24);
        ctx.lineTo(92, 50);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.fillRect(16, 6, 64, 20);
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(21, 9, 54, 14);
        ctx.fillStyle = color;
        ctx.fillRect(10, 34, 18, 7);
        ctx.fillRect(68, 34, 18, 7);
        ctx.restore();
      },
    };
  }
  Arcade.Sprites.duel_p1 = racer('#22d3ee', '#0e7490');
  Arcade.Sprites.duel_p2 = racer('#f472b6', '#9d174d');

  const CONTROLS = [
    { left: 'KeyA', right: 'KeyD', gas: 'KeyW', brake: 'KeyS' },
    { left: 'ArrowLeft', right: 'ArrowRight', gas: 'ArrowUp', brake: 'ArrowDown' },
  ];

  class Duel3D {
    constructor(g) {
      this.g = g;
      this.road = new Arcade.Road({
        width: W,
        height: VIEW_H,
        roadWidth: 2200,
        lanes: 3,
        cameraHeight: 1000,
        fieldOfView: 100,
        drawDistance: 150, // вдвое меньше обычного: рисуем дорогу дважды за кадр
        fogDensity: 6,
        palette: PALETTE,
      });
      const rnd = this.road.build(5150607, 12);
      this.road.decorate(rnd, ['pylon', 'billboard', 'sign'], 12);
      this.rnd = rnd;

      this.countdown = 3.6;
      this.winner = null;
      this.finishFlash = 0;

      this.players = [0, 1].map((i) => ({
        index: i,
        position: 0,
        playerX: i === 0 ? -0.45 : 0.45,
        speed: 0,
        lean: 0,
        lap: 1,
        distance: 0,
        crashCooldown: 0,
        sprite: i === 0 ? 'duel_p1' : 'duel_p2',
        color: i === 0 ? '#22d3ee' : '#f472b6',
      }));

      // Каждый игрок присутствует на трассе как объект — так соперник виден
      // в чужом виде и в него можно врезаться.
      for (const p of this.players) {
        p.car = { offset: p.playerX, z: 0, kind: p.sprite, speed: 0, segment: null, owner: p };
        this.placeCar(p.car);
      }
      this.syncInfo();
    }

    placeCar(car) {
      const seg = this.road.findSegment(car.z);
      if (car.segment === seg) return;
      if (car.segment) {
        const i = car.segment.cars.indexOf(car);
        if (i >= 0) car.segment.cars.splice(i, 1);
      }
      seg.cars.push(car);
      car.segment = seg;
    }

    syncInfo() {
      this.g.setInfo({
        p1: this.players[0].lap + '/' + LAPS,
        p2: this.players[1].lap + '/' + LAPS,
      });
    }

    /* ---------------- обновление ---------------- */

    update(dt) {
      if (this.countdown > 0) {
        this.countdown -= dt;
        return;
      }
      if (this.winner !== null) {
        this.finishFlash += dt;
        if (this.finishFlash > 1.6) {
          this.g.gameOver({
            won: true,
            message: Arcade.t('playerWins', { n: this.winner + 1 }),
          });
        }
        return;
      }

      for (const p of this.players) this.updatePlayer(p, dt);
      this.syncInfo();
    }

    updatePlayer(p, dt) {
      const road = this.road;
      const keys = CONTROLS[p.index];
      const g = this.g;
      const start = p.position;
      const seg = road.findSegment(p.position + road.playerZ);
      const speedPercent = p.speed / T.maxSpeed;
      const dx = dt * 2 * speedPercent;

      let steer = 0;
      if (g.rawHeld(keys.left)) steer = -1;
      else if (g.rawHeld(keys.right)) steer = 1;
      p.playerX += steer * dx * T.steer;
      p.lean += (steer - p.lean) * Math.min(1, dt * 6);

      if (g.rawHeld(keys.brake)) p.speed += T.brake * dt;
      else if (g.rawHeld(keys.gas)) p.speed += T.accel * dt;
      else p.speed += T.decel * dt;

      p.playerX -= dx * speedPercent * seg.curve * T.centrifugal;

      if (Math.abs(p.playerX) > 1 && p.speed > T.offRoadLimit) {
        p.speed += T.offRoadDecel * dt;
      }

      p.playerX = Arcade.roadClamp(p.playerX, -2.2, 2.2);
      p.speed = Arcade.roadClamp(p.speed, 0, T.maxSpeed);

      p.crashCooldown = Math.max(0, p.crashCooldown - dt);
      if (p.crashCooldown <= 0) this.checkCollisions(p, seg);

      p.position = (p.position + p.speed * dt) % road.trackLength;
      let travelled = p.position - start;
      if (travelled < 0) {
        travelled += road.trackLength;
        p.lap += 1;
        this.g.sfx('bonus');
        if (p.lap > LAPS) {
          p.lap = LAPS;
          this.winner = p.index;
          this.g.addScore(1000 + Math.round(p.distance / 100));
          this.g.sfx('fanfare');
          this.g.shake(12);
        }
      }
      p.distance += travelled;

      p.car.z = p.position;
      p.car.offset = p.playerX;
      p.car.speed = p.speed;
      this.placeCar(p.car);
    }

    checkCollisions(p, seg) {
      for (const car of seg.cars) {
        if (car.owner === p) continue;
        if (Math.abs(p.playerX - car.offset) >= 0.5) continue;
        if (p.speed <= car.speed) continue;
        p.speed = Math.min(p.speed, T.maxSpeed / 5);
        p.crashCooldown = 0.7;
        p.playerX += p.playerX > car.offset ? 0.35 : -0.35;
        this.g.sfx('crash');
        this.g.shake(10);
        return;
      }
      for (const sp of seg.sprites) {
        if (Math.abs(p.playerX - sp.offset) >= 0.9) continue;
        p.speed = Math.min(p.speed, T.maxSpeed / 6);
        p.crashCooldown = 0.8;
        this.g.sfx('crash');
        return;
      }
    }

    /* ---------------- отрисовка ---------------- */

    draw(ctx) {
      for (const p of this.players) {
        const view = { x: 0, y: p.index * VIEW_H, w: W, h: VIEW_H };
        this.road.render(ctx, {
          position: p.position,
          playerX: p.playerX,
          backdropOffset: p.position * 0.0016,
          view: view,
          skipCar: p.car,
        });
        this.drawCar(ctx, p, view);
        this.drawPanel(ctx, p, view);
      }

      // разделитель половин
      ctx.fillStyle = '#05060d';
      ctx.fillRect(0, VIEW_H - 2, W, 4);

      if (this.countdown > 0) this.drawCountdown(ctx);
      if (this.winner !== null) this.drawWinner(ctx);
    }

    drawCar(ctx, p, view) {
      const painter = Arcade.Sprites[p.sprite];
      const scale = 1.15; // половинка экрана всего 240px — машина не должна её забивать
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, view.w, view.h);
      ctx.clip();
      ctx.translate(
        W / 2 - (painter.w * scale) / 2 + p.lean * 6,
        view.y + view.h - painter.h * scale - 6
      );
      ctx.scale(scale, scale);
      painter.draw(ctx, { lean: p.lean });
      ctx.restore();
    }

    drawPanel(ctx, p, view) {
      const kmh = Math.round((p.speed / T.maxSpeed) * 320);
      ctx.save();
      ctx.fillStyle = 'rgba(5,6,13,0.8)';
      Arcade.roundRect(ctx, 10, view.y + 8, 168, 24, 8);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.fillRect(18, view.y + 14, 10, 10);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#e8edf7';
      ctx.fillText(
        Arcade.t('playerN', { n: p.index + 1 }) + '  ' + p.lap + '/' + LAPS + '  ' + kmh,
        34,
        view.y + 24
      );
      ctx.restore();
    }

    drawCountdown(ctx) {
      const n = Math.ceil(this.countdown - 0.6);
      const label = n > 0 ? String(n) : Arcade.t('go');
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 84px ui-monospace, Menlo, monospace';
      ctx.fillStyle = n > 0 ? '#f8fafc' : '#4ade80';
      ctx.fillText(label, W / 2, H / 2);
      ctx.restore();
    }

    drawWinner(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(5,6,13,0.72)';
      ctx.fillRect(0, H / 2 - 46, W, 92);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 34px ui-monospace, Menlo, monospace';
      ctx.fillStyle = this.players[this.winner].color;
      ctx.fillText(Arcade.t('playerWins', { n: this.winner + 1 }), W / 2, H / 2);
      ctx.restore();
    }
  }

  Arcade.register({
    id: 'duel3d',
    width: W,
    height: H,
    create: (g) => new Duel3D(g),
    // На витрине оба болида ведут себя как боты, чтобы карточка показывала гонку
    autopilot(d) {
      d.countdown = Math.min(d.countdown, 0);
      for (const p of d.players) {
        const seg = d.road.findSegment(p.position + d.road.playerZ);
        let target = -seg.curve * 0.07 + (p.index === 0 ? -0.2 : 0.2);
        for (let i = 0; i < 12; i++) {
          const s = d.road.segments[(seg.index + i) % d.road.segments.length];
          for (const car of s.cars) {
            if (car.owner === p) continue;
            if (Math.abs(car.offset - p.playerX) < 0.6) target = car.offset > 0 ? -0.6 : 0.6;
          }
        }
        p.playerX += Arcade.roadClamp(target - p.playerX, -0.035, 0.035);
        p.speed = Math.min(T.maxSpeed * (0.72 + p.index * 0.06), p.speed + T.accel * 0.02);
        if (p.lap >= LAPS) p.lap = 1;
      }
      d.winner = null;
    },
  });
})();
