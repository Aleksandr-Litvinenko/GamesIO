/* Весь текст сайта и метаданные игр — единственный источник правды.
   Отсюда генератор собирает страницы, sitemap, llms.txt и games.json. */

const SITE = {
  name: 'GamesIO',
  // Основной адрес. Меняется в одном месте — попадает в canonical, og:url и sitemap.
  url: 'https://aleksandr-litvinenko.github.io/GamesIO',
  repo: 'https://github.com/Aleksandr-Litvinenko/GamesIO',
  author: 'Aleksandr Litvinenko',
  // Локали: ключ → префикс пути. Пустой префикс = корень сайта.
  locales: { en: '', ru: 'ru' },
  defaultLocale: 'en',
};

const UI = {
  ru: {
    lang: 'ru',
    localeTag: 'ru_RU',
    langName: 'Русский',
    tagline: 'мини-игры в браузере',
    siteTitle: 'GamesIO — мини-игры в браузере: арканоид, змейка, мотоциклы',
    siteDescription:
      'Три классические мини-игры прямо в браузере: арканоид, змейка и световые мотоциклы. Без регистрации, без установки, бесплатно. Работают на телефоне и компьютере.',
    heroEyebrow: 'Вставьте монету',
    heroTitle: 'Мини-игры,<br>которые открываются<br><em>за одну секунду</em>',
    heroText:
      'Ни установки, ни регистрации, ни загрузок. Каждый экран ниже — живая игра на автопилоте: нажмите, чтобы сесть за руль. Рекорды сохраняются прямо в браузере.',
    catalogTitle: 'Каталог игр',
    searchLabel: 'Поиск по играм',
    searchPlaceholder: 'Найти игру…',
    filterAll: 'Все',
    nothingFound: 'Ничего не нашлось. Попробуйте другое слово.',
    playCta: 'Играть',
    record: 'Рекорд',
    noRecord: 'Ещё не играли',
    demoMode: 'Демо-режим',
    home: 'Главная',
    games: 'Игры',
    howToPlay: 'Как играть',
    controls: 'Управление',
    tips: 'Советы',
    about: 'Об игре',
    faq: 'Частые вопросы',
    otherGames: 'Другие игры',
    backToCatalog: '← Все игры',
    restart: 'Заново',
    pause: 'Пауза',
    sound: 'Звук',
    footerAbout:
      'GamesIO — небольшой набор классических аркад, переписанных на чистом JavaScript. Открытый код, никаких трекеров, всё работает офлайн после первой загрузки.',
    footerLinks: 'Разделы',
    footerSource: 'Исходный код на GitHub',
    footerRights: 'Код открыт под лицензией MIT.',
    langSwitch: 'In English',
    adLabel: 'Реклама',
    playNow: 'Играть сейчас',
    freeOnline: 'Бесплатно, без регистрации',
    // Строки, которые движок и игры рисуют внутри канваса и оверлеев
    game: {
      score: 'Очки',
      best: 'Рекорд',
      lives: 'Жизни',
      level: 'Уровень',
      length: 'Длина',
      apples: 'Яблок',
      round: 'Раунд',
      play: 'Играть',
      resume: 'Продолжить',
      restart: 'Заново',
      again: 'Ещё раз',
      menu: 'В меню',
      paused: 'Пауза',
      gameOver: 'Игра окончена',
      victory: 'Победа!',
      newRecord: '🎉 Новый рекорд!',
      recordIs: 'Рекорд: {n}',
      launch: 'Пробел или тап — запуск',
      boost: 'БУСТ · SHIFT',
      roundClear: 'РАУНД ПРОЙДЕН',
      crashed: 'ТЫ РАЗБИЛСЯ',
      nextRoundFaster: 'Раунд {n} — быстрее',
      livesLeft: 'Осталось жизней: {n}',
      levelsCleared: 'Пройдено уровней: {n}',
      snakeLength: 'Длина змейки: {n}',
      roundsCleared: 'Пройдено раундов: {n}',
      perfectSnake: 'Поле заполнено — идеальная змейка!',
    },
  },
  en: {
    lang: 'en',
    localeTag: 'en_US',
    langName: 'English',
    tagline: 'mini-games in your browser',
    siteTitle: 'GamesIO — free browser mini-games: breakout, snake, light cycles',
    siteDescription:
      'Three classic mini-games right in your browser: breakout, snake and light cycles. No sign-up, no install, completely free. Works on phone and desktop.',
    heroEyebrow: 'Insert coin',
    heroTitle: 'Mini-games that open<br><em>in one second</em>',
    heroText:
      'No install, no sign-up, no downloads. Every screen below is a live game on autopilot — click one to take the wheel. High scores are saved right in your browser.',
    catalogTitle: 'Game catalogue',
    searchLabel: 'Search games',
    searchPlaceholder: 'Find a game…',
    filterAll: 'All',
    nothingFound: 'Nothing matched. Try another word.',
    playCta: 'Play',
    record: 'Best',
    noRecord: 'Not played yet',
    demoMode: 'Demo mode',
    home: 'Home',
    games: 'Games',
    howToPlay: 'How to play',
    controls: 'Controls',
    tips: 'Tips',
    about: 'About the game',
    faq: 'FAQ',
    otherGames: 'More games',
    backToCatalog: '← All games',
    restart: 'Restart',
    pause: 'Pause',
    sound: 'Sound',
    footerAbout:
      'GamesIO is a small set of classic arcade games rewritten in plain JavaScript. Open source, no trackers, and everything runs offline after the first load.',
    footerLinks: 'Sections',
    footerSource: 'Source code on GitHub',
    footerRights: 'Code released under the MIT licence.',
    langSwitch: 'По-русски',
    adLabel: 'Advertisement',
    playNow: 'Play now',
    freeOnline: 'Free, no sign-up',
    game: {
      score: 'Score',
      best: 'Best',
      lives: 'Lives',
      level: 'Level',
      length: 'Length',
      apples: 'Apples',
      round: 'Round',
      play: 'Play',
      resume: 'Resume',
      restart: 'Restart',
      again: 'Play again',
      menu: 'Back to games',
      paused: 'Paused',
      gameOver: 'Game over',
      victory: 'You win!',
      newRecord: '🎉 New best score!',
      recordIs: 'Best: {n}',
      launch: 'Space or tap to launch',
      boost: 'BOOST · SHIFT',
      roundClear: 'ROUND CLEARED',
      crashed: 'YOU CRASHED',
      nextRoundFaster: 'Round {n} — faster',
      livesLeft: 'Lives left: {n}',
      levelsCleared: 'Levels cleared: {n}',
      snakeLength: 'Snake length: {n}',
      roundsCleared: 'Rounds cleared: {n}',
      perfectSnake: 'Grid filled — a perfect snake!',
    },
  },
};

const CATEGORIES = {
  ru: { arcade: 'Аркада', classic: 'Классика', versus: 'Против ботов', retro: 'Ретро' },
  en: { arcade: 'Arcade', classic: 'Classic', versus: 'Versus bots', retro: 'Retro' },
};

const GAMES = [
  {
    id: 'arkanoid',
    emoji: '🧱',
    accent: '#22d3ee',
    categories: ['arcade', 'classic', 'retro'],
    released: '2026-08-04',
    ru: {
      title: 'Арканоид',
      slug: 'arkanoid',
      short: 'Разбей все кирпичи, лови бонусы и не теряй мяч.',
      metaTitle: 'Арканоид — играть онлайн бесплатно, без регистрации | GamesIO',
      metaDescription:
        'Классический арканоид в браузере: 5 уровней, пять видов бонусов, мультимяч и неразрушимые блоки. Управление мышью или стрелками, работает на телефоне. Играть бесплатно.',
      keywords: ['арканоид', 'арканоид играть', 'breakout онлайн', 'игра в кирпичики', 'арканоид бесплатно'],
      about: [
        'Арканоид родился в 1986 году как развитие Breakout: к простой связке «платформа и мяч» добавили бонусы, разные типы блоков и уровни со своим рисунком. Эта версия следует той же логике — вы отбиваете мяч платформой и выбиваете кирпичную стену, но каждый уровень требует своей траектории.',
        'Главный приём — угол отскока. Мяч уходит от платформы тем круче, чем дальше от центра вы его приняли: центр отправляет почти вертикально, край — почти горизонтально. Именно так пробивают проход к верхнему ряду и оставляют мяч работать под потолком, где он выбивает по несколько кирпичей за один заход.',
      ],
      controls: [
        '<kbd>←</kbd> <kbd>→</kbd> или мышь — двигать платформу',
        '<kbd>Пробел</kbd> или тап по экрану — запустить мяч',
        '<kbd>P</kbd> или <kbd>Esc</kbd> — пауза',
      ],
      tips: [
        'Принимайте мяч краем платформы, когда нужен резкий угол, и центром — когда хотите вернуть его строго вверх.',
        'Зелёный бонус <b>E</b> расширяет платформу, красный <b>S</b> сужает: под красный лучше не подставляться специально.',
        'Бонус <b>M</b> делит мяч на несколько — самый быстрый способ дочистить уровень, но следить придётся за всеми сразу.',
        'Серые блоки не разбиваются никогда. Считайте их частью стен и стройте траекторию вокруг.',
        'За каждый пройденный уровень дают 200 очков плюс 60 за каждую оставшуюся жизнь — рисковать ради бонуса не всегда выгодно.',
      ],
      faq: [
        {
          q: 'Сколько в игре уровней?',
          a: 'Пять разных раскладок, после чего они повторяются по кругу, но скорость мяча каждый раз растёт. Формально игра бесконечная — предел ставит только реакция.',
        },
        {
          q: 'Что делают падающие бонусы?',
          a: 'E расширяет платформу, S сужает, M делит мяч, L даёт дополнительную жизнь, W замедляет мяч на восемь секунд. Любой пойманный бонус приносит ещё 50 очков.',
        },
        {
          q: 'Можно ли играть с телефона?',
          a: 'Да. Платформа следует за пальцем, а тап по экрану запускает мяч. Отдельная раскладка кнопок не нужна.',
        },
        {
          q: 'Игра сохраняет прогресс?',
          a: 'Сохраняется рекорд — он лежит в localStorage вашего браузера и никуда не отправляется. Текущая партия при закрытии вкладки теряется.',
        },
      ],
    },
    en: {
      title: 'Breakout',
      slug: 'breakout',
      short: 'Clear every brick, catch power-ups and never drop the ball.',
      metaTitle: 'Breakout — play online free, no sign-up | GamesIO',
      metaDescription:
        'Classic breakout in your browser: 5 levels, five power-up types, multiball and indestructible blocks. Mouse or arrow keys, works on mobile. Play free.',
      keywords: ['breakout game', 'play breakout online', 'arkanoid online', 'brick breaker', 'free breakout'],
      about: [
        'Breakout arrived in 1976 and Arkanoid refined it a decade later by adding power-ups, block types and levels with their own shapes. This version follows the same idea: you bounce a ball off a paddle to demolish a brick wall, and each layout asks for a different angle of attack.',
        'The core skill is controlling the bounce. The ball leaves the paddle at a sharper angle the further from the centre you catch it — the middle sends it almost straight up, the edge sends it nearly sideways. That is how you carve a tunnel to the top row and leave the ball working under the ceiling, clearing several bricks per pass.',
      ],
      controls: [
        '<kbd>←</kbd> <kbd>→</kbd> or mouse — move the paddle',
        '<kbd>Space</kbd> or tap the screen — launch the ball',
        '<kbd>P</kbd> or <kbd>Esc</kbd> — pause',
      ],
      tips: [
        'Catch the ball on the edge of the paddle for a sharp angle, and in the centre when you want it straight back up.',
        'The green <b>E</b> power-up widens the paddle and the red <b>S</b> shrinks it — never chase the red one on purpose.',
        'The <b>M</b> power-up splits the ball into several. It is the fastest way to finish a level, but you have to track all of them.',
        'Grey blocks never break. Treat them as walls and plan your angles around them.',
        'Clearing a level pays 200 points plus 60 per remaining life, so a risky power-up grab is not always worth it.',
      ],
      faq: [
        {
          q: 'How many levels are there?',
          a: 'Five distinct layouts that then repeat, with the ball speeding up on every loop. In practice the game is endless — only your reflexes cap the score.',
        },
        {
          q: 'What do the falling power-ups do?',
          a: 'E widens the paddle, S shrinks it, M splits the ball, L grants an extra life, and W slows the ball for eight seconds. Any caught power-up is also worth 50 points.',
        },
        {
          q: 'Can I play on a phone?',
          a: 'Yes. The paddle follows your finger and a tap launches the ball, so no on-screen buttons are needed.',
        },
        {
          q: 'Does the game save progress?',
          a: 'Your best score is saved in your browser via localStorage and is never uploaded anywhere. The current run is lost when you close the tab.',
        },
      ],
    },
  },
  {
    id: 'snake',
    emoji: '🐍',
    accent: '#4ade80',
    categories: ['arcade', 'classic', 'retro'],
    released: '2026-08-04',
    ru: {
      title: 'Змейка',
      slug: 'zmeyka',
      short: 'Ешь яблоки, расти и не врезайся в себя. Золотое яблоко даёт +50.',
      metaTitle: 'Змейка — играть онлайн бесплатно, классическая игра | GamesIO',
      metaDescription:
        'Классическая змейка в браузере на поле 20×20: плавное движение, ускорение по мере роста и золотое яблоко на таймере. Стрелки, WASD или свайпы. Играть бесплатно.',
      keywords: ['змейка', 'змейка играть', 'игра змейка онлайн', 'snake игра', 'змейка бесплатно'],
      about: [
        'Змейка стала массовой в 1997 году вместе с Nokia 6110, хотя сама идея старше на два десятилетия. Правила не изменились: змея ползёт вперёд без остановки, каждое съеденное яблоко удлиняет её, а собственный хвост со временем превращается в главную опасность.',
        'Эта версия идёт на поле 20×20 со скоростью, которая растёт с каждым яблоком — от 0,145 секунды на клетку до 0,058. Раз в пять яблок появляется золотое: оно стоит 50 очков вместо 10 и живёт всего шесть с половиной секунд, так что за ним приходится идти на риск.',
      ],
      controls: [
        '<kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> или <kbd>WASD</kbd> — поворот',
        'Свайп в любую сторону — поворот на телефоне',
        '<kbd>P</kbd> или <kbd>Esc</kbd> — пауза',
      ],
      tips: [
        'Ходите вдоль стен и складывайте тело плотными рядами — так в центре остаётся место для манёвра.',
        'Повороты можно ставить в очередь: два быстрых нажатия подряд не потеряются, змейка выполнит оба.',
        'Золотое яблоко мигает за две секунды до исчезновения. Если к этому моменту вы не рядом — не идите за ним.',
        'Никогда не заходите в тупик, из которого нет выхода длиной больше вашего тела: развернуться на 180° нельзя.',
        'Чем длиннее змейка, тем быстрее она ползёт. Планируйте маршрут на пару ходов вперёд, а не по одному.',
      ],
      faq: [
        {
          q: 'Змейка проходит сквозь стены?',
          a: 'Нет, это классический вариант: удар о стену или о собственный хвост заканчивает партию.',
        },
        {
          q: 'Зачем нужно золотое яблоко?',
          a: 'Оно даёт 50 очков вместо обычных 10 и появляется после каждого пятого съеденного яблока. Но живёт всего 6,5 секунды и исчезает.',
        },
        {
          q: 'Игра ускоряется?',
          a: 'Да, каждое яблоко немного сокращает время хода — от 0,145 до 0,058 секунды на клетку. К пятидесятому яблоку темп становится заметно жёстче.',
        },
        {
          q: 'Какой максимальный счёт?',
          a: 'Поле 20×20, то есть 400 клеток. Если заполнить его целиком, игра засчитывает победу — но на практике это почти недостижимо.',
        },
      ],
    },
    en: {
      title: 'Snake',
      slug: 'snake',
      short: 'Eat apples, grow longer and never bite yourself. Golden apples pay +50.',
      metaTitle: 'Snake — play the classic game online free | GamesIO',
      metaDescription:
        'Classic snake in your browser on a 20×20 grid: smooth movement, speed that ramps as you grow, and a timed golden apple. Arrows, WASD or swipes. Play free.',
      keywords: ['snake game', 'play snake online', 'classic snake', 'snake game free', 'nokia snake'],
      about: [
        'Snake went mainstream in 1997 on the Nokia 6110, though the idea is two decades older. The rules never changed: the snake moves forward without stopping, every apple makes it longer, and your own tail eventually becomes the real hazard.',
        'This version runs on a 20×20 grid at a pace that tightens with every apple — from 0.145 seconds per cell down to 0.058. Every fifth apple spawns a golden one worth 50 points instead of 10, but it only lives six and a half seconds, so collecting it always costs you some risk.',
      ],
      controls: [
        '<kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> or <kbd>WASD</kbd> — turn',
        'Swipe in any direction — turn on mobile',
        '<kbd>P</kbd> or <kbd>Esc</kbd> — pause',
      ],
      tips: [
        'Hug the walls and stack your body in tight rows so the centre stays open for manoeuvring.',
        'Turns are queued: two quick presses in a row are both remembered, so fast double turns work.',
        'The golden apple blinks two seconds before it vanishes. If you are not close by then, let it go.',
        'Never enter a dead end shorter than your own body — you cannot turn 180 degrees to escape.',
        'The longer the snake, the faster it moves. Plan two moves ahead rather than one.',
      ],
      faq: [
        {
          q: 'Does the snake wrap around the walls?',
          a: 'No — this is the classic ruleset. Hitting a wall or your own tail ends the run.',
        },
        {
          q: 'What is the golden apple for?',
          a: 'It pays 50 points instead of the usual 10 and appears after every fifth apple eaten. It only lasts 6.5 seconds before disappearing.',
        },
        {
          q: 'Does the game get faster?',
          a: 'Yes. Each apple shortens the step time from 0.145 down to 0.058 seconds per cell, so by the fiftieth apple the pace is genuinely demanding.',
        },
        {
          q: 'What is the maximum score?',
          a: 'The grid is 20×20, so 400 cells. Filling it completely counts as a win, though in practice that is nearly unreachable.',
        },
      ],
    },
  },
  {
    id: 'moto',
    emoji: '🏍️',
    accent: '#a78bfa',
    categories: ['arcade', 'versus', 'retro'],
    released: '2026-08-04',
    ru: {
      title: 'Мотоциклы',
      slug: 'motocikly',
      short: 'Световые мотоциклы: оставляй стену за собой и переживи трёх ботов.',
      metaTitle: 'Мотоциклы (Tron) — играть онлайн против ботов бесплатно | GamesIO',
      metaDescription:
        'Световые мотоциклы в стиле Tron: вы против трёх ботов на арене 40×40. Стена за спиной, буст на Shift, раунды с ростом скорости. Играть в браузере бесплатно.',
      keywords: ['световые мотоциклы', 'трон игра', 'tron мотоциклы', 'игра мотоциклы онлайн', 'змейка против ботов'],
      about: [
        'Жанр вырос из фильма «Трон» 1982 года: мотоцикл едет без остановки и оставляет за собой сплошную световую стену. Проигрывает тот, кто первым в такую стену врежется — свою, чужую или границу арены. Здесь вы выходите на поле 40×40 против трёх ботов сразу.',
        'Боты не ездят по скрипту: перед каждым ходом каждый из них считает длину свободного коридора впереди и объём доступной области с трёх сторон, а если вы оказались рядом — сознательно подрезает. Поэтому одна и та же тактика дважды не сработает, а раунд обычно решается за 20–25 секунд.',
      ],
      controls: [
        '<kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> или <kbd>WASD</kbd> — поворот',
        '<kbd>Shift</kbd> — буст, тратит энергию из шкалы внизу',
        'Тап по левой или правой половине экрана — поворот на телефоне',
        '<kbd>P</kbd> или <kbd>Esc</kbd> — пауза',
      ],
      tips: [
        'Не рвитесь в центр на старте. Тесная спираль вдоль своей половины арены экономит место, которое понадобится в конце раунда.',
        'Буст — не для скорости, а для отрезания. Им удобно захлопнуть петлю раньше, чем бот успеет из неё выйти.',
        'Боты жадные до свободного места: если оставить им узкий коридор и широкий соблазн рядом, они сами загонят себя в тупик.',
        'Энергия буста восстанавливается примерно втрое медленнее, чем тратится. Держите запас на последние секунды раунда.',
        'За каждого разбившегося бота дают 150 очков, а за выигранный раунд — 500, умноженные на номер раунда. Дожить до пятого выгоднее, чем собрать все убийства в первом.',
      ],
      faq: [
        {
          q: 'Сколько ботов на арене?',
          a: 'Трое. Раунд считается выигранным, когда все три разбились, а вы остались живы.',
        },
        {
          q: 'Как работает буст?',
          a: 'Пока держите Shift, мотоцикл едет почти вдвое быстрее и тратит энергию из шкалы внизу экрана. Она восстанавливается сама, но медленно.',
        },
        {
          q: 'Игра становится сложнее?',
          a: 'Да, с каждым раундом шаг сокращается — от 0,075 до 0,04 секунды на клетку. У вас три жизни на всю партию.',
        },
        {
          q: 'Можно ли развернуться назад?',
          a: 'Нет. Поворот на 180 градусов заблокирован — это привело бы к мгновенному столкновению с собственной стеной.',
        },
      ],
    },
    en: {
      title: 'Light Cycles',
      slug: 'light-cycles',
      short: 'Tron-style light cycles: leave a wall behind you and outlast three bots.',
      metaTitle: 'Light Cycles (Tron) — play online against bots, free | GamesIO',
      metaDescription:
        'Tron-style light cycles: you against three bots on a 40×40 arena. Solid light wall behind you, Shift to boost, rounds that keep getting faster. Play free in your browser.',
      keywords: ['light cycles game', 'tron game online', 'light bike game', 'tron light cycle', 'snake vs bots'],
      about: [
        'The genre comes straight out of Tron (1982): the cycle never stops and leaves a solid wall of light behind it. Whoever hits a wall first — their own, someone else’s, or the arena edge — is out. Here you take a 40×40 arena against three bots at once.',
        'The bots do not follow a script. Before every move each one measures the length of the open corridor ahead and the amount of reachable space in three directions, and if you are close it will deliberately cut you off. The same trick rarely works twice, and a round usually resolves in 20–25 seconds.',
      ],
      controls: [
        '<kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> or <kbd>WASD</kbd> — turn',
        '<kbd>Shift</kbd> — boost, drains the energy bar at the bottom',
        'Tap the left or right half of the screen — turn on mobile',
        '<kbd>P</kbd> or <kbd>Esc</kbd> — pause',
      ],
      tips: [
        'Do not rush the centre at the start. A tight spiral in your own half banks the space you will need at the end of the round.',
        'Boost is for cutting off, not for speed. Use it to close a loop before a bot can escape it.',
        'Bots are greedy for open space: leave them a narrow corridor next to a tempting opening and they will trap themselves.',
        'Boost energy regenerates about three times slower than it drains, so keep a reserve for the final seconds.',
        'Each crashed bot pays 150 points and a won round pays 500 × the round number, so surviving to round five beats farming kills in round one.',
      ],
      faq: [
        {
          q: 'How many bots are on the arena?',
          a: 'Three. A round is won when all three have crashed and you are still riding.',
        },
        {
          q: 'How does the boost work?',
          a: 'Holding Shift moves your cycle almost twice as fast while draining the energy bar at the bottom. It refills on its own, but slowly.',
        },
        {
          q: 'Does the game get harder?',
          a: 'Yes — each round shortens the step from 0.075 down to 0.04 seconds per cell. You get three lives for the whole session.',
        },
        {
          q: 'Can I turn back on myself?',
          a: 'No. A 180-degree turn is blocked, since it would mean instantly crashing into your own wall.',
        },
      ],
    },
  },
];

module.exports = { SITE, UI, CATEGORIES, GAMES };
