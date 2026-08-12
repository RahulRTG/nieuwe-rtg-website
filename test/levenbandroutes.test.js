/* LEVEN.md fase 2 aan de BUITENKANT: de routes die de twee sessiewerelden aan
   elkaar knopen (server/routes/levenband.js).

   De kernregels zelf staan in test/levensband.test.js en worden hier niet
   overgedaan. Wat deze toets meet, bestaat alleen op dit niveau:

     - een RTG-lid en een gezinsprofiel bereiken elkaar echt, over twee
       inlogwerelden heen (de hele opbrengst van fase 2);
     - besluit 1 houdt ook stand als de twee kanten via verschillende deuren
       binnenkomen;
     - er lekt GEEN rauwe identiteit naar het scherm -- geen sessiesleutel en
       geen rtf-handle, alleen codenamen (privacy by design, CLAUDE.md);
     - een gast van het gezin (oppas, opa en oma) komt er niet in.

   Draai los: node --experimental-sqlite --test test/levenbandroutes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let lidTok, lidNaam;            // het RTG-lid
let code, kindTok, kindNaam;    // het gezinsprofiel van een kind
let ouderTok;                   // de beheerder van hetzelfde gezin
let gastTok;                    // een gastprofiel (oppas/familie)

function post(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// de gezinskant reist met gezinscode + profieltoken IN het lichaam, niet in een kop
const huis = (pad, body, tok) => post(pad, Object.assign({ code, token: tok }, body || {}));
const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-levenband-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;

  const t = Date.now();
  const reg = await post('/api/auth/register', { name: 'Band Anna', email: 'lb' + t + '@e.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
  lidTok = reg.body.token;
  assert.ok(lidTok, 'het lid krijgt een token');
  lidNaam = ((await post('/api/auth/me', {}, lidTok)).body.user || {}).codename;
  assert.ok(lidNaam, 'en een codenaam: ' + JSON.stringify(lidNaam));

  const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Huis ' + t, naam: 'Ouder', pin: '1234' });
  code = g.body.code;
  ouderTok = g.body.token;
  assert.ok(code && ouderTok, 'het gezin bestaat');

  const kind = await post('/api/foundation/gezin/profiel/maak', { code, token: ouderTok, naam: 'Kind', rol: 'kind', groep: 'po' });
  kindNaam = kind.body.profiel.codenaam;
  assert.ok(kindNaam, 'het kind heeft een codenaam');
  kindTok = (await post('/api/foundation/gezin/profiel/kies', { code, profielId: kind.body.profiel.id })).body.token;
  assert.ok(kindTok, 'en een profieltoken');

  const gast = await post('/api/foundation/gezin/profiel/maak', { code, token: ouderTok, naam: 'Oppas', rol: 'gast' });
  gastTok = (await post('/api/foundation/gezin/profiel/kies', { code, profielId: gast.body.profiel.id })).body.token;
  assert.ok(gastTok, 'de oppas kan gewoon inloggen -- en hoort hier tóch niets te mogen');
});
test.after(() => stop(srv && srv.child));

test('1. zonder inlog blijft alles dicht, aan beide kanten', async () => {
  assert.equal((await post('/api/leven/kring', {})).status, 401, 'de ledenkant vraagt om een token');
  assert.equal((await post('/api/rtf/leven/kring', { code, token: 'nep' })).status, 403,
    'de gezinskant vraagt om een geldig profieltoken');
});

/* MUTATIE GEZIEN ZAKKEN: in routes/levenband.js de regel `if (sess.gast)` uit
   gezinsPoort verwijderd; zakte hier. De kern kan dit niet vangen -- die kent
   geen gasten en ziet alleen een identiteit. */
test('2. een gast van het gezin (oppas, opa en oma) legt geen banden', async () => {
  const r = await huis('/api/rtf/leven/kring', {}, gastTok);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /gezinsleden zelf/,
    'bezit van de gezinscode is geen instemming -- zie kern/levensband/index.js besluit 1');
});

/* MUTATIE GEZIEN ZAKKEN: in routes/levenband.js de bevestig-actie een andere
   identiteit laten doorgeven zodra de aanvrager zelf bevestigde (de klassieke
   "namens"-achterdeur); zakte hier. */
test('3. een lid vraagt een band op CODENAAM, en het kind bevestigt hem', async () => {
  const v = await post('/api/leven/band/vraag', { codenaam: kindNaam, soort: 'mentor', vervalt: dag(200) }, lidTok);
  assert.equal(v.status, 200, JSON.stringify(v.body));

  /* Besluit 1, nu over twee inlogwerelden heen: het lid vroeg, dus het lid
     bevestigt niet -- ook niet nu de andere kant een heel andere deur heeft. */
  const zelf = await post('/api/leven/band/bevestig', { bandId: v.body.band.id }, lidTok);
  assert.equal(zelf.status, 403);
  assert.match(zelf.body.error, /zelf gestuurd/);

  /* En de OUDER van het kind bevestigt evenmin, terwijl hij in dezelfde
     gezinssessie zit. Een band hangt aan de mens, niet aan het huishouden. */
  const doorOuder = await huis('/api/rtf/leven/band/bevestig', { bandId: v.body.band.id }, ouderTok);
  assert.equal(doorOuder.status, 403);

  const ok = await huis('/api/rtf/leven/band/bevestig', { bandId: v.body.band.id }, kindTok);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.band.staat, 'bevestigd');
});

test('4. een onbekende codenaam levert geen lijst met bijna-treffers op', async () => {
  const r = await post('/api/leven/band/vraag', { codenaam: 'Bestaat Niet 0000', soort: 'mentor' }, lidTok);
  assert.equal(r.status, 404);
  assert.equal(JSON.stringify(r.body).includes('rtf:'), false, 'en al helemaal geen handles');
});

test('5. de bevestigde band geeft uit zichzelf niets; het kind deelt per stuk', async () => {
  const kring = (await post('/api/leven/kring', {}, lidTok)).body;
  const band = kring.banden[0];
  assert.equal(band.ander, kindNaam, 'het lid ziet met wie hij een band heeft');
  assert.deepEqual(band.ikZie, [], 'en ziet standaard NIETS van het kind (LEVEN.md par. 2.8)');

  const geenDatum = await huis('/api/rtf/leven/deel/zet', { bandId: band.id, stuk: 'afspraken' }, kindTok);
  assert.equal(geenDatum.status, 400);
  assert.match(geenDatum.body.error, /Tot wanneer/, 'delen zonder einddatum kan niet');

  const d = await huis('/api/rtf/leven/deel/zet', { bandId: band.id, stuk: 'afspraken', vervalt: dag(30) }, kindTok);
  assert.equal(d.status, 200, JSON.stringify(d.body));

  const na = (await post('/api/leven/kring', {}, lidTok)).body.banden[0];
  assert.deepEqual(na.ikZie.map((s) => s.stuk), ['afspraken'], 'precies wat het kind gaf');
  assert.deepEqual(na.ikDeel, [], 'en het lid gaf zelf nog niets terug -- een band is geen ruil');

  const uit = await huis('/api/rtf/leven/deel/in', { delingId: d.body.deling.id }, kindTok);
  assert.equal(uit.status, 200, 'intrekken kan altijd');
  assert.deepEqual((await post('/api/leven/kring', {}, lidTok)).body.banden[0].ikZie, []);
});

test('6. het dagboek is via de route net zo min deelbaar als in de kern', async () => {
  const band = (await post('/api/leven/kring', {}, lidTok)).body.banden[0];
  const r = await huis('/api/rtf/leven/deel/zet', { bandId: band.id, stuk: 'dagboek', vervalt: dag(30) }, kindTok);
  assert.equal(r.status, 403, 'par. 2.5: een droom en een dagboek zijn van de mens zelf');
});

/* MUTATIE GEZIEN ZAKKEN: in routes/levenband.js `ander: naam(ander)` vervangen
   door `ander: ander`; zakte hier op de rauwe sessiesleutel in het antwoord.
   Dit is de enige toets die dat lek kan vangen -- de kern geeft de identiteit
   met opzet onbewerkt terug, want zij weet niet wie er meekijkt. */
test('7. er lekt geen enkele rauwe identiteit naar het scherm', async () => {
  const lid = JSON.stringify((await post('/api/leven/kring', {}, lidTok)).body);
  const kind = JSON.stringify((await huis('/api/rtf/leven/kring', {}, kindTok)).body);
  for (const [wie, tekst] of [['het lid', lid], ['het kind', kind]]) {
    assert.equal(tekst.includes('rtf:'), false, wie + ' hoort geen rtf-handle te zien, alleen een codenaam');
    assert.equal(tekst.includes(code), false, wie + ' hoort de gezinscode niet in dit antwoord te vinden');
  }
  assert.ok(lid.includes(kindNaam), 'wel de codenaam van de ander -- anders weet niemand met wie hij een band heeft');
  assert.ok(kind.includes(lidNaam), 'en omgekeerd');
});

test('8. elke kant verbreekt, en dan is de weg terug dicht', async () => {
  const band = (await huis('/api/rtf/leven/kring', {}, kindTok)).body.banden[0];
  assert.equal((await huis('/api/rtf/leven/band/verbreek', { bandId: band.id }, kindTok)).status, 200);
  assert.deepEqual((await post('/api/leven/kring', {}, lidTok)).body.banden, [],
    'een verbroken band staat bij niemand meer in de lijst');
  const opnieuw = await huis('/api/rtf/leven/deel/zet', { bandId: band.id, stuk: 'afspraken', vervalt: dag(30) }, kindTok);
  assert.equal(opnieuw.status, 400, 'en er valt niets meer over te delen');
});

/* ---------------------------------------------------------------------------
   HET BELEID EN WAT ER EINDIGDE, over de route.

   De regels zelf staan in test/levensbeleid.test.js -- die toetst de kern
   rechtstreeks en komt hier niet langs een deur binnen. Precies daarom stonden
   deze zes routes in geen enkele toets: de laag was gedekt, de weg ernaartoe
   niet. Wat hier gemeten wordt bestaat alleen op dit niveau: dat BEIDE
   inlogwerelden hetzelfde beleid bereiken, elk met hun eigen poort.
   --------------------------------------------------------------------------- */

/* MUTATIE: in routes/levenband.js `gezinsPoort` bij de rtf-beleidsroutes
   vervangen door niets; deze toets zakt dan op de tweede bewering. */
test('9. beide werelden lezen hun eigen beleid, en het zegt zelf dat vooraf delen niet bestaat', async () => {
  const lid = await post('/api/leven/beleid', {}, lidTok);
  assert.equal(lid.status, 200, JSON.stringify(lid.body));
  assert.equal(lid.body.vooraafDelenMogelijk, false,
    'een FEIT en geen instelling: zonder deze zin gaat iemand die stand zoeken');
  assert.ok(Array.isArray(lid.body.stukken) && lid.body.stukken.length, 'de stukken staan erbij');
  assert.ok(lid.body.grens && lid.body.grens.min < lid.body.grens.max, 'en de grenzen van de termijn');

  const kind = await huis('/api/rtf/leven/beleid', {}, kindTok);
  assert.equal(kind.status, 200, JSON.stringify(kind.body));
  assert.equal(kind.body.vooraafDelenMogelijk, false, 'ook aan de gezinskant');

  const zonder = await post('/api/rtf/leven/beleid', {});
  assert.equal(zonder.status >= 400, true, 'zonder gezinspoort komt niemand hier binnen');
});

/* MUTATIE: in kern/levensbeleid/index.js de grenscontrole op standaardTot
   weghalen; de derde bewering zakt dan. */
test('10. het beleid versmalt en wordt bewaard, en een termijn buiten de grens wordt geweigerd', async () => {
  const zet = await post('/api/leven/beleid/zet', { stuk: 'gezondheid', nooit: true }, lidTok);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal(zet.body.gewijzigd, true);
  assert.ok(zet.body.beleid.nooit.includes('gezondheid'), 'het slot zit erop');

  const opnieuw = await post('/api/leven/beleid', {}, lidTok);
  assert.ok(opnieuw.body.nooit.includes('gezondheid'), 'en hij staat er de volgende keer nog');

  const teLang = await post('/api/leven/beleid/zet', { standaardTot: 100000 }, lidTok);
  assert.equal(teLang.status, 400, 'een termijn buiten de grens is geen beleid maar een fout');

  const onzin = await post('/api/leven/beleid/zet', { stuk: 'verzonnen' }, lidTok);
  assert.equal(onzin.status, 400, 'een stuk dat niet bestaat wordt geweigerd, niet stil genegeerd');

  const kind = await huis('/api/rtf/leven/beleid/zet', { stuk: 'talenten', nooit: true }, kindTok);
  assert.equal(kind.status, 200, JSON.stringify(kind.body));
  assert.ok(kind.body.beleid.nooit.includes('talenten'), 'de gezinskant zet zijn eigen slot');
  assert.equal((await post('/api/leven/beleid', {}, lidTok)).body.nooit.includes('talenten'), false,
    'en dat slot is van hem alleen -- twee mensen, twee beleiden');
});

/* MUTATIE: in kern/levensband/banden.js `beeindigd()` ook `verbrokenDoor` mee
   laten geven; de laatste bewering zakt dan. */
test('11. wat onlangs eindigde staat er, zonder wie het deed en zonder reden', async () => {
  const lid = await post('/api/leven/beeindigd', {}, lidTok);
  assert.equal(lid.status, 200, JSON.stringify(lid.body));
  assert.equal(lid.body.banden.length, 1, 'toets 8 verbrak er een, en die staat hier binnen het venster');
  const b = lid.body.banden[0];
  assert.ok(b.beeindigdAt, 'met de dag erbij -- dat is wat je wil weten');

  const kind = await huis('/api/rtf/leven/beeindigd', {}, kindTok);
  assert.equal(kind.status, 200);
  assert.equal(kind.body.banden.length, 1, 'beide kanten zien dat het voorbij is');

  /* LEVEN.md par. 2.8: verbreken kan zonder uitleg. Bij een band met een kind
     zou "wie" van een gewone handeling een verantwoording maken. */
  const tekst = JSON.stringify(lid.body) + JSON.stringify(kind.body);
  for (const woord of ['verbrokenDoor', 'reden', kindNaam, lidNaam]) {
    assert.equal(tekst.includes(woord), false, woord + ' hoort hier niet in te staan');
  }
});
