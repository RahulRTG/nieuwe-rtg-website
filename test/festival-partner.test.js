/* ============================================================================
   DE PARTNERBAND EN DE SIGNALEN VAN BUITEN.

   WAAROM DIT BESTAAT

   De cockpit hoort te weten dat er twee beveiligingsposten onbezet zijn. Dat
   staat er al -- maar bij een ANDERE ZAAK, met eigen personeel en eigen
   klanten. Twee voor de hand liggende wegen daarheen zijn allebei fout, en deze
   toets sluit ze:

     matchen op de naam van de klant   -> vrije tekst; wie zijn post "Testival"
                                          noemt, leest mee
     het festival wijst zelf een zaak  -> dan opent een regel in je eigen data
                                          het rooster van een ander

   Dus: een band bestaat pas als BEIDE kanten hem sluiten, en de PARTNER noemt
   zelf welke stukken hij vrijgeeft.

   WAT ER WORDT VASTGELEGD
    1. Een voorstel opent niets.
    2. Alleen de genoemde zaak mag antwoorden, en een ander krijgt 404.
    3. Een bevestigde band zonder gedeelde stukken deelt niets -- en telt als
       blinde vlek.
    4. Alleen de vrijgegeven posten komen door; de rest van het rooster niet.
    5. Wat er doorkomt is een AANTAL, geen dossier.
    6. Een storing telt alleen binnen zijn eigen venster.
    7. Opzeggen kan van beide kanten, en daarna komt er niets meer door.
    8. De signalen komen op dezelfde hoop als de eigen metingen.

   DE MUTATIES staan aan het slot.
   Puur: de domeinen komen als stub binnen, zodat deze toets DEZE laag meet en
   niet kern/beveiliging of kern/mobiliteit.
   Draai los: node --test test/festival-partner.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

const VANDAAG = '2027-07-02';

/* Een nagebootst beveiligingsbedrijf met DRIE posten: twee voor dit festival en
   een voor een andere klant. Die derde hoort nooit door te komen. */
function stubKern() {
  return {
    findSupplier: (code) => (code === 'SECUR' || code === 'BUS' ? { code } : null),
    bevRooster: () => ({ van: VANDAAG, dagen: [{ datum: VANDAAG, open: 5, posten: [
      { postId: 'p1', post: 'Hoofdingang', klant: 'Testival', open: 2,
        shifts: [{ shiftId: 'a', open: 2, bezet: [{ naam: 'Jordi Ripoll', staffId: 's9' }] }] },
      { postId: 'p2', post: 'Backstage', klant: 'Testival', open: 0, shifts: [] },
      { postId: 'p9', post: 'Bankfiliaal', klant: 'Andere klant', open: 3, shifts: [] }
    ] }] }),
    storingLijst: () => ({ storingen: [
      { id: 'st1', lijnId: 'l1', lijnNaam: 'Pendel Lelystad', soort: 'vertraging',
        oorzaak: 'wegwerkzaamheden', van: VANDAAG + 'T19:00:00.000Z', tot: VANDAAG + 'T21:00:00.000Z' },
      { id: 'st2', lijnId: 'l9', lijnNaam: 'Lijn van een ander', soort: 'uitval',
        oorzaak: null, van: VANDAAG + 'T19:00:00.000Z', tot: VANDAAG + 'T21:00:00.000Z' }
    ] })
  };
}

function wereld() {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon, kern: stubKern });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const dag = k.dagZet(fid, eid, { datum: VANDAAG, open: '12:00', sluit: '02:00' }).dag;
  const terrein = k.plekZet(fid, eid, { naam: 'Terrein', soort: 'terrein', capaciteit: 5000 }).plek;
  const sig = (tijd) => k.signalen(fid, eid, { datum: VANDAAG, tijd: tijd || '20:00' });
  return { k, fid, eid, dag, terrein, sig };
}

const stel = (w, rol, zaak) => w.k.partnerVoorstel(w.fid, w.eid, { rol, zaak, door: 'Marta' });

test('1. een voorstel opent niets', () => {
  const w = wereld();
  const p = stel(w, 'beveiliging', 'SECUR');
  assert.equal(p.partner.stand, 'voorgesteld');
  const s = w.sig();
  assert.deepEqual(s.signalen, [], 'voorgesteld is geen band');
  assert.equal(s.partners, 0);
});

test('2. alleen de genoemde zaak mag antwoorden, en een ander krijgt 404', () => {
  const w = wereld();
  const p = stel(w, 'beveiliging', 'SECUR').partner;

  const vreemde = w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'IEMAND', door: 'X' });
  assert.equal(vreemde.status, 404, 'en geen 403: wie het niet is, hoort niet te weten dat dit bestaat');

  const zonder = w.k.partnerBevestig(w.fid, w.eid, { id: p.id, door: 'X' });
  assert.equal(zonder.status, 404);

  assert.equal(w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere' }).ok, true);
});

test('3. een bevestigde band zonder gedeelde stukken deelt niets', () => {
  const w = wereld();
  const p = stel(w, 'beveiliging', 'SECUR').partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere' });

  const s = w.sig();
  assert.deepEqual(s.signalen, [], 'bevestigd is nog geen deling');
  assert.equal(s.partners, 1);
  assert.equal(s.zonderDeling, 1, 'en dat is een blinde vlek, geen rust');
});

test('3b. en een partner die niets deelt, maakt van stilte geen rust', () => {
  const w = wereld();
  /* Een terrein waarop WEL gemeten wordt, zodat de rust niet al om een andere
     reden wegvalt: een scan binnen, niets dat volloopt. */
  const hek = w.k.plekZet(w.fid, w.eid, { naam: 'Hek', soort: 'ingang', ouder: w.terrein.id }).plek;
  const pas = w.k.pasUitgeven(w.fid, w.eid, { drager: 'Kobalt', rechten: [{ soort: 'festival.entree' }] }).pas;
  w.k.scan(w.fid, w.eid, { code: pas.code, plek: hek.id, datum: VANDAAG, tijd: '13:00', poort: 'Hek' });

  const zonderPartner = w.k.uitzonderingen(w.fid, w.eid, { dag: w.dag.id, datum: VANDAAG, tijd: '13:10' });
  assert.equal(zonderPartner.rust, true, 'zonder partners is dit gewoon rustig');

  const p = w.k.partnerVoorstel(w.fid, w.eid, { rol: 'beveiliging', zaak: 'SECUR', door: 'Marta' }).partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere' });   // geen deelt

  const metPartner = w.k.uitzonderingen(w.fid, w.eid, { dag: w.dag.id, datum: VANDAAG, tijd: '13:10' });
  assert.equal(metPartner.uitzonderingen.length, 0, 'er is nog steeds niets aan de hand');
  assert.equal(metPartner.zonderDeling, 1);
  assert.equal(metPartner.rust, false, 'maar een bevestigde partner die zwijgt, is geen rust');
});

test('4. alleen de vrijgegeven posten komen door', () => {
  const w = wereld();
  const p = stel(w, 'beveiliging', 'SECUR').partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere', deelt: ['p1', 'p2'] });

  const s = w.sig();
  assert.equal(s.signalen.length, 1, 'p2 heeft niets open, p9 is van een andere klant');
  assert.match(s.signalen[0].zin, /Hoofdingang/);
  assert.ok(!s.signalen.some(x => /Bankfiliaal/.test(x.zin)),
    'het rooster van een andere klant hoort dit festival niet aan');
});

test('5. wat er doorkomt is een aantal, geen dossier', () => {
  const w = wereld();
  const p = stel(w, 'beveiliging', 'SECUR').partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere', deelt: ['p1'] });

  const sig = w.sig().signalen[0];
  const alles = JSON.stringify(sig);
  assert.match(sig.zin, /mist 2 bewakers/);
  assert.equal(sig.herkomst.open, 2);
  assert.ok(!/Jordi Ripoll/.test(alles), 'de naam van een bewaker hoort hier niet te staan');
  assert.ok(!/staffId|s9/.test(alles), 'en zijn personeelsnummer evenmin');
});

test('6. een storing telt alleen binnen zijn eigen venster', () => {
  const w = wereld();
  const p = stel(w, 'vervoer', 'BUS').partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'BUS', door: 'Aina', deelt: ['l1'] });

  const binnen = w.sig('20:00').signalen;
  assert.equal(binnen.length, 1);
  assert.match(binnen[0].zin, /Pendel Lelystad/);
  assert.match(binnen[0].zin, /wegwerkzaamheden/);
  assert.ok(!/minuten te laat/.test(binnen[0].zin),
    'RTG rekent geen vertraging uit; de vervoerder meldt hem');

  assert.deepEqual(w.sig('22:30').signalen, [], 'na 21:00 is hij voorbij');
  assert.deepEqual(w.sig('13:00').signalen, [], 'en ervoor was hij er nog niet');
});

test('7. opzeggen kan van beide kanten, en daarna komt er niets meer door', () => {
  const w = wereld();
  const p = stel(w, 'beveiliging', 'SECUR').partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere', deelt: ['p1'] });
  assert.equal(w.sig().signalen.length, 1);

  const vreemde = w.k.partnerOpzeg(w.fid, w.eid, { id: p.id, zaakCode: 'IEMAND' });
  assert.equal(vreemde.status, 404);

  assert.equal(w.k.partnerOpzeg(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere' }).ok, true);
  assert.deepEqual(w.sig().signalen, [], 'een opgezegde band levert niets meer');
  assert.equal(w.sig().partners, 0);

  // en andersom: de eigenaar van het festival kan ook opzeggen
  const q = stel(w, 'vervoer', 'BUS').partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: q.id, zaakCode: 'BUS', door: 'Aina', deelt: ['l1'] });
  assert.equal(w.k.partnerOpzeg(w.fid, w.eid, { id: q.id, eigenaar: true, door: 'Marta' }).ok, true);
  assert.equal(w.sig().signalen.length, 0);
});

test('8. de signalen komen op dezelfde hoop als de eigen metingen', () => {
  const w = wereld();
  const p = stel(w, 'beveiliging', 'SECUR').partner;
  w.k.partnerBevestig(w.fid, w.eid, { id: p.id, zaakCode: 'SECUR', door: 'Pere', deelt: ['p1'] });

  const u = w.k.uitzonderingen(w.fid, w.eid, { dag: w.dag.id, datum: VANDAAG, tijd: '20:00' });
  assert.ok(u.uitzonderingen.some(x => x.bron === 'beveiliging'),
    'een uitzondering van buiten staat in dezelfde lijst en niet in een tweede');
  assert.equal(u.rust, false, 'en rust is het dus niet');
  assert.equal(u.partners, 1);
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Acht mutaties, alle acht RAAK.

   1. partnersVan() ook voorstellen en opgezegde banden laten teruggeven.
      -> toetsen 1 en 7 zakten. Dit is de kern van de hele band: een voorstel is
         geen toestemming, en een opzegging is geen formaliteit.

   2. De controle dat de antwoordende zaak DE GENOEMDE zaak is, uitgezet.
      -> toets 2 zakte: een willekeurige zaak bevestigde de band van een ander
         en opende daarmee het rooster van SECUR.

   3. De deelt-lijst genegeerd in ./signalen.js (heel het rooster lezen).
      -> toetsen 4 en 7 zakten: de post 'Bankfiliaal' van een ANDERE klant van
         hetzelfde beveiligingsbedrijf kwam in de festivalcockpit terecht.

   4. Het venster van een storing genegeerd.
      -> toets 6 zakte: een storing van 19:00-21:00 stond er om 13:00 ook.

   5. In ./uitzondering.js `zonderDeling` uit de rust-berekening gehaald.
      -> toets 3b zakte: een bevestigde partner die zwijgt, meldde rust. Dat is
         hetzelfde soort stilte als een ongemeten plek, en even gevaarlijk.

   6. De shifts (met bezet en de namen erin) meegestuurd in `herkomst`.
      -> toets 5 zakte: 'Jordi Ripoll' en zijn staffId stonden in het antwoord.
         De cockpit heeft een AANTAL nodig, geen personeelsdossier van een
         andere onderneming.

   7. De opzeg-controle uitgezet.
      -> toets 7 zakte: een derde beeindigde de band.

   8. De signalen niet meer bij de uitzonderingen gooien.
      -> toets 8 zakte. Twee lijsten naast elkaar laten de leiding kiezen welke
         ze eerst leest, en dat is precies de keuze die een cockpit wegneemt.
   ========================================================================== */
