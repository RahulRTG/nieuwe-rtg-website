/* DE WAARDELAAG -- waarde die weet wat hij is.

   WAAROM DEZE TOETS ER IS

   Het besluit onder WALLET_SALDO (server/kern/bevoegdheid/lijst.js) zegt sinds
   zijn eerste regel dat het gesloten circuit "een maximum per wallet en per
   boeking" kent, en dat de grond onder het besluit vervalt zodra die plafonds
   worden losgelaten. Er was alleen nooit een maximum per wallet: kern/pay/
   stand.js kent MAX_CENTEN (per boeking) en KASCODE_MAX, en verder niets. Het
   besluit beschreef dus een werkelijkheid die de code niet had -- en juist bij
   een besluit is dat het gevaarlijkst, want een besluit heeft geen toezichthouder
   die het narekent. Deze toets is die narekening.

   WAT HIER WORDT NAGETROKKEN

   1. HET PLAFOND BESTAAT ECHT. Boven het maximum van een wallet ketst de
      boeking af, en het antwoord zegt hoeveel ruimte er nog was.
   2. GERESERVEERD GELD IS NIET BESCHIKBAAR. Saldo, gereserveerd en beschikbaar
      zijn drie getallen; een bestedingsvraag hoort tegen het derde.
   3. VASTLEGGEN KAN NOOIT VOOR MEER DAN GERESERVEERD. Anders was de reservering
      geen garantie en had de houder het verschil al kunnen uitgeven.
   4. EEN VERLOPEN RESERVERING ZET NIETS MEER VAST. Geld dat blijft hangen omdat
      een partner niets terugmeldde, is een lek dat niemand kan uitleggen.
   5. DE KLASSE WEIGERT WAT DE KLASSE NIET MAG, en het beleid van de uitgever
      daarbovenop -- op genre en op tijdvenster.
   6. HET GROOTBOEK BLIJFT SLUITEN. Een reservering is geen boeking; de som van
      alle saldi hoort er niet door te bewegen.

   Draai los: node --experimental-sqlite --test test/waarde.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { maakWaarde } = require('../server/kern/waarde');
const { KLASSEN, uitbetaalVermogenVan } = require('../server/kern/waarde/klassen');

/* Een minimale db-dubbel: de waardelaag raakt alleen db.data en save(). Bewust
   geen server erbij -- deze laag boekt niets en heeft er niets aan. */
function bouw(klok) {
  const db = { data: {} };
  let saves = 0;
  const w = maakWaarde({ db, save: () => { saves++; }, crypto, nu: klok }).waarde;
  return { db, w, saves: () => saves };
}
let tijd = 1700000000000;
const klok = () => tijd;

test('het plafond van een wallet bestaat echt, en het antwoord zegt hoeveel ruimte er was', () => {
  const { w } = bouw(klok);
  const saldi = { 'lid:ANNA': 990000 };   // 9.900 euro staat er al (plafond 10.000)
  const saldoVan = r => saldi[r] || 0;
  const plafond = KLASSEN.PERSONAL_FUNDED.plafondCenten;
  /* 10.000 euro: gelijkgetrokken met kern/bankregie op 26 augustus 2026. Dit is
     de TERUGVAL uit de tabel; draait de waardelaag in het huis, dan wint de
     ingestelde waarde via koppelWalletPlafond(). */
  assert.equal(plafond, 1000000, 'het plafond is 10.000 euro per wallet');

  // 100 euro erbij past nog precies
  assert.equal(w.poort({ van: 'extern:oplaad', naar: 'lid:ANNA', centen: 10000, soort: 'oplaad', saldoVan }), null);
  // 100,01 euro past niet meer
  const dicht = w.poort({ van: 'extern:oplaad', naar: 'lid:ANNA', centen: 10001, soort: 'oplaad', saldoVan });
  assert.ok(dicht, 'boven het plafond ketst het af');
  assert.equal(dicht.status, 409);
  assert.equal(dicht.reden, 'plafond');
  assert.equal(dicht.ruimte, 10000, 'het antwoord zegt hoeveel ruimte er nog was');
});

test('een zaak heeft géén plafond: een kassa moet een dag lang door kunnen innen', () => {
  const { w } = bouw(klok);
  const saldi = { 'partner:KIKUNOI': 9000000 };  // 90.000 euro omzet
  const saldoVan = r => saldi[r] || 0;
  assert.equal(KLASSEN.PARTNER_SETTLEMENT.plafondCenten, null);
  assert.equal(w.poort({ van: 'lid:ANNA', naar: 'partner:KIKUNOI', centen: 5000, soort: 'kassa',
    saldoVan: r => (r === 'lid:ANNA' ? 100000 : saldoVan(r)) }), null);
});

test('gereserveerd geld telt niet als beschikbaar, en de weigering zegt dat ook', () => {
  const { w } = bouw(klok);
  const saldi = { 'lid:BRAM': 50000 };           // 500 euro
  const saldoVan = r => saldi[r] || 0;
  assert.equal(w.beschikbaar('lid:BRAM', 50000), 50000);

  const r = w.reserveer({ rek: 'lid:BRAM', centen: 40000, doel: 'Hotel' });
  assert.ok(r.ok, 'de reservering staat');
  assert.equal(w.gereserveerd('lid:BRAM'), 40000);
  assert.equal(w.beschikbaar('lid:BRAM', 50000), 10000, 'beschikbaar is saldo min gereserveerd');
  assert.equal(saldi['lid:BRAM'], 50000, 'het SALDO is niet aangeraakt: een reservering is geen boeking');

  const dicht = w.poort({ van: 'lid:BRAM', naar: 'partner:X', centen: 20000, soort: 'kassa', saldoVan });
  assert.equal(dicht.status, 402);
  assert.equal(dicht.gereserveerd, 40000);
  assert.match(dicht.error, /gereserveerd/, 'het lid hoort te lezen WAAROM, niet alleen "onvoldoende"');

  // en binnen het beschikbare deel mag het gewoon
  assert.equal(w.poort({ van: 'lid:BRAM', naar: 'partner:X', centen: 10000, soort: 'kassa', saldoVan }), null);
});

test('vastleggen mag voor minder dan gereserveerd, nooit voor meer', () => {
  const { w } = bouw(klok);
  const r = w.reserveer({ rek: 'lid:CEES', centen: 4000, doel: 'Taxi, maximale ritprijs' }).reservering;

  assert.equal(w.vastleggen({ id: r.id, centen: 5000 }).status, 409, 'boven de reservering kan niet');
  const v = w.vastleggen({ id: r.id, centen: 2600 });
  assert.ok(v.ok);
  assert.equal(v.centen, 2600, 'de rit was goedkoper dan het maximum');
  assert.equal(v.vrijgevallen, 1400);
  assert.equal(w.gereserveerd('lid:CEES'), 0, 'na vastleggen zet de reservering niets meer vast');
  assert.equal(w.vastleggen({ id: r.id }).status, 409, 'een tweede keer vastleggen kan niet');
});

test('een verlopen reservering zet niets meer vast, zonder dat er een opruimtaak aan te pas komt', () => {
  const { w } = bouw(klok);
  w.reserveer({ rek: 'lid:DIRK', centen: 30000, doel: 'Rekening', msGeldig: 60 * 60 * 1000 });
  assert.equal(w.gereserveerd('lid:DIRK'), 30000);
  tijd += 61 * 60 * 1000;                       // een uur en een minuut later
  assert.equal(w.gereserveerd('lid:DIRK'), 0, 'verlopen is verlopen; het geld is weer van het lid');
  assert.equal(w.beschikbaar('lid:DIRK', 30000), 30000);
  tijd = 1700000000000;
});

test('de klasse weigert wat de klasse niet mag: een werkgeversbudget gaat niet naar een ander lid', () => {
  const { w } = bouw(klok);
  w.registreer({ rek: 'lid:EVA', klasse: 'EMPLOYER_BUDGET', uitgever: 'WERKGEVER' });
  const saldoVan = () => 100000;
  const dicht = w.poort({ van: 'lid:EVA', naar: 'lid:FRANK', centen: 5000, soort: 'p2p', saldoVan });
  assert.equal(dicht.status, 403);
  assert.equal(dicht.reden, 'overdracht');
  // en persoonlijk saldo mag dat juist wel
  assert.equal(w.poort({ van: 'lid:GERDA', naar: 'lid:FRANK', centen: 5000, soort: 'p2p', saldoVan }), null);
});

test('geld teruggeven is geen overdracht -- een zaak mag een klant compenseren', () => {
  /* DIT IS EEN FOUT DIE ECHT IS GEMAAKT, en hij was stil. Een zaak die een
     reiziger compenseert voor een uitgevallen bus boekt van `partner:` naar
     `lid:`. De poort las dat als 'overdragen', en een partnersaldo is niet
     overdraagbaar -- dus weigerde hij ELKE teruggave, terugbetaling en
     creditering in het hele huis. test/ovkaart.test.js viel er als eerste over;
     er was geen foutmelding die zei wat er werkelijk aan de hand was.

     De regel is structureel: gaat waarde van een ZAAK naar een LID, dan is dat
     geld dat terugkomt bij de klant. Een lijst met soortnamen ('terug',
     'ovteruggave', ...) zou werken tot de volgende die iemand verzint. */
  const { w } = bouw(klok);
  const saldoVan = () => 100000;
  assert.equal(w.poort({ van: 'partner:NS', naar: 'lid:ANNA', centen: 500, soort: 'ovteruggave', saldoVan }), null,
    'een compensatie aan een reiziger mag');
  assert.equal(w.poort({ van: 'partner:NS', naar: 'lid:ANNA', centen: 500, soort: 'terug', saldoVan }), null,
    'en een teruggedraaide deelbetaling ook');

  /* En het mag niet zo ruim worden dat de overdrachtsregel eronder wegvalt: een
     werkgeversbudget blijft onoverdraagbaar aan een ander lid. */
  w.registreer({ rek: 'lid:EVA', klasse: 'EMPLOYER_BUDGET', uitgever: 'WERKGEVER' });
  assert.equal(w.poort({ van: 'lid:EVA', naar: 'lid:FRANK', centen: 500, soort: 'p2p', saldoVan }).reden, 'overdracht');
});

test('het beleid van de uitgever geldt: op genre en op tijdvenster', () => {
  const { w } = bouw(klok);
  w.registreer({ rek: 'lid:HANS', klasse: 'EMPLOYER_BUDGET', uitgever: 'WERKGEVER',
    beleid: { genres: ['horeca', 'ov'], venster: '06:00-23:00', dagMaxCenten: 4000 } });
  const saldoVan = () => 100000;
  const overdag = new Date('2026-08-24T12:00:00');
  const nacht = new Date('2026-08-24T02:00:00');
  const { w: w2 } = bouw(() => overdag.getTime());
  w2.registreer({ rek: 'lid:HANS', klasse: 'EMPLOYER_BUDGET', uitgever: 'WERKGEVER',
    beleid: { genres: ['horeca', 'ov'], venster: '06:00-23:00', dagMaxCenten: 4000 } });
  assert.equal(w2.poort({ van: 'lid:HANS', naar: 'partner:Z', centen: 2000, soort: 'kassa', saldoVan, genre: 'horeca' }), null);
  assert.equal(w2.poort({ van: 'lid:HANS', naar: 'partner:Z', centen: 2000, soort: 'kassa', saldoVan, genre: 'slijterij' }).reden, 'genre');
  assert.equal(w2.poort({ van: 'lid:HANS', naar: 'partner:Z', centen: 2000, soort: 'kassa', saldoVan, genre: 'horeca', dagBesteed: 3000 }).reden, 'dagmax');

  const { w: w3 } = bouw(() => nacht.getTime());
  w3.registreer({ rek: 'lid:HANS', klasse: 'EMPLOYER_BUDGET', uitgever: 'WERKGEVER',
    beleid: { genres: ['horeca'], venster: '06:00-23:00' } });
  assert.equal(w3.poort({ van: 'lid:HANS', naar: 'partner:Z', centen: 2000, soort: 'kassa', saldoVan, genre: 'horeca' }).reden, 'tijd');
});

test('de eigen grens van het lid weigert net zo hard, maar zegt dat het zijn eigen grens is', () => {
  const { w } = bouw(klok);
  const saldoVan = () => 100000;
  const dicht = w.poort({ van: 'lid:IRIS', naar: 'partner:Z', centen: 6000, soort: 'kassa', saldoVan,
    dagBesteed: 0, eigenBeleid: { dagMaxCenten: 5000 } });
  assert.equal(dicht.status, 403);
  assert.equal(dicht.reden, 'eigen');
  assert.equal(dicht.opheffbaar, true, 'dit is de enige weigering die het lid zelf kan opheffen');
});

test('een positie zonder registratie krijgt niet stilzwijgend de ruimste rechten', () => {
  const { w } = bouw(klok);
  /* Een LID-rekening zonder registratie is gewoon persoonlijk saldo -- daar valt
     niets aan te raden, de wallet van een lid IS dat. */
  const p = w.positie('lid:ONBEKEND');
  assert.equal(p.klasse, 'PERSONAL_FUNDED');
  assert.equal(p.geregistreerd, false);
  assert.ok(Number.isFinite(p.spec.plafondCenten), 'en valt gewoon onder een plafond');

  /* Een UITGEGEVEN positie zonder registratie is een fout, en die valt terug op
     de strengste klasse. Dit werd belangrijk op het moment dat persoonlijk saldo
     uitbetaalbaar werd: viel een onbekende positie nog steeds terug op
     PERSONAL_FUNDED, dan was hij daarmee stilzwijgend uitbetaalbaar geworden --
     het omgekeerde van wat deze regel bedoelt. */
  const q = w.positie('waarde:VAL-BESTAATNIET');
  assert.equal(q.geregistreerd, false);
  assert.equal(q.spec.uitbetaalbaar, false, 'wat we niet kennen, kan niets');
  assert.equal(q.spec.overdraagbaar, 'nee');
  assert.notEqual(q.klasse, 'PERSONAL_FUNDED', 'en valt niet terug op de klasse van een gewone wallet');
  // de extern-rekeningen zijn géén waardepositie: dat is de sluitpost van het dubbel boekhouden
  assert.equal(w.positie('extern:oplaad'), null);
  assert.equal(w.positie('extern:uitbetaald'), null);
});

test('elke klasse draagt een grond, en uitbetaalbaarheid hangt aan een bevoegdheid', () => {
  /* HIER STOND EEN ANDERE EIS, EN DIE IS OP 24 AUGUSTUS 2026 VERVALLEN. Er
     stond dat alleen PARTNER_SETTLEMENT uitbetaalbaar mocht zijn -- de
     weerslag van het besluit WALLET_SALDO, dat uitging van een gesloten
     circuit. Sinds leden hun saldo kunnen terugstorten klopt dat niet meer, en
     een toets die een vervallen regel bewaakt is erger dan geen toets: hij
     blokkeert de verandering die wél besloten is en zegt er de reden niet bij.

     Wat ervoor in de plaats komt is strenger op het punt dat er werkelijk toe
     doet. `uitbetaalbaar: true` is één woord; wie het zet, verlegt de zwaarste
     grens van deze laag. Daarom moet elke uitbetaalbare klasse NOEMEN waarop
     dat rust, en moet dat vermogen echt in de bevoegdhedenlijst staan én van
     een soort zijn die iets kan weigeren. Een `besluit` kan dat niet -- dat
     staat per definitie altijd open -- dus een uitbetaalbaarheid die op een
     besluit leunt, is geen grens maar een aanname. */
  const { VERMOGENS, gezichtVan } = require('../server/kern/bevoegdheid/lijst');
  for (const [id, k] of Object.entries(KLASSEN)) {
    assert.ok(k.grond && k.grond.length > 40, id + ' hoort een grond te dragen die uitlegt waarom hij mag bestaan');
    assert.ok(['nee', 'leden', 'vrij'].includes(k.overdraagbaar), id + ' heeft een geldige overdraagbaarheid');
    if (k.uitbetaalbaar) {
      const v = uitbetaalVermogenVan(id);
      assert.ok(v, id + ' is uitbetaalbaar en moet zeggen waarop dat rust');
      assert.ok(VERMOGENS[v], id + ' verwijst naar ' + v + ', en dat vermogen bestaat niet in de bevoegdhedenlijst');
      /* Een vermogen kan twee GEZICHTEN hebben (afhankelijk van een stand), en
         dan moet ELK gezicht iets kunnen weigeren -- niet gemiddeld, niet in de
         stand die vandaag toevallig geldt. Een uitbetaalbaarheid die in één
         stand op een besluit leunt, is in die stand geen grens. */
      for (const stand of ['gesloten', 'open', null]) {
        const g = gezichtVan(VERMOGENS[v], stand);
        assert.notEqual(g.soort, 'besluit',
          v + ' is in stand ' + stand + ' een besluit, en een besluit kan niets weigeren');
        assert.ok(g.soort === 'stand' || g.eigenNodig || g.nodig,
          v + ' hoort in stand ' + stand + ' iets te vragen of dicht te staan');
      }
    } else {
      assert.equal(uitbetaalVermogenVan(id), null, id + ' is niet uitbetaalbaar en hoort geen vermogen te noemen');
    }
    // vrij overdraagbaar EN uitbetaalbaar is geld uitgeven; die combinatie mag hier niet bestaan
    assert.ok(!(k.overdraagbaar === 'vrij' && k.uitbetaalbaar), id + ' zou daarmee een betaalmiddel zijn');
  }
});

test('de terugstortstand bepaalt de juridische positie, en beide standen kloppen', () => {
  /* Het besluit WALLET_SALDO droeg zijn eigen vervalclausule -- verandert de
     uitbetaalbaarheid, de geslotenheid of het plafond, dan hoort het vermogen
     van soort te wisselen. RTG wil BEIDE posities kunnen innemen, en dat is een
     legitieme bedrijfskeuze; het gevaar is dat de knop losraakt van wat hij
     juridisch betekent. Deze toets bewaakt dat er geen stand bestaat waarin de
     code iets anders doet dan het document zegt. */
  const { VERMOGENS, gezichtVan } = require('../server/kern/bevoegdheid/lijst');

  const dicht = gezichtVan(VERMOGENS.WALLET_SALDO, 'gesloten');
  assert.equal(dicht.soort, 'besluit', 'gesloten circuit: een besluit, geen vergunning nodig');
  assert.match(dicht.besluit, /beperkt netwerk/, 'met de grond die dat draagt');
  assert.match(dicht.besluit, /vervalt deze grond/, 'en met wanneer die grond vervalt');
  assert.equal(gezichtVan(VERMOGENS.LID_UITBETALING, 'gesloten').soort, 'stand',
    'in die stand bestaat terugstorten niet -- geen "mag even niet" maar "hoort er niet bij"');

  const open = gezichtVan(VERMOGENS.WALLET_SALDO, 'open');
  assert.equal(open.soort, 'rail', 'inwisselbaar saldo is elektronisch geld');
  assert.equal(open.eigenNodig, 'elektronischgeldinstelling',
    'klantgeld aanhouden dat inwisselbaar is, vraagt meer dan een betaalinstelling');
  const uit = gezichtVan(VERMOGENS.LID_UITBETALING, 'open');
  assert.equal(uit.eigenNodig, 'elektronischgeldinstelling');
  /* Apart van elkaar, met opzet: bij een storing op de uitbetaalrail hoort de
     wallet niet mee te vallen. */
  assert.notEqual(uit.partnerRail, open.partnerRail);

  /* ZONDER STAND geldt het strengste gezicht, en dat is per vermogen een ANDER
     gezicht: bij WALLET_SALDO de rail (die kan weigeren, een besluit nooit), bij
     LID_UITBETALING juist gesloten (die staat altijd nee). Een terugval die
     simpelweg altijd hetzelfde gezicht koos, zou er een van beide openzetten. */
  assert.equal(gezichtVan(VERMOGENS.WALLET_SALDO, null).soort, 'rail');
  assert.equal(gezichtVan(VERMOGENS.LID_UITBETALING, null).soort, 'stand');
});


/* ------------------------------------------------------------------------
   EN DAN DE ENIGE VRAAG DIE ER ECHT TOE DOET: ZIT HET VAST?

   Alles hierboven toetst de waardelaag op zichzelf, en dat is precies de toets
   die groen blijft als niemand hem aanroept. Een plafond dat in een module
   bestaat maar niet in de betaalweg zit, is geen plafond -- en het besluit
   onder WALLET_SALDO gaat over de betaalweg, niet over een module. Deze twee
   toetsen gaan daarom door de voordeur: over HTTP, langs de echte oplaadroute,
   met een echte wallet.
   ------------------------------------------------------------------------ */
let srv, base, walletLid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-waarde-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const d = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  const o = await api('pay/overzicht', {}, d.token);
  walletLid = { token: d.token, codenaam: o.body.codenaam };
  assert.ok(walletLid.codenaam, 'een lid met een wallet');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('door de voordeur: opladen stopt bij het plafond van de wallet', async () => {
  /* HET PLAFOND IS 10.000 EURO EN DAT KOST TWEE OPLAADBEURTEN, want MAX_CENTEN
     begrenst EEN boeking op 5.000. Hier stond een enkele oplading van 5.000 met
     "tot precies het plafond": dat leunde op een tweede getal in
     kern/waarde/klassen.js dat op de helft van het bankplafond stond. Die twee
     zijn op 26 augustus 2026 samengevoegd tot een bron (de boardroom stelt het
     in, kern/pay/plafond.js en de waardelaag lezen allebei die), en toen bleek
     deze toets de oude verborgen waarde te bevestigen. */
  const eerste = await api('pay/oplaad', { centen: 500000, idem: 'plafond-1' }, walletLid.token);
  assert.equal(eerste.status, 200, 'de eerste helft laadt gewoon');
  const vol = await api('pay/oplaad', { centen: 500000, idem: 'plafond-vol' }, walletLid.token);
  assert.equal(vol.status, 200, 'tot het plafond laadt gewoon');
  assert.equal(vol.body.saldo, 1000000);

  // en er kan geen cent meer bij
  const over = await api('pay/oplaad', { centen: 100, idem: 'plafond-over' }, walletLid.token);
  assert.equal(over.status, 409, 'boven het plafond weigert de oplaadroute');
  /* De melding komt van de poort die als EERSTE weigert -- kern/pay/plafond.js
     spreekt van "maximaal", de waardelaag van "maximum". Beide noemen het
     bedrag, en dat is wat deze bewering wil: een grens die zegt waarom. */
  assert.match(over.body.error, /maxima(al|um)/i, 'en zegt waarom');
  assert.match(over.body.error, /10000|10\.000/, 'en noemt het bedrag');

  const na = await api('pay/overzicht', {}, walletLid.token);
  assert.equal(na.body.saldo, 1000000, 'de geweigerde oplading heeft niets bijgeschreven');
});

test('door de voordeur: het grootboek sluit nog steeds op nul', async () => {
  const r = await fetch(base + '/api/pay/gezond');
  assert.equal(r.status, 200, 'een niet-sluitend grootboek geeft hier een 500');
  assert.equal((await r.json()).klopt, true, 'de som van alle saldi is exact nul -- de waardelaag boekt niets');
});
