/* Eigen Redis-client (server/redis.js), die het pakket `redis` verving. We
   starten een ECHTE redis-server op een vrije poort en toetsen: set/get,
   publish/subscribe, en kruisvalidatie met de nog geïnstalleerde npm-client
   (mijn publish -> npm ontvangt, en npm publish -> ik ontvang) zodat het
   wireprotocol echt klopt. Zonder redis-server worden de tests overgeslagen.
   Los: node --test test/redis.test.js */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const { spawnSync, spawn } = require('node:child_process');
const eigen = require('../server/redis');

const HEEFT_REDIS = spawnSync('sh', ['-c', 'command -v redis-server']).status === 0;
const wacht = ms => new Promise(r => setTimeout(r, ms));
function vrijePoort() {
  return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}

let server, POORT, URL;

before(async () => {
  if (!HEEFT_REDIS) return;
  POORT = await vrijePoort();
  URL = 'redis://127.0.0.1:' + POORT;
  server = spawn('redis-server', ['--port', String(POORT), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  /* WACHTEN TOT HIJ LUISTERT -- MET EEN DEADLINE, en dat is de plek waar het
     eerder vastliep.

     Deze lus staat in `before`, dus VOOR de eerste toets. Onder de mutatie die de
     RESP-ontleder van elk antwoord "onvolledig" laat zeggen, settelt
     `c.set('probe','1')` nooit -- en dan komt de suite niet verder dan
     "TAP version 13": geen enkele toets wordt geregistreerd, er is niets om rood
     te maken, en de motor noteert `vastgelopen`.

     Ik heb er eerst twee andere dingen aan gerepareerd (de quit in een finally, en
     deadlines in de toetsbodies) en die zijn allebei goed en allebei NIET de
     oorzaak: ze zitten in code die hier nooit werd bereikt. Dat verschil kwam
     alleen boven door de mutatie met de hand te draaien en naar de uitvoer te
     kijken in plaats van naar de uitslag. */
  /* DE GRENS OM DE HELE LUS EN NIET OM ELKE POGING, en dat verschil heeft me een
     ronde gekost. Eerst gaf ik elke poging 3 seconden; met zestig pogingen is dat
     drie minuten, dus de lus werd LANGZAMER in plaats van begrensd en de suite
     hing nog steeds. Een budget hoort te gaan over het geheel. */
  const EINDE = Date.now() + 8000;
  let praat = false;
  while (Date.now() < EINDE) {
    const c = eigen.createClient({ url: URL }); c.on('error', () => {});
    const rest = Math.max(200, EINDE - Date.now());
    try {
      await metDeadline(c.connect(), rest, 'probe connect');
      await metDeadline(c.set('probe', '1'), Math.max(200, EINDE - Date.now()), 'probe set');
      await sluit([c]);
      praat = true;
      break;
    } catch (e) { try { c.disconnect(); } catch (e2) { /* al weg */ } await wacht(100); }
  }
  /* EN HIJ GOOIT ALS HET NIET LUKT, hij slaat niet over. redis-server IS er (dat
     is de voorwaarde van HEEFT_REDIS), dus "ik kan er niet mee praten" is een
     BREUK en geen ontbrekende voorziening. Zou dit overslaan, dan meldde de
     mutatiemotor 'slaat zichzelf over' en dat is net zo stil als vastlopen: het
     gedrag is veranderd en niemand zegt het. */
  if (!praat) throw new Error('redis-server draait wel maar antwoordt niet binnen 8s -- ' +
    'de eigen client of het RESP-protocol is stuk. Dat is een breuk en geen reden om over te slaan.');
});
after(() => { if (server) try { server.kill('SIGKILL'); } catch (e) {} });

/* WAAROM DEZE TOETS EEN DEADLINE HEEFT, EN EEN FINALLY, EN WAAROM DAT TWEE
   VERSCHILLENDE LEKKEN ZIJN.

   Deze toets stond als `vastgelopen` in MUTATIES.json en als eerlijkheidspunt
   6.10: met een mutatie in server/redis.js kwam hij niet meer uit, en de motor
   telt dat NIET als gezakt -- het gedrag was echt veranderd maar geen assertie
   heeft het gemeld.

   Mijn eerste reparatie was de finally, want dat was de oorzaak bij
   test/mail-eigen.test.js (6.7): daar stond het opruimen achter een assertie en
   sprong een zakkende toets eroverheen. Die finally staat er nu ook, en hij is
   goed -- maar de mutatie bleef vastlopen. Nameten wees uit waarom: de mutatie
   maakt `if (eol === -1)` tot `if (eol !== -1)`, en dan meldt de RESP-ontleder van
   elk leesbaar antwoord dat het onvolledig is. Geen enkel commando krijgt nog een
   antwoord, dus `await c.set(...)` settelt nooit. De toets staat vast BINNEN de
   try, en daar komt een finally nooit aan te pas.

   Wat er dan moet gebeuren is niet opruimen maar een DEADLINE: een netwerkvraag
   die niet antwoordt hoort de toets te laten zakken met "geen antwoord binnen
   zoveel", niet eeuwig te wachten. Een toets die hangt kost een time-out en een
   schouderophalen; niemand leest daarna nog welke bewering het was.

   Twee lekken, twee reparaties, en de tweede was alleen te vinden door de eerste
   te proberen en de mutatie opnieuw te draaien.
*/
/* WAAROM DEZE TOETS EEN DEADLINE HEEFT, EN EEN FINALLY, EN WAAROM DAT TWEE
   VERSCHILLENDE LEKKEN ZIJN.

   Deze toets stond als `vastgelopen` in MUTATIES.json en als eerlijkheidspunt
   6.10: met een mutatie in server/redis.js kwam hij niet meer uit, en de motor
   telt dat NIET als gezakt -- het gedrag was echt veranderd maar geen assertie
   heeft het gemeld.

   Mijn eerste reparatie was de finally, want dat was de oorzaak bij
   test/mail-eigen.test.js (6.7): daar stond het opruimen achter een assertie en
   sprong een zakkende toets eroverheen. Die finally staat er nu ook, en hij is
   goed -- maar de mutatie bleef vastlopen. Nameten wees uit waarom: de mutatie
   maakt `if (eol === -1)` tot `if (eol !== -1)`, en dan meldt de RESP-ontleder van
   elk leesbaar antwoord dat het onvolledig is. Geen enkel commando krijgt nog een
   antwoord, dus `await c.set(...)` settelt nooit. De toets staat vast BINNEN de
   try, en daar komt een finally nooit aan te pas.

   Wat er dan moet gebeuren is niet opruimen maar een DEADLINE: een netwerkvraag
   die niet antwoordt hoort de toets te laten zakken met "geen antwoord binnen
   zoveel", niet eeuwig te wachten. Een toets die hangt kost een time-out en een
   schouderophalen; niemand leest daarna nog welke bewering het was.

   Twee lekken, twee reparaties, en de tweede was alleen te vinden door de eerste
   te proberen en de mutatie opnieuw te draaien.
*/
/* Een deadline om een belofte die nooit settelt. Geeft een gewone fout, dus de
   toets ZAKT met een leesbare reden in plaats van te blijven staan. */
function metDeadline(belofte, ms, wat) {
  let t = null;
  const klok = new Promise((_, af) => {
    t = setTimeout(() => af(new Error('geen antwoord binnen ' + ms + 'ms: ' + wat +
      ' -- een netwerkvraag die niet antwoordt hoort deze toets te laten zakken, niet te laten hangen')), ms);
  });
  return Promise.race([belofte, klok]).finally(() => clearTimeout(t));
}

/* Sluiten dat NOOIT zelf gooit: een finally die een fout opgooit, verdringt de
   assertie die de toets liet zakken -- en dan lees je de verkeerde oorzaak. */
async function sluit(clients) {
  for (const c of clients) {
    if (!c) continue;
    try { await c.quit(); } catch (e) { try { c.disconnect(); } catch (e2) { /* al weg */ } }
  }
}

test('set/get gaan over de eigen client', { skip: !HEEFT_REDIS }, async () => {
  const c = eigen.createClient({ url: URL }); c.on('error', () => {});
  try {
    await metDeadline(c.connect(), 8000, 'connect');
    assert.strictEqual(await metDeadline(c.set('rtg:test', 'hallo'), 8000, 'set'), 'OK');
    assert.strictEqual(await metDeadline(c.get('rtg:test'), 8000, 'get'), 'hallo');
    assert.strictEqual(await metDeadline(c.get('rtg:bestaat-niet'), 8000, 'get van niets'), null);
  } finally { await c.quit().catch(() => c.disconnect()); }
});

test('EVAL maakt een clusterbrede teller plus verval atomair', { skip: !HEEFT_REDIS }, async () => {
  const c = eigen.createClient({ url: URL }); c.on('error', () => {});
  const lua = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return n";
  const claim = "if redis.call('EXISTS',KEYS[1])==1 then return 0 end; redis.call('PSETEX',KEYS[1],ARGV[1],'1'); return 1";
  const basis = 'rtg:test:eval:' + Date.now();
  try {
    await metDeadline(c.connect(), 8000, 'eval connect');
    assert.strictEqual(await metDeadline(c.eval(lua, [basis + ':teller'], [5000]), 8000, 'eval een'), 1);
    assert.strictEqual(await metDeadline(c.eval(lua, [basis + ':teller'], [5000]), 8000, 'eval twee'), 2);
    assert.strictEqual(await metDeadline(c.eval(claim, [basis + ':claim'], [5000]), 8000, 'claim een'), 1);
    assert.strictEqual(await metDeadline(c.eval(claim, [basis + ':claim'], [5000]), 8000, 'claim replay'), 0);
  } finally { await c.quit().catch(() => c.disconnect()); }
});

test('publish/subscribe binnen de eigen client', { skip: !HEEFT_REDIS }, async () => {
  const sub = eigen.createClient({ url: URL }); sub.on('error', () => {});
  const pub = eigen.createClient({ url: URL }); pub.on('error', () => {});
  try {
    await metDeadline(sub.connect(), 8000, 'sub connect');
    await metDeadline(pub.connect(), 8000, 'pub connect');
    const ontvangen = [];
    await metDeadline(sub.subscribe('rtg:kanaal', m => ontvangen.push(m)), 8000, 'subscribe');
    await wacht(50);
    await pub.publish('rtg:kanaal', JSON.stringify({ hoi: 1 }));
    for (let i = 0; i < 50 && ontvangen.length === 0; i++) await wacht(20);
    assert.strictEqual(ontvangen.length, 1);
    assert.deepStrictEqual(JSON.parse(ontvangen[0]), { hoi: 1 });
  } finally { await sluit([sub, pub]); }
});

test('kruisvalidatie met de npm-client: beide kanten op', { skip: !HEEFT_REDIS }, async () => {
  let npm; try { npm = require('redis'); } catch (e) { return; } // npm-client (nog) niet aanwezig: overslaan
  const open = [];
  try {
  // mijn publish -> npm ontvangt
  const npmSub = npm.createClient({ url: URL }); npmSub.on('error', () => {}); open.push(npmSub);
  const mijnPub = eigen.createClient({ url: URL }); mijnPub.on('error', () => {}); open.push(mijnPub);
  await metDeadline(npmSub.connect(), 8000, 'npmSub connect');
  await metDeadline(mijnPub.connect(), 8000, 'mijnPub connect');
  const naarNpm = [];
  await npmSub.subscribe('kruis:a', m => naarNpm.push(m));
  await wacht(50);
  await mijnPub.publish('kruis:a', 'van-mij');
  for (let i = 0; i < 50 && naarNpm.length === 0; i++) await wacht(20);
  assert.deepStrictEqual(naarNpm, ['van-mij'], 'npm-client ontvangt wat mijn client publiceert');

  // npm publish -> mijn client ontvangt
  const mijnSub = eigen.createClient({ url: URL }); mijnSub.on('error', () => {}); open.push(mijnSub);
  const npmPub = npm.createClient({ url: URL }); npmPub.on('error', () => {}); open.push(npmPub);
  await metDeadline(mijnSub.connect(), 8000, 'mijnSub connect');
  await metDeadline(npmPub.connect(), 8000, 'npmPub connect');
  const naarMij = [];
  await mijnSub.subscribe('kruis:b', m => naarMij.push(m));
  await wacht(50);
  await npmPub.publish('kruis:b', 'van-npm');
  for (let i = 0; i < 50 && naarMij.length === 0; i++) await wacht(20);
  assert.deepStrictEqual(naarMij, ['van-npm'], 'mijn client ontvangt wat de npm-client publiceert');

  // en set via de een is leesbaar via de ander
  await metDeadline(npmPub.set('kruis:sleutel', 'gedeeld'), 8000, 'npm set');
  assert.strictEqual(await metDeadline(mijnPub.get('kruis:sleutel'), 8000, 'mijn get'), 'gedeeld');

  } finally {
    await sluit(open);
    await wacht(100); // sockets rustig laten sluiten voor de test eindigt
  }
});
