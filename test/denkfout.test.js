/* De Misconception Graph: een fout is geen fout maar een denkfout.

   De beloftes die hier hard worden gemaakt:

   - 3 x 7 = 10 wordt geduid als optellen in plaats van vermenigvuldigen, en
     daar komt meteen een ANDERE uitleg van hetzelfde leerdoel bij;
   - een fout die nergens op uitkomt levert NIETS op: liever niets dan een gok,
     want een verzonnen denkfout stuurt een kind een verkeerde uitleg in;
   - het feit (de bouwstenen van de opgave) verlaat de server nooit -- met de
     getallen erbij is het antwoord uit te rekenen;
   - de klas telt patronen zonder wie: er staat geen leerlingsleutel bij en er
     is geen weg terug naar een kind;
   - de duiding is geen oordeel: nergens "fout", "jammer" of "helaas".
   Draai los: node --experimental-sqlite --test test/denkfout.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { duiding, andersUitgelegd } = require('../server/kern/leerstof-denkfout');
const { DENKFOUTEN } = require('../server/kern/leerstof-denkfout-lijst');
const { opgave } = require('../server/kern/leerstof-gen');
const { tel } = require('../server/school/denkfout');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-denkfout-'));
const api = (pad, body) => fetch(base + '/api' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Leerling Denkfout', email: 'df' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '2005-04-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
  token = reg.token;
  if (!token) throw new Error('registratie mislukt: ' + JSON.stringify(reg).slice(0, 200));
  const ins = await api('/onderwijs/inschrijf', { fase: 'po-g5' });
  if (ins.status !== 200) throw new Error('inschrijven mislukt: ' + JSON.stringify(ins).slice(0, 200));
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de regels los: hier zit de duiding ---------- */
test('een fout antwoord dat precies een andere bewerking is, wordt zo geduid', () => {
  const proef = (gen, foutVan) => {
    const o = opgave(gen);
    return { o, uit: duiding(o.feit, o.a, foutVan(o.feit)) };
  };
  const tafel = proef({ soort: 'tafel', tafels: [7] }, f => String(f.n + f.t));
  assert.equal(tafel.uit.id, 'maal.plus-in-plaats-van-maal', tafel.o.v + ' met de som van de getallen');

  const breuk = proef({ soort: 'breuk-som' }, f => (f.a + f.b) + '/' + (f.noemer * 2));
  assert.equal(breuk.uit.id, 'breuken.noemer-opgeteld');

  const meter = proef({ soort: 'metriek' }, () => '1');
  assert.equal(meter.uit.id, 'eenheden.niet-omgerekend');

  const rest = proef({ soort: 'deelrest', max: 9 }, f => String(f.heel));
  assert.equal(rest.uit.id, 'delen.rest-weggelaten');

  const pro = proef({ soort: 'procent', procenten: [25] }, f => String(f.p));
  assert.equal(pro.uit.id, 'procent.percentage-als-antwoord');
});

test('een fout die nergens op uitkomt levert niets op -- liever niets dan een gok', () => {
  const o = opgave({ soort: 'tafel', tafels: [7] });
  assert.equal(duiding(o.feit, o.a, '99999'), null);
  assert.equal(duiding(o.feit, o.a, 'weet ik niet'), null);
  assert.equal(duiding(null, o.a, '3'), null, 'zonder feit valt er niets te duiden');
  assert.equal(duiding(o.feit, o.a, ''), null);
});

test('een specifieke duiding gaat voor op "eentje ernaast"', () => {
  /* 2 x 3 = 5 is zowel "eentje naast 6" als "opgeteld in plaats van
     vermenigvuldigd". Het tweede zegt meer, dus dat hoort eruit te komen. */
  const uit = duiding({ soort: 'tafel', n: 2, t: 3 }, '6', '5');
  assert.equal(uit.id, 'maal.plus-in-plaats-van-maal');
  // en waar er niets specifieks is, mag het algemene patroon wel
  assert.equal(duiding({ soort: 'tafel', n: 4, t: 7 }, '28', '27').id, 'algemeen.eentje-ernaast');
});

test('geen enkele duiding is een verwijt', () => {
  for (const [id, d] of Object.entries(DENKFOUTEN)) {
    assert.doesNotMatch(d.naam + ' ' + d.uitleg, /fout|slecht|jammer|helaas|dom/i, id + ' klinkt als een verwijt');
    assert.ok(d.uitleg.length > 40, id + ' legt niets uit');
    assert.ok(d.vorm, id + ' wijst niet naar een uitlegvorm');
  }
});

/* De scherpste grens van deze laag, en hij wordt op de OPSLAG gemeten en niet
   op het antwoord: wat er in de klas wordt vastgelegd is een aantal en een
   datum, en verder niets. Een test die alleen naar het antwoord kijkt, mist
   een sleutel die stil in de database belandt -- en juist dat is wat een
   dossier van de missers van een kind zou worden. */
test('een klas telt een patroon met een aantal en een datum, en niets anders', () => {
  const k = {};
  const rij = tel(k, 'rekenen.g5.tafels-tot-10', 'maal.plus-in-plaats-van-maal', '2026-08-19T10:00:00.000Z');
  assert.deepEqual(Object.keys(rij).sort(), ['aantal', 'laatst'], 'er hoort niets bij dan een aantal en een datum');
  assert.equal(rij.aantal, 1);
  tel(k, 'rekenen.g5.tafels-tot-10', 'maal.plus-in-plaats-van-maal', '2026-08-19T11:00:00.000Z');
  assert.equal(k.patronen['rekenen.g5.tafels-tot-10']['maal.plus-in-plaats-van-maal'].aantal, 2);
  // en de hele telling, tot in de diepte, draagt geen enkel spoor van een kind
  assert.deepEqual(Object.keys(k), ['patronen']);
  assert.doesNotMatch(JSON.stringify(k), /sleutel|profiel|leerling|naam/i);
});

test('Explain Differently kiest de vorm die bij de denkfout past', () => {
  const doel = { uitleg: [{ soort: 'eenvoudig', tekst: 'kort' }, { soort: 'visueel', tekst: 'met een plaatje' }] };
  assert.equal(andersUitgelegd(doel, DENKFOUTEN['maal.plus-in-plaats-van-maal']).soort, 'visueel');
  // en valt terug op wat er is, in plaats van niets te geven
  assert.equal(andersUitgelegd({ uitleg: [{ soort: 'stap', tekst: 'x' }] }, DENKFOUTEN['maal.plus-in-plaats-van-maal']).soort, 'stap');
  assert.equal(andersUitgelegd({ uitleg: [] }, DENKFOUTEN['maal.plus-in-plaats-van-maal']), null);
});

/* ---------- en door de hele machine heen ---------- */
test('bij het oefenen komt de duiding mee, met een andere uitleg erbij', async () => {
  let start, m;
  for (let poging = 0; poging < 8; poging++) {
    start = (await api('/leerstof/oefen', { doel: 'rekenen.g5.tafels-tot-10' })).body;
    m = /^(\d+) x (\d+)/.exec(start.vraag);
    assert.ok(m, 'de tafelvraag heeft de verwachte vorm');
    /* Bij 2 x 2 is optellen toevallig ook vermenigvuldigen. Dat is geen
       denkfout en mag deze proef dus niet als fout antwoord aanbieden. */
    if (+m[1] + +m[2] !== +m[1] * +m[2]) break;
  }
  assert.notEqual(+m[1] + +m[2], +m[1] * +m[2],
    'de proef heeft een tafel nodig waarbij optellen echt een ander antwoord geeft');
  const r = (await api('/leerstof/antwoord', { antwoord: String(+m[1] + +m[2]) })).body;

  assert.equal(r.goed, false);
  assert.equal(r.denkfout.id, 'maal.plus-in-plaats-van-maal');
  assert.match(r.denkfout.uitleg, /keer/i);
  assert.ok(r.anders && r.anders.tekst, 'er komt een andere uitleg van hetzelfde doel bij');

  /* Het FEIT blijft op de server: met de twee getallen erbij is het antwoord
     uit te rekenen, dus dat mag de client nooit zien. */
  assert.doesNotMatch(JSON.stringify(r), /"feit"/);
});

test('twee keer hetzelfde patroon stuurt het advies, en blijft vriendelijk', async () => {
  let r = (await api('/leerstof/oefen', { doel: 'rekenen.g5.tafels-tot-10' })).body;
  const plus = v => { const m = /^(\d+) x (\d+)/.exec(v); return String(+m[1] + +m[2]); };
  for (let i = 0; i < 5; i++) r = (await api('/leerstof/antwoord', { antwoord: plus(r.vraag) })).body;

  assert.equal(r.klaar, true);
  assert.equal(r.behaald, false);
  assert.match(r.advies, /op dezelfde manier/i, 'het advies wijst naar het patroon en niet naar de voorkennis');
  assert.match(r.advies, /keer/i);
  assert.doesNotMatch(r.advies, /fout|slecht|jammer|helaas/i, 'een denkpatroon benoemen is geen verwijt');
  assert.ok(r.anders && r.anders.tekst, 'en er staat een andere uitleg klaar');
});

test('de klas telt patronen zonder wie, en besproken is weg', async () => {
  const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const sch = (await fnd('/school/school/maak', { naam: 'De Kring', plaats: 'Deventer' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  const leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Nore', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: leraar.personeelId, akkoord: true });
  const klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '5B', trap: 'po', fase: 'po-g5' })).body;
  const kl = (p, b) => fnd(p, Object.assign({ klasCode: klas.code, personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, b || {}));

  const gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Kring', naam: 'Ouder Kring', pin: '4321' })).body;
  const kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Bram', rol: 'kind', groep: 'kind' })).body;
  const kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kind.profiel.id });
  await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });

  const hw = (await kl('/school/huiswerk/maak', { titel: 'Tafels oefenen', doel: 'rekenen.g5.tafels-tot-10' })).body;
  const hwId = (hw.huiswerk && hw.huiswerk.id) || hw.id;
  assert.ok(hwId, 'het huiswerk is aangemaakt: ' + JSON.stringify(hw).slice(0, 160));

  /* EEN SOM WAARIN DE FOUT OOK ECHT FOUT IS.

     Deze proef maakt met opzet de denkfout "plus in plaats van maal": op `n x t`
     antwoordt hij `n + t`. Bij precies EEN som van de generator valt dat samen
     met het goede antwoord -- 2 x 2 is vier, en twee plus twee ook. Dan is het
     antwoord GOED, komt er geen duiding terug, en zakte deze toets op
     `eerste.denkfout.id` met "Cannot read properties of undefined". Kans per
     ronde ongeveer een op negentig (n is 1..10, t is een van negen tafels), en
     daarmee precies het soort dobbelsteen dat maanden ongezien blijft en dan een
     groene tak rood maakt (gebeurd in CI op 31 augustus 2026).

     De oplossing is niet opnieuw proberen tot het lukt, maar de som KIEZEN: haal
     een verse oefenronde op zolang de eerste vraag er een is waarin de fout geen
     goed antwoord oplevert. Meer dan een handvol rondes heeft dat nooit nodig,
     en als het toch niet lukt zakt de toets met een uitleg in plaats van op een
     TypeError. */
  const plus = t => { const m = /^(\d+) x (\d+)/.exec(t); return m ? String(+m[1] + +m[2]) : 'x'; };
  const echtFout = (t) => { const m = /^(\d+) x (\d+)/.exec(t); return !!m && (+m[1] + +m[2]) !== (+m[1] * +m[2]); };
  let v = null;
  for (let poging = 0; poging < 25 && !(v && echtFout(v.vraag)); poging++) {
    v = (await fnd('/school/huiswerk/oefen', { code: gezin.code, token: kindToken, klasCode: klas.code, huiswerkId: hwId })).body;
  }
  assert.ok(v && echtFout(v.vraag),
    'na 25 rondes nog geen som waarin "plus in plaats van maal" ook echt fout is; gekregen: ' + JSON.stringify(v && v.vraag));
  const eerste = (await fnd('/school/huiswerk/oefen-antwoord', { code: gezin.code, token: kindToken,
    klasCode: klas.code, antwoord: plus(v.vraag) })).body;
  assert.equal(eerste.denkfout.id, 'maal.plus-in-plaats-van-maal');
  assert.ok(eerste.anders && eerste.anders.tekst, 'ook hier komt er een andere uitleg bij');

  const beeld = (await kl('/school/denkfout/klas')).body;
  const rij = beeld.patronen.find(x => x.id === 'maal.plus-in-plaats-van-maal');
  assert.ok(rij, 'de leraar ziet het patroon in zijn klas');
  assert.equal(rij.aantal, 1);
  assert.equal(rij.doel, 'rekenen.g5.tafels-tot-10');

  /* De grens: er staat NIET bij wie. Geen leerlingsleutel, geen naam, geen
     profielId -- en dus geen weg terug naar een kind. */
  const tekst = JSON.stringify(beeld);
  assert.doesNotMatch(tekst, /sleutel|profielId|Bram/i, 'het klasbeeld voert terug op een kind');

  // besproken is weg, en er blijft niets achter
  assert.equal((await kl('/school/denkfout/besproken', { doel: 'rekenen.g5.tafels-tot-10', denkfout: 'maal.plus-in-plaats-van-maal' })).status, 200);
  const na = (await kl('/school/denkfout/klas')).body;
  assert.equal(na.patronen.filter(x => x.id === 'maal.plus-in-plaats-van-maal').length, 0);
  assert.equal((await kl('/school/denkfout/besproken', { doel: 'rekenen.g5.tafels-tot-10', denkfout: 'maal.plus-in-plaats-van-maal' })).status, 404);
});
