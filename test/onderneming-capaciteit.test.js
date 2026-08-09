/* Ronde: de capaciteit -- kan er nog iets bij.

   Vier beweringen:

   1. ER WORDT GEEN GEMISTE OMZET UITGEREKEND. Wij zien geen vraag die nooit is
      gesteld; wie de agenda vol zag en wegklikte staat nergens. Zo'n bedrag zou
      een verzinsel zijn met een euroteken ervoor, en juist dat wordt
      overgeschreven in een besluit om iemand aan te nemen.
   2. DE BEZETTING IS EEN EXACTE DELING: geboekte minuten door beschikbare
      minuten. Geen weging, dus geen score.
   3. ZONDER AGENDA GEEN BEZETTING. Een winkel die als "0% bezet" leest, is een
      verkeerd antwoord op een vraag die niet is gesteld.
   4. BUITEN DE EIGEN UREN WERKEN WEEGT ZWAARDER DAN EEN VOLLE AGENDA. Dat is
      al gebeurd, en het is de stille manier waarop iemand zichzelf opbrandt.

   Draai los: node --experimental-sqlite --test test/onderneming-capaciteit.test.js */
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
const CAP = require('../server/kern/onderneming/capaciteit');
const TIJD = require('../server/kern/agendatijd');

const DAG = 86400000;
/* Maandag 1 juni 2026, zodat de weekdagen voorspelbaar liggen. */
const NU = Date.parse('2026-06-01T08:00:00Z');
const dag = (n) => new Date(NU + n * DAG).toISOString().slice(0, 10);

function boeking(over) {
  return Object.assign({
    id: 'b' + Math.random().toString(16).slice(2, 8), customerCodename: 'Reiger',
    status: 'bevestigd', wanneer: dag(0) + 'T10:00',
    service: { id: 's', name: 'Klus', duurMin: 60 }
  }, over || {});
}

function stubKern(boekingen, vakUren, type) {
  const zaak = { code: 'GLAS', name: 'Glas', type: type || 'zzp', city: 'Haarlem',
    staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' },
    services: [{ id: 's', name: 'Klus', price: 100, duurMin: 60 }],
    boekingen: boekingen || [], orders: [] };
  if (vakUren) zaak.vakUren = vakUren;
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {},
    supplierTypes: {
      zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] },
      retail: { label: 'Winkel', caps: ['retail'] }
    }, thuisHuizen: {} };
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

/* De standaard: ma t/m vr, 09:00-18:00, in je eentje. Negen uur per werkdag.
   NU is maandag 1 juni 2026, dus dag(0) t/m dag(4) zijn de werkdagen en dag(5)
   en dag(6) het weekend. Dat is nagerekend en niet aangenomen: de eerste versie
   van deze toetsen ging ervan uit dat dag(1) de maandag was, en zakte daarop. */
const UREN_PER_DAG = 9;
const WERKDAGEN = [0, 1, 2, 3, 4];
const ZATERDAG = 5;

/* ---------------- geen gemiste omzet ---------------- */

test('er wordt nergens een bedrag aan gemiste omzet uitgerekend', () => {
  const vol = Array.from({ length: 40 }, (_, i) =>
    boeking({ wanneer: dag(i % 5) + 'T10:00', service: { duurMin: 120 } }));
  const K = stubKern(vol);
  const c = K.ondernemingCapaciteit(ond(K), NU);
  /* Het veld `nietGemeten` gaat er juist OVER, dus dat hoort er wel in te
     staan; de rest van het antwoord niet. */
  const zonderVoorbehoud = Object.assign({}, c, { nietGemeten: undefined });
  assert.ok(!/gemist|misgelopen|potenti|euro/i.test(JSON.stringify(zonderVoorbehoud)),
    'geen enkel getal in het antwoord belooft omzet die wij niet kunnen zien');
  assert.ok(c.nietGemeten.includes('nooit is gesteld'));

  /* En in de code wordt nergens een prijs UITGELEZEN. Het woord "prijs" mag
     wel in een adviestekst staan ("of uw prijs verhoogt") -- dat is raad geven,
     geen bedrag uitrekenen. De eerste versie van deze toets zocht op het woord
     en sloeg daarop aan; dat is de verkeerde vraag. */
  const bron = require('fs').readFileSync('server/kern/onderneming/capaciteit.js', 'utf8');
  assert.ok(!/\.price\b|\.prijs\b|\.totaal\b/.test(bron),
    'de capaciteitslaag leest geen enkel bedrag uit');
});

/* ---------------- de deling ---------------- */

test('de bezetting is geboekte minuten gedeeld door beschikbare minuten', () => {
  /* Een werkweek: 5 werkdagen in het venster van 7 dagen, 9 uur per dag. */
  const K = stubKern([
    boeking({ wanneer: dag(0) + 'T10:00', service: { duurMin: 180 } }),
    boeking({ wanneer: dag(1) + 'T10:00', service: { duurMin: 90 } })
  ]);
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.werkdagen, 5, 'ma t/m vr binnen een venster van zeven dagen');
  assert.equal(c.beschikbareUren, 5 * UREN_PER_DAG);
  assert.equal(c.bezetteUren, 4.5);
  assert.equal(c.bezetting, Math.round((270 / (5 * UREN_PER_DAG * 60)) * 100));
});

test('een boeking zonder duur telt als een uur, en een boeking buiten het venster niet mee', () => {
  const K = stubKern([
    boeking({ wanneer: dag(0) + 'T10:00', service: {} }),
    boeking({ wanneer: dag(60) + 'T10:00', service: { duurMin: 480 } })
  ]);
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.bezetteUren, 1);
});

test('alleen aangevraagde en bevestigde boekingen kosten tijd', () => {
  const K = stubKern([
    boeking({ status: 'bevestigd', service: { duurMin: 60 } }),
    boeking({ status: 'aangevraagd', service: { duurMin: 60 } }),
    boeking({ status: 'afgerond', service: { duurMin: 600 } }),
    boeking({ status: 'wacht-op-betaling', service: { duurMin: 600 } })
  ]);
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.bezetteUren, 2, 'afgerond werk ligt achter ons, wachten op betaling is geen afspraak');
  assert.equal(c.openAanvragen, 1);
});

test('de teamgrootte vermenigvuldigt de beschikbare tijd', () => {
  const K = stubKern([], { capaciteit: 3 });
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.beschikbareUren, 5 * UREN_PER_DAG * 3);
  assert.equal(c.uren.capaciteit, 3);
});

test('geblokkeerde dagen tellen niet als werkdag', () => {
  const K = stubKern([], { geblokkeerd: [dag(0), dag(1)] });
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.werkdagen, 3);
  assert.equal(c.beschikbareUren, 3 * UREN_PER_DAG);
});

/* ---------------- de aannames ---------------- */

test('zonder ingestelde werktijden staat erbij dat wij aannames gebruiken', () => {
  const K = stubKern([]);
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.uren.gezet, false);
  assert.ok(c.uren.let.includes('nog niet ingesteld'));

  const K2 = stubKern([], { van: '08:00', tot: '16:00' });
  const c2 = K2.ondernemingCapaciteit(ond(K2), NU, 7);
  assert.equal(c2.uren.gezet, true);
  assert.equal(c2.uren.let, null);
  assert.equal(c2.beschikbareUren, 5 * 8);
});

/* ---------------- zonder agenda ---------------- */

/* Let op de teamgrootte: een winkel van EEN persoon is volgens werkvormen.js
   ook zelfstandige en krijgt dus wel een agenda -- dat is de belofte van die
   laag en geen randgeval. Deze toets gaat over de winkel die dat niet is. */
test('een winkel met personeel krijgt geen bezetting van 0% maar een eigen stand', () => {
  const K = stubKern([], null, 'retail');
  K._zaak.staff = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.stand, 'geen-agenda');
  assert.equal(c.bezetting, null, '0% zou een verkeerd antwoord zijn op een vraag die niet is gesteld');
  assert.ok(c.uitleg.includes('iets anders'));
  assert.equal(CAP.capaciteitOpvolging(c), null);
});

test('zonder zaak is er geen capaciteitsbeeld', () => {
  const K = stubKern([]);
  assert.equal(K.ondernemingCapaciteit(ond(K, false), NU), null);
});

/* ---------------- de opvolging ---------------- */

test('een rustige agenda levert geen waarschuwing op', () => {
  const K = stubKern([boeking({ service: { duurMin: 60 } })]);
  assert.equal(CAP.capaciteitOpvolging(K.ondernemingCapaciteit(ond(K), NU, 7)), null);
});

test('een volle agenda waarschuwt, met het aantal volle dagen erbij', () => {
  const vol = [];
  for (const d of WERKDAGEN) vol.push(boeking({ wanneer: dag(d) + 'T09:00', service: { duurMin: 8 * 60 } }));
  const K = stubKern(vol);
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.ok(c.bezetting >= 85);
  assert.equal(c.volleDagen, 5);
  const v = CAP.capaciteitOpvolging(c);
  assert.equal(v.id, 'krap');
  assert.ok(v.kop.includes('%'));
  assert.ok(v.waarom.includes('kost elke nieuwe klant een bestaande'));
});

test('buiten de eigen uren werken weegt zwaarder dan een volle agenda', () => {
  const vol = [];
  for (const d of WERKDAGEN) vol.push(boeking({ wanneer: dag(d) + 'T09:00', service: { duurMin: 8 * 60 } }));
  vol.push(boeking({ wanneer: dag(ZATERDAG) + 'T10:00', service: { duurMin: 120 } }));
  const K = stubKern(vol);
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.buitenUrenDagen, 1);
  const v = CAP.capaciteitOpvolging(c);
  assert.equal(v.id, 'buiten-uren', 'dat is al gebeurd; een volle agenda is nog te sturen');
  assert.ok(v.waarom.includes('telt niet mee in uw tarief'));
});

test('werk op een niet-werkdag telt wel als bezet, en de bezetting kan boven 100 uit', () => {
  const K = stubKern([boeking({ wanneer: dag(ZATERDAG) + 'T10:00', service: { duurMin: 600 } })], { dagen: [false, false, false, false, false, false, false] });
  const c = K.ondernemingCapaciteit(ond(K), NU, 7);
  assert.equal(c.werkdagen, 0);
  assert.equal(c.bezetting, null, 'zonder beschikbare tijd valt er niets te delen');
  assert.equal(c.bezetteUren, 10, 'maar het werk is wel gedaan');
  assert.equal(c.buitenUrenDagen, 1);
});

/* ---------------- de gedeelde tijdhelpers ---------------- */

test('datum en tijd van een boeking komen uit een gedeelde module', () => {
  assert.equal(TIJD.datumVan({ wanneer: '2026-06-01T10:30' }), '2026-06-01');
  assert.equal(TIJD.tijdVan({ wanneer: '2026-06-01T10:30' }), '10:30');
  assert.equal(TIJD.tijdVan({ wanneer: '2026-06-01' }), null,
    'een klus zonder afgesproken uur is geldig; middernacht is een tijd en "geen tijd" niet');
  const bron = require('fs').readFileSync('server/kern/vakwerk/index.js', 'utf8');
  assert.ok(bron.includes("require('../agendatijd')"), 'Vakwerk gebruikt diezelfde module');
});

test('het dagbeeld zet de capaciteit na het geld en voor de gewone opvolging', () => {
  /* Het dagbeeld kijkt 28 dagen vooruit en niet zeven: een capaciteitssignaal
     dat maar een week ziet, komt te laat om er nog iets aan te doen. De agenda
     moet dus over dat hele venster vol staan. */
  const vol = [];
  for (let d = 0; d < 28; d++) {
    const wd = new Date(NU + d * DAG).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    vol.push(boeking({ wanneer: dag(d) + 'T09:00', service: { duurMin: 8 * 60 } }));
  }
  vol.push(boeking({ status: 'aangevraagd', wanneer: dag(2) + 'T09:00', service: { duurMin: 30 } }));
  const K = stubKern(vol);
  const d = K.ondernemingDagbeeld(ond(K), NU);
  const iCap = d.acties.findIndex(a => a.id === 'capaciteit');
  const iOpv = d.acties.findIndex(a => a.id === 'opvolging:aanvragen');
  assert.ok(iCap >= 0 && iOpv >= 0, 'allebei staan er');
  assert.ok(iCap < iOpv, 'meer klanten werven terwijl de agenda vol staat, is werk dat u daarna moet weigeren');
  assert.ok(d.capaciteit, 'en het beeld hangt aan het dagbeeld');
});
