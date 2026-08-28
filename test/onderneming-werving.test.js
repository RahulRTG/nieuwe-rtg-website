/* Ronde: de werving -- staat er iemand te wachten.

   Vier beweringen:

   1. HIER STAAN GEEN NAMEN. Sollicitaties dragen in de opslag een echte naam en
      contactgegevens; die horen in de personeels-app en niet op een dagbeeld.
      Elke naam die hier zou opduiken, is een naam op een scherm waar hij niet
      voor nodig is.
   2. HET PROBLEEM IS NIET WERVEN MAAR ANTWOORDEN. Een sollicitatie die drie
      weken blijft liggen is een kandidaat die ergens anders begint -- en de
      zaak denkt dat er niemand reageerde.
   3. WAT EEN EXTRA PERSOON DOET IS REKENKUNDE, GEEN BELOFTE. De beschikbare
      tijd schaalt recht evenredig met de teamgrootte; of die persoon zichzelf
      terugverdient, zeggen wij niet.
   4. ER WORDT NIETS NAAST GEBOUWD. Vacatures en sollicitaties bestaan al; deze
      laag telt en klokt ze.

   Draai los: node --test test/onderneming-werving.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

const maakOnderneming = require('../server/kern/onderneming');
const WRV = require('../server/kern/onderneming/werving');

const DAG = 86400000;
const NU = Date.parse('2026-06-01T08:00:00Z');   // maandag
const dag = (n) => new Date(NU + n * DAG).toISOString().slice(0, 10);
const isoTerug = (n) => new Date(NU - n * DAG).toISOString();

function sollicitatie(over) {
  return Object.assign({
    id: 's' + Math.random().toString(16).slice(2, 8),
    name: 'Jan Jansen', contact: 'jan@example.com', codename: 'Reiger',
    func: 'Glazenwasser', status: 'nieuw', vacatureId: null, at: isoTerug(3),
    cv: { headline: 'Ervaren', skills: ['ramen'] }
  }, over || {});
}
const vacature = (over) => Object.assign({
  id: 'v' + Math.random().toString(16).slice(2, 8), func: 'Glazenwasser',
  omschrijving: 'Ramen wassen', uren: 32, minLeeftijd: 18, open: true, at: isoTerug(10)
}, over || {});

function boeking(over) {
  return Object.assign({
    id: 'b' + Math.random().toString(16).slice(2, 8), customerCodename: 'R',
    status: 'bevestigd', wanneer: dag(0) + 'T09:00', service: { duurMin: 60 }
  }, over || {});
}

function stubKern(opties) {
  const o = opties || {};
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', city: 'Haarlem',
    staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' },
    services: [{ id: 's', name: 'Klus', price: 100, duurMin: 60 }],
    boekingen: o.boekingen || [], orders: [] };
  if (o.vakUren) zaak.vakUren = o.vakUren;
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {},
    vacatures: { GLAS: o.vacatures || [] },
    applications: { GLAS: o.sollicitaties || [] },
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] },
      retail: { label: 'Winkel', caps: ['retail'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => (code === 'GLAS' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => zaak.boekingen,
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
  K._zaak = zaak;
  return K;
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (koppel !== false) K.ondernemingKoppel(o, 'GLAS', MIJN_ZAAK);
  return o;
}

/* De agenda vol maken over het hele venster van 28 dagen. */
function volleAgenda() {
  const uit = [];
  for (let d = 0; d < 28; d++) {
    const wd = new Date(NU + d * DAG).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    uit.push(boeking({ wanneer: dag(d) + 'T09:00', service: { duurMin: 8 * 60 } }));
  }
  return uit;
}

/* ---------------- geen namen ---------------- */

test('er komt geen enkele naam of contactgegeven in het antwoord', () => {
  const K = stubKern({ sollicitaties: [
    sollicitatie({ name: 'Jan Jansen', contact: 'jan@example.com' }),
    sollicitatie({ name: 'Fatima El Amrani', contact: '0612345678' })
  ] });
  const w = K.ondernemingWerving(ond(K), NU);
  const tekst = JSON.stringify(w);
  assert.ok(!tekst.includes('Jansen') && !tekst.includes('Fatima'), 'geen namen');
  assert.ok(!tekst.includes('@example.com') && !tekst.includes('0612345678'), 'geen contactgegevens');
  assert.ok(!tekst.includes('Reiger'), 'ook de codenaam hoeft hier niet: tellen en klokken is genoeg');
  assert.equal(w.sollicitaties.wachtend, 2, 'ze tellen wel gewoon mee');
  assert.ok(w.nietGemeten.includes('personeels-app'));
});

/* ---------------- tellen en klokken ---------------- */

test('alleen sollicitaties waar nog niets mee is gebeurd tellen als wachtend', () => {
  const K = stubKern({ sollicitaties: [
    sollicitatie({ status: 'nieuw' }),
    sollicitatie({ status: 'aangevraagd' }),
    sollicitatie({ status: 'afgewezen' }),
    sollicitatie({ status: 'aangenomen' })
  ] });
  const w = K.ondernemingWerving(ond(K), NU);
  assert.equal(w.sollicitaties.wachtend, 2);
});

test('de wachttijd wordt geklokt, en de langste staat bovenaan', () => {
  const K = stubKern({ sollicitaties: [
    sollicitatie({ at: isoTerug(3) }),
    sollicitatie({ at: isoTerug(21), func: 'Voorman' }),
    sollicitatie({ at: isoTerug(9) })
  ] });
  const w = K.ondernemingWerving(ond(K), NU);
  assert.equal(w.sollicitaties.langstWachtend, 21);
  assert.equal(w.sollicitaties.rijen[0].dagen, 21);
  assert.equal(w.sollicitaties.rijen[0].functie, 'Voorman', 'de functie mag wel: dat is geen persoon');
  assert.equal(w.sollicitaties.teLang, 1, 'alleen die van 21 dagen is over de grens van ' + WRV.TE_LANG_DAGEN);
});

test('openstaande vacatures worden geteld met hun functies', () => {
  const K = stubKern({ vacatures: [
    vacature({ func: 'Glazenwasser', at: isoTerug(40) }),
    vacature({ func: 'Planner', at: isoTerug(5) }),
    vacature({ func: 'Oud', open: false })
  ] });
  const w = K.ondernemingWerving(ond(K), NU);
  assert.equal(w.vacatures.open, 2);
  assert.equal(w.vacatures.oudste, 40);
  assert.deepEqual(w.vacatures.functies, ['Glazenwasser', 'Planner']);
});

/* ---------------- de rekensom ---------------- */

test('wat een extra persoon doet is een exacte som op de bezetting', () => {
  const K = stubKern({ boekingen: volleAgenda() });
  const w = K.ondernemingWerving(ond(K), NU);
  assert.equal(w.extraPersoon.teamNu, 1);
  assert.equal(w.extraPersoon.teamDan, 2);
  assert.equal(w.extraPersoon.naar, Math.round(w.extraPersoon.van / 2),
    'twee mensen op dezelfde uren is de helft van de bezetting');
  assert.ok(w.extraPersoon.uitleg.includes('geen schatting'));
});

/* Bij een team van EEN is n/(n+1) toevallig gelijk aan de helft, dus die ene
   toets kan een verkeerde formule niet van de goede onderscheiden. Met een
   team van drie wel: van drie naar vier is drie kwart, niet de helft. Dat is
   precies waarom deze tweede toets er staat -- de mutatie op de formule sloeg
   op de eerste af. */
test('bij een groter team is het drie kwart en niet de helft', () => {
  const K = stubKern({ boekingen: volleAgenda(), vakUren: { capaciteit: 3 } });
  const w = K.ondernemingWerving(ond(K), NU);
  assert.equal(w.extraPersoon.teamNu, 3);
  assert.equal(w.extraPersoon.teamDan, 4);
  assert.equal(w.extraPersoon.naar, Math.round(w.extraPersoon.van * 3 / 4));
  assert.notEqual(w.extraPersoon.naar, Math.round(w.extraPersoon.van / 2),
    'een formule die altijd halveert, klopt hier niet meer');
});

test('de som zegt uitdrukkelijk niets over of die persoon uit kan', () => {
  const K = stubKern({ boekingen: volleAgenda() });
  const w = K.ondernemingWerving(ond(K), NU);
  assert.ok(w.extraPersoon.let.includes('terugverdient'));
  assert.ok(!/euro|omzet/i.test(JSON.stringify(w).replace(/nooit is gesteld/g, '')),
    'er staat nergens een bedrag in het antwoord');
});

test('zonder gemeten bezetting is er niets om te rekenen', () => {
  const K = stubKern({});
  K._zaak.type = 'retail';
  K._zaak.staff = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const w = K.ondernemingWerving(ond(K), NU);
  assert.equal(w.extraPersoon, null, 'zonder agenda is dit een som over niets');
});

/* ---------------- de opvolging ---------------- */

test('een sollicitatie die te lang ligt is de eerste waarschuwing', () => {
  const K = stubKern({ sollicitaties: [sollicitatie({ at: isoTerug(30) })] });
  const v = WRV.wervingOpvolging(K.ondernemingWerving(ond(K), NU), null);
  assert.equal(v[0].id, 'sollicitaties');
  assert.ok(v[0].kop.includes('30 dagen'));
  assert.ok(v[0].waarom.includes('begint ergens anders'));
});

test('een verse sollicitatie is geen waarschuwing', () => {
  const K = stubKern({ sollicitaties: [sollicitatie({ at: isoTerug(2) })] });
  assert.deepEqual(WRV.wervingOpvolging(K.ondernemingWerving(ond(K), NU), null), []);
});

test('vol en niemand gezocht levert een tweede waarschuwing op, met de som erbij', () => {
  const K = stubKern({ boekingen: volleAgenda() });
  const o = ond(K);
  const cap = K.ondernemingCapaciteit(o, NU);
  const v = WRV.wervingOpvolging(K.ondernemingWerving(o, NU), cap);
  const geen = v.find(x => x.id === 'geen-vacature');
  assert.ok(geen, 'de agenda staat vol en er staat geen vacature open');
  assert.ok(geen.waarom.includes('%'), 'met de som over de bezetting erbij');
  assert.ok(geen.waarom.includes('weet u zelf het beste'), 'en zonder oordeel of het uit kan');
});

test('met een openstaande vacature komt die tweede waarschuwing niet', () => {
  const K = stubKern({ boekingen: volleAgenda(), vacatures: [vacature()] });
  const o = ond(K);
  const v = WRV.wervingOpvolging(K.ondernemingWerving(o, NU), K.ondernemingCapaciteit(o, NU));
  assert.ok(!v.some(x => x.id === 'geen-vacature'), 'u zoekt al iemand');
});

test('zonder gemeten bezetting wordt er niet beweerd dat het druk is', () => {
  const K = stubKern({});
  K._zaak.type = 'retail';
  K._zaak.staff = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const o = ond(K);
  const v = WRV.wervingOpvolging(K.ondernemingWerving(o, NU), K.ondernemingCapaciteit(o, NU));
  assert.ok(!v.some(x => x.id === 'geen-vacature'), 'zonder agenda weten wij niet of het druk is');
});

/* ---------------- de grenzen ---------------- */

test('zonder zaak is er geen wervingsbeeld', () => {
  const K = stubKern({});
  assert.equal(K.ondernemingWerving(ond(K, false), NU), null);
});

test('het dagbeeld zet de werving direct achter de capaciteit', () => {
  const K = stubKern({ boekingen: volleAgenda(), sollicitaties: [sollicitatie({ at: isoTerug(30) })] });
  const d = K.ondernemingDagbeeld(ond(K), NU);
  const iCap = d.acties.findIndex(a => a.id === 'capaciteit');
  const iWrv = d.acties.findIndex(a => a.id === 'werving:sollicitaties');
  assert.ok(iCap >= 0 && iWrv >= 0, 'allebei staan er');
  assert.ok(iCap < iWrv, 'de werving is het antwoord op de capaciteitsvraag, dus komt erachter');
  assert.ok(d.werving, 'en het beeld hangt aan het dagbeeld');
});
