/* Тайловая карта, физическое тело и камера — основа для сайд-скроллеров.

   Столкновения разрешаются по одной оси за раз: сначала двигаем тело по X и
   выталкиваем из стен, потом по Y. Это классический приём двумерных
   платформеров: он даёт предсказуемое поведение на углах и не позволяет
   провалиться сквозь пол на большой скорости. */
(function () {
  'use strict';

  const SOLID = '#';
  const PLATFORM = '='; // проходится снизу вверх, стоять можно только сверху

  class TileMap {
    constructor(rows, tile) {
      this.rows = rows;
      this.tile = tile;
      this.h = rows.length;
      this.w = Math.max(...rows.map((r) => r.length));
      this.pixelW = this.w * tile;
      this.pixelH = this.h * tile;
    }

    at(col, row) {
      if (row < 0 || row >= this.h) return ' ';
      const line = this.rows[row];
      if (col < 0 || col >= line.length) return ' ';
      return line[col];
    }

    set(col, row, ch) {
      if (row < 0 || row >= this.h) return;
      const line = this.rows[row];
      if (col < 0 || col >= line.length) return;
      this.rows[row] = line.slice(0, col) + ch + line.slice(col + 1);
    }

    isSolid(col, row) {
      return this.at(col, row) === SOLID;
    }
    isPlatform(col, row) {
      return this.at(col, row) === PLATFORM;
    }

    // Точка внутри стены? Нужно пулям и проверкам видимости
    solidAtPixel(x, y) {
      return this.isSolid(Math.floor(x / this.tile), Math.floor(y / this.tile));
    }
  }

  /* Прямоугольное тело с гравитацией */
  class Body {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
    }

    get cx() {
      return this.x + this.w / 2;
    }
    get cy() {
      return this.y + this.h / 2;
    }

    overlaps(o, pad) {
      const p = pad || 0;
      return (
        this.x < o.x + o.w + p &&
        this.x + this.w + p > o.x &&
        this.y < o.y + o.h + p &&
        this.y + this.h + p > o.y
      );
    }

    /* Двигает тело и выталкивает из стен. Возвращает, во что упёрлись. */
    move(map, dt) {
      const t = map.tile;
      const hit = { left: false, right: false, up: false, down: false };

      // --- ось X ---
      this.x += this.vx * dt;
      let c0 = Math.floor(this.x / t);
      let c1 = Math.floor((this.x + this.w - 1) / t);
      let r0 = Math.floor(this.y / t);
      let r1 = Math.floor((this.y + this.h - 1) / t);
      for (let r = r0; r <= r1; r++) {
        if (this.vx > 0 && map.isSolid(c1, r)) {
          this.x = c1 * t - this.w;
          this.vx = 0;
          hit.right = true;
          break;
        }
        if (this.vx < 0 && map.isSolid(c0, r)) {
          this.x = (c0 + 1) * t;
          this.vx = 0;
          hit.left = true;
          break;
        }
      }

      // --- ось Y ---
      const wasBottom = this.y + this.h;
      this.y += this.vy * dt;
      this.onGround = false;
      c0 = Math.floor(this.x / t);
      c1 = Math.floor((this.x + this.w - 1) / t);
      r0 = Math.floor(this.y / t);
      r1 = Math.floor((this.y + this.h - 1) / t);
      for (let c = c0; c <= c1; c++) {
        if (this.vy > 0) {
          const isFloor =
            map.isSolid(c, r1) ||
            // на платформу встаём, только если падали и были над ней
            (map.isPlatform(c, r1) && wasBottom <= r1 * t + 1);
          if (isFloor) {
            this.y = r1 * t - this.h;
            this.vy = 0;
            this.onGround = true;
            hit.down = true;
            break;
          }
        } else if (this.vy < 0 && map.isSolid(c, r0)) {
          this.y = (r0 + 1) * t;
          this.vy = 0;
          hit.up = true;
          break;
        }
      }
      return hit;
    }
  }

  /* Камера с мёртвой зоной: не дёргается от мелких движений игрока */
  class Camera {
    constructor(viewW, viewH) {
      this.x = 0;
      this.y = 0;
      this.viewW = viewW;
      this.viewH = viewH;
    }
    follow(target, map, dt, aheadX) {
      const wantX = target.cx - this.viewW / 2 + (aheadX || 0);
      const wantY = target.cy - this.viewH * 0.6;
      const k = Math.min(1, dt * 6);
      this.x += (wantX - this.x) * k;
      this.y += (wantY - this.y) * k;
      this.clamp(map);
    }
    snap(target, map, aheadX) {
      this.x = target.cx - this.viewW / 2 + (aheadX || 0);
      this.y = target.cy - this.viewH * 0.6;
      this.clamp(map);
    }
    clamp(map) {
      this.x = Arcade.clamp(this.x, 0, Math.max(0, map.pixelW - this.viewW));
      this.y = Arcade.clamp(this.y, 0, Math.max(0, map.pixelH - this.viewH));
    }
  }

  Arcade.TileMap = TileMap;
  Arcade.Body = Body;
  Arcade.Camera = Camera;
  Arcade.TILE = { SOLID, PLATFORM };
})();
