/* De leerlingdeur: geboortedatum -> leeftijdspas -> passende apps, plus een
   Schoolpas uit een echte klasinschrijving. Directe schermen gebruiken exact
   dezelfde serverbeslissing. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { APPS } = require('../server/kern/rtfbieb');

let srv, base, gezin, kind, tiener, zonder;
const post = async (pad, body, prefix = '/api/foundation') => {
  const r = await fetch(base + prefix + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
async function profiel(naam, geboortedatum, groep) {
  const p = (await post('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam, rol: 'kind', geboortedatum, groep })).body.profiel;
  const k = (await post('/gezin/profiel/kies', { code: gezin.code, profielId: p.id })).body;
  return { code: gezin.code, token: k.token, id: p.id, profiel: k.profiel };
}
const toegang = (sess, extra) => post('/toegang', Object.assign({ code: sess.code, token: sess.token, scherm: 'campus' }, extra || {}), '/api/rtf');
const leer = (sess, pad, body) => post('/leerling' + pad, Object.assign({ code: sess.code, token: sess.token }, body || {}), '/api/rtf');

test.before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-leerlingdeur-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } }); base = srv.base;
  gezin = (await post('/gezin/maak', { gezinsnaam: 'Toegang', naam: 'Beheerder', pin: '1234' })).body;
  kind = await profiel('Mila', '2018-06-01');
  tiener = await profiel('Sam', '2012-06-01');
  zonder = await profiel('Oud profiel', '', 'kind');
});
test.after(() => stop(srv && srv.child));

test('geboortedatum bepaalt de groep en wordt niet op de profielkeuzedeur gelekt', async () => {
  assert.equal(kind.profiel.groep, 'kind');
  assert.equal(kind.profiel.leeftijdBevestigd, true);
  assert.equal(kind.profiel.geboortedatum, null, 'de profielkeuze deelt geen exacte geboortedatum');
  const lijst = await post('/gezin/inloggen', { code: gezin.code });
  assert.ok(lijst.body.profielen.every(p => p.geboortedatum == null));
  const kindMij = await fetch(base + '/api/foundation/gezin/' + gezin.code + '/mij', { headers: { Authorization: 'Bearer ' + kind.token } }).then(r => r.json());
  assert.ok(kindMij.profielen.every(p => p.geboortedatum == null), 'een leerling ziet geen exacte geboortedata van het gezin');
  const beheerMij = await fetch(base + '/api/foundation/gezin/' + gezin.code + '/mij', { headers: { Authorization: 'Bearer ' + gezin.token } }).then(r => r.json());
  assert.equal(beheerMij.profielen.find(p => p.id === kind.id).geboortedatum, '2018-06-01', 'alleen de beheerder kan de geboortedatum onderhouden');
});

test('zonder bevestigde leeftijdspas blijft de Campus fail-closed', async () => {
  const r = await toegang(zonder);
  assert.equal(r.status, 403);
  assert.match(r.body.reden, /geboortedatum/i);
  assert.deepEqual(r.body.passen, ['foundation']);
});

test('kind en tiener krijgen automatisch verschillend aanbod', async () => {
  const k = await toegang(kind), t = await toegang(tiener);
  assert.equal(k.status, 200); assert.equal(t.status, 200);
  assert.ok(k.body.passen.includes('leeftijd') && k.body.passen.includes('leerling'));
  assert.ok(k.body.apps.includes('rtf-school'));
  assert.ok(!k.body.apps.includes('rtf-mediawijs'), 'tienertool blijft dicht voor een kind');
  assert.ok(t.body.apps.includes('rtf-mediawijs'), 'tiener krijgt de tienertool automatisch');
  assert.ok(!k.body.apps.includes('rtf-bord'), 'leerling krijgt nooit de begeleiderskant van het bord');
  assert.ok(k.body.apps.includes('rtf-schrift'), 'het leerlingenschrift is wel beschikbaar');
  const directKind = await toegang(kind, { scherm: 'app', appId: 'rtf-mediawijs' });
  const directTiener = await toegang(tiener, { scherm: 'app', appId: 'rtf-mediawijs' });
  assert.equal(directKind.status, 403); assert.equal(directTiener.status, 200);
});

test('de leerpaspoortserver filtert de ladder én directe hogere verzoeken', async () => {
  const k = await leer(kind, '/ladder');
  assert.equal(k.status, 200);
  assert.deepEqual([...new Set(k.body.fasen.map(f => f.trap))], ['po']);
  const t = await leer(tiener, '/ladder');
  assert.deepEqual([...new Set(t.body.fasen.map(f => f.trap))], ['po', 'vo']);
  assert.equal((await leer(kind, '/inschrijf', { fase: 'wo-b' })).status, 403);
  assert.equal((await leer(kind, '/inschrijf', { fase: 'po-g5' })).status, 200);
  assert.equal((await leer(zonder, '/ladder')).status, 403);
});

test('een echte klasinschrijving activeert de Schoolpas automatisch', async () => {
  const sch = (await post('/school/school/maak', { naam: 'De Horizon', plaats: 'Utrecht' })).body;
  const inlog = await post('/office/login', { code: 'RTG-OFFICE' }, '/api');
  await fetch(base + '/api/office/school/decide', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + inlog.body.token }, body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  const p = (await post('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Noor', rol: 'leraar' })).body;
  await post('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const klas = (await post('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Groep 5' })).body;
  assert.equal((await post('/school/koppel', { code: kind.code, token: kind.token, klasCode: klas.code })).status, 200);
  const r = await toegang(kind);
  assert.ok(r.body.passen.includes('school'));
  assert.equal(r.body.school.actief, true);
  assert.equal(r.body.school.aantalKlassen, 1);
});

/* DRIE SCHERMEN DRAGEN DE DEUR MET OPZET NIET, en dat is per stuk een besluit.

   `privacy` stond hier al: inzage, export en verwijdering zijn WETTELIJKE
   RECHTEN, en een deur waarmee RTG die kan sluiten hoort niet te bestaan.

   `onveilig` en `wegwijzer` zijn er sinds 2 september 2026 bij, om een reden van
   dezelfde soort: dit zijn de twee schermen voor iemand die in gevaar is. Wie
   daar aanklopt heeft heel vaak geen account, en sessie.js toont zonder toegang
   "Deze ruimte blijft nog dicht" -- precies de zin die deze twee schermen
   onbruikbaar zou maken voor de mens voor wie ze bestaan. Een deur die eerst een
   account vraagt, is voor hem geen deur (HDI.md par. 7.3).

   DE UITZONDERING BEWIJST ZICHZELF, en dat is de helft die telt: hieronder wordt
   niet alleen overgeslagen maar ook VASTGELEGD dat deze drie de deur echt niet
   dragen. Zonder die tegencontrole is een uitzonderingenlijst een plek waar een
   scherm stil in verdwijnt zodra iemand hem eraan toevoegt. */
const ZONDER_DEUR = new Map([
  ['privacy', 'inzage, export en verwijdering zijn wettelijke rechten; een knop waarmee RTG die kan sluiten hoort niet te bestaan'],
  ['onveilig', 'de hulpwijzer bij geweld en uitbuiting: wie hier aanklopt heeft vaak geen account, en een dichte deur is hier het gevaar zelf'],
  ['wegwijzer', 'zelf een hulpvraag achterlaten zonder account, zonder naam en zonder adres; een sessiedeur zou de voordeur sluiten']
]);

test('elk niet-openbaar catalogusscherm draagt de centrale sessiedeur', () => {
  const pub = path.join(__dirname, '..', 'public');
  for (const app of APPS) {
    const url = new URL(app.url, 'https://rtg.test');
    if (!url.pathname.startsWith('/apps/foundation/')) continue;
    const bron = fs.readFileSync(path.join(pub, url.pathname.slice(1)), 'utf8');
    if (ZONDER_DEUR.has(app.sleutel)) {
      /* De tegencontrole: zo'n scherm hoort de deur ECHT niet te dragen. Draagt
         hij hem alsnog, dan klopt de uitzondering niet meer en hoort iemand daar
         opnieuw naar te kijken -- in beide richtingen. */
      assert.ok(!/sessie\.js/.test(bron),
        app.naam + ' staat als uitzondering (' + ZONDER_DEUR.get(app.sleutel) + ') maar draagt de deur ' +
        'wel; haal hem uit de lijst of uit het scherm');
      continue;
    }
    assert.match(bron, /sessie\.js/, app.naam + ' mist de centrale leerlingdeur');
  }
  /* En de lijst mag niet stil groeien: elke uitzondering hoort ook echt in de
     catalogus te staan. Een sleutel die nergens meer bestaat, is een vergeten
     regel die de volgende uitzondering dekt. */
  for (const sleutel of ZONDER_DEUR.keys()) {
    assert.ok(APPS.some(a => a.sleutel === sleutel),
      'de uitzondering "' + sleutel + '" hoort bij geen enkel scherm meer; haal hem weg');
  }
  const sessie = fs.readFileSync(path.join(pub, 'apps', 'foundation', 'sessie.js'), 'utf8');
  assert.match(sessie, /\/api\/rtf\/toegang/);
  assert.match(sessie, /Deze ruimte blijft nog dicht/);
});

test('live lessen lekken geen sleutels en klaswerk gebruikt geen ranglijst', () => {
  const pub = path.join(__dirname, '..', 'public');
  const leren = fs.readFileSync(path.join(pub, 'apps', 'foundation', 'leren.html'), 'utf8');
  const bord = fs.readFileSync(path.join(pub, 'apps', 'foundation', 'bord.html'), 'utf8');
  const schrift = fs.readFileSync(path.join(pub, 'apps', 'foundation', 'schrift.html'), 'utf8');
  const klas = fs.readFileSync(path.join(pub, 'apps', 'foundation', 'klas.html'), 'utf8');
  const tijdelijkeSessies = fs.readFileSync(path.join(pub, 'shared', 'rtg-school-session.js'), 'utf8');
  const lesmaker = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'lesmaker.js'), 'utf8');
  assert.match(leren, /RTGSchoolSession/);
  for (const bron of [bord, schrift]) {
    assert.match(bron, /rtg-school-session\.js/);
    assert.match(bron, /history\.replaceState/);
    assert.doesNotMatch(bron, /localStorage\.setItem\(['"]rtf_(?:docent|leerling)/);
  }
  assert.match(tijdelijkeSessies, /sessionStorage\.setItem/);
  assert.doesNotMatch(klas, /LES\.stand/);
  assert.match(klas, /geen podium/i);
  assert.match(klas, /geen wedstrijd/i);
  assert.doesNotMatch(lesmaker, /stand:\s*publiekeStand/);
});
