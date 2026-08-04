/* Рисует обложки 1200×630 для og:image прямо в канвасе.
   Используется скриптом tools/make-og.js: он открывает страницу сайта,
   выполняет этот код и сохраняет результат в docs/og/. */
window.renderOg = function (opts) {
  const W = 1200;
  const H = 630;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const accent = opts.accent || '#22d3ee';

  // Заливки намеренно плоские: градиенты и построчная развёртка раздувают
  // PNG до сотен килобайт, а соцсети такие обложки грузят медленно.
  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, W, H);

  // сетка арены
  ctx.strokeStyle = 'rgba(148,163,184,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 60) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();

  // акцентная полоса вместо мягкого свечения
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 12, H);

  const pad = 80;

  // марка
  ctx.font = '700 30px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e8edf7';
  ctx.fillText('Games', pad, 96);
  const w = ctx.measureText('Games').width;
  ctx.fillStyle = accent;
  ctx.fillText('IO', pad + w, 96);

  // эмодзи
  if (opts.emoji) {
    ctx.font = '120px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
    ctx.textAlign = 'right';
    ctx.fillText(opts.emoji, W - pad, 150);
  }

  // заголовок с лёгким расхождением цветов, как на сайте
  ctx.textAlign = 'left';
  const lines = opts.title.split('\n');
  let y = H / 2 - (lines.length - 1) * 34;
  ctx.font = '700 74px ui-monospace, Menlo, monospace';
  for (const line of lines) {
    ctx.fillStyle = 'rgba(244,114,182,0.55)';
    ctx.fillText(line, pad + 2, y);
    ctx.fillStyle = 'rgba(34,211,238,0.55)';
    ctx.fillText(line, pad - 2, y);
    ctx.fillStyle = '#f2f6ff';
    ctx.fillText(line, pad, y);
    y += 84;
  }

  // подпись
  ctx.font = '30px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3bd';
  ctx.fillText(opts.subtitle, pad, y + 18);

  // плашка снизу
  ctx.font = '600 24px ui-monospace, Menlo, monospace';
  const badge = opts.badge;
  const bw = ctx.measureText(badge).width + 44;
  const by = H - 96;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(pad, by, bw, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#04121a';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, pad + 22, by + 25);

  // рамка
  ctx.strokeStyle = 'rgba(148,163,184,0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  return cv.toDataURL('image/png');
};
