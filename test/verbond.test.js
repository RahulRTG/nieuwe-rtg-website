/* Het verbond tussen twee genootschappen (kern/verbond/, GEMEENSCHAP-FASE0.md
   par. 4.2) -- de module, los van de server.

   Wat hier vastligt: het verbond bezit geen leden en schrijft nooit in een
   genootschap; de kant komt uit de sessie; een lid van de ene kant ziet van de
   andere kant alleen de groepsnaam; een tekstwijziging zet beide tekens terug;
   opgezegd en verlopen zijn twee standen en allebei dicht voor nieuwe
   handelingen; een herhaalde tik geeft hetzelfde antwoord zonder tweede effect.

   De echte-serverproef (elke route minstens een keer) staat in
   test/verbond-server.test.js.

   Bij elke toets staat de MUTATIE die hem moet laten zakken; elk daarvan is een
   keer gedraaid en zakte (zie het commitbericht).
   Draai los: node --test test/verbond.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const keten = require('../server/lib/keten');
const partners = require('../server/kern/rtfos/partners');

const DAG = 86400000;
const datum = (ms) => new Date(ms).toISOString().slice(0, 10);

/* Een nagemaakt genootschap met dezelfde vier functies die het verbond
   gebruikt. Vier groepen: openbaar (1), besloten (2), geheim (3), en een vierde
   voor de tweemensenregel. `x` is beheerder van 1 en 2, en lid van 3. */
function opzet() {
  let klok = Date.parse('2026-10-11T10:00:00Z');
  const groepen = [
    { id: 1, naam: 'De Zeilclub', soort: 'openbaar', leden: [
      { key: 'aBeh', rol: 'beheerder' }, { key: 'aLid', rol: 'lid' }, { key: 'x', rol: 'beheerder' }] },
    { id: 2, naam: 'De Roeiclub', soort: 'besloten', leden: [
      { key: 'bBeh', rol: 'beheerder' }, { key: 'bLid', rol: 'lid' }, { key: 'x', rol: 'beheerder' }] },
    { id: 3, naam: 'De Stille Kamer', soort: 'geheim', leden: [
      { key: 'cBeh', rol: 'beheerder' }, { key: 'x', rol: 'lid' }] }
  ];
  const genootschap = {
    groepMet: (id) => groepen.find(g => String(g.id) === String(id)) || null,
    isLid: (gr, key) => (gr.leden || []).some(l => l.key === key),
    isBeheer: (gr, key) => (gr.leden || []).some(l => l.key === key && l.rol === 'beheerder')
  };
  const meldingen = [];
  const db = { data: {} };
  let bewaard = 0;
  const vb = require('../server/kern/verbond')({ db, save: () => { bewaard++; }, genootschap,
    notify: (key, note) => { meldingen.push({ key, note }); }, nu: () => klok });
  return { vb, db, groepen, meldingen, bewaard: () => bewaard, verzet: (ms) => { klok += ms; }, nu: () => klok };
}

const S = (key) => ({ key });
const AF = { geld: 'a', vrijwilligers: 'samen', persoonsgegevens: 'b', aansprakelijk: 'samen', rapportage: 'a' };
const voorstel = (o, extra) => o.vb.voorstel(S('aBeh'), Object.assign({ groep: 1, naar: 2,
  doel: 'Samen een zomerregatta organiseren.', afspraken: AF }, extra || {}));

// Zakt bij de mutatie: in voorstel de isBeheer-controle op grA weghalen -> het lid stelt voor en dit zakt.
test('1. alleen een beheerder stelt voor, en het voorstel is een concept dat de andere kant bereikt', () => {
  const o = opzet();
  const nee = o.vb.voorstel(S('aLid'), { groep: 1, naar: 2, doel: 'Iets samen doen.', afspraken: AF });
  assert.equal(nee.status, 403);
  assert.match(nee.error, /beheerder/);

  const r = voorstel(o);
  assert.ok(r.ok, r.error);
  assert.equal(r.verbond.stand, 'concept');
  assert.deepEqual(r.verbond.tekens, { a: null, b: null }, 'voorstellen is geen tekenen');
  // de melding gaat als OBJECT naar de SLEUTEL van de beheerder van de andere kant, en alleen daarheen
  // de beheerders van de Roeiclub (bBeh, en x die ook daar beheerder is); niet de voorsteller zelf, niet het lid
  assert.deepEqual(o.meldingen.map(m => m.key).sort(), ['bBeh', 'x']);
  for (const m of o.meldingen) {
    assert.equal(typeof m.note, 'object');
    assert.ok(m.note.title && m.note.body);
  }
});

// Zakt bij de mutatie: in voorstel de toetsAfspraken-uitslag negeren (`if (!t.ok)` weghalen) -> zakt.
test('2. invoer die niet klopt: een afspraak buiten a|b|samen is 400, een verzonnen groep 404', () => {
  const o = opzet();
  const fout = voorstel(o, { afspraken: { geld: 'rtf' } });
  assert.equal(fout.status, 400);
  assert.equal(fout.error, 'Bij "geld" hoort a, b of samen.');
  assert.equal(voorstel(o, { naar: 999 }).status, 404);
  assert.equal(voorstel(o, { groep: 999 }).status, 404);
  assert.equal(voorstel(o, { naar: 1 }).status, 400, 'een verbond met jezelf');
  assert.equal(voorstel(o, { doel: '' }).status, 400);
  assert.equal(voorstel(o, { van: '2026-12-01', tot: '2026-11-01' }).status, 400);
  assert.equal((o.db.data.verbonden || []).length, 0, 'geen enkele weigering liet een verbond achter');
});

// Zakt bij de mutatie: in voorstel de geheim-controle op grB weghalen -> aBeh vindt de Stille Kamer en dit zakt.
test('3. een geheim genootschap bestaat niet voor wie er niet in zit', () => {
  const o = opzet();
  const r = voorstel(o, { naar: 3 });
  assert.equal(r.status, 404);
  assert.equal(voorstel(o, { naar: 999 }).error, r.error, 'geheim en verzonnen geven hetzelfde antwoord');
  // x zit wel in de Stille Kamer en mag het voorstellen
  const x = o.vb.voorstel(S('x'), { groep: 1, naar: 3, doel: 'Een stille avond.', afspraken: AF });
  assert.ok(x.ok, x.error);
});

// Zakt bij de mutatie: in teken `kk.beheer.filter` vervangen door `R.KANTEN.filter` (elke kant tekenbaar) -> zakt.
test('4. een kant tekent voor zichzelf en nooit voor de andere; actief pas met beide', () => {
  const o = opzet();
  const id = voorstel(o).verbond.id;
  const b = o.vb.teken(S('bBeh'), id);
  assert.ok(b.ok, b.error);
  assert.equal(b.verbond.stand, 'getekend-b');
  assert.equal(b.verbond.tekens.a, null);
  assert.ok(b.verbond.tekens.b.doorMij);

  // bBeh nog een keer: hij heeft geen andere kant om voor te tekenen
  const nogmaals = o.vb.teken(S('bBeh'), id);
  assert.ok(nogmaals.ok && nogmaals.al);
  assert.equal(nogmaals.verbond.tekens.a, null, 'B tekende niet voor A');

  // een gewoon lid ziet een concept niet eens, dus tekenen geeft hetzelfde als een verzonnen id
  assert.equal(o.vb.teken(S('aLid'), id).status, 404);
  assert.equal(o.vb.teken(S('bLid'), id).status, 404);

  const a = o.vb.teken(S('aBeh'), id);
  assert.equal(a.verbond.stand, 'actief');
  assert.ok(a.verbond.actiefSinds);
  // nu het actief is ziet het lid het wel, en tekenen blijft een zaak van de beheerder
  const lid = o.vb.teken(S('aLid'), id);
  assert.equal(lid.status, 403);
  assert.match(lid.error, /beheerder/);
});

// Zakt bij de mutatie: in teken de regel `if (!open.length) return { ok: true, al: true ...}` weghalen -> zakt (409).
test('5. een herhaalde tik op tekenen: zelfde antwoord, geen tweede effect', () => {
  const o = opzet();
  const id = voorstel(o).verbond.id;
  const eerste = o.vb.teken(S('aBeh'), id);
  const n = o.meldingen.length, opgeslagen = o.bewaard();
  const regels = o.db.data.verbonden[0].tijdlijn.length;
  const tweede = o.vb.teken(S('aBeh'), id);
  assert.ok(tweede.ok && tweede.al);
  assert.deepEqual(tweede.verbond, eerste.verbond);
  assert.equal(o.meldingen.length, n, 'geen tweede melding');
  assert.equal(o.bewaard(), opgeslagen, 'niets opnieuw bewaard');
  assert.equal(o.db.data.verbonden[0].tijdlijn.length, regels, 'geen tweede tijdlijnregel');
});

// Zakt bij de mutatie: in teken de twee-mensen-controle (`R.KANTEN.some(... door === key)`) weghalen -> x tekent beide kanten.
test('6. wie aan beide kanten beheerder is, tekent voor een kant: een verbond vraagt twee mensen', () => {
  const o = opzet();
  const id = o.vb.voorstel(S('x'), { groep: 1, naar: 2, doel: 'Twee clubs, een steiger.', afspraken: AF }).verbond.id;
  assert.ok(o.vb.teken(S('x'), id).ok);
  const tweede = o.vb.teken(S('x'), id);
  assert.equal(tweede.status, 409);
  assert.match(tweede.error, /twee verschillende mensen/);
  assert.notEqual(o.vb.lees(S('x'), id).verbond.stand, 'actief');
  assert.equal(o.vb.teken(S('bBeh'), id).verbond.stand, 'actief', 'een tweede mens maakt het af');
});

// Zakt bij de mutatie: in teken de openAfspraak-controle weghalen -> een onvolledig verbond wordt getekend.
test('7. een verbond met een open afspraak wordt niet getekend', () => {
  const o = opzet();
  const id = voorstel(o, { afspraken: { geld: 'samen' } }).verbond.id;
  const r = o.vb.teken(S('aBeh'), id);
  assert.equal(r.status, 409);
  assert.match(r.error, /vrijwilligers/);
});

// Zakt bij de mutatie: in wijzig `v.tekens = { a: null, b: null }` weghalen -> zakt.
test('8. een tekstwijziging zet beide tekens terug; een wijziging zonder verschil doet niets', () => {
  const o = opzet();
  const id = voorstel(o).verbond.id;
  o.vb.teken(S('aBeh'), id); o.vb.teken(S('bBeh'), id);
  assert.equal(o.vb.lees(S('aBeh'), id).verbond.stand, 'actief');

  const zelfde = o.vb.wijzig(S('bBeh'), id, { doel: 'Samen een zomerregatta organiseren.' });
  assert.ok(zelfde.al, 'zelfde tekst is geen wijziging');
  assert.equal(o.vb.lees(S('aBeh'), id).verbond.stand, 'actief');

  const w = o.vb.wijzig(S('bBeh'), id, { doel: 'Samen een najaarsregatta organiseren.', afspraken: { geld: 'samen' } });
  assert.ok(w.ok, w.error);
  assert.deepEqual(w.velden, ['doel', 'geld']);
  assert.equal(w.tekensTeruggezet, true);
  assert.equal(w.verbond.stand, 'concept');
  assert.deepEqual(w.verbond.tekens, { a: null, b: null });
  assert.equal(o.vb.wijzig(S('bBeh'), id, { afspraken: { geld: 'iedereen' } }).status, 400);
  assert.equal(o.vb.wijzig(S('aLid'), id, { doel: 'Anders.' }).status, 403);
});

// Zakt bij de mutatie: in dicht() de opgezegd-tak weghalen -> tekenen na opzeggen lukt en dit zakt.
test('9. opzeggen: eenzijdig, met reden, daarna 409 op alles wat nieuw is, en het blijft leesbaar', () => {
  const o = opzet();
  const id = voorstel(o).verbond.id;
  o.vb.teken(S('aBeh'), id); o.vb.teken(S('bBeh'), id);
  assert.equal(o.vb.zegOp(S('bBeh'), id, '').status, 400, 'zonder reden geen opzegging');
  const z = o.vb.zegOp(S('bBeh'), id, 'Ons bestuur stopt met evenementen.');
  assert.ok(z.ok, z.error);
  assert.equal(z.verbond.stand, 'opgezegd');
  assert.equal(z.verbond.opzegging.kant, 'b');

  const n = o.meldingen.length;
  const nog = o.vb.zegOp(S('bBeh'), id, 'Nog een keer.');
  assert.ok(nog.ok && nog.al, 'een tweede opzegging door dezelfde kant: zelfde antwoord');
  assert.equal(nog.verbond.opzegging.reden, 'Ons bestuur stopt met evenementen.', 'de eerste reden blijft');
  assert.equal(o.meldingen.length, n);

  for (const r of [o.vb.teken(S('aBeh'), id), o.vb.wijzig(S('aBeh'), id, { doel: 'Anders dan eerst.' }),
    o.vb.zegOp(S('aBeh'), id, 'Wij ook.')]) {
    assert.equal(r.status, 409);
    assert.match(r.error, /opgezegd/);
  }
  const lees = o.vb.lees(S('aLid'), id);
  assert.ok(lees.ok, 'wat besloten is, blijft leesbaar');
  assert.equal(lees.verbond.doel, 'Samen een zomerregatta organiseren.');
});

// Zakt bij de mutatie: in regels.standVan de verlopen-regel weghalen -> zakt.
test('10. verlopen is een andere stand dan opgezegd, en wordt berekend uit de einddatum', () => {
  const o = opzet();
  const id = voorstel(o, { tot: datum(o.nu() + DAG) }).verbond.id;
  o.vb.teken(S('aBeh'), id); o.vb.teken(S('bBeh'), id);
  assert.equal(o.vb.lees(S('aBeh'), id).verbond.stand, 'actief');
  o.verzet(3 * DAG);
  const l = o.vb.lees(S('aBeh'), id).verbond;
  assert.equal(l.stand, 'verlopen');
  assert.equal(l.opzegging, null, 'niemand zei op');
  const z = o.vb.zegOp(S('aBeh'), id, 'Toch maar opzeggen.');
  assert.equal(z.status, 409);
  assert.match(z.error, /verlopen/);
  assert.ok(!('stand' in o.db.data.verbonden[0]), 'de stand wordt berekend, niet bewaard');
});

// Zakt bij de mutatie: in regels.weergave voor de andere kant `leden: gr.leden` toevoegen -> zakt.
test('11. een lid van A ziet van B alleen de groepsnaam: geen sleutel, geen codenaam, geen ledenlijst', () => {
  const o = opzet();
  const id = voorstel(o).verbond.id;
  o.vb.teken(S('aBeh'), id); o.vb.teken(S('bBeh'), id);
  const v = o.vb.lees(S('aLid'), id).verbond;
  assert.deepEqual(v.kanten.b, { naam: 'De Roeiclub', eigen: false });
  const tekst = JSON.stringify(v);
  for (const sleutel of ['bBeh', 'bLid']) assert.ok(!tekst.includes(sleutel), sleutel + ' lekt naar de andere kant');
  assert.ok(!/leden/.test(tekst), 'geen ledenlijst en geen aantal');
  // ook de eigen beheerder komt er niet als sleutel in: wie tekende is doorMij of niet
  assert.ok(!tekst.includes('aBeh'));
});

// Zakt bij de mutatie: in voorLid `if (!kk.beheer.length && !v.actiefSinds)` weghalen -> een lid ziet het concept.
test('12. een concept is iets tussen beheerders; een lid ziet het verbond pas als het actief werd', () => {
  const o = opzet();
  const id = voorstel(o).verbond.id;
  assert.equal(o.vb.lees(S('aLid'), id).status, 404);
  assert.equal(o.vb.mijn(S('aLid')).verbonden.length, 0);
  assert.equal(o.vb.mijn(S('aBeh')).verbonden.length, 1);
  assert.equal(o.vb.lees(S('niemand'), id).status, 404, 'buitenstaander');
  assert.equal(o.vb.lees(S('aBeh'), 'vbverzonnen').status, 404, 'verzonnen id');
  o.vb.teken(S('aBeh'), id); o.vb.teken(S('bBeh'), id);
  assert.equal(o.vb.mijn(S('aLid')).verbonden.length, 1);
  assert.equal(o.vb.mijn(S('bLid')).verbonden.length, 1);
});

// Zakt bij de mutatie: in regels.naamNaarBuiten altijd gr.naam geven -> zakt.
test('13. de naam van een geheim genootschap verschijnt aan de andere kant pas als het zelf tekent', () => {
  const o = opzet();
  const id = o.vb.voorstel(S('x'), { groep: 1, naar: 3, doel: 'Een stille avond.', afspraken: AF }).verbond.id;
  const voor = o.vb.lees(S('aBeh'), id).verbond;
  assert.equal(voor.kanten.b.naam, null);
  assert.ok(voor.kanten.b.verborgen);
  assert.ok(!JSON.stringify(voor).includes('Stille Kamer'));
  assert.equal(o.vb.lees(S('x'), id).verbond.kanten.b.naam, 'De Stille Kamer', 'wie er zelf in zit, ziet de naam');
  o.vb.teken(S('cBeh'), id);
  assert.equal(o.vb.lees(S('aBeh'), id).verbond.kanten.b.naam, 'De Stille Kamer');
});

// Zakt bij de mutatie: in voorstel de `zelfde`-zoektocht weghalen -> een dubbele tik maakt twee verbonden.
test('14. een dubbele tik op voorstellen maakt geen tweede verbond', () => {
  const o = opzet();
  const een = voorstel(o), twee = voorstel(o);
  assert.ok(twee.al);
  assert.equal(twee.verbond.id, een.verbond.id);
  assert.equal(o.db.data.verbonden.length, 1);
});

// Zakt bij de mutatie: in regels.weergave `keten: { ok: true, ... }` vast zetten in plaats van verifieer() -> zakt.
test('15. de tijdlijn is een hashketen: knoeien met een regel breekt hem aantoonbaar', () => {
  const o = opzet();
  const id = voorstel(o).verbond.id;
  o.vb.teken(S('aBeh'), id); o.vb.teken(S('bBeh'), id);
  const v = o.vb.lees(S('aBeh'), id).verbond;
  assert.deepEqual(v.tijdlijn.map(r => r.wat), ['actief', 'getekend', 'getekend', 'voorgesteld']);
  assert.ok(v.keten.ok);
  assert.ok(o.db.data.verbonden[0].tijdlijn.every(r => r.hash), 'elke regel draagt een hash');
  o.db.data.verbonden[0].tijdlijn[2].kant = 'b';   // iemand schuift achteraf wie er tekende
  assert.equal(o.vb.lees(S('aBeh'), id).verbond.keten.ok, false);
  assert.equal(keten.verifieer(o.db.data.verbonden[0].tijdlijn).ok, false);
});

// Zakt bij de mutatie: in kern/verbond/index.js een `gr.leden.push(...)` toevoegen -> toets 16b zakt op de bron.
test('16. het verbond bezit geen leden: het genootschap is na de hele keten byte voor byte gelijk', () => {
  const o = opzet();
  const voor = JSON.stringify(o.groepen);
  const id = voorstel(o).verbond.id;
  o.vb.teken(S('aBeh'), id); o.vb.teken(S('bBeh'), id);
  o.vb.wijzig(S('aBeh'), id, { doel: 'Samen twee regatta\'s organiseren.' });
  o.vb.zegOp(S('aBeh'), id, 'Toch niet.');
  o.vb.mijn(S('aLid')); o.vb.lees(S('aLid'), id);
  assert.equal(JSON.stringify(o.groepen), voor);
  assert.ok(!JSON.stringify(o.db.data.verbonden).includes('"leden"'), 'het verbond houdt geen eigen ledenlijst bij');
});

test('16b. bron: kern/verbond schrijft nooit in leden, kent db.data.genootschap niet en leest geen kant uit het verzoek', () => {
  const map = path.join(__dirname, '..', 'server', 'kern', 'verbond');
  const bestanden = fs.readdirSync(map).filter(f => f.endsWith('.js'));
  assert.ok(bestanden.length >= 2, 'de bron is gevonden');
  for (const f of bestanden) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/leden\s*(\.\s*(push|splice|unshift|pop|shift|length\s*=)|\s*=[^=]|\[[^\]]*\]\s*=[^=])/.test(bron), f + ' schrijft in een ledenlijst');
    assert.ok(!/data\s*\.\s*genootschap|['"]genootschap['"]\s*\]/.test(bron), f + ' leest de opslag van het genootschap rechtstreeks');
    assert.ok(!/req\b|\.body\b/.test(bron), f + ' kent het verzoek; de kant hoort uit de sessie te komen');
  }
  const route = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'member', 'verbond.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/body\s*\|\|\s*\{\}\s*\)\s*\.\s*kant|body\.kant/.test(route), 'de route geeft geen kant uit het verzoek door');
});

// Zakt bij de mutatie: in partners.js de foutzin van toetsAfspraken veranderen -> zakt (partner-zin is publiek gedrag).
test('17. de afspraakvelden staan op een plek: partners en verbond delen lijst en toets', () => {
  assert.deepEqual(partners.AFSPRAAKVELDEN, ['geld', 'vrijwilligers', 'persoonsgegevens', 'aansprakelijk', 'rapportage']);
  assert.equal(partners.toetsAfspraken({ geld: 'x' }, partners.WIE).error, 'Bij "geld" hoort rtf, partner of samen.');
  assert.deepEqual(partners.toetsAfspraken({ geld: 'samen', rapportage: '' }, partners.WIE), { ok: true, waarden: { geld: 'samen' } });
  // geen half werk: een fout bij het tweede veld geeft niets terug
  const t = partners.toetsAfspraken({ geld: 'rtf', vrijwilligers: 'niemand' }, partners.WIE);
  assert.equal(t.ok, false); assert.equal(t.waarden, undefined);
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'verbond', 'index.js'), 'utf8');
  assert.ok(/require\('\.\.\/rtfos\/partners'\)/.test(bron), 'het verbond gebruikt de lijst van partners');
  assert.ok(!/'persoonsgegevens'/.test(bron), 'en schrijft hem niet over');
});
