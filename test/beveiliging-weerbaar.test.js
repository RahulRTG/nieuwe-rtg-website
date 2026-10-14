/* HET BEVEILIGINGSJOURNAAL EN DE NOODREM, WEERBAAR (server/beveiliging.js en
   server/beveiliging-noodrem.js).

   Het journaal neemt de hoog-signaal-gebeurtenissen aan ("we worden
   aangevallen"), voegt herhalingen samen, escaleert kritiek naar de eigenaar
   met een rem, en voedt de noodrem-ladder. test/beveiliging.test.js toetst de
   gewone weg en de ladder; test/sensorstilte.test.js de verloren melding. Hier
   de randen waar een aanvaller het journaal kan laten liegen of zwijgen.

   Wat hier niet mag sneuvelen:
   1. een onbekende ernst wordt geen "info" (dan zou een aanvaller zijn eigen
      melding kunnen wegzetten) maar een waarschuwing;
   2. samenvoegen mag een melding nooit LICHTER maken: een kritieke herhaling
      tilt de regel op, een lichtere herhaling laat hem kritiek;
   3. een afgehandelde melding of een melding van langer dan twee minuten
      geleden wordt niet stil opgeteld bij een oude regel, maar is een nieuwe;
   4. het journaal is begrensd (200), nieuwste eerst;
   5. de eigenaar hoort het na vijf minuten opnieuw, en een omvallende
      meldingsdienst neemt de melding niet mee in zijn val;
   6. de noodrem telt alleen brute force BINNEN tien minuten, slaat meldingen
      zonder bron over, en een quarantaine-haak die omvalt houdt de ladder niet
      tegen;
   7. een zekering die niet bestaat, of al gesprongen is, laat de noodrem niet
      omvallen en niet dubbel melden;
   8. de noodrem-stand is van de eigenaar en wordt bewaard.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - beveiliging.js meld: `ernst = ERNST[ernst] == null ? 'waarschuwing' : ernst`
     vervangen door `... ? 'info' : ernst`
     -> "1. een onbekende ernst" ZAKT (RAAK).
   - beveiliging.js meld: `if (score(ernst) > score(kop.ernst)) kop.ernst = ernst`
     vervangen door `kop.ernst = ernst`
     -> "2. samenvoegen maakt nooit lichter" ZAKT (RAAK).
   - beveiliging-noodrem.js: `(nu - m.atMs) < NOODREM_VENSTER_MS` vervangen door
     `true`
     -> "6. de noodrem telt alleen binnen tien minuten" ZAKT (RAAK).
   - beveiliging-noodrem.js: de `try { ... } catch (e) {}` rond isoleerBron
     weggehaald
     -> "6b. een quarantaine-haak die omvalt" ZAKT (RAAK).

   Draai: node --test test/beveiliging-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/beveiliging');

function opzet(extra) {
  const db = (extra && extra.db) || { data: {} };
  const naarEigenaar = [];
  let saves = 0;
  const bev = maak(Object.assign({ db, save: () => { saves++; }, notifyOwner: (n) => naarEigenaar.push(n) }, extra || {}));
  return { db, bev, naarEigenaar, saves: () => saves };
}
function metKlok(t0) {
  const echt = Date.now;
  let nu = t0;
  Date.now = () => nu;
  return { verder: (ms) => { nu += ms; }, terug: () => { Date.now = echt; } };
}
const zekering = (db, id) => (db.data.techniek.zekeringen || {})[id] || { aan: true };

test('1. een onbekende ernst wordt een waarschuwing, nooit info of kritiek', () => {
  const { bev, naarEigenaar } = opzet();
  const m = bev.meld('vreemd', 'paniek', 't', { bron: 'a' });
  assert.equal(m.ernst, 'waarschuwing');
  assert.equal(bev.meld('leeg', undefined, 't').ernst, 'waarschuwing');
  assert.equal(naarEigenaar.length, 0);
  const s = bev.samenvatting();
  assert.equal(s.waarschuwing, 2);
  assert.equal(s.kritiek, 0);
  // zonder meta: een lege bron en een lege meta, geen crash
  const zonder = bev.meld('kaal', 'info', 't');
  assert.deepEqual(zonder.meta, {});
  assert.equal(zonder.sleutel, 'kaal|');
});

test('2. samenvoegen maakt een melding nooit lichter, wel zwaarder', () => {
  const { bev, naarEigenaar } = opzet();
  bev.meld('tech-login-mislukt', 'info', 'een', { bron: 'x' });
  const kop = bev.meld('tech-login-mislukt', 'kritiek', 'twee', { bron: 'x' });
  assert.equal(kop.aantal, 2);
  assert.equal(kop.ernst, 'kritiek', 'een kritieke herhaling tilt de regel op');
  assert.equal(naarEigenaar.length, 1, 'en die kritieke herhaling escaleert');
  const na = bev.meld('tech-login-mislukt', 'info', 'drie', { bron: 'x' });
  assert.equal(na.ernst, 'kritiek', 'een lichtere herhaling zet een kritieke regel niet terug');
  assert.equal(na.tekst, 'drie', 'de tekst is die van de laatste poging');
  assert.equal(bev.openKritiek(), 1);
});

test('3. afgehandeld of ouder dan twee minuten: een nieuwe regel, geen stille optelling', () => {
  const klok = metKlok(1e12);
  try {
    const { bev } = opzet();
    const a = bev.meld('waf', 'waarschuwing', 'a', { bron: 'ip' });
    bev.handelAf(a.id);
    const b = bev.meld('waf', 'waarschuwing', 'b', { bron: 'ip' });
    assert.notEqual(b.id, a.id, 'na afhandelen is een herhaling een nieuw feit');
    assert.equal(b.aantal, 1);
    klok.verder(2 * 60000 - 1);
    assert.equal(bev.meld('waf', 'waarschuwing', 'c', { bron: 'ip' }).aantal, 2, 'net binnen het venster telt hij op');
    klok.verder(2 * 60000);
    const d = bev.meld('waf', 'waarschuwing', 'd', { bron: 'ip' });
    assert.equal(d.aantal, 1, 'buiten het venster een nieuwe regel');
    assert.equal(bev.samenvatting().recent.length, 3);
    // alleen de KOP wordt samengevoegd: een tussenliggende andere melding breekt de reeks
    bev.meld('ander', 'info', 'x', { bron: 'q' });
    assert.equal(bev.meld('waf', 'waarschuwing', 'e', { bron: 'ip' }).aantal, 1);
  } finally { klok.terug(); }
});

test('4. het journaal is begrensd op 200, nieuwste eerst, en de samenvatting op haar limiet', () => {
  const { bev, db } = opzet();
  for (let i = 0; i < 205; i++) bev.meld('m', 'info', 't' + i, { bron: 'b' + i });
  assert.equal(db.data.techniek.beveiliging.length, 200);
  assert.equal(db.data.techniek.beveiliging[0].tekst, 't204');
  assert.equal(db.data.techniek.beveiliging[199].tekst, 't5');
  const s = bev.samenvatting();
  assert.equal(s.recent.length, 40, 'standaard veertig op het bord');
  assert.equal(bev.samenvatting(3).recent.length, 3);
  assert.deepEqual(Object.keys(s.recent[0]).sort(), ['aantal', 'afgehandeld', 'at', 'ernst', 'id', 'tekst', 'type'],
    'het bord krijgt geen meta (bronnen, adressen) mee');
  assert.equal(s.open, 200);
  assert.equal(s.autoReactie, true, 'de noodrem staat standaard aan');
});

test('5. de eigenaar hoort het na vijf minuten opnieuw; een omvallende meldingsdienst neemt de melding niet mee', () => {
  const klok = metKlok(1e12);
  try {
    const { bev, naarEigenaar } = opzet();
    bev.meld('tech-toegang-geweigerd', 'kritiek', 'eerste', { bron: 'u' });
    klok.verder(5 * 60000 - 1);
    bev.handelAf();
    bev.meld('tech-toegang-geweigerd', 'kritiek', 'tweede', { bron: 'u' });
    assert.equal(naarEigenaar.length, 1, 'binnen de rem geen tweede bericht');
    klok.verder(1);
    bev.handelAf();
    bev.meld('tech-toegang-geweigerd', 'kritiek', 'derde', { bron: 'u' });
    assert.equal(naarEigenaar.length, 2, 'na vijf minuten weer');
    assert.equal(naarEigenaar[1].body, 'derde');
    // de rem is per soort+bron: een andere bron escaleert meteen
    bev.meld('tech-toegang-geweigerd', 'kritiek', 'ander', { bron: 'v' });
    assert.equal(naarEigenaar.length, 3);
  } finally { klok.terug(); }

  const kapot = opzet({ notifyOwner: () => { throw new Error('mailserver plat'); } });
  const m = kapot.bev.meld('quarantaine', 'kritiek', 'x', { bron: 'q' });
  assert.equal(m.type, 'quarantaine', 'de melding staat in het journaal ondanks de dode meldingsdienst');
  assert.equal(kapot.bev.openKritiek(), 1);
  const geen = opzet({ notifyOwner: 'geen functie' });
  assert.equal(geen.bev.meld('quarantaine', 'kritiek', 'x').ernst, 'kritiek');
});

test('6. de noodrem telt alleen brute force binnen tien minuten, en geen meldingen zonder bron', () => {
  const klok = metKlok(1e12);
  try {
    const { bev, db } = opzet();
    bev.meld('brute-force', 'kritiek', 'x', { bron: 'oud1' });
    bev.meld('brute-force', 'kritiek', 'x', { bron: 'oud2' });
    klok.verder(10 * 60000);
    bev.meld('brute-force', 'kritiek', 'x', { bron: 'nieuw1' });
    assert.notEqual(zekering(db, 'registratie').aan, false, 'twee oude en een nieuwe zijn samen geen drie binnen het venster');
    // meldingen zonder bron of zonder meta tellen niet als aanvaller
    bev.meld('brute-force', 'kritiek', 'x');
    db.data.techniek.beveiliging.unshift({ type: 'brute-force', atMs: Date.now(), ernst: 'kritiek' });
    bev.meld('brute-force', 'kritiek', 'x', { bron: '' });
    assert.notEqual(zekering(db, 'registratie').aan, false, 'een melding zonder bron is geen bron');
    bev.meld('brute-force', 'kritiek', 'x', { bron: 'nieuw2' });
    bev.meld('brute-force', 'kritiek', 'x', { bron: 'nieuw3' });
    assert.equal(zekering(db, 'registratie').aan, false, 'drie verse bronnen: de registratie dicht');
    assert.equal(zekering(db, 'registratie').tot, Date.now() + 60 * 60000, 'en hij dooft na precies een uur');
    assert.match(zekering(db, 'registratie').reden, /vanaf 3 bronnen/);
    const ingreep = db.data.techniek.beveiliging.find(m => m.type === 'auto-reactie');
    assert.match(ingreep.tekst, /"Nieuwe registraties".*over 60 min/);
    assert.equal(ingreep.meta.bron, 'zekering:registratie');
  } finally { klok.terug(); }
});

test('6b. een quarantaine-haak die omvalt houdt de ladder niet tegen', () => {
  const { bev, db } = opzet();
  const geprobeerd = [];
  bev.zetIsoleer((bron) => { geprobeerd.push(bron); throw new Error('de wacht ligt plat'); });
  for (let i = 1; i <= 3; i++) bev.meld('brute-force', 'kritiek', 'x', { bron: 'b' + i, aanvaller: '198.51.100.' + i });
  assert.ok(geprobeerd.includes('198.51.100.3'), 'het adres dat klopte gaat naar de quarantaine, niet de bucket');
  assert.equal(geprobeerd.some(b => b.startsWith('b')), false);
  assert.equal(zekering(db, 'registratie').aan, false, 'trede 2 springt ook als trede 1 omviel');
  bev.zetIsoleer(null);
  bev.meld('brute-force', 'kritiek', 'x', { bron: 'b9', aanvaller: '198.51.100.9' });
  assert.equal(db.data.techniek.beveiliging[0].type, 'brute-force', 'zonder haak loopt hij gewoon door');
});

test('7. een zekering die niet bestaat of al gesprongen is: geen crash, geen dubbele melding', () => {
  const db = { data: { techniek: { zekeringen: { onderhoud: { aan: true } } } } };
  const { bev } = opzet({ db });
  for (let i = 1; i <= 6; i++) bev.meld('brute-force', 'kritiek', 'x', { bron: 'ip' + i });
  assert.equal(db.data.techniek.beveiliging.filter(m => m.type === 'auto-reactie').length, 0,
    'zonder registratie- of inlogzekering springt er niets en wordt er niets beweerd');
  assert.equal(db.data.techniek.zekeringen.onderhoud.aan, true);

  const db2 = { data: { techniek: { zekeringen: {
    registratie: { naam: 'Reg', aan: false, reden: 'handmatig' }, inlogpauze: { naam: 'Inlog', aan: true } } } } };
  const twee = opzet({ db: db2 });
  for (let i = 1; i <= 6; i++) twee.bev.meld('brute-force', 'kritiek', 'x', { bron: 'ip' + i });
  assert.equal(db2.data.techniek.zekeringen.registratie.reden, 'handmatig', 'een handmatig getrokken zekering wordt niet overschreven');
  assert.equal(db2.data.techniek.zekeringen.registratie.tot, undefined, 'en krijgt geen automatisch einde');
  const z = db2.data.techniek.zekeringen.inlogpauze;
  assert.equal(z.aan, false);
  assert.ok(z.tot - z.sindsGesprongen === 10 * 60000, 'de inlogpauze dooft na tien minuten');
  assert.equal(db2.data.techniek.beveiliging.filter(m => m.type === 'auto-reactie').length, 1);
});

test('8. de noodrem-stand is van de eigenaar, wordt bewaard, en een bestaande techniek-tak blijft heel', () => {
  const db = { data: { techniek: { functies: { x: 1 } } } };
  const { bev, saves } = opzet({ db });
  assert.equal(bev.autoAan(), true);
  const voor = saves();
  assert.equal(bev.zetAuto(0), false, 'elke onware waarde zet hem uit');
  assert.equal(saves(), voor + 1, 'de keuze wordt bewaard');
  assert.equal(db.data.techniek.autoReactie.aan, false);
  assert.equal(bev.samenvatting().autoReactie, false);
  assert.equal(bev.zetAuto('ja'), true);
  assert.deepEqual(db.data.techniek.functies, { x: 1 }, 'de rest van de techniek-tak wordt niet overschreven');
  // afhandelen zonder open meldingen bewaart niets
  const s0 = saves();
  assert.equal(bev.handelAf('bestaat-niet'), 0);
  assert.equal(bev.handelAf(), 0);
  assert.equal(saves(), s0);
  const m = bev.meld('x', 'info', 't');
  assert.equal(bev.handelAf(m.id), 1);
  assert.ok(db.data.techniek.beveiliging[0].afgehandeldAt, 'het tijdstip van afhandelen staat erbij');
  assert.equal(bev.handelAf(m.id), 0, 'twee keer afhandelen telt niet dubbel');
  assert.equal(bev.openTotaal(), 0);
});

test('9. een gemanipuleerde kop, een journaal dat niet te bewaren is, en een noodrem die niet te lezen is: nooit stil', () => {
  const stilte = require('../server/kern/command/sensorstilte');
  stilte._wis();
  try {
    const { bev, db } = opzet();
    bev.meld('waf', 'info', 'a', { bron: 'ip' });
    // iemand zette een onzin-ernst en haalde de teller weg in de opgeslagen kop
    Object.assign(db.data.techniek.beveiliging[0], { ernst: 'genegeerd' });
    delete db.data.techniek.beveiliging[0].aantal;
    const kop = bev.meld('waf', 'waarschuwing', 'b', { bron: 'ip' });
    assert.equal(kop.aantal, 2, 'een kop zonder teller telt als een, plus deze');
    assert.equal(kop.ernst, 'waarschuwing', 'een onzin-ernst in de kop wordt overschreven door een echte');

    // de noodrem uit: brute force springt niets, en de stand staat als "uit" op het bord
    bev.zetAuto(false);
    for (let i = 1; i <= 6; i++) bev.meld('brute-force', 'kritiek', 'x', { bron: 'n' + i });
    assert.equal((db.data.techniek.zekeringen || {}).registratie, undefined, 'uitgezet: er wordt niet eens een zekering aangeraakt');
    assert.equal(stilte.oordeel().find(r => r.naam === 'noodrem').stand, 'uit');

    // een opslag die weigert: de melding gaat niet stil verloren -- de aanroeper hoort het, en de bewaking telt hem
    const kapot = opzet({ save: () => { throw new Error('schijf vol'); } });
    assert.throws(() => kapot.bev.meld('waf', 'waarschuwing', 'x', { bron: 'q' }), /schijf vol/);
    const rij = stilte.oordeel().find(r => r.naam === 'melding:beveiligingsjournaal');
    assert.equal(rij.stand, 'stil');
    assert.match(rij.reden, /^1 meldingen gingen verloren$/);

    // een noodrem waarvan de stand niet te lezen is, is stil en niet levend
    kapot.db.data = null;
    const nr = stilte.oordeel().find(r => r.naam === 'noodrem');
    assert.equal(nr.stand, 'stil');
    assert.match(nr.reden, /kon niet worden gelezen/);
  } finally { stilte._wis(); }
});

test('10. een opslag die faalt, houdt de eigenaar en de noodrem niet tegen', () => {
  /* Een volle schijf tijdens een aanval: de melding kan niet worden bewaard,
     maar de eigenaar heeft de schijf niet nodig om het te horen, en de noodrem
     springt in het geheugen. Vroeger gooide meld() vóór beide, en bleef het
     bij een verloren melding (WEERBAARHEID.md par. 9b: inperking wacht niet). */
  const stilte = require('../server/kern/command/sensorstilte');
  stilte._wis();
  try {
    const { bev, db, naarEigenaar } = opzet({ save: () => { throw new Error('schijf vol'); } });
    assert.throws(() => bev.meld('tech-toegang-geweigerd', 'kritiek', 'inbraak', { bron: 'x' }), /schijf vol/,
      'de aanroeper hoort nog steeds dat bewaren mislukte');
    assert.equal(naarEigenaar.length, 1, 'maar de eigenaar hoort het toch');
    assert.equal(naarEigenaar[0].body, 'inbraak');
    for (let i = 1; i <= 3; i++) assert.throws(() => bev.meld('brute-force', 'kritiek', 'x', { bron: 'b' + i }), /schijf vol/);
    assert.equal(zekering(db, 'registratie').aan, false, 'en de noodrem springt, ook zonder schijf');
    assert.equal(stilte.oordeel().find(r => r.naam === 'melding:beveiligingsjournaal').stand, 'stil', 'het verlies staat op het bord');
  } finally { stilte._wis(); }
});

test('11. een ernst uit het prototype is geen ernst', () => {
  const { bev } = opzet();
  for (const vals of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const m = bev.meld('vreemd-' + vals, vals, 't', { bron: vals });
    assert.equal(m.ernst, 'waarschuwing', vals + ' wordt een waarschuwing');
  }
  const s = bev.samenvatting();
  assert.equal(s.waarschuwing, 4, 'en telt dus mee in de samenvatting');
});
