/* DE ISOLATIELAAG -- zes dragers, een join, en verlagen als protocol.

   WAT DEZE TOETS BEWIJST, en de derde en de vijfde zijn de belangrijkste:

   1. het paar-model klopt met wat de code DOET: de veilige noodstand aanzetten
      is geen verlaging, en isolatie is strenger dan beschermd;
   2. een lagere drager neutraliseert een hogere niet -- de join is geen keuze;
   3. verlagen kan STRUCTUREEL niet buiten de ceremonie om: niet omdat er een
      controle staat die je kunt vergeten, maar omdat er geen andere weg is;
   4. het verzoek zelf verandert niets, en de commit weigert tot alles rond is;
   5. de toerekening beschuldigt het huis niet als het huis gewoon draait;
   6. het isolatiefilter is per constructie een VERSMALLING, en het versnijdt
      geen lezers;
   7. het effectmodel handhaaft niets en zegt dat met zoveel woorden.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `beschermd` weer trede `null` geven
     -> 1, 3, 4, 5, 6 en 7 ZAKKEN. Dat is GEEN te grove mutatie maar de meting
        zelf: dit is het model waar de hele laag op staat, dus als het niet
        klopt, klopt er verderop ook niets meer. De bewering zit in toets 1 --
        aanzetten van de veilige noodstand telt dan als een verlaging en vraagt
        een ceremonie, precies de drempel voor de veilige keuze die grens 6.10
        verbiedt. De vijf andere zakken omdat de ceremonie dan overal in de weg
        gaat staan.
   - `isolatie` op `beschermd: false` zetten
     -> 1, 2 en 3 ZAKKEN. Bewering in toets 1: isolatie en beschermd worden dan
        onvergelijkbaar, en dan is de weg van isolatie naar beschermd geen
        verlaging meer.
   - de verlagingscontrole uit zet() halen
     -> toets 3 ZAKT, en alleen 3 (RAAK).
   - commit() de ontbrekende stappen laten negeren
     -> toets 4 ZAKT (RAAK).
   - dragersVanStand() terug op "gelijke trede telt mee"
     -> toets 5 ZAKT, en alleen 5 (RAAK).
   - het filter een pad laten TOEVOEGEN dat er niet in zat
     -> toets 6 ZAKT (RAAK).

   Draai los: node --test test/isolatie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const functies = require('../server/functies');
const beleid = require('../server/kern/stuur/beleid');
const ordening = require('../server/kern/isolatie/ordening');
const dragers = require('../server/kern/isolatie/dragers');
const effecten = require('../server/kern/isolatie/effecten');
const { dragersVanStand } = require('../server/kern/isolatie/besluit');
const maakIsolatie = require('../server/kern/isolatie');
const { maakIsolatiefilter } = require('../server/kern/stuur/isolatiefilter');

function laag(huis) {
  const db = { data: {} };
  return maakIsolatie({ db, save() {}, functies, klok: null, huisStand: () => huis || 'normaal' });
}

test('1. het paar-model klopt met wat de code doet, niet met wat de naam zegt', () => {
  /* De veilige noodstand AANZETTEN is een verstrenging. incidentcontrole-bescherm.js
     zet geen enkele schakelaar om, dus zijn trede is normaal en zijn strengheid
     zit in de eigenschap. Zou hij geen trede hebben, dan werd aanzetten een
     "niet te ordenen" overgang -- en die telt als verlaging, dus zou de veilige
     keuze een ceremonie vragen. Dat is grens 6.10 op zijn kop. */
  assert.equal(ordening.verlaagt('normaal', 'beschermd').verlaagt, false);
  assert.equal(ordening.vergelijk('beschermd', 'normaal'), 'strenger');

  /* Isolatie is strenger dan beschermd, en dat is AFGELEID en niet beweerd:
     isolatie zet alles uit, dus draagt hij de eigenschap ook. */
  assert.equal(ordening.vergelijk('isolatie', 'beschermd'), 'strenger');
  assert.equal(ordening.verlaagt('isolatie', 'beschermd').verlaagt, true);

  /* En de vijf blijven geen ladder: beschermd bevriest zes categorieën, beperkt
     zet genoemde functies uit. Dat is de botsing waar het altijd om ging. */
  assert.equal(ordening.vergelijk('beschermd', 'beperkt'), 'onvergelijkbaar');
  assert.equal(ordening.vergelijk('beschermd', 'waakzaam'), 'onvergelijkbaar');
});

test('2. de join is geen keuze: een lagere drager neutraliseert een hogere niet', () => {
  const iso = laag('isolatie');
  /* Het huis staat in isolatie. Een sessie op normaal bestaat niet eens als
     zetbare stand -- maar zelfs als hij er stond, wint de join. */
  const samen = iso.effectieveStand({ huis: 'isolatie', sessie: 'normaal', apparaat: 'waakzaam' });
  assert.equal(samen.trede, 'isolatie');
  assert.equal(samen.beschermd, true);
  for (const a of ['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie'])
    for (const b of ['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie'])
      assert.equal(ordening.neutraliseert(a, b), false, b + ' verzwakt ' + a);
});

test('3. verlagen kan structureel niet buiten de ceremonie om', () => {
  const iso = laag();
  iso.zet({ drager: 'identiteit', sleutel: 'cn-1', naar: 'isolatie', door: 'u1',
    reden: 'Verdenking op een gerichte aanval' });
  assert.equal(iso.standVan('identiteit', 'cn-1'), 'isolatie');

  assert.throws(() => iso.zet({ drager: 'identiteit', sleutel: 'cn-1', naar: 'normaal', door: 'u1',
    reden: 'Toch maar weer aan' }), /verlaagt de beveiliging/);
  assert.throws(() => iso.zet({ drager: 'identiteit', sleutel: 'cn-1', naar: 'beschermd', door: 'u1',
    reden: 'Iets minder streng graag' }), /verlaagt de beveiliging/);
  assert.equal(iso.standVan('identiteit', 'cn-1'), 'isolatie', 'een geweigerde verlaging laat niets achter');

  /* En de stand van het huis is hier niet te zetten: die woont in de
     incidentcontrole en twee plekken voor één stand is hoe twee schermen iets
     anders gaan zeggen. */
  assert.throws(() => iso.zet({ drager: 'huis', sleutel: 'x', naar: 'isolatie', door: 'u1',
    reden: 'Alles dicht graag' }), /incidentcontrole/);

  /* Verstrengen mag zonder ceremonie -- een drempel voor de veilige keuze duwt
     mensen onder druk naar de onveilige. */
  const iso2 = laag();
  iso2.zet({ drager: 'sessie', sleutel: 's1', naar: 'beschermd', door: 'u1', reden: 'Vreemde inlog gezien' });
  assert.doesNotThrow(() => iso2.zet({ drager: 'sessie', sleutel: 's1', naar: 'isolatie', door: 'u1',
    reden: 'Het wordt erger' }));
});

test('4. het verzoek verlaagt niets, en de commit weigert tot alles rond is', () => {
  const iso = laag();
  iso.zet({ drager: 'sessie', sleutel: 's1', naar: 'isolatie', door: 'u1', reden: 'Verdachte inlog' });

  const v = iso.vraagOntsluiting({ drager: 'sessie', sleutel: 's1', naar: 'normaal', door: 'u1',
    reden: 'Toestel vervangen en opnieuw geverifieerd' });
  assert.match(v.effectNu, /blijft isolatie/);
  assert.equal(iso.standVan('sessie', 's1'), 'isolatie', 'een lopend verzoek verandert de stand niet');
  assert.ok(v.ontbreekt.length, 'er staan nog stappen open');

  assert.throws(() => iso.voltooiOntsluiting(v.id, { door: 'u1' }), /nog niet rond/);
  assert.equal(iso.standVan('sessie', 's1'), 'isolatie', 'een geweigerde commit laat de stand staan');

  iso.ontsluiting.stap(v.id, { soort: 'passkey', door: 'u1', bewijs: 'webauthn:1' });
  iso.ontsluiting.stap(v.id, { soort: 'apparaat', door: 'u1', bewijs: 'toestel:1' });
  const klaar = iso.voltooiOntsluiting(v.id, { door: 'u1' });
  assert.equal(klaar.nieuweStand, 'normaal');
  assert.equal(iso.standVan('sessie', 's1'), null, 'normaal is de afwezigheid van een stand');

  /* HET TWEEDE PAAR OGEN IS EEN ANDER PAAR. Zonder deze regel voert dezelfde
     mens de vier-ogencontrole twee keer uit, en dan is het een formaliteit. */
  const iso3 = laag();
  iso3.zet({ drager: 'organisatie', sleutel: 'org-1', naar: 'beschermd', door: 'a', reden: 'Melding van een klant' });
  const v3 = iso3.vraagOntsluiting({ drager: 'organisatie', sleutel: 'org-1', naar: 'normaal', door: 'a',
    reden: 'De melding bleek onterecht' });
  assert.ok(v3.vereisten.includes('tweedePaarOgen'));
  assert.throws(() => iso3.ontsluiting.stap(v3.id, { soort: 'tweedePaarOgen', door: 'a' }), /iemand anders/);
  assert.doesNotThrow(() => iso3.ontsluiting.stap(v3.id, { soort: 'tweedePaarOgen', door: 'b' }));
});

test('5. de toerekening beschuldigt het huis niet als het huis gewoon draait', () => {
  const iso = laag('normaal');
  iso.zet({ drager: 'identiteit', sleutel: 'cn-1', naar: 'beschermd', door: 'u1', reden: 'Verdachte inlog' });
  const b = iso.besluit({ pad: '/api/pay/stuur', methode: 'POST', context: iso.context({ identiteit: 'cn-1' }) });
  assert.equal(b.toegestaan, false);
  assert.deepEqual(b.dragers.map(d => d.drager), ['identiteit'],
    'het huis staat op normaal en hoort niet in de verklaring');

  /* Twee dragers die hetzelfde zeggen, dragen hem samen. */
  assert.deepEqual(dragersVanStand({ huis: 'isolatie', identiteit: 'isolatie' },
    ordening.strengste(['isolatie', 'isolatie'])).map(d => d.drager), ['huis', 'identiteit']);
  /* En als niemand iets sluit, is er niemand om te noemen. */
  assert.deepEqual(dragersVanStand({ huis: 'normaal', sessie: 'normaal' },
    ordening.strengste(['normaal', 'normaal'])), []);
});

test('6. het isolatiefilter versmalt altijd, en versnijdt geen lezers', () => {
  const iso = laag();
  const filter = maakIsolatiefilter({ isolatie: iso, beleid });
  iso.zet({ drager: 'identiteit', sleutel: 'cn-1', naar: 'beschermd', door: 'u1', reden: 'Verdachte inlog' });
  const ctx = iso.context({ identiteit: 'cn-1' });

  const binnen = beleid.LEZEN.member.length
    ? ['/api/bank/afschrift', '/api/bank/advies', '/api/pay/overzicht', '/api/pay/stuur', '/api/bank/sepa']
    : [];
  const uit = filter.versmal(binnen, ctx, 'member');

  /* DEELVERZAMELING, per constructie. Wie hier ooit iets toevoegt, heeft van een
     beveiligingsfilter een tweede allowlist gemaakt. */
  for (const p of uit.paden) assert.ok(binnen.includes(p), p + ' zat er niet in en komt er wel uit');
  assert.ok(uit.paden.length <= binnen.length);

  /* De lezers blijven. De beschermstand belooft dat het lezen doorloopt; een
     filter dat een lid zijn eigen afschrift ontneemt, breekt die belofte. */
  assert.ok(uit.paden.includes('/api/bank/afschrift'));
  assert.ok(uit.paden.includes('/api/pay/overzicht'));
  /* En wat geld beweegt, valt weg -- met een reden die een mens kan lezen. */
  assert.ok(!uit.paden.includes('/api/pay/stuur'));
  assert.ok(!uit.paden.includes('/api/bank/sepa'));
  assert.match(filter.uitleg(uit.weggevallen), /identiteit/);

  /* Zonder stand versmalt hij niets, en zegt dat. */
  const leeg = filter.versmal(binnen, iso.context({}), 'member');
  assert.equal(leeg.actief, false);
  assert.deepEqual(leeg.paden, binnen);
});

test('7. het effectmodel handhaaft niets, en zegt dat', () => {
  const iso = laag();
  assert.equal(iso.overzicht().effectmodel.handhaaft, false);
  assert.match(iso.overzicht().effectmodel.waarom, /schaduw/);

  /* Een pad zonder effectprofiel geeft NOOIT een lege lijst terug: leeg leest
     als "dit doet niets", en dat is de gevaarlijkste zin in deze laag. */
  const prof = effecten.effectenVan('/api/iets/onbekends', 'POST', null);
  assert.equal(prof.effecten, null);
  assert.equal(prof.graad, 'onbekend');

  /* En de schaduw meldt een onenigheid in plaats van te stemmen. */
  iso.zet({ drager: 'identiteit', sleutel: 'cn-1', naar: 'beschermd', door: 'u1', reden: 'Verdachte inlog' });
  const b = iso.besluit({ pad: '/api/techniek/zekering', methode: 'POST',
    context: iso.context({ identiteit: 'cn-1' }) });
  assert.equal(b.toegestaan, true, 'de beschermstand kent dit pad niet en laat het door');
  assert.equal(b.schaduw.oordeel, 'tegenhouden', 'het effectmodel ziet er BEVEILIGING_VERZWAKKEN in');
  assert.equal(b.onenigheid.soort, 'strenger');
});

test('8. een drager zonder bron telt niet stil als normaal mee', () => {
  const zonder = dragers.DRAGERS.filter(d => d.bron === null);
  assert.ok(zonder.length, 'workload staat er als drager zonder bron');
  for (const d of zonder) assert.ok(d.nietGebouwd, d.naam + ' hoort te zeggen waarom hij leeg is');
  /* En hij staat in het overzicht en niet in een voetnoot. */
  assert.equal(laag().overzicht().dragersZonderBron.length, zonder.length);
  /* De zetrichting is grof naar fijn: een lid zet niets op het huis. */
  assert.equal(dragers.magZetten('identiteit', 'huis'), false);
  assert.equal(dragers.magZetten('huis', 'sessie'), true);
});

/* ---------------------------------------------------------------------------
   9. WAT EEN TWEEDE AANROEP DOET -- gemeten en niet opgeschreven.

   Deze toets bestaat omdat server/lib/mutatiecontracten-isolatie.js ernaar
   verwijst. Een contract dat zegt "een herhaling doet het werk niet nog een
   keer" is een BEWERING; MUTATIECONTRACT.md zegt dat zo'n bewering een meting
   nodig heeft, en dat een meting die alleen bij het schrijven van het contract
   is gedaan, binnen een jaar niet meer waar hoeft te zijn. Hij draait dus mee.

   De methode is byte voor byte: db.data na de eerste aanroep tegenover db.data
   na de tweede. Geen veldvergelijking, want dan bepaalt degene die de toets
   schrijft welke velden meetellen.
   ------------------------------------------------------------------------ */
function herhaal(bouw) {
  const db = { data: {} };
  const iso = maakIsolatie({ db, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  const nogmaals = bouw(iso, db);
  const na1 = JSON.stringify(db.data);
  let geweigerd = null;
  try { nogmaals(); } catch (e) { geweigerd = e.status; }
  return { gelijk: JSON.stringify(db.data) === na1, geweigerd };
}
function inIsolatie(iso) {
  iso.zet({ drager: 'sessie', sleutel: 's', naar: 'isolatie', door: 'u', reden: 'meting van de herhaling' });
  return iso.vraagOntsluiting({ drager: 'sessie', sleutel: 's', naar: 'normaal', door: 'u',
    reden: 'meting van de herhaling' });
}

test('9. een tweede aanroep: gemeten per handeling, byte voor byte', () => {
  /* zet(): de tweede aanroep merkt dat de stand al klopt en laat GEEN spoorregel
     na. Zonder die no-op zou het spoor een handeling melden die niet gebeurde. */
  assert.deepEqual(herhaal(iso => {
    const a = { drager: 'sessie', sleutel: 's', naar: 'beschermd', door: 'u', reden: 'meting van de herhaling' };
    iso.zet(a); return () => iso.zet(a);
  }), { gelijk: true, geweigerd: null });

  /* Een tweede ontsluitVERZOEK is met opzet een tweede verzoek. Ze weigeren zou
     betekenen dat één vergeten open verzoek de drager voorgoed vastzet. */
  assert.equal(herhaal(iso => {
    const v = () => inIsolatie(iso);
    v(); return v;
  }).gelijk, false, 'een tweede verzoek hoort een tweede verzoek te zijn');

  /* Dezelfde stap nog eens aftekenen verandert niets: de EERSTE aftekening
     blijft staan, want daar hangen de wachttijd en een onderzoek achteraf aan. */
  assert.deepEqual(herhaal(iso => {
    const v = inIsolatie(iso);
    const a = { soort: 'passkey', door: 'u', bewijs: 'w:1' };
    iso.ontsluiting.stap(v.id, a); return () => iso.ontsluiting.stap(v.id, a);
  }), { gelijk: true, geweigerd: null });

  /* De commit en het afbreken worden bij herhaling GEWEIGERD. Dat is een
     toestandscontrole en geen idempotentiesleutel -- MUTATIECONTRACT.md staat
     erop dat die twee niet door elkaar lopen -- maar het effect is gemeten:
     er verandert niets. */
  assert.deepEqual(herhaal(iso => {
    const v = inIsolatie(iso);
    iso.ontsluiting.stap(v.id, { soort: 'passkey', door: 'u' });
    iso.ontsluiting.stap(v.id, { soort: 'apparaat', door: 'u' });
    iso.voltooiOntsluiting(v.id, { door: 'u' });
    return () => iso.voltooiOntsluiting(v.id, { door: 'u' });
  }), { gelijk: true, geweigerd: 409 });

  assert.deepEqual(herhaal(iso => {
    const v = inIsolatie(iso);
    iso.ontsluiting.afbreken(v.id, { door: 'u', reden: 'meting' });
    return () => iso.ontsluiting.afbreken(v.id, { door: 'u', reden: 'meting' });
  }), { gelijk: true, geweigerd: 409 });

  /* En het besluit zelf verandert nooit iets -- dat is de hele reden dat er een
     proefroute bestaat waarmee een mens kan kijken voor hij iemand dichtzet. */
  assert.deepEqual(herhaal(iso => {
    const c = iso.context({ identiteit: 'x' });
    return () => iso.besluit({ pad: '/api/pay/stuur', methode: 'POST', context: c });
  }), { gelijk: true, geweigerd: null });
});
