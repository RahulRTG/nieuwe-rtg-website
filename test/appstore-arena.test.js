/* DE ARENA VAN EEN APP -- een bord per app, met de 18+-poort van het huis.

   Wat deze toets vastlegt:

     1. Een gewoon lid bewaart NIETS: de 18+-poort staat standaard dicht, en de
        App Store is geen weg eromheen.
     2. Het bord van een app staat LOS van de ranglijsten van RTG zelf.
     3. De richting komt uit het MANIFEST: bij een tijd wint de laagste. Een app
        die de richting per aanroep zou meesturen, kan het bord omdraaien zodra
        hij verliest -- daarom staat hij niet in de argumenten.
     4. Een arena zonder de machtiging wordt bij het INZENDEN geweigerd: een veld
        dat nergens over gaat, is de duurste vorm van LAT-regel 6.
     5. Zonder de machtiging komt geen enkele arena-methode door de brug.
     6. De sleutel van een ander lid komt nooit mee -- alleen zijn codenaam.

   De leeftijdsgrens zelf (onder 18 speelt door, bewaart niets) wordt op zijn
   eigen plek getoetst: kern/spellen/grens.js is een gedeelde regel, en deze
   laag geeft hem alleen door. Wat hier telt is dat hij WORDT doorgegeven en dat
   het antwoord dan geen fout is -- zie toets 7.

   Draai los: node --test test/appstore-arena.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { lees } = require('../server/kern/appstore/manifest');
const { maakArena } = require('../server/kern/appstore/arena');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-arena-'));
let srv, base, lid, lid2, sup, office, tech;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const brug = (token, methode, args) => api('/api/appstore/brug', { sleutel: 'arena-proef', methode, args }, token);

const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Proef</title></head>' +
  '<body><p id="n">0</p><script src="app.js"></script></body></html>';
const JS = 'RTG.roep("arena.zet", { score: 10 });\n';

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Speler Een', email: 'a1@x.nl', phone: '0612340001',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  lid2 = (await api('/api/auth/register', { name: 'Speler Twee', email: 'a2@x.nl', phone: '0612340002',
    password: 'geheim123', geboortedatum: '1988-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
  await api('/api/techniek/tenant', { org: 'O-ARENA', naam: 'Arena Uitgeverij' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-ARENA', soort: 'zaak', code: 'KIKUNOI' }, tech);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Arena Uitgeverij', contact: 'dev@arena.nl' }, sup);
  await api('/api/appstore/kantoor/uitgever', { org: 'O-ARENA', besluit: 'toegelaten', door: 'Sam van RTG' }, office);

  const inz = await api('/api/appstore/uitgever/inzenden', {
    manifest: { sleutel: 'arena-proef', naam: 'Arenaproef', versie: '1.0.0', categorie: 'spelen',
      uitleg: 'Een proefspel dat een score naar het bord van zijn eigen app stuurt.',
      arena: { richting: 'laag', eenheid: 'seconden' },
      machtigingen: [{ id: 'arena.meedoen', doel: 'meedoen-arena' }] },
    bestanden: [{ pad: 'index.html', inhoud: HTML }, { pad: 'app.js', inhoud: JS }]
  }, sup);
  assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: inz.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  assert.equal((await api('/api/appstore/kantoor/besluit',
    { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office)).status, 200);
  for (const t of [lid, lid2]) {
    assert.equal((await api('/api/appstore/installeer',
      { sleutel: 'arena-proef', machtigingen: ['arena.meedoen'] }, t)).status, 200);
  }
});
test.after(() => stop(srv));

test('1. een gewoon lid krijgt de machtiging NIET, en bewaart dus niets', async () => {
  /* Dit is de belangrijkste HTTP-toets van dit bestand, en hij is op 14
     september 2026 van laag VERSCHOVEN -- niet verzwakt. Lees dat verschil
     goed, want het is precies het soort wijziging waarmee een toets stilletjes
     minder gaat bewijzen.

     WAT ER GELIJK BLIJFT, en dat is de eigenschap waar het om gaat: een vers
     geregistreerd lid heeft wel een geboortedatum opgegeven maar geen gekeurd
     identiteitsbewijs, en `volwassen()` vraagt allebei. Er wordt van zo'n lid
     NIETS bewaard. Zou dat wel gebeuren, dan is de 18+-poort van dit huis
     omzeild via de App Store -- het gat dat kern/volwassen.js een keer eerder
     had.

     WAT ER VERANDERT, is waar dat wordt tegengehouden. Hiervoor werd de
     machtiging gewoon verleend en weigerde de ARENA bij de uitvoering
     (`bewaard: false`). Sinds de versmalling (kern/namens/versmalling.js) wordt
     hij niet meer verleend: een lid kan niet weggeven wat hij zelf niet mag, en
     `arena.meedoen` draagt daarom `eistVanLid: 'progressie'`. Het lid werd
     hiervoor gevraagd ja te zeggen tegen "andere spelers zien uw codenaam en uw
     score op het bord" terwijl dat structureel niet kon gebeuren, en zijn app
     werd op de ZWAARSTE bereikklasse gerekend.

     DE DIEPERE POORT BLIJFT BEWEZEN en is niet ingeruild voor deze: toets 7
     draait de arena rechtstreeks met `progressieMag: () => false` en eist dat
     `staat.arena` leeg blijft. Zonder die toets zou deze wijziging een echte
     grendel vervangen door een papieren.

     EN GRENS 3 VAN ./arena.js SNEUVELT NIET. Het spel speelt door; wat er niet
     meer gebeurt is het BEWAREN, en dat gebeurde al niet. Een app die stukgaat
     op een ontbrekende `arena.meedoen` was al stuk: elk lid mag dat vinkje
     gewoon weglaten, en `installeer` zegt met zoveel woorden "de app werkt; wat
     hij niet mag, krijgt hij niet". */
  const open = await api('/api/appstore/open', { sleutel: 'arena-proef' }, lid);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  assert.deepEqual(open.body.machtigingen, [],
    'het lid vinkte hem aan bij het installeren en hij is toch niet verleend');
  assert.equal((open.body.versmald || {})['arena.meedoen'], 'progressie',
    'en er staat bij WAAROM hij wegviel -- de eissleutel, niet de zin');

  const r = await brug(lid, 'arena.zet', { score: 90 });
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.equal(r.body.code, 'RTG_MACHTIGING_VERSMALD',
    'een eigen code, want de uitweg is een andere dan bij "niet verleend"');
  assert.ok(r.body.waarom, 'de weigering draagt de reden');
  assert.doesNotMatch(String(r.body.hoe || ''), /Alleen het lid kan dit aanzetten/,
    'en stuurt het lid NIET naar een knop die zijn probleem niet oplost');

  /* Het tweede lid is net zo vers en loopt dus tegen dezelfde muur. Wat deze
     regel WEL toevoegt is dat het geen eigenaardigheid van één sessie is.

     Wat hij NIET bewijst, en dat staat er liever dan dat het eruitziet als
     dekking: dat er niets is BEWAARD. Geen enkel lid in deze opstelling haalt
     de poort, dus zwart-doos is er niets te zien; een leeg bord achter een
     geweigerde aanroep bewijst niets. Die eigenschap staat in toets 7, op de
     module, met `staat.arena` erbij. */
  const b = await brug(lid2, 'arena.bord', {});
  assert.equal(b.status, 403, 'ook het tweede lid haalt de poort niet');
  assert.equal(b.body.code, 'RTG_MACHTIGING_VERSMALD');
});

/* De rest van het bord wordt op de MODULE getoetst, met de poort als stub. Dat
   is geen omweg om de poort heen: hij is hierboven en in toets 7 getoetst, en
   wat hier telt is de rekensom van het bord zelf -- richting, plaats, week en
   wat er van een ander lid zichtbaar is. Via HTTP zou daar eerst een gekeurd
   identiteitsbewijs voor moeten worden nagespeeld, en dan toetst deze toets de
   verificatiestroom in plaats van de arena. */
function proefArena(over) {
  const staat = { arena: {} };
  return { staat, arena: maakArena(Object.assign({
    S: () => staat, save: () => {}, nu: () => new Date().toISOString(),
    progressieMag: () => true, GEEN_PROGRESSIE: 'niet volwassen',
    versieVan: () => ({ manifest: { arena: { richting: 'laag', eenheid: 'seconden' } } })
  }, over || {})) };
}

test('2. de richting komt uit het manifest: de laagste tijd wint', () => {
  const { arena } = proefArena();
  const een = { key: 'K1', sleutel: 'x', codenaam: 'Zilveren Vos' };
  const twee = { key: 'K2', sleutel: 'x', codenaam: 'Stille Reiger' };
  assert.equal(arena.zet(een, { score: 90 }).bewaard, true);
  arena.zet(twee, { score: 45 });
  const b = arena.bord(een, {});
  assert.equal(b.vorm.richting, 'laag');
  assert.equal(b.vorm.eenheid, 'seconden');
  assert.equal(b.bord[0].score, 45, 'de snelste staat bovenaan');
  assert.equal(b.bord[0].codenaam, 'Stille Reiger');
  assert.equal(b.deelnemers, 2);
  /* Een slechtere tijd verandert de eigen stand niet. */
  const t = arena.zet(twee, { score: 80 });
  assert.equal(t.persoonlijkRecord, false);
  assert.equal(t.beste, 45);
});

test('2b. zonder arena in het manifest wint de hoogste, en dat staat erbij', () => {
  const { arena } = proefArena({ versieVan: () => ({ manifest: {} }) });
  const ik = { key: 'K1', sleutel: 'x', codenaam: 'Vos' };
  arena.zet(ik, { score: 10 });
  const r = arena.zet(ik, { score: 40 });
  assert.equal(r.persoonlijkRecord, true, 'meer is beter');
  assert.equal(r.vorm.richting, 'hoog');
  assert.equal(r.vorm.uitManifest, false, 'de app kan zien dat dit de terugval is');
});

test('3. van een ander lid komt alleen zijn codenaam mee', () => {
  const { arena } = proefArena();
  arena.zet({ key: 'K1', sleutel: 'x', codenaam: 'Vos' }, { score: 90 });
  arena.zet({ key: 'K2', sleutel: 'x', codenaam: 'Reiger' }, { score: 45 });
  const b = arena.bord({ key: 'K1', sleutel: 'x', codenaam: 'Vos' }, {});
  assert.ok(!/"key"/.test(JSON.stringify(b)), 'er staat geen ledensleutel in het bord');
  const ander = b.bord.find(r => !r.ik);
  assert.deepEqual(Object.keys(ander).sort(), ['codenaam', 'ik', 'plaats', 'score']);
});

test('3b. wie buiten de eerste twintig valt, ziet zijn eigen plaats erbij', () => {
  const { arena } = proefArena();
  for (let i = 0; i < 25; i++) arena.zet({ key: 'K' + i, sleutel: 'x', codenaam: 'Speler ' + i }, { score: i + 1 });
  const laatste = { key: 'K24', sleutel: 'x', codenaam: 'Speler 24' };
  const b = arena.bord(laatste, {});
  assert.equal(b.bord.length, 20);
  assert.equal(b.ik.plaats, 25);
  assert.equal(b.ik.buitenBord, true);
});

test('4. het bord van een app staat los van de ranglijsten van RTG zelf', async () => {
  /* De arcade van het huis kent deze app niet, en hoort dat ook te zeggen. */
  const r = await api('/api/spellen/arcade-bord', { spel: 'arena-proef' }, lid);
  assert.notEqual(r.status, 200, 'een appsleutel is geen spel van het huis');
});

test('5. zonder de machtiging komt geen enkele arena-methode door', async () => {
  await api('/api/appstore/verleen', { sleutel: 'arena-proef', machtigingen: [] }, lid);
  for (const m of ['arena.zet', 'arena.bord', 'arena.mijn']) {
    const r = await brug(lid, m, { score: 1 });
    assert.equal(r.status, 403, m + ' kwam er toch door');
    assert.equal(r.body.machtiging, 'arena.meedoen');
  }
  await api('/api/appstore/verleen', { sleutel: 'arena-proef', machtigingen: ['arena.meedoen'] }, lid);
});

test('6. een arena zonder de machtiging wordt bij het inzenden geweigerd', () => {
  const r = lees({ sleutel: 'zonder-recht', naam: 'Zonder', versie: '1.0.0',
    uitleg: 'Een app met een arena in zijn manifest maar zonder de machtiging erbij.',
    categorie: 'spelen', arena: { richting: 'hoog' }, machtigingen: [] });
  assert.equal(r.ok, false);
  assert.ok(r.fouten.some(f => f.veld === 'arena'), 'de arena wordt geweigerd met de reden');
});

test('7. onder de leeftijdsgrens speelt het spel door en wordt er niets bewaard', () => {
  /* De poort zelf staat in kern/spellen/grens.js; hier telt dat de arena hem
     GEBRUIKT en dat het antwoord geen fout is. Met een poort die altijd nee
     zegt, hoort een score te verdwijnen zonder dat er iets stukgaat. */
  const staat = { arena: {} };
  const arena = maakArena({ S: () => staat, save: () => {}, nu: () => new Date().toISOString(),
    progressieMag: () => false, GEEN_PROGRESSIE: 'nog niet volwassen', versieVan: () => null });
  const r = arena.zet({ key: 'K1', sleutel: 'x', codenaam: 'Zilveren Vos' }, { score: 10 });
  assert.equal(r.bewaard, false);
  assert.equal(r.ranglijst, false);
  assert.ok(r.reden, 'de reden staat erbij');
  assert.ok(!r.fout, 'het is geen fout: het spel speelt door');
  assert.deepEqual(staat.arena, {}, 'er is niets bewaard');
});

test('8. een lid dat zijn opslag wist, verdwijnt van het bord', () => {
  const { arena, staat } = proefArena();
  const ik = { key: 'K1', sleutel: 'x', codenaam: 'Vos' };
  arena.zet(ik, { score: 20 });
  assert.ok(arena.mijn(ik).beste != null, 'hij stond erop');
  arena.wisLid('x', 'K1');
  assert.equal(arena.mijn(ik).beste, null);
  assert.equal(arena.mijn(ik).plaats, null);
  /* En een app die verdwijnt, neemt zijn hele bord mee. */
  arena.zet(ik, { score: 20 });
  arena.wisApp('x');
  assert.deepEqual(staat.arena.x, undefined);
});
