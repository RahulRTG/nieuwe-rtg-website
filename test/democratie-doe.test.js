/* HET DOENETWERK -- een actie die bij de burger begint (POLITIEK.md par. 6,
   release-trein stap 4).

   De lus die hier bewezen wordt: een inbrenger maakt van zijn kwestie een actie,
   anderen sluiten ZELF aan, er is een bijeenkomst met een eerlijke plaatsgrens,
   de actie legt een resultaat vast, en een medewerker op naam die er niet bij
   betrokken is sluit de kwestie met `samen-opgelost` -- waarna iedereen die
   meedeed de uitkomst terugkrijgt.

   En de grenzen die daar niet onder mogen lijden:
     - alleen wie de kwestie heeft, maakt er een actie van, en alleen met
       uitdrukkelijk akkoord dat het onderwerp zichtbaar wordt;
     - geen namen en geen nummers naar buiten, alleen aantallen;
     - wie meedoet, gaat volgen en beslist dus ook niet over de kwestie (W2);
     - de eindstandenlijst en de bevoegdheid om te sluiten veranderen niet.

   Toets 9 loopt dezelfde lus over HTTP tegen een echte server: elke route van
   het DoeNetwerk krijgt daar minstens een treffer (LAT.md, de routeregel).

   Draai los: node --test test/democratie-doe.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakDemocratie } = require('../server/kern/democratie');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

function wereld() {
  const db = { data: {} };
  const gewekt = [];
  const d = maakDemocratie({ db, save: () => {}, bijeen: async (fn) => fn(), inBundel: () => true, crypto,
    codenaamVan: (k) => 'Codenaam-' + k, meldLid: (k, n) => { gewekt.push(k); return n; } });
  return { db, d, gewekt };
}
const lang = 'Samen hebben we het zebrapad geschilderd en de gemeente heeft het overgenomen.';

async function metActie(d) {
  const k = (await d.inbreng('user-1', { onderwerp: 'De oversteek bij de school is onveilig', gebied: 'Kerkbuurt' })).kwestie;
  const a = (await d.doe.start('user-1', { kwestie: k.id, wat: 'Samen een klaarovergang regelen', rollen: 'verf, planning', zichtbaar: true })).actie;
  return { k, a };
}

test('1. alleen wie de kwestie heeft maakt er een actie van, en alleen met akkoord op zichtbaarheid', async () => {
  const { db, d } = wereld();
  const k = (await d.inbreng('user-1', { onderwerp: 'De oversteek bij de school is onveilig' })).kwestie;
  assert.equal((await d.doe.start('user-2', { kwestie: k.id, wat: 'Samen iets doen hieraan', zichtbaar: true })).status, 404,
    'een ander kan van mijn kwestie geen actie maken');
  const zonder = await d.doe.start('user-1', { kwestie: k.id, wat: 'Samen iets doen hieraan' });
  assert.equal(zonder.status, 400, 'zonder uitdrukkelijk akkoord wordt het onderwerp niet zichtbaar');
  assert.equal(Object.keys(db.data.democratieActies || {}).length, 0, 'een weigering laat niets achter');
  const r = await d.doe.start('user-1', { kwestie: k.id, wat: 'Samen iets doen hieraan', rollen: ['verf', 'planning'], zichtbaar: true });
  assert.equal(r.ok, true);
  assert.match(r.actie.id, /^AC-[0-9A-F]{6}$/);
  assert.deepEqual(r.actie.rollen, ['verf', 'planning']);
  assert.equal((await d.doe.start('user-1', { kwestie: k.id, wat: 'Nog een actie erbij', zichtbaar: true })).status, 409,
    'een lopende kwestie heeft een open actie tegelijk');
  assert.ok(!/user-\d/.test(JSON.stringify(db.data.democratieActies)), 'een actie draagt geen RTG-sleutel');
  const tijdlijn = d.mijn('user-1').kwesties[0].tijdlijn;
  assert.ok(tijdlijn.some(t => t.wat === 'actie' && t.stand === 'gestart'), 'de kwestie weet dat er een actie begon');
});

test('2. de lijst toont aantallen, nooit namen of nummers', async () => {
  const { d } = wereld();
  const { a } = await metActie(d);
  await d.doe.aansluit('user-2', a.id);
  const tekst = JSON.stringify(d.doe.lijst('user-3'));
  assert.ok(!/ib-|user-|Codenaam/.test(tekst), 'de lijst verraadt wie er meedoet: ' + tekst.slice(0, 200));
  const rij = d.doe.lijst('user-3').acties[0];
  assert.equal(rij.deelnemers, 2);
  assert.equal(rij.kwestie.onderwerp, 'De oversteek bij de school is onveilig');
  assert.equal(rij.ikDoeMee, false);
  assert.equal(d.doe.lijst('user-2').acties[0].ikDoeMee, true);
  assert.equal(d.doe.lijst('user-1').acties[0].ikStartte, true);
});

test('3. wie aansluit, volgt: hij krijgt de uitkomst terug en beslist zelf niet (W2)', async () => {
  const { d, gewekt } = wereld();
  const { k, a } = await metActie(d);
  assert.equal((await d.doe.aansluit('user-2', a.id)).ok, true);
  assert.equal((await d.doe.aansluit('user-2', a.id)).herhaling, true, 'nog eens aansluiten verandert niets');
  assert.equal(d.mijn('user-2').kwesties.length, 1, 'de deelnemer ziet de kwestie bij zijn eigen kwesties');
  const zelf = await d.sluit('user-2', { id: k.id, stand: 'samen-opgelost', toelichting: lang });
  assert.equal(zelf.status, 409, 'een deelnemer die ook kantoormens is, sluit de kwestie niet');
  const s = await d.sluit('user-9', { id: k.id, stand: 'samen-opgelost', toelichting: lang });
  assert.equal(s.ok, true, 'een medewerker op naam die niet betrokken is, sluit wel');
  for (const lid of ['user-1', 'user-2']) {
    const r = d.mijn(lid).kwesties[0].rondes[0];
    assert.equal(r.eindstand.stand, 'samen-opgelost');
    assert.ok(['klaargezet', 'gewekt'].includes(r.terugkoppeling.stand), lid + ' krijgt de terugkoppeling');
  }
  assert.deepEqual(gewekt.sort(), ['user-1', 'user-2'], 'beiden krijgen een wek, niemand anders');
  assert.equal((await d.intrek('user-1', k.id)).status, 409, 'wat samen is opgelost, trekt de inbrenger niet alleen in');
});

test('4. de bijeenkomst: alleen de starter plant, de plaatsgrens is eerlijk, opnieuw plannen wist de antwoorden', async () => {
  const { d } = wereld();
  const { a } = await metActie(d);
  await d.doe.aansluit('user-2', a.id);
  await d.doe.aansluit('user-3', a.id);
  const plan = { id: a.id, datum: '2026-10-14', tijd: '19:30', waar: 'Buurthuis De Kerk', plaatsen: 2 };
  assert.equal((await d.doe.plan('user-2', a.id, plan)).status, 403, 'een deelnemer plant geen bijeenkomst');
  assert.equal((await d.doe.plan('user-1', a.id, Object.assign({}, plan, { datum: 'volgende week' }))).status, 400);
  assert.equal((await d.doe.plan('user-1', a.id, plan)).ok, true);
  assert.equal((await d.doe.antwoord('user-4', a.id, { wat: 'ja' })).status, 403, 'wie niet meedoet, antwoordt niet');
  assert.equal((await d.doe.antwoord('user-1', a.id, { wat: 'ja' })).ok, true);
  assert.equal((await d.doe.antwoord('user-2', a.id, { wat: 'ja' })).ok, true);
  assert.equal((await d.doe.antwoord('user-3', a.id, { wat: 'ja' })).status, 409, 'vol is vol, zonder wachtlijst');
  assert.equal((await d.doe.antwoord('user-3', a.id, { wat: 'misschien' })).ok, true);
  const b = d.doe.lijst('user-3').acties[0].bijeenkomst;
  assert.deepEqual([b.ja, b.misschien, b.vol, b.mijnAntwoord], [2, 1, true, 'misschien']);
  await d.doe.plan('user-1', a.id, Object.assign({}, plan, { datum: '2026-10-16' }));
  assert.equal(d.doe.lijst('user-1').acties[0].bijeenkomst.ja, 0, 'wie ja zei tegen de veertiende, zei niet ja tegen de zestiende');
  assert.equal((await d.doe.afgelast('user-1', a.id, { reden: 'Het buurthuis is dicht' })).ok, true);
  assert.equal((await d.doe.antwoord('user-2', a.id, { wat: 'ja' })).status, 409, 'op een afgelaste bijeenkomst antwoordt niemand');
});

test('5. het resultaat komt op de tijdlijn van de kwestie en bij het kantoor, zonder nummers', async () => {
  const { d } = wereld();
  const { k, a } = await metActie(d);
  await d.doe.aansluit('user-2', a.id);
  assert.equal((await d.doe.resultaat('user-2', a.id, { tekst: lang })).status, 403, 'alleen wie begon, legt het resultaat vast');
  assert.equal((await d.doe.resultaat('user-1', a.id, { tekst: 'kort' })).status, 400);
  assert.equal((await d.doe.resultaat('user-1', a.id, { tekst: lang })).ok, true);
  assert.equal((await d.doe.aansluit('user-3', a.id)).status, 409, 'bij een afgeronde actie sluit niemand meer aan');
  const kantoor = d.lijst().kwesties.find(x => x.id === k.id);
  assert.deepEqual(kantoor.acties, [{ id: a.id, wat: 'Samen een klaarovergang regelen', stand: 'klaar', deelnemers: 2, resultaat: lang }]);
  assert.ok(kantoor.tijdlijn.some(t => t.wat === 'actie' && t.stand === 'resultaat'));
  assert.ok(!/ib-|user-/.test(JSON.stringify(kantoor)), 'het kantoor ziet geen nummers en geen sleutels');
  assert.equal(kantoor.rondes[0].stand, 'ingebracht', 'een resultaat is geen eindstand: dat besluit een mens op naam');
});

test('6. stoppen vraagt een reden, en een gestopte actie verdwijnt uit de lijst maar niet uit de kwestie', async () => {
  const { d } = wereld();
  const { k, a } = await metActie(d);
  assert.equal((await d.doe.stop('user-1', a.id, { reden: 'nee' })).status, 400);
  assert.equal((await d.doe.stop('user-1', a.id, { reden: 'De gemeente regelt het zelf al.' })).ok, true);
  assert.equal(d.doe.lijst('user-1').acties.length, 0);
  assert.ok(d.mijn('user-1').kwesties[0].tijdlijn.some(t => t.wat === 'actie' && t.stand === 'gestopt'));
  assert.equal((await d.doe.start('user-1', { kwestie: k.id, wat: 'Toch een nieuwe poging samen', zichtbaar: true })).ok, true,
    'na een gestopte actie kan er een nieuwe beginnen');
});

test('7. vertrekken: de starter niet, een deelnemer wel, en hij blijft volgen', async () => {
  const { d } = wereld();
  const { a } = await metActie(d);
  await d.doe.aansluit('user-2', a.id);
  assert.equal((await d.doe.verlaat('user-1', a.id)).status, 409);
  assert.equal((await d.doe.verlaat('user-3', a.id)).status, 403);
  assert.equal((await d.doe.verlaat('user-2', a.id)).ok, true);
  assert.equal(d.doe.lijst('user-2').acties[0].deelnemers, 1);
  assert.equal(d.mijn('user-2').kwesties.length, 1, 'wie vertrok, krijgt de uitkomst nog steeds');
});

test('8. vergeten: de sleutel van een deelnemer verdwijnt, de actie blijft', async () => {
  const { db, d } = wereld();
  const { a } = await metActie(d);
  await d.doe.aansluit('user-2', a.id);
  d.vergeet('user-2');
  assert.ok(!JSON.stringify(db.data).includes('"user-2"'), 'er staat nergens meer een weg naar deze mens');
  assert.equal(d.doe.lijst('user-1').acties[0].deelnemers, 2, 'de actie telt hem nog, zonder te weten wie');
});

test('9. over HTTP tegen een echte server: de hele lus, elke route van het DoeNetwerk', async () => {
  const OFFICE_CODE = 'DOENETWERK-1';
  const { child, base } = await startServer({ env: { SMTP_URL: '', OFFICE_CODE } });
  const api = (pad, body, token) => fetch(base + pad, { method: 'POST', signal: AbortSignal.timeout(20000),
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  let n = 0;
  const lid = async () => {
    const u = String(Date.now() + (++n)).slice(-8);
    const r = await api('/api/auth/register', { name: 'Doe ' + u, email: 'doe' + u + '@x.nl', phone: '06' + u,
      password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(r.body.token, 'registreren: ' + JSON.stringify(r.body).slice(0, 160));
    return r.body.token;
  };
  try {
    const [inbrenger, buur] = [await lid(), await lid()];
    const A = '/api/member/democratie/actie/';
    const k = (await api('/api/member/democratie/kwestie/inbreng', { onderwerp: 'Zwerfvuil rond het speelveld' }, inbrenger)).body.kwestie;
    const s = await api(A + 'start', { kwestie: k.id, wat: 'Samen een opruimochtend houden', zichtbaar: true }, inbrenger);
    assert.equal(s.status, 200, 'start: ' + JSON.stringify(s.body));
    const id = s.body.actie.id;
    assert.equal((await api(A + 'lijst', {}, buur)).body.acties[0].id, id);
    assert.equal((await api(A + 'aansluit', { id }, buur)).status, 200);
    assert.equal((await api(A + 'plan', { id, datum: '2026-10-18', waar: 'Bij het speelveld', plaatsen: 10 }, inbrenger)).status, 200);
    assert.equal((await api(A + 'antwoord', { id, wat: 'ja' }, buur)).status, 200);
    assert.equal((await api(A + 'afgelast', { id, reden: 'Regen voorspeld' }, inbrenger)).status, 200);
    assert.equal((await api(A + 'verlaat', { id }, buur)).status, 200);
    assert.equal((await api(A + 'resultaat', { id, tekst: 'Twaalf buren ruimden drie zakken zwerfvuil op.' }, inbrenger)).status, 200);
    assert.equal((await api(A + 'stop', { id, reden: 'Is al afgerond, dit mag niet' }, inbrenger)).status, 409,
      'een afgeronde actie stopt niet meer');

    const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
    assert.ok(kantoor, 'een kantoormens op naam');
    const lijst = await api('/api/office/democratie/kwestie/lijst', {}, kantoor);
    assert.equal(lijst.body.kwesties.find(x => x.id === k.id).acties[0].stand, 'klaar');
    const sluit = await api('/api/office/democratie/kwestie/eindstand', { id: k.id, stand: 'samen-opgelost',
      toelichting: 'Buren ruimden het samen op; er kwam geen politicus aan te pas.' }, kantoor);
    assert.equal(sluit.status, 200, 'sluiten: ' + JSON.stringify(sluit.body));
    const terug = await api('/api/member/democratie/kwestie/mijn', {}, buur);
    assert.equal(terug.body.kwesties[0].rondes[0].eindstand.stand, 'samen-opgelost', 'wie meedeed, krijgt de uitkomst terug');

    const demo = await api('/api/auth/demo', { tier: 'rtg' });
    if (demo.body && demo.body.token) {
      assert.equal((await api(A + 'lijst', {}, demo.body.token)).status, 403, 'een demosessie doet niet mee');
    }
  } finally { stop(child); }
});
