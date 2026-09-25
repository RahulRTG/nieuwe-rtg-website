/* DEMOCRATIEOS FASE B -- de minimale burgerlus (POLITIEK.md par. 18.1).

   Het acceptatiecriterium: iedere geaccepteerde kwestie is terug te vinden,
   heeft een verklaarbare toestand en kan niet ongemerkt verdwijnen. Deze toetsen
   bewaken de eerste twee helften; test/democratie-verlies.test.js de derde,
   onder storingen.

   DE METER KRIJGT EEN ZELFIJKING (toets 5): elke soort breuk wordt een keer met
   opzet gemaakt, en de meter moet hem vinden. Een meter die niets KAN vinden,
   staat groen om dezelfde reden als een meter die niets vindt.

   Draai los: node --test test/democratie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakDemocratie } = require('../server/kern/democratie');
const { EINDSTANDEN } = require('../server/kern/democratie/eindstanden');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

function wereld(opties) {
  const o = opties || {};
  const db = { data: {} };
  const gewekt = [];
  const d = maakDemocratie({ db, save: () => {}, bijeen: async (fn) => fn(), inBundel: () => true, crypto,
    codenaamVan: (k) => 'Codenaam-' + k,
    meldLid: o.meldLid || ((k, n) => { gewekt.push({ k, n }); return n; }) });
  return { db, d, gewekt };
}
const lang = 'Dit is een toelichting van ruim vijftien tekens.';

test('1. de eindstanden zijn gesloten: er is geen "anders", en samen-opgelost is volwaardig', async () => {
  const standen = EINDSTANDEN.map(e => e.stand);
  assert.ok(standen.includes('samen-opgelost'));
  assert.ok(!standen.some(s => /ander|overig|divers/.test(s)), 'een restcategorie is een weg om weg te boeken');
  for (const e of EINDSTANDEN) assert.ok(e.naam && e.uitleg, e.stand + ' mist naam of uitleg');
  const { d } = wereld();
  const k = (await d.inbreng('user-1', { onderwerp: 'De oversteek bij de school is onveilig' })).kwestie;
  const r = await d.sluit('user-9', { id: k.id, stand: 'anders', toelichting: lang });
  assert.equal(r.status, 400);
  assert.equal(d.mijn('user-1').kwesties[0].rondes[0].stand, 'ingebracht', 'een weigering raakt niets aan');
});

test('2. een kwestie draagt geen RTG-sleutel, en elke kwestie een eigen inbrengersnummer', async () => {
  const { db, d } = wereld();
  await d.inbreng('user-42', { onderwerp: 'Te weinig bankjes in het park', gebied: 'Noord' });
  await d.inbreng('user-42', { onderwerp: 'De bus rijdt niet meer op zondag' });
  const opgeslagen = JSON.stringify(db.data.democratieKwesties);
  assert.ok(!/user-\d/.test(opgeslagen), 'de sleutel van het lid staat alleen in de koppeling');
  const refs = Object.values(db.data.democratieKwesties).map(k => k.inbrenger);
  assert.equal(new Set(refs).size, 2, 'twee kwesties van een mens zijn niet tot een persoon op te tellen');
  assert.ok(refs.every(r => /^ib-[0-9a-f]{12}$/.test(r)));
  assert.equal(d.mijn('user-42').kwesties.length, 2);
  assert.equal(d.mijn('user-7').kwesties.length, 0, 'een ander ziet ze niet');
});

test('3. een eindstand verandert nooit achteraf; heropenen is een nieuwe ronde', async () => {
  const { d } = wereld();
  const k = (await d.inbreng('user-1', { onderwerp: 'Losliggende stoeptegels op het plein' })).kwestie;
  assert.equal((await d.behandel('user-9', { id: k.id })).ok, true);
  const h = await d.behandel('user-9', { id: k.id });
  assert.equal(h.herhaling, true, 'dezelfde stand nog eens zetten schrijft niets');
  const s = await d.sluit('user-9', { id: k.id, stand: 'afgewezen', toelichting: lang, bevoegdheid: 'wijkraad' });
  assert.equal(s.ok, true);
  const ronde1 = JSON.stringify(d.lijst().kwesties[0].rondes[0]);
  const nog = await d.sluit('user-8', { id: k.id, stand: 'uitgevoerd', toelichting: lang });
  assert.equal(nog.status, 409);
  assert.equal((await d.heropen('user-9', { id: k.id, reden: 'kort' })).status, 400);
  assert.equal((await d.heropen('user-9', { id: k.id, reden: 'Er is een nieuw ongeluk gebeurd op die plek.' })).ok, true);
  const na = d.lijst().kwesties[0];
  assert.equal(na.rondes.length, 2);
  assert.equal(JSON.stringify(na.rondes[0]), ronde1, 'de eerste ronde bleef byte voor byte gelijk');
  assert.equal(na.rondes[1].stand, 'ingebracht');
  assert.equal(na.rondes[0].eindstand.door, 'Codenaam-user-9', 'wie besloot is zichtbaar, als codenaam');
});

test('4. de eisen per eindstand: bevoegdheid, naar wie, en in welke kwestie', async () => {
  const { d } = wereld();
  const a = (await d.inbreng('user-1', { onderwerp: 'Er is geen speeltuin in de wijk' })).kwestie;
  const b = (await d.inbreng('user-2', { onderwerp: 'Kinderen hebben nergens om te spelen' })).kwestie;
  assert.equal((await d.sluit('u', { id: a.id, stand: 'afgewezen', toelichting: lang })).status, 400);
  assert.equal((await d.sluit('u', { id: a.id, stand: 'doorgestuurd', toelichting: lang })).status, 400);
  assert.equal((await d.sluit('u', { id: a.id, stand: 'samengevoegd', toelichting: lang, in: a.id })).status, 400);
  assert.equal((await d.sluit('u', { id: a.id, stand: 'uitgevoerd', toelichting: 'kort' })).status, 400);
  assert.equal((await d.sluit('u', { id: a.id, stand: 'ingetrokken', toelichting: lang })).status, 403,
    'intrekken is van de inbrenger alleen');
  /* samenvoegen: wie a inbracht, volgt b en krijgt ook de uitkomst van b */
  assert.equal((await d.sluit('u', { id: a.id, stand: 'samengevoegd', toelichting: lang, in: b.id })).ok, true);
  assert.equal(d.mijn('user-1').kwesties.length, 2, 'de inbrenger van a ziet ook b');
  assert.equal((await d.sluit('u', { id: b.id, stand: 'samen-opgelost', toelichting: lang })).ok, true);
  const bij1 = d.mijn('user-1').kwesties.find(k => k.id === b.id);
  assert.equal(bij1.rondes[0].terugkoppeling.stand, 'gewekt', 'de volger kreeg de uitkomst van b');
  assert.equal(d.meter().onverklaard, 0);
});

test('5. zelfijking: de meter vindt elke soort breuk, en een gezonde stand heeft er nul', async () => {
  const bouw = async () => {
    const w = wereld();
    const k = (await w.d.inbreng('user-1', { onderwerp: 'De stoplichten staan te kort op groen' })).kwestie;
    await w.d.sluit('u', { id: k.id, stand: 'uitgevoerd', toelichting: lang });
    await w.d.inbreng('user-2', { onderwerp: 'Het buurthuis is op maandag dicht' });
    return { ...w, id: k.id, kw: () => w.db.data.democratieKwesties };
  };
  const gezond = await bouw();
  assert.equal(gezond.d.meter().onverklaard, 0);

  const gevallen = {
    'verdwenen': (w) => { delete w.kw()[w.id]; },
    'buiten-journaal': (w) => { w.kw()['KW-BUITEN'] = JSON.parse(JSON.stringify(w.kw()[w.id])); w.kw()['KW-BUITEN'].id = 'KW-BUITEN'; },
    'geschiedenis-gewijzigd': (w) => { w.kw()[w.id].tijdlijn[1].wat = 'iets anders'; },
    'journaal-gewijzigd': (w) => { w.db.data.democratieJournaal[1].kwestie = 'KW-ANDERS'; },
    'toestand-onverklaarbaar': (w) => { w.kw()[w.id].rondes[0].eindstand.stand = 'anders'; },
    'terugkoppeling-ontbreekt': (w) => { w.kw()[w.id].rondes[0].terugkoppeling = {}; },
    'inbrenger-onbereikbaar': (w) => { delete w.db.data.democratieInbrengers[w.kw()[w.id].inbrenger]; }
  };
  for (const [soort, breek] of Object.entries(gevallen)) {
    const w = await bouw();
    breek(w);
    const m = w.d.meter();
    assert.ok(m.breuken.some(b => b.soort === soort), 'de meter zag "' + soort + '" niet: ' + JSON.stringify(m.breuken));
    assert.ok(m.onverklaard >= 1);
  }
});

test('6. een mislukte wek is een verklaarde stand, geen breuk, en herbezorgen haalt hem in', async () => {
  let stuk = true;
  const w = wereld({ meldLid: (k, n) => { if (stuk) throw new Error('berichtendienst ligt eruit'); return n; } });
  const k = (await w.d.inbreng('user-1', { onderwerp: 'Er ligt afval langs de dijk' })).kwestie;
  assert.equal((await w.d.sluit('u', { id: k.id, stand: 'samen-opgelost', toelichting: lang })).ok, true);
  let m = w.d.meter();
  assert.equal(m.staan.besluitWekNogNietUit, 1);
  assert.equal(m.onverklaard, 0);
  assert.equal(w.d.mijn('user-1').kwesties[0].rondes[0].eindstand.stand, 'samen-opgelost',
    'de uitkomst is te lezen, ook zonder wek: dat is het bewezen leespad');
  stuk = false;
  assert.equal((await w.d.herbezorg()).gewekt, 1);
  assert.equal((await w.d.herbezorg()).gewekt, 0, 'een tweede ronde vindt niets meer');
  m = w.d.meter();
  assert.equal(m.staan.wachtOpInbrenger, 1);
  await w.d.gezien('user-1', k.id);
  assert.equal(w.d.meter().staan.rond, 1);
  assert.ok(!('percentage' in m) && m.zegtNiet.length > 0, 'geen percentage, wel wat de meter niet zegt');
});

test('7. vergeten: de kwestie blijft, de weg naar de mens niet, en dat is geen breuk', async () => {
  const { d } = wereld();
  const k = (await d.inbreng('user-5', { onderwerp: 'Onveilige fietsroute naar het station' })).kwestie;
  assert.equal(d.vergeet('user-5'), 1);
  assert.equal(d.mijn('user-5').kwesties.length, 0);
  assert.equal(d.lijst().kwesties[0].id, k.id);
  await d.sluit('u', { id: k.id, stand: 'onhaalbaar', toelichting: lang });
  assert.equal(d.meter().onverklaard, 0);
  assert.equal(d.meter().inbrengersVergeten, 1);
  assert.equal((await d.intrek('user-5', k.id)).status, 404);
});

/* ---------------------------------------------------------------- server */

function api(base, pad, body, token) {
  return fetch(base + pad, { method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Burger ' + seq, email: 'dem' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

let srv;
test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'KANTOOR-DEMOCRATIE-1' } }); });
test.after(() => { stop(srv && srv.child); });

const LID = ['/api/member/democratie/kwestie/inbreng', '/api/member/democratie/kwestie/mijn',
  '/api/member/democratie/kwestie/gezien', '/api/member/democratie/kwestie/intrek'];
const KANTOOR = ['/api/office/democratie/kwestie/lijst', '/api/office/democratie/kwestie/behandel',
  '/api/office/democratie/kwestie/eindstand', '/api/office/democratie/kwestie/heropen',
  '/api/office/democratie/kwestie/herbezorg', '/api/office/democratie/meter'];

test('8. zonder sessie komt niemand binnen, een demosessie brengt niets in, en de gedeelde kantoorcode beslist niets', async () => {
  for (const p of LID.concat(KANTOOR)) assert.equal((await api(srv.base, p, {})).status, 401, p);
  const demo = (await api(srv.base, '/api/login', { tier: 'rtg' })).body.token;
  assert.equal((await api(srv.base, LID[0], { onderwerp: 'Een demosessie is van iedereen' }, demo)).status, 403);
  const gedeeld = (await api(srv.base, '/api/office/login', { code: 'KANTOOR-DEMOCRATIE-1' })).body.token;
  assert.ok(gedeeld, 'de gedeelde code logt in');
  for (const p of KANTOOR) assert.equal((await api(srv.base, p, {}, gedeeld)).status, 403, p + ' hoort op naam te gaan');
});

test('9. de hele lus tegen een echte server: inbrengen, behandelen, eindstand, wek, gezien, heropenen, intrekken', async () => {
  const tok = await lid(srv.base);
  const ander = await lid(srv.base);
  const kantoor = await kantoorAlsPersoon(srv.base);
  assert.ok(kantoor, 'een kantoormens op naam');

  const ib = await api(srv.base, LID[0], { onderwerp: 'De oversteek bij de basisschool is onveilig', gebied: 'West' }, tok);
  assert.equal(ib.status, 200);
  const id = ib.body.kwestie.id;
  assert.match(id, /^KW-[0-9A-F]{6}$/);
  assert.ok(!JSON.stringify(ib.body).includes('ib-'), 'het inbrengersnummer gaat niet naar buiten');

  assert.equal((await api(srv.base, LID[1], {}, tok)).body.kwesties.length, 1);
  assert.equal((await api(srv.base, LID[1], {}, ander)).body.kwesties.length, 0, 'een ander lid ziet hem niet');
  assert.equal((await api(srv.base, LID[2], { id }, ander)).status, 404);
  assert.equal((await api(srv.base, LID[3], { id }, ander)).status, 404);

  assert.ok((await api(srv.base, KANTOOR[0], {}, kantoor)).body.kwesties.some(k => k.id === id));
  assert.equal((await api(srv.base, KANTOOR[1], { id, stand: 'wacht-op-bevoegde' }, kantoor)).status, 200);
  const nogEens = await api(srv.base, KANTOOR[1], { id, stand: 'wacht-op-bevoegde' }, kantoor);
  assert.equal(nogEens.status, 200);
  assert.equal((await api(srv.base, KANTOOR[5], {}, kantoor)).body.staan.wachtOpBevoegde >= 1, true);

  const eind = await api(srv.base, KANTOOR[2], { id, stand: 'samen-opgelost', toelichting: lang }, kantoor);
  assert.equal(eind.status, 200);
  const tweede = await api(srv.base, KANTOOR[2], { id, stand: 'samen-opgelost', toelichting: lang }, kantoor);
  assert.equal(tweede.status, 409, 'een eindstand verandert niet achteraf, ook niet met hetzelfde verzoek');

  const post = await api(srv.base, '/api/notifications', {}, tok);
  assert.ok((post.body.notifications || []).some(n => String(n.body || '').includes(id)), 'de wek staat in zijn berichten');
  const mijn = (await api(srv.base, LID[1], {}, tok)).body.kwesties[0];
  assert.equal(mijn.rondes[0].eindstand.stand, 'samen-opgelost');
  assert.equal(mijn.rondes[0].terugkoppeling.stand, 'gewekt');
  assert.equal((await api(srv.base, LID[2], { id }, tok)).body.kwestie.rondes[0].terugkoppeling.stand, 'gezien');
  assert.equal((await api(srv.base, LID[2], { id }, tok)).status, 200, 'nog eens openen is een herhaling');

  assert.equal((await api(srv.base, LID[3], { id }, tok)).status, 409, 'intrekken kan niet meer na een eindstand');
  assert.equal((await api(srv.base, KANTOOR[3], { id, reden: 'Er is een nieuw feit: de school is verhuisd.' }, kantoor)).status, 200);
  assert.equal((await api(srv.base, KANTOOR[3], { id, reden: 'Er is een nieuw feit: de school is verhuisd.' }, kantoor)).status, 409);
  assert.equal((await api(srv.base, LID[3], { id }, tok)).status, 200, 'in de nieuwe ronde kan hij zelf stoppen');
  assert.equal((await api(srv.base, KANTOOR[4], {}, kantoor)).status, 200);

  const m = (await api(srv.base, KANTOOR[5], {}, kantoor)).body;
  assert.equal(m.onverklaard, 0, JSON.stringify(m.breuken));
  assert.ok(Array.isArray(m.afhankelijkVanRtg.modules) && m.afhankelijkVanRtg.modules.length > 0);
});

test('10. het recht op vergetelheid via de echte route: de kwestie blijft, de weg naar de mens niet', async () => {
  const tok = await lid(srv.base);
  const kantoor = await kantoorAlsPersoon(srv.base);
  const id = (await api(srv.base, LID[0], { onderwerp: 'Wie vergeten wil worden, laat een kwestie achter' }, tok)).body.kwestie.id;
  assert.equal((await api(srv.base, '/api/privacy/delete', {}, tok)).status, 200);
  const lijst = (await api(srv.base, KANTOOR[0], {}, kantoor)).body.kwesties;
  assert.ok(lijst.some(k => k.id === id), 'de kwestie zelf blijft staan: hij is geen persoonsgegeven van de inbrenger');
  assert.equal((await api(srv.base, KANTOOR[2], { id, stand: 'onhaalbaar', toelichting: lang }, kantoor)).status, 200);
  const m = (await api(srv.base, KANTOOR[5], {}, kantoor)).body;
  assert.equal(m.onverklaard, 0, 'een bewust vergeten inbrenger is geen breuk: ' + JSON.stringify(m.breuken));
  assert.ok(m.inbrengersVergeten >= 1, 'de weg naar de mens is echt weg, en de meter ziet dat');
});
