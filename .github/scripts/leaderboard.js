/* Собирает docs/data/leaderboard.json из issue с меткой «score».
 *
 * Результат приходит от клиента, поэтому доверять ему нельзя: здесь стоят
 * потолок правдоподобия по каждой игре и ограничение «один результат на
 * игрока в игре». Это не защита от целенаправленного накрутчика — от него
 * без сервера защититься невозможно, — а фильтр от случайного мусора.
 */
const MAX_SCORE = {
  arkanoid: 500000,
  snake: 100000,
  moto: 500000,
  moto3d: 300000,
  cars3d: 300000,
  duel3d: 100000,
  planes: 1000000,
};

const TOP = 25;
const OUT = 'docs/data/leaderboard.json';

// Из тела issue нас интересует только блок yaml с двумя полями
function parseBody(body) {
  if (!body) return null;
  const game = /^\s*game:\s*([a-z0-9_-]{1,32})\s*$/im.exec(body);
  const score = /^\s*score:\s*(\d{1,9})\s*$/im.exec(body);
  if (!game || !score) return null;
  return { game: game[1], score: parseInt(score[1], 10) };
}

module.exports = async ({ github, context, core, fs }) => {
  const { owner, repo } = context.repo;

  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    labels: 'score',
    state: 'all',
    per_page: 100,
  });

  const games = {};
  let considered = 0;
  let rejected = 0;

  for (const issue of issues) {
    if (issue.pull_request) continue;
    // закрытый как «not planned» = отклонён вручную модератором
    if (issue.state === 'closed' && issue.state_reason === 'not_planned') continue;

    const parsed = parseBody(issue.body);
    if (!parsed) {
      rejected++;
      continue;
    }
    const cap = MAX_SCORE[parsed.game];
    if (!cap) {
      rejected++;
      continue;
    }
    if (!Number.isFinite(parsed.score) || parsed.score <= 0 || parsed.score > cap) {
      rejected++;
      continue;
    }
    considered++;

    const user = issue.user || {};
    const entry = {
      name: user.login || 'anonymous',
      score: parsed.score,
      avatar: user.avatar_url ? user.avatar_url + '&s=40' : null,
      at: (issue.created_at || '').slice(0, 10),
      issue: issue.number,
    };

    const list = (games[parsed.game] = games[parsed.game] || []);
    // одна строка на игрока: держим только его лучший результат
    const mine = list.findIndex((r) => r.name === entry.name);
    if (mine >= 0) {
      if (list[mine].score >= entry.score) continue;
      list.splice(mine, 1);
    }
    list.push(entry);
  }

  for (const id of Object.keys(games)) {
    games[id].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
    games[id] = games[id].slice(0, TOP);
  }

  const payload = { updated: new Date().toISOString(), games };
  fs.mkdirSync('docs/data', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');

  core.info(
    `issue с меткой score: ${issues.length}, принято: ${considered}, отклонено: ${rejected}`
  );
  for (const id of Object.keys(games)) {
    core.info(`  ${id}: ${games[id].length} строк, лучший ${games[id][0].score}`);
  }
};
