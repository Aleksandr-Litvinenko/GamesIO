/* Реальные тачки — псевдо-3D гонка в духе OutRun.
   Машина тяжелее байка: медленнее руль, но и сносит слабее, а трасса шире —
   четыре полосы, пальмы и берег вместо горного заката. */
(function () {
  'use strict';

  const W = 640;
  const H = 400;
  const MAX = 13500;

  const CFG = {
    width: W,
    height: H,
    seed: 771402,
    pieces: 18,
    accent: '#fbbf24',
    palette: {
      sky: ['#0e7490', '#7dd3fc'],
      sun: '#fef3c7',
      hills: ['#0c4a6e', '#075985'],
      ground: '#d0b78a',
      grass: ['#d2b98c', '#cdb486'],
      rumble: ['#f8fafc', '#ea580c'],
      road: ['#40454d', '#484d56'],
      lane: '#f8fafc',
      fog: '#7dd3fc',
    },
    road: {
      roadWidth: 2400,
      lanes: 4,
      cameraHeight: 1100,
      fieldOfView: 100,
      drawDistance: 220,
      fogDensity: 4,
    },
    decor: ['palm', 'billboard', 'sign', 'pylon'],
    decorDensity: 9,
    traffic: ['car_red', 'car_blue', 'car_yellow', 'car_white', 'truck'],
    trafficCount: 30,
    playerSprite: 'car_player',
    playerScale: 1.9,
    topKmh: 340,
    startTime: 45,
    checkpointBonus: 12, // раньше 24 — времени копилось столько,
    // что таймер переставал быть ограничением и гонка теряла смысл
    checkpointEvery: 0.2,
    tuning: {
      maxSpeed: MAX,
      accel: MAX / 5,
      brake: -MAX / 1.5,
      decel: -MAX / 7,
      offRoadDecel: -MAX / 2.2,
      offRoadLimit: MAX / 3,
      centrifugal: 0.34,
      steer: 2.1,
    },
  };

  // Машина игрока — вид сзади, с креном кузова в повороте
  Arcade.Sprites.car_player = {
    w: 96,
    h: 62,
    draw(ctx, extra) {
      const lean = (extra && extra.lean) || 0;
      ctx.save();
      ctx.translate(48, 62);
      ctx.rotate((lean * 3 * Math.PI) / 180);
      ctx.translate(-48, -62);

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(48, 60, 44, 6, 0, 0, 7);
      ctx.fill();

      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 40, 16, 20);
      ctx.fillRect(80, 40, 16, 20);

      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.moveTo(4, 50);
      ctx.lineTo(12, 24);
      ctx.lineTo(84, 24);
      ctx.lineTo(92, 50);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#be123c';
      ctx.fillRect(16, 6, 64, 20);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(21, 9, 54, 14);
      // отражение в стекле
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(21, 9, 54, 5);

      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(10, 34, 18, 8);
      ctx.fillRect(68, 34, 18, 8);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(38, 44, 20, 6); // номерной знак
      ctx.restore();

      // след от шин на скорости
      if (extra && extra.drift > 0.4) {
        ctx.fillStyle = 'rgba(226,232,240,0.25)';
        ctx.fillRect(6, 58, 12, 4);
        ctx.fillRect(78, 58, 12, 4);
      }
    },
  };

  class Cars3D extends Arcade.Racer {
    constructor(g) {
      super(g, CFG);
    }

    drawPlayer(ctx) {
      const painter = Arcade.Sprites.car_player;
      const scale = CFG.playerScale;
      const bob = Math.sin(this.position * 0.015) * (this.speed / MAX) * 1.5;
      ctx.save();
      ctx.translate(
        W / 2 - (painter.w * scale) / 2 + this.lean * 8,
        H - painter.h * scale - 10 + bob
      );
      ctx.scale(scale, scale);
      painter.draw(ctx, { lean: this.lean, drift: Math.abs(this.lean) * (this.speed / MAX) });
      ctx.restore();
    }
  }

  Arcade.register({
    id: 'cars3d',
    width: W,
    height: H,
    create: (g) => new Cars3D(g),
    autopilot: Arcade.Racer.autopilot,
  });
})();
