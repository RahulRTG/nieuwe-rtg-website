/* DE PUBLIEKE AANWEZIGHEID EN DE REDACTIEHANDELING -- de twee besluiten van
   13 september, als toetsen in plaats van als zin.

   BESLUIT 1: een lid volgt een PUBLIEKE AANWEZIGHEID, gedragen door een mens of
   een organisatie, en die relatie is er EEN. De invariant die alles draagt:
   een aanwezigheid heeft nooit meer bevoegdheid dan haar drager -- zij is een
   projectieadres en geen actor. Toets 1 en 2 bewaken dat de vorm gesloten is.

   BESLUIT 2: uitlichten is een menselijke redactiehandeling. Geen AI, geen
   viraalscore, op naam, met een grond uit een gesloten lijst, en intrekken is
   even expliciet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);

function stel() {
  const db = { data: {} };
  const save = () => {};
  return require('../server/kern/mediaos/aanwezigheid')({ db, save, schoon, codenaamVan: (k) => 'CN-' + k });
}

test('1. de vorm is gesloten: een aanwezigheid draagt geen bevoegdheid', () => {
  const a = stel();
  /* Met opzet vergif meesturen: wie `mag`, `rollen` of `saldo` meegeeft, hoort
     het NIET terug te krijgen. Dat is de invariant in plaats van de belofte. */
  const p = a.aanwezigZorg('zaak', 'club-1', 'FC RTG', ['wedstrijd']);
  for (const veld of ['mag', 'rollen', 'saldo', 'bevoegdheden', 'tekenen'])
    assert.ok(!(veld in p), 'een aanwezigheid draagt geen `' + veld + '`');
  assert.deepEqual(Object.keys(p).sort(), ['at', 'drager', 'id', 'naam', 'soorten']);
});

test('2. de bron blijft wat hij is: de drager is een verwijzing en geen kopie', () => {
  const a = stel();
  const p = a.aanwezigZorg('lid', 'lid-7', 'Mila');
  assert.equal(p.drager.soort, 'lid');
  assert.equal(p.drager.code, 'lid-7');
  /* Een zaak wordt geen mens en een mens geen zaak: dezelfde code onder een
     andere drager is een ANDERE aanwezigheid. */
  const q = a.aanwezigZorg('zaak', 'lid-7', 'Iets anders');
  assert.notEqual(p.id, q.id);
});

test('3. volgen is expliciet, en twee keer volgen is een keer volgen', () => {
  const a = stel();
  const p = a.aanwezigZorg('zaak', 'club-1', 'FC RTG');
  assert.deepEqual(a.aanwezigVolgersVan(p.id), [], 'niemand volgt uit zichzelf');

  const een = a.aanwezigVolg('lid-2', p.id, true);
  const twee = a.aanwezigVolg('lid-2', p.id, true);
  assert.equal(een.ok, true);
  assert.equal(twee.ok, true);
  assert.deepEqual(a.aanwezigVolgersVan(p.id), ['lid-2'], 'de tweede oproep voegt niets toe');

  a.aanwezigVolg('lid-2', p.id, false);
  assert.deepEqual(a.aanwezigVolgersVan(p.id), [], 'ontvolgen is net zo expliciet');
});

test('4. jezelf volgen kan niet', () => {
  const a = stel();
  const p = a.aanwezigZorg('lid', 'lid-9', 'Mila');
  const r = a.aanwezigVolg('lid-9', p.id, true);
  assert.equal(r.status, 400);
});

test('5. het volgscherm zegt WAT je krijgt, en niet welk domein het komt', () => {
  const a = stel();
  const p = a.aanwezigZorg('zaak', 'fes-1', 'Zomerfestival', ['optreden', 'kaartverkoop']);
  const b = a.aanwezigBeeld(p);
  assert.deepEqual(b.watUKrijgt, ['optredens', 'kaartverkoop']);
  for (const woord of b.watUKrijgt)
    assert.ok(!/mediaos|kern|api/.test(woord), 'geen technische naam op het scherm: ' + woord);
});

/* ---------------------------------------------------------------------------
   BESLUIT 2: de redactiehandeling
   ------------------------------------------------------------------------ */
function salonStel(haak) {
  const db = { data: { posts: [{ id: 'p1', text: 'Een foto uit Kyoto', authorKey: 'lid-3' }] } };
  const save = () => {};
  const mod = require('../server/kern/salon/uitlichten')({
    db, save, schoon, codenaamVan: (k) => 'CN-' + k,
    nieuwMoment: haak || (() => ({ gewekt: [] })),
    aanwezigZorg: (soort, code, naam) => ({ id: soort + ':' + code, naam })
  });
  return { mod, db };
}

test('6. uitlichten gebeurt op naam: zonder redacteur gebeurt er niets', () => {
  const { mod, db } = salonStel();
  const r = mod.uitlicht(null, { postId: 'p1', grond: 'bijzonder' });
  assert.equal(r.status, 403);
  assert.ok(/gedeelde kantoorcode/.test(r.error), 'de reden noemt de gedeelde code');
  assert.ok(!db.data.posts[0].featured, 'en er is niets uitgelicht');
});

test('7. zonder grond geen uitlichting, en de grond komt uit een gesloten lijst', () => {
  const { mod } = salonStel();
  assert.equal(mod.uitlicht('user-1', { postId: 'p1' }).status, 400);
  /* Een verzonnen grond telt niet -- en juist een CIJFER hoort er niet in:
     "engagementscore 8,2" als grond is precies de automatisering die dit
     besluit tegenhoudt. */
  assert.equal(mod.uitlicht('user-1', { postId: 'p1', grond: 'engagement' }).status, 400);
  assert.equal(mod.uitlicht('user-1', { postId: 'p1', grond: 'bijzonder' }).ok, true);
});

test('8. hooguit een keer: een tweede uitlichting van dezelfde post wordt geweigerd', () => {
  const { mod, db } = salonStel();
  assert.equal(mod.uitlicht('user-1', { postId: 'p1', grond: 'lokaal' }).ok, true);
  const twee = mod.uitlicht('user-1', { postId: 'p1', grond: 'lokaal' });
  assert.equal(twee.status, 409);
  assert.equal(db.data.salonUitlicht.length, 1, 'en er staat er maar een in het register');
});

test('9. `featured` is een PROJECTIE van de handeling en niet zelf de waarheid', () => {
  const { mod, db } = salonStel();
  mod.uitlicht('user-1', { postId: 'p1', grond: 'actualiteit' });
  assert.equal(db.data.posts[0].featured, true);

  /* Een looptijd die om is: de post is niet meer uitgelicht, maar de handeling
     blijft staan. Wie later vraagt "is dit ooit uitgelicht en waarom", krijgt
     antwoord -- dat is het verschil met een vinkje. */
  db.data.salonUitlicht[0].tot = '2020-01-01T00:00:00.000Z';
  mod.uitlichtProjecteer();
  assert.equal(db.data.posts[0].featured, false);
  assert.equal(db.data.salonUitlicht.length, 1, 'de geschiedenis blijft');
  assert.equal(db.data.salonUitlicht[0].grond, 'actualiteit');
});

test('10. intrekken is even expliciet als uitlichten, en vraagt een reden', () => {
  const { mod, db } = salonStel();
  mod.uitlicht('user-1', { postId: 'p1', grond: 'talent' });
  assert.equal(mod.trekIn('user-1', { postId: 'p1' }).status, 400, 'zonder reden niet');
  assert.equal(mod.trekIn(null, { postId: 'p1', reden: 'x' }).status, 403, 'zonder naam niet');
  const r = mod.trekIn('user-2', { postId: 'p1', reden: 'Auteur wilde het niet.' });
  assert.equal(r.ok, true);
  assert.equal(db.data.posts[0].featured, false);
  assert.equal(db.data.salonUitlicht[0].ingetrokken.door, 'user-2');
});

test('11. het moment komt PAS na de mens, en hangt aan de aanwezigheid van de AUTEUR', () => {
  const gewekt = [];
  const { mod } = salonStel((id, soort, titel) => { gewekt.push({ id, soort, titel }); return { gewekt: [] }; });
  assert.deepEqual(gewekt, [], 'het plaatsen van een post wekt niets');
  mod.uitlicht('user-1', { postId: 'p1', grond: 'redactie' });
  assert.equal(gewekt.length, 1);
  assert.equal(gewekt[0].id, 'lid:lid-3', 'de aanwezigheid van de auteur, niet van de redactie');
  assert.equal(gewekt[0].soort, 'uitgelicht');
});

test('12. geen enkele viraal- of AI-module kan zelf uitlichten', () => {
  /* De bewaking is lexicaal en dat is hier genoeg: uitlichten loopt via deze ene
     module, en als salonviraal.js of salon/ai.js hem zou aanroepen, zou "RTG
     cureert" stil veranderen in "een engagementalgoritme cureert namens RTG". */
  for (const f of ['server/kern/salonviraal.js', 'server/kern/salon/ai.js', 'server/kern/salonpromo.js']) {
    const src = fs.readFileSync(path.join(WORTEL, f), 'utf8');
    assert.ok(!/uitlicht\s*\(/.test(src), f + ' roept uitlicht() niet aan');
    assert.ok(!/\.featured\s*=/.test(src), f + ' zet `featured` niet');
  }
});

/* ===========================================================================
   DISCOVERY EN DE FAN INBOX (13 september 2026)

   De twee helften die schakel 2 en 5 van scripts/momentproef.js openhielden:
   een fan kon een aanwezigheid niet VINDEN, en na de wek niet TERUGVINDEN.
   ======================================================================== */

/* Discovery woont sinds de splitsing in ../server/kern/mediaos/zoeken.js: die
   module raakt `db.data` niet aan en leest de aanwezigheden via `aanwezigAlle`,
   zodat de collectie EEN lezer en EEN schrijver houdt (keuring regel 63). */
function zoeker(a) {
  return require('../server/kern/mediaos/zoeken')({ a: null, aanwezig: a, SOORTEN: a.AANWEZIG_SOORTEN });
}

test('13. zoeken vindt een aanwezigheid die je nog niet volgt, en rangschikt niemand', () => {
  const a = stel();
  const z = zoeker(a);
  a.aanwezigZorg('zaak', 'NACHT', 'Proeffestival');
  a.aanwezigZorg('zaak', 'FCRTG', 'FC RTG');
  a.aanwezigZorg('lid', 'lid-1', 'CN-lid-1');

  /* 1. Vinden zonder het id te kennen -- dat is de hele schakel. */
  const r = z.aanwezigZoek('lid-9', 'proef');
  assert.equal(r.aanwezigheden.length, 1, 'op een stuk van de naam');
  assert.equal(r.aanwezigheden[0].id, 'zaak:NACHT');
  assert.equal(r.aanwezigheden[0].volgIk, false, 'en hij zegt erbij dat je hem nog niet volgt');
  assert.ok(r.aanwezigheden[0].watUKrijgt.length, 'met wat je zou gaan krijgen');

  /* 2. Op soort filteren doet hetzelfde werk vanuit de andere kant. */
  assert.ok(z.aanwezigZoek('lid-9', '', 'wedstrijd').aanwezigheden.length >= 2);
  assert.equal(z.aanwezigZoek('lid-9', 'bestaat-niet').aanwezigheden.length, 0);

  /* 3. DE GRENS: er komt geen volgerstelling uit, ook niet verstopt. Een cijfer
        over iemands publiek is het begin van een ranglijst, en de meeteenheid
        van deze laag is de gebeurtenis en nooit de mens (STAGE.md par. 5). */
  a.aanwezigVolg('lid-2', 'zaak:NACHT', true);
  a.aanwezigVolg('lid-3', 'zaak:NACHT', true);
  const na = z.aanwezigZoek('lid-9', 'proef').aanwezigheden[0];
  for (const sleutel of Object.keys(na))
    assert.ok(!/volgers|aantal|score|rang|populair/i.test(sleutel), 'geen telling in het veld ' + sleutel);
  assert.equal(JSON.stringify(na).includes('lid-2'), false, 'en geen enkele volger bij naam');

  /* 4. Jezelf vind je niet: volgen zou toch 400 geven, dus een treffer waar je
        niets mee kunt is een dood spoor. */
  assert.equal(z.aanwezigZoek('lid-1', 'CN-lid-1').aanwezigheden.length, 0);

  /* 5. Sorteren op naam en niet op iets wat op populariteit lijkt. */
  const alle = z.aanwezigZoek('lid-9', '').aanwezigheden.map(x => x.naam);
  assert.deepEqual(alle, [...alle].sort((x, y) => String(x).localeCompare(String(y))));
});

test('14. de tijdlijn toont wat je volgt, leest de naam LIVE en bewaart geen tweede waarheid', () => {
  const db = { data: {} };
  const save = () => {};
  const a = require('../server/kern/mediaos/aanwezigheid')({ db, save, schoon, codenaamVan: (k) => 'CN-' + k });
  const SOORT_NAAM = require('../server/kern/mediaos/wekken').SOORT_NAAM;
  /* De motor bezit de collectie niet meer: hij legt neer via ./tijdlijn.js, en
     die is als enige schrijver van `mediaMomenten`. */
  const tijdlijn = require('../server/kern/mediaos/tijdlijn')({ db, save, aanwezig: a, SOORT_NAAM });
  const w = require('../server/kern/mediaos/wekken').maakWekken({
    notify: () => {}, codenaamVan: (k) => 'CN-' + k, meldVan: () => ['wedstrijd', 'optreden'],
    bronnen: {}, aanwezig: a, tijdlijn
  });

  a.aanwezigZorg('zaak', 'FCRTG', 'FC RTG');
  a.aanwezigZorg('zaak', 'NACHT', 'Proeffestival');

  /* 1. EEN MOMENT WORDT VASTGELEGD, OOK ZONDER VOLGERS. Het feit staat los van
        de vraag of er iemand te wekken viel -- anders mist wie morgen volgt de
        hele voorgeschiedenis. */
  w.mediaNieuwMoment('zaak:FCRTG', 'wedstrijd', 'thuis tegen CD Salinas');
  assert.equal(db.data.mediaMomenten.length, 1, 'vastgelegd zonder een enkele volger');

  /* 2. De tijdlijn is een VENSTER op wat je volgt: niets volgen is niets zien. */
  assert.equal(tijdlijn.mediaMomentenVoor('lid-1').momenten.length, 0);
  a.aanwezigVolg('lid-1', 'zaak:FCRTG', true);
  const t = tijdlijn.mediaMomentenVoor('lid-1');
  assert.equal(t.momenten.length, 1);
  assert.equal(t.momenten[0].soort, 'wedstrijd');
  assert.equal(t.momenten[0].titel, 'thuis tegen CD Salinas');

  /* 3. En wat je NIET volgt blijft weg, ook al staat het in hetzelfde register. */
  w.mediaNieuwMoment('zaak:NACHT', 'optreden', 'Iemand op het hoofdpodium');
  assert.equal(tijdlijn.mediaMomentenVoor('lid-1').momenten.length, 1, 'het festival volgt hij niet');

  /* 4. DE GRENS UIT STAGE.md PAR. 2: de bron bepaalt DAT iets gebeurd is, Stage
        alleen hoe het hier staat. De NAAM wordt dus live gelezen -- hernoemt de
        club, dan staat de nieuwe naam er meteen -- terwijl de TITEL bij de
        gebeurtenis hoort en historisch is. Zonder dat verschil draagt dit
        register een kopie van de bron, en dat is precies de fout die deze tak
        al een keer heeft gemaakt. */
  a.aanwezigZorg('zaak', 'FCRTG', 'FC RTG Ibiza');
  const na = tijdlijn.mediaMomentenVoor('lid-1').momenten[0];
  assert.equal(na.naam, 'FC RTG Ibiza', 'de naam komt live uit de aanwezigheid');
  assert.equal(na.titel, 'thuis tegen CD Salinas', 'de titel blijft van het moment');
  assert.equal(db.data.mediaMomenten[0].naam, undefined, 'de naam staat NIET in het register');
});
