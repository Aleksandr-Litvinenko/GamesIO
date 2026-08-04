/* Рекламные слоты.
 *
 * Пока PUBLISHER_ID пуст, слоты остаются скрытыми и вёрстка их не резервирует —
 * сайт выглядит чисто и не получает штраф за пустые блоки. Чтобы включить
 * рекламу, достаточно вписать идентификатор площадки и номера блоков ниже:
 * ничего больше в проекте менять не нужно.
 *
 * Google AdSense:
 *   1. Подтвердите домен в AdSense и получите ca-pub-XXXXXXXXXXXXXXXX.
 *   2. Создайте три блока и подставьте их id в SLOTS.
 *   3. Пересоберите сайт (node build.js) и задеплойте.
 */
(function () {
  'use strict';

  const PUBLISHER_ID = ''; // например 'ca-pub-1234567890123456'

  const SLOTS = {
    top: '', // горизонтальный баннер над контентом
    side: '', // прямоугольник рядом с игрой (десктоп)
    bottom: '', // баннер в подвале
  };

  // Размеры зарезервированы заранее, чтобы блок не сдвигал вёрстку при загрузке.
  const SIZES = {
    top: { desktop: [728, 90], mobile: [320, 100] },
    side: { desktop: [300, 250], mobile: [300, 250] },
    bottom: { desktop: [728, 90], mobile: [320, 100] },
  };

  const nodes = Array.from(document.querySelectorAll('[data-ad]'));
  if (!nodes.length) return;

  if (!PUBLISHER_ID) {
    // Реклама не подключена — оставляем слоты скрытыми.
    window.GamesIOAds = { enabled: false, slots: SLOTS };
    return;
  }

  const isMobile = window.matchMedia('(max-width: 720px)').matches;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src =
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + PUBLISHER_ID;
  document.head.appendChild(script);

  for (const node of nodes) {
    const position = node.dataset.ad;
    const slotId = SLOTS[position];
    if (!slotId) continue;

    const size = SIZES[position][isMobile ? 'mobile' : 'desktop'];
    const box = node.querySelector('.ad-box');
    if (!box) continue;

    box.style.minHeight = size[1] + 'px';

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'inline-block';
    ins.style.width = size[0] + 'px';
    ins.style.height = size[1] + 'px';
    ins.setAttribute('data-ad-client', PUBLISHER_ID);
    ins.setAttribute('data-ad-slot', slotId);
    box.appendChild(ins);

    node.hidden = false;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }

  window.GamesIOAds = { enabled: true, slots: SLOTS };
})();
