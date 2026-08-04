// Одноразовый прогон боевого баланса арены. Удаляется после проверки.
import { register } from 'node:module';
register('data:text/javascript,export async function resolve(s,c,d){const r=await d(s,c);if(r.url.endsWith(".ts"))return r;return r}', import.meta.url);

const { buildArenaFighter, resolveArenaMatch, ARENA_CONFIG, calcBlobPower } =
  await import('./dist-sim/data.js');

function blob(level, upgrades = {}) {
  return {
    id: 'x', personality: 'cosmic', level, xp: 0,
    upgrades, branches: Object.keys(upgrades),
    mood: { level: 2, lastFed: 0, winsToday: 0, lossesToday: 0 },
    trait: null, isRadiant: false,
    totalExpeditions: 0, totalCubesEarned: 0, nodesHeld: [],
  };
}

const cases = [
  ['Lv5  чистый',          blob(5)],
  ['Lv12 Vigor3+Fero2',    blob(12, { vigor: 3, ferocity: 2 })],
  ['Lv12 Guard5',          blob(12, { guard: 5 })],
  ['Lv12 Fero5',           blob(12, { ferocity: 5 })],
  ['Lv20 Vigor5+Guard5',   blob(20, { vigor: 5, guard: 5 })],
];

console.log('=== Характеристики ===');
for (const [name, b] of cases) {
  const f = buildArenaFighter(b);
  console.log(
    `${name.padEnd(22)} Power=${String(calcBlobPower(b)).padStart(4)}  HP=${String(f.hp).padStart(5)}  ATK=${String(f.atk).padStart(4)}  crit=${(f.critChance*100).toFixed(0)}%  dbl=${(f.doubleChance*100).toFixed(0)}%`
  );
}

console.log('\n=== Длина дуэли и винрейт (1000 матчей) ===');
function trial(aBlob, bBlob) {
  let wins = 0, turns = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const A = [buildArenaFighter(aBlob), buildArenaFighter(aBlob), buildArenaFighter(aBlob)];
    const B = [buildArenaFighter(bBlob), buildArenaFighter(bBlob), buildArenaFighter(bBlob)];
    const r = resolveArenaMatch(A, B);
    if (r.playerWins >= 2) wins++;
    turns += r.log.length / ARENA_CONFIG.squadSize;
  }
  return { winrate: (wins / N * 100).toFixed(1), turns: (turns / N).toFixed(1) };
}

const pairs = [
  ['Lv12 Vigor3+Fero2', 'Lv12 Vigor3+Fero2', blob(12,{vigor:3,ferocity:2}), blob(12,{vigor:3,ferocity:2})],
  ['Lv12 Fero5',        'Lv12 Guard5',       blob(12,{ferocity:5}),         blob(12,{guard:5})],
  ['Lv20 Vigor5+Guard5','Lv12 Vigor3+Fero2', blob(20,{vigor:5,guard:5}),    blob(12,{vigor:3,ferocity:2})],
  ['Lv20 Vigor5+Guard5','Lv5  чистый',       blob(20,{vigor:5,guard:5}),    blob(5)],
  ['Lv12 Guard5',       'Lv12 Guard5',       blob(12,{guard:5}),            blob(12,{guard:5})],
];

for (const [an, bn, a, b] of pairs) {
  const { winrate, turns } = trial(a, b);
  console.log(`${an.padEnd(20)} vs ${bn.padEnd(20)} → winrate ${winrate.padStart(5)}%  ударов/дуэль ${turns}`);
}
