/* Псевдо-3D дорога — общий движок для гоночных игр.
 *
 * Тот же приём, на котором работали автоматы Sega восьмидесятых (Hang-On,
 * OutRun): настоящей трёхмерной сцены нет. Трасса нарезана на сегменты,
 * каждый сегмент проецируется на экран как трапеция, и рисуются они от
 * дальнего к ближнему. Повороты — это не геометрия, а сдвиг каждого
 * следующего сегмента вбок; холмы — сдвиг по высоте.
 */
(function () {
  'use strict';

  const SEGMENT_LENGTH = 200; // длина одного сегмента в мировых единицах
  const RUMBLE_LENGTH = 3; // сегментов на одну полосу «зебры» обочины

  const CURVE = { none: 0, easy: 2, medium: 4, hard: 6 };
  const HILL = { none: 0, low: 20, medium: 40, high: 60 };
  const LENGTH = { short: 25, medium: 50, long: 100 };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeIn = (a, b, p) => a + (b - a) * Math.pow(p, 2);
  const easeOut = (a, b, p) => a + (b - a) * (1 - Math.pow(1 - p, 2));
  const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

  /* Детерминированный генератор: одна и та же трасса при одном и том же seed */
  function mulberry(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Road {
    constructor(opts) {
      const o = opts || {};
      this.width = o.width || 640;
      this.height = o.height || 400;
      this.roadWidth = o.roadWidth || 2000;
      this.lanes = o.lanes || 3;
      this.cameraHeight = o.cameraHeight || 1000;
      this.fieldOfView = o.fieldOfView || 100;
      this.drawDistance = o.drawDistance || 220;
      this.fogDensity = o.fogDensity == null ? 5 : o.fogDensity;
      this.palette = o.palette;
      this.cameraDepth = 1 / Math.tan(((this.fieldOfView / 2) * Math.PI) / 180);
      this.playerZ = this.cameraHeight * this.cameraDepth;
      this.segments = [];
      this.trackLength = 0;
    }

    get segmentLength() {
      return SEGMENT_LENGTH;
    }

    /* ---------------- построение трассы ---------------- */

    lastY() {
      return this.segments.length === 0
        ? 0
        : this.segments[this.segments.length - 1].p2.world.y;
    }

    addSegment(curve, y) {
      const n = this.segments.length;
      this.segments.push({
        index: n,
        p1: { world: { y: this.lastY(), z: n * SEGMENT_LENGTH }, camera: {}, screen: {} },
        p2: { world: { y: y, z: (n + 1) * SEGMENT_LENGTH }, camera: {}, screen: {} },
        curve: curve,
        sprites: [],
        cars: [],
        looped: false,
        fog: 0,
        clip: 0,
        dark: Math.floor(n / RUMBLE_LENGTH) % 2 === 0,
      });
    }

    addRoad(enter, hold, leave, curve, y) {
      const startY = this.lastY();
      const endY = startY + y * SEGMENT_LENGTH;
      const total = enter + hold + leave;
      for (let i = 0; i < enter; i++) {
        this.addSegment(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
      }
      for (let i = 0; i < hold; i++) {
        this.addSegment(curve, easeInOut(startY, endY, (enter + i) / total));
      }
      for (let i = 0; i < leave; i++) {
        this.addSegment(
          easeInOut(curve, 0, i / leave),
          easeInOut(startY, endY, (enter + hold + i) / total)
        );
      }
    }

    /* Собирает трассу из случайных, но воспроизводимых кусков */
    build(seed, pieces) {
      this.segments = [];
      const rnd = mulberry(seed);
      const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
      const count = pieces || 14;

      this.addRoad(LENGTH.short, LENGTH.short, LENGTH.short, 0, 0); // стартовая прямая
      for (let i = 0; i < count; i++) {
        const kind = rnd();
        const len = pick([LENGTH.short, LENGTH.medium, LENGTH.long]);
        const dir = rnd() < 0.5 ? -1 : 1;
        if (kind < 0.28) {
          this.addRoad(len, len, len, 0, pick([HILL.low, HILL.medium, HILL.high]) * dir);
        } else if (kind < 0.75) {
          this.addRoad(len, len, len, pick([CURVE.easy, CURVE.medium, CURVE.hard]) * dir, 0);
        } else {
          this.addRoad(
            len,
            len,
            len,
            pick([CURVE.easy, CURVE.medium]) * dir,
            pick([HILL.low, HILL.medium]) * dir
          );
        }
      }
      // Замыкаем кольцо: последний сегмент должен вернуться на нулевую высоту,
      // иначе на стыке появится ступенька.
      const back = Math.max(1, Math.round(this.lastY() / SEGMENT_LENGTH / 3));
      this.addRoad(back, back, back, 0, -this.lastY() / SEGMENT_LENGTH);
      while (this.segments.length % RUMBLE_LENGTH !== 0) this.addSegment(0, this.lastY());

      this.trackLength = this.segments.length * SEGMENT_LENGTH;
      return rnd;
    }

    /* Расставляет придорожные объекты по обеим сторонам */
    decorate(rnd, kinds, density) {
      const step = density || 12;
      for (let n = 20; n < this.segments.length; n += step + Math.floor(rnd() * step)) {
        const side = rnd() < 0.5 ? -1 : 1;
        this.segments[n].sprites.push({
          kind: kinds[Math.floor(rnd() * kinds.length)],
          offset: side * (1.25 + rnd() * 1.6),
        });
      }
    }

    findSegment(z) {
      return this.segments[
        Math.floor(z / SEGMENT_LENGTH) % this.segments.length
      ];
    }

    /* ---------------- проекция и отрисовка ---------------- */

    project(p, cameraX, cameraY, cameraZ, width, height) {
      p.camera.x = (p.world.x || 0) - cameraX;
      p.camera.y = (p.world.y || 0) - cameraY;
      p.camera.z = (p.world.z || 0) - cameraZ;
      p.screen.scale = this.cameraDepth / p.camera.z;
      p.screen.x = Math.round(width / 2 + (p.screen.scale * p.camera.x * width) / 2);
      p.screen.y = Math.round(height / 2 - (p.screen.scale * p.camera.y * height) / 2);
      p.screen.w = Math.round((p.screen.scale * this.roadWidth * width) / 2);
    }

    /* Небо, солнце и дальние горы — рисуются один раз под дорогой */
    drawBackdrop(ctx, view, offset, hillShift) {
      const P = this.palette;
      const { x, y, w, h } = view;
      const horizon = y + h * 0.42 + hillShift;

      const sky = ctx.createLinearGradient(0, y, 0, horizon + 10);
      sky.addColorStop(0, P.sky[0]);
      sky.addColorStop(1, P.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(x, y, w, Math.max(0, horizon - y + 10));

      if (P.sun) {
        ctx.fillStyle = P.sun;
        ctx.beginPath();
        ctx.arc(x + w * 0.72, horizon - h * 0.14, h * 0.13, 0, 7);
        ctx.fill();
      }

      // два слоя холмов, сдвигаются с разной скоростью — простой параллакс
      for (let layer = 0; layer < 2; layer++) {
        const color = P.hills[layer];
        const amp = h * (layer ? 0.1 : 0.16);
        const speed = layer ? 0.5 : 0.22;
        const shift = -(offset * speed) % (w * 2);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, horizon);
        for (let i = 0; i <= 40; i++) {
          const px = x + (i / 40) * w;
          const t = (i / 40) * 6.4 + shift * 0.02 + layer * 2;
          ctx.lineTo(px, horizon - (Math.sin(t) * 0.5 + Math.sin(t * 2.3) * 0.5 + 1) * amp);
        }
        ctx.lineTo(x + w, horizon);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = P.ground;
      ctx.fillRect(x, horizon, w, y + h - horizon);
    }

    /* Основной проход: сегменты от дальнего к ближнему, затем спрайты обратно */
    render(ctx, o) {
      const P = this.palette;
      const view = o.view || { x: 0, y: 0, w: this.width, h: this.height };
      const W = view.w;
      const H = view.h;
      const position = o.position;
      const playerX = o.playerX;

      const baseSegment = this.findSegment(position);
      const basePercent = (position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
      const playerSegment = this.findSegment(position + this.playerZ);
      const playerPercent = ((position + this.playerZ) % SEGMENT_LENGTH) / SEGMENT_LENGTH;
      const playerY =
        playerSegment.p1.world.y +
        (playerSegment.p2.world.y - playerSegment.p1.world.y) * playerPercent;

      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, W, H);
      ctx.clip();

      this.drawBackdrop(ctx, view, o.backdropOffset || 0, clamp(playerY * 0.012, -H * 0.2, H * 0.2));

      let maxy = H;
      let x = 0;
      let dx = -(baseSegment.curve * basePercent);

      // дальний проход — сама дорога
      for (let n = 0; n < this.drawDistance; n++) {
        const seg = this.segments[(baseSegment.index + n) % this.segments.length];
        seg.looped = seg.index < baseSegment.index;
        seg.fog = this.fog(n / this.drawDistance);
        seg.clip = maxy;

        const camZ = position - (seg.looped ? this.trackLength : 0);
        this.project(seg.p1, playerX * this.roadWidth - x, playerY + this.cameraHeight, camZ, W, H);
        this.project(
          seg.p2,
          playerX * this.roadWidth - x - dx,
          playerY + this.cameraHeight,
          camZ,
          W,
          H
        );

        x += dx;
        dx += seg.curve;

        if (
          seg.p1.camera.z <= this.cameraDepth ||
          seg.p2.screen.y >= seg.p1.screen.y ||
          seg.p2.screen.y >= maxy
        )
          continue;

        this.drawSegment(ctx, view, seg);
        maxy = seg.p2.screen.y;
      }

      // ближний проход — спрайты поверх дороги, от дальних к ближним
      for (let n = this.drawDistance - 1; n > 0; n--) {
        const seg = this.segments[(baseSegment.index + n) % this.segments.length];
        if (!seg.p1.screen.scale) continue;

        for (const car of seg.cars) {
          // в разделённом экране игрок не должен видеть собственную машину
          // как спрайт на дороге — она рисуется отдельно, у нижнего края
          if (o.skipCar && o.skipCar === car) continue;
          const percent = (car.z % SEGMENT_LENGTH) / SEGMENT_LENGTH;
          const scale = seg.p1.screen.scale + (seg.p2.screen.scale - seg.p1.screen.scale) * percent;
          const sx = seg.p1.screen.x + (seg.p2.screen.x - seg.p1.screen.x) * percent;
          const sy = seg.p1.screen.y + (seg.p2.screen.y - seg.p1.screen.y) * percent;
          this.drawSprite(ctx, view, car.kind, scale, sx, sy, car.offset, seg.clip, seg.fog, car);
        }
        for (const sp of seg.sprites) {
          this.drawSprite(
            ctx,
            view,
            sp.kind,
            seg.p1.screen.scale,
            seg.p1.screen.x,
            seg.p1.screen.y,
            sp.offset,
            seg.clip,
            seg.fog
          );
        }
      }

      ctx.restore();
      return { playerY, playerSegment };
    }

    fog(distance) {
      return 1 - 1 / Math.exp(distance * distance * this.fogDensity);
    }

    drawSegment(ctx, view, seg) {
      const P = this.palette;
      const p1 = seg.p1.screen;
      const p2 = seg.p2.screen;
      const dark = seg.dark;
      const ox = view.x;
      const oy = view.y;

      // трава по всей ширине полосы экрана
      ctx.fillStyle = dark ? P.grass[0] : P.grass[1];
      ctx.fillRect(ox, oy + p2.y, view.w, p1.y - p2.y);

      const r1 = p1.w / Math.max(6, 3 * this.lanes);
      const r2 = p2.w / Math.max(6, 3 * this.lanes);
      const l1 = p1.w / Math.max(32, 10 * this.lanes);
      const l2 = p2.w / Math.max(32, 10 * this.lanes);

      // обочина
      const rumble = dark ? P.rumble[0] : P.rumble[1];
      this.poly(ctx, ox, oy, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, rumble);
      this.poly(ctx, ox, oy, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, rumble);

      // полотно
      this.poly(ctx, ox, oy, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, dark ? P.road[0] : P.road[1]);

      // разметка только на светлых сегментах — получается пунктир
      if (!dark && this.lanes > 1) {
        const lw1 = (p1.w * 2) / this.lanes;
        const lw2 = (p2.w * 2) / this.lanes;
        let lx1 = p1.x - p1.w + lw1;
        let lx2 = p2.x - p2.w + lw2;
        for (let lane = 1; lane < this.lanes; lane++) {
          this.poly(ctx, ox, oy, lx1 - l1, p1.y, lx1 + l1, p1.y, lx2 + l2, p2.y, lx2 - l2, p2.y, P.lane);
          lx1 += lw1;
          lx2 += lw2;
        }
      }

      if (seg.fog > 0.02) {
        ctx.globalAlpha = seg.fog;
        ctx.fillStyle = P.fog;
        ctx.fillRect(ox, oy + p2.y, view.w, p1.y - p2.y);
        ctx.globalAlpha = 1;
      }
    }

    poly(ctx, ox, oy, x1, y1, x2, y2, x3, y3, x4, y4, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ox + x1, oy + y1);
      ctx.lineTo(ox + x2, oy + y2);
      ctx.lineTo(ox + x3, oy + y3);
      ctx.lineTo(ox + x4, oy + y4);
      ctx.closePath();
      ctx.fill();
    }

    drawSprite(ctx, view, kind, scale, roadX, roadY, offset, clipY, fog, extra) {
      const painter = Arcade.Sprites[kind];
      if (!painter || !scale) return;
      // 3.6 подобрано на глаз: дерево у обочины должно быть заметно выше
      // машины, но не закрывать полдороги на ближнем плане
      const spriteScale = scale * view.w * 0.5;
      const w = painter.w * spriteScale * 3.6;
      const h = painter.h * spriteScale * 3.6;
      if (w < 0.8 || h < 0.8) return;

      const destX = view.x + roadX + spriteScale * offset * this.roadWidth - w / 2;
      const destY = view.y + roadY - h;
      const clip = clipY ? Math.max(0, view.y + roadY - (view.y + clipY)) : 0;
      if (clip >= h) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, view.w, view.h - (view.h - clipY));
      ctx.clip();
      ctx.translate(destX, destY);
      ctx.scale(w / painter.w, h / painter.h);
      painter.draw(ctx, extra);
      ctx.restore();

      if (fog > 0.02) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, fog);
        ctx.fillStyle = this.palette.fog;
        ctx.fillRect(destX, destY, w, h - clip);
        ctx.restore();
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Спрайты рисуются кодом: ни одной картинки в проекте.
   * Каждый описан в своей системе координат w×h, движок его масштабирует.
   * ------------------------------------------------------------------ */
  const S = (window.Arcade.Sprites = {});

  function sprite(name, w, h, draw) {
    S[name] = { w: w, h: h, draw: draw };
  }

  sprite('tree', 60, 90, (ctx) => {
    ctx.fillStyle = '#3f2d1d';
    ctx.fillRect(26, 58, 8, 32);
    ctx.fillStyle = '#1f6f3f';
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(56, 46);
    ctx.lineTo(4, 46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b8a52';
    ctx.beginPath();
    ctx.moveTo(30, 16);
    ctx.lineTo(52, 62);
    ctx.lineTo(8, 62);
    ctx.closePath();
    ctx.fill();
  });

  sprite('palm', 54, 110, (ctx) => {
    ctx.strokeStyle = '#6b4f2a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(27, 110);
    ctx.quadraticCurveTo(20, 60, 27, 30);
    ctx.stroke();
    ctx.fillStyle = '#1f7a4d';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      ctx.beginPath();
      ctx.moveTo(27, 30);
      ctx.quadraticCurveTo(27 + Math.cos(a) * 20, 30 + Math.sin(a) * 20, 27 + Math.cos(a) * 30, 34 + Math.sin(a) * 26);
      ctx.quadraticCurveTo(27 + Math.cos(a) * 18, 34 + Math.sin(a) * 10, 27, 30);
      ctx.fill();
    }
  });

  sprite('sign', 56, 60, (ctx) => {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(25, 26, 6, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(4, 4, 48, 26);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(8, 8, 40, 18);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(14, 15, 28, 4);
  });

  sprite('rock', 50, 34, (ctx) => {
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.moveTo(2, 34);
    ctx.lineTo(14, 8);
    ctx.lineTo(30, 2);
    ctx.lineTo(46, 20);
    ctx.lineTo(48, 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9aa3af';
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(30, 2);
    ctx.lineTo(32, 16);
    ctx.closePath();
    ctx.fill();
  });

  sprite('pylon', 34, 78, (ctx) => {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(14, 0, 6, 78);
    ctx.fillRect(2, 10, 30, 5);
    ctx.fillRect(6, 26, 22, 5);
  });

  sprite('billboard', 90, 70, (ctx) => {
    ctx.fillStyle = '#475569';
    ctx.fillRect(20, 40, 6, 30);
    ctx.fillRect(64, 40, 6, 30);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 90, 44);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(4, 4, 82, 36);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(12, 14, 66, 7);
    ctx.fillRect(12, 25, 40, 6);
  });

  /* Машины и мотоциклы — вид сзади. Цвет приходит из данных спрайта. */
  function carBody(ctx, c, dark, glass) {
    ctx.fillStyle = dark;
    ctx.fillRect(6, 44, 76, 12); // тень/днище
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(4, 44);
    ctx.lineTo(10, 22);
    ctx.lineTo(78, 22);
    ctx.lineTo(84, 44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c;
    ctx.fillRect(14, 8, 60, 18);
    ctx.fillStyle = glass;
    ctx.fillRect(19, 11, 50, 13);
    ctx.fillStyle = '#111827';
    ctx.fillRect(2, 40, 12, 16);
    ctx.fillRect(74, 40, 12, 16);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(10, 32, 14, 7);
    ctx.fillRect(64, 32, 14, 7);
  }

  sprite('car_red', 88, 58, (ctx) => carBody(ctx, '#dc2626', '#4c0519', '#1e293b'));
  sprite('car_blue', 88, 58, (ctx) => carBody(ctx, '#2563eb', '#0b1f4d', '#1e293b'));
  sprite('car_yellow', 88, 58, (ctx) => carBody(ctx, '#eab308', '#4a3609', '#1e293b'));
  sprite('car_white', 88, 58, (ctx) => carBody(ctx, '#e2e8f0', '#64748b', '#1e293b'));
  sprite('truck', 104, 84, (ctx) => {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(6, 66, 92, 18);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(6, 4, 92, 64);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(12, 10, 80, 52);
    ctx.fillStyle = '#111827';
    ctx.fillRect(2, 62, 14, 22);
    ctx.fillRect(88, 62, 14, 22);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(14, 70, 12, 6);
    ctx.fillRect(78, 70, 12, 6);
  });

  /* Мотоцикл сзади: колесо, выхлопы, седок с плечами и руками на руле.
     Крен идёт вокруг точки контакта колеса с дорогой, а не вокруг центра —
     иначе байк «подпрыгивает» при наклоне. */
  function bikeBody(ctx, c, riderColor, lean) {
    const tilt = (lean || 0) * 10;
    ctx.save();
    ctx.translate(30, 78);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.translate(-30, -78);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(30, 77, 20, 4, 0, 0, 7);
    ctx.fill();

    // мотоцикл шире седока — иначе силуэт читается как бегущий человек
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(22, 50, 16, 28); // заднее колесо
    ctx.fillStyle = '#475569';
    ctx.fillRect(25, 57, 10, 13); // диск

    ctx.fillStyle = '#cbd5e1'; // выхлопы по бокам
    ctx.fillRect(10, 56, 12, 7);
    ctx.fillRect(38, 56, 12, 7);

    ctx.fillStyle = c; // хвост
    ctx.beginPath();
    ctx.moveTo(17, 56);
    ctx.lineTo(43, 56);
    ctx.lineTo(39, 36);
    ctx.lineTo(21, 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(21, 36, 18, 4);

    ctx.fillStyle = '#ef4444'; // стоп-сигнал
    ctx.fillRect(25, 45, 10, 5);

    ctx.strokeStyle = '#1f2937'; // руль
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(13, 33);
    ctx.lineTo(47, 33);
    ctx.stroke();
    ctx.fillStyle = c; // зеркала
    ctx.fillRect(8, 28, 7, 4);
    ctx.fillRect(45, 28, 7, 4);

    ctx.strokeStyle = riderColor; // руки к рулю
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(23, 24);
    ctx.lineTo(15, 33);
    ctx.moveTo(37, 24);
    ctx.lineTo(45, 33);
    ctx.stroke();

    ctx.fillStyle = riderColor; // торс седока — узкий
    ctx.beginPath();
    ctx.moveTo(23, 40);
    ctx.lineTo(37, 40);
    ctx.lineTo(35, 20);
    ctx.lineTo(25, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(29, 20, 2, 20); // складка на спине

    ctx.fillStyle = riderColor; // плечи
    ctx.beginPath();
    ctx.moveTo(21, 26);
    ctx.lineTo(39, 26);
    ctx.lineTo(37, 17);
    ctx.lineTo(23, 17);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a'; // шлем
    ctx.beginPath();
    ctx.arc(30, 11, 8, 0, 7);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.fillRect(23, 9, 14, 3);

    ctx.restore();
  }

  sprite('bike_player', 60, 80, (ctx, extra) =>
    bikeBody(ctx, '#22d3ee', '#f8fafc', extra && extra.lean)
  );
  sprite('bike_rival', 60, 80, (ctx, extra) =>
    bikeBody(ctx, '#f472b6', '#1f2937', extra && extra.lean)
  );
  sprite('bike_rival2', 60, 80, (ctx, extra) =>
    bikeBody(ctx, '#fbbf24', '#1f2937', extra && extra.lean)
  );

  Arcade.Road = Road;
  Arcade.roadRandom = mulberry;
  Arcade.ROAD = { SEGMENT_LENGTH, RUMBLE_LENGTH, CURVE, HILL, LENGTH };
  Arcade.roadClamp = clamp;
})();
