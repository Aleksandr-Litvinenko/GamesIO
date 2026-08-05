/* Реальные мотоциклы — псевдо-3D гонка в духе Hang-On.
   Байк вертлявее машины: резче руль, сильнее снос в поворотах, выше разгон,
   но обочина наказывает жёстче. Закат и горы — как на автоматах 1985 года. */
(function () {
  'use strict';

  const W = 640;
  const H = 400;
  const MAX = 12000;

  const CFG = {
    width: W,
    height: H,
    seed: 20260804,
    pieces: 16,
    accent: '#22d3ee',
    palette: {
      sky: ['#2a1c53', '#f0766b'],
      sun: '#ffd166',
      hills: ['#3b2a63', '#26204a'],
      ground: '#213c2c',
      grass: ['#223f2b', '#25442f'],
      rumble: ['#e2e8f0', '#dc2626'],
      road: ['#3b3f46', '#42474f'],
      lane: '#e2e8f0',
      fog: '#2a1c53',
    },
    road: {
      roadWidth: 2000,
      lanes: 3,
      cameraHeight: 900,
      fieldOfView: 100,
      drawDistance: 210,
      fogDensity: 6,
    },
    decor: ['tree', 'sign', 'rock', 'billboard'],
    decorDensity: 10,
    traffic: ['car_red', 'car_blue', 'car_yellow', 'car_white', 'truck'],
    trafficCount: 24,
    playerSprite: 'bike_player',
    playerScale: 1.9,
    topKmh: 300,
    startTime: 42,
    checkpointBonus: 11, // раньше 22 — времени копилось столько,
    // что таймер переставал быть ограничением и гонка теряла смысл
    checkpointEvery: 0.2,
    tuning: {
      maxSpeed: MAX,
      accel: MAX / 4.2,
      brake: -MAX / 1.6,
      decel: -MAX / 6,
      offRoadDecel: -MAX / 1.8,
      offRoadLimit: MAX / 3.4,
      centrifugal: 0.42,
      steer: 2.6,
    },
  };

  class Moto3D extends Arcade.Racer {
    constructor(g) {
      super(g, CFG);
    }

    // Байк кренится всем корпусом, поэтому наклон рисуем сильнее, чем у машины
    drawPlayer(ctx) {
      const painter = Arcade.Sprites.bike_player;
      const scale = CFG.playerScale;
      const bob = Math.sin(this.position * 0.02) * (this.speed / MAX) * 2;
      ctx.save();
      ctx.translate(
        W / 2 - (painter.w * scale) / 2 + this.lean * 10,
        H - painter.h * scale - 12 + bob
      );
      ctx.scale(scale, scale);
      painter.draw(ctx, { lean: this.lean * 1.6 });
      ctx.restore();
    }
  }

  Arcade.register({
    id: 'moto3d',
    width: W,
    height: H,
    create: (g) => new Moto3D(g),
    autopilot: Arcade.Racer.autopilot,
  });
})();
