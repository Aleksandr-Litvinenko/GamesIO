# GamesIO

Сервис мини-игр, который целиком работает в браузере: ни сборки, ни зависимостей,
ни бэкенда. Витрина показывает каждую игру в «режиме аттракта» — настоящая игра
крутится в карточке под управлением автопилота.

| Игра | Что это | Управление |
|---|---|---|
| 🧱 Арканоид | 5 уровней, бонусы, мультимяч, кирпичи разной прочности | ← → или мышь, пробел — запуск мяча |
| 🐍 Змейка | сетка 20×20, ускорение по мере роста, золотое яблоко на таймере | ← ↑ → ↓ / WASD / свайп |
| 🏍️ Мотоциклы | световые мотоциклы против трёх ботов, раунды, буст | ← ↑ → ↓ / WASD, Shift — буст, тап слева/справа |

Пауза — `P` или `Esc`. Рекорды хранятся в `localStorage` браузера.

## Структура

```
index.html          витрина + экран игры
styles.css
js/engine.js        движок: цикл, ввод, звук, частицы, HUD, оверлеи, рекорды, превью
js/games/*.js       три игры, каждая — самостоятельный модуль
js/app.js           hash-роутер и витрина
build.js            сборка всего в один файл
```

Каждая игра регистрируется через `Arcade.register({...})` и получает от движка
объект-хост: размеры поля, ввод, частицы, звук, счёт. Чтобы добавить четвёртую
игру, достаточно положить файл в `js/games/`, подключить его в `index.html`
и добавить в список `SOURCES` в `build.js` — витрина подхватит её сама.

## Запуск локально

```bash
python3 -m http.server 4321
```

Открыть http://localhost:4321

## Сборка в один файл

```bash
node build.js
```

Появятся:

* `dist/index.html` — самодостаточная страница со всеми стилями и скриптами внутри;
* `dist/artifact.html` — то же самое без обёртки `<html>/<head>/<body>`.

## Публикация

**GitHub Pages.** Запушить репозиторий и включить Pages из корня ветки `main`
(Settings → Pages → Deploy from a branch → `main` / `/root`). Сайт — статика,
никакой сборки на CI не нужно.

```bash
git remote add origin git@github.com:USER/GamesIO.git
git push -u origin main
```

**Hugging Face Space.** Создать Space с SDK `static`, скопировать в него
`deploy/huggingface-README.md` под именем `README.md` и залить `dist/index.html`
как `index.html`:

```bash
hf auth login
hf repo create GamesIO --repo-type space --space_sdk static
git clone https://huggingface.co/spaces/USER/GamesIO hf-space
cp dist/index.html hf-space/index.html
cp deploy/huggingface-README.md hf-space/README.md
cd hf-space && git add -A && git commit -m "GamesIO" && git push
```

**Любой другой хостинг.** `dist/index.html` — один файл без внешних запросов,
его можно просто открыть с диска или положить куда угодно.
