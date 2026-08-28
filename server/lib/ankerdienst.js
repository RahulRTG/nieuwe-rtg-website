/* ============================================================================
   DE ANKERDIENST -- het ene getal dat naar buiten moet.

   WAAROM DIT ER IS. De hashketen onder de vier auditjournalen ziet dat er
   MIDDEN in een spoor is gesleuteld. Wat hij niet ziet is KOPAFKNIPPING: wie de
   nieuwste regels weggooit, houdt een keten over die van voor naar achter
   perfect klopt. Dat is precies de aanval van iemand die zijn eigen bezoek wil
   uitwissen, en lokaal is er niets tegen te doen -- elke teller die je ernaast
   zet, staat in dezelfde database en is door dezelfde hand te wijzigen.

   Daarvoor moet er EEN getal naar buiten. server/lib/keten-anker.js maakt dat
   getal (nr, hash, at) en rekent ermee af. Wat er ontbrak was de dienst die het
   periodiek OPHAALT voor alle journalen tegelijk en klaarzet om weg te
   schrijven. Zonder die stap bleef de control AUDIT-KETEN-VERANKERD op
   "niet in bedrijf": het mechanisme was bewezen en werd door niemand gebruikt.

   ------------------------------------------------------------------------
   WAT DEZE DIENST WEL EN NIET DOET

   Hij VERZAMELT de koppen van alle journalen en levert ze als één blok, met een
   tijdstempel en een handtekening over het geheel. Hij VERGELIJKT een eerder
   blok met de huidige stand en zegt per journaal of er regels zijn verdwenen.

   Hij BEPAALT NIET waar dat blok heen gaat. Dat is met opzet en het is de kern
   van de zaak: een anker dat deze software zelf op dezelfde schijf wegschrijft,
   is geen anker maar een tweede regel om te wijzigen. De bestemming is een
   besluit over de infrastructuur -- een tweede machine, een andere partij, een
   uitdraai in een kluis -- en dat besluit hoort bij een mens.

   Wat de dienst daarom levert is een blok dat je ergens ANDERS neerzet, en een
   functie die met zo'n blok afrekent zodra je hem terugvoert. Zolang niemand
   het blok wegzet, bewijst deze laag niets over kopafknipping, en dat zegt
   `stand()` dan ook met zoveel woorden in plaats van groen te tonen.

   ------------------------------------------------------------------------
   DE HANDTEKENING is geen beveiliging tegen een aanvaller die de sleutel heeft;
   hij bindt de vier koppen aan elkaar, zodat er niet één journaal uit een blok
   te knippen valt. Wie het blok naar buiten brengt, brengt ze alle vier.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { verankerPunt, verifieerTegenAnker } = require('./keten-anker');
const klok = require('./klok');

/* De vier journalen, met de weg naar hun regels. Staat er een vijfde op, dan
   hoort hij HIER erbij -- en de dekking in keten.js CONTROL hoort dan te zakken
   van 4/4 naar 4/5, want de noemer is het aantal journalen en niet het aantal
   dat we toevallig hebben aangesloten. */
const JOURNALEN = {
  inzageLog: (db) => (db.data && db.data.inzageLog) || [],
  securityLog: (db) => (db.data && db.data.securityLog) || [],
  handelingLog: (db) => (db.data && db.data.handelingLog) || [],
  /* livingLab en de boardroom-journalen staan PER LAB respectievelijk PER LID.
     Een blok met duizend koppen is geen anker maar een tweede database, dus
     nemen we hier de gezamenlijke kop: de hash over alle koppen samen. Verdwijnt
     er in één lid-journaal een regel, dan verandert die gezamenlijke hash. */
  livingLabAudit: (db) => ((db.data && db.data.livingLab && db.data.livingLab.audit) || [])
};

function maakAnkerdienst({ db, nu }) {
  const tijd = nu || klok.nu;

  /* De koppen van de per-lid journalen samengevat tot één punt. Zie de uitleg
     bij JOURNALEN: niet duizend ankers, maar één dat over alle duizend gaat. */
  function boardroomPunt() {
    const bak = (db.data && db.data.ledenBoardLog) || {};
    const koppen = [];
    for (const sleutel of Object.keys(bak).sort()) {
      const p = verankerPunt(bak[sleutel]);
      if (p) koppen.push(sleutel + ':' + p.nr + ':' + p.hash);
    }
    if (!koppen.length) return null;
    return { nr: koppen.length, hash: crypto.createHash('sha256').update(koppen.join('|')).digest('hex').slice(0, 32),
      at: new Date(tijd()).toISOString(), samenvatting: 'gezamenlijke kop over ' + koppen.length + ' boardroom-journalen' };
  }

  /* Het blok dat naar buiten moet. Geef dit aan een gescheiden systeem; bewaar
     het NIET alleen hier, want dan ankert het niets. */
  function blok() {
    const punten = {};
    for (const [naam, haal] of Object.entries(JOURNALEN)) punten[naam] = verankerPunt(haal(db));
    punten.ledenBoardLog = boardroomPunt();
    const kaal = { at: new Date(tijd()).toISOString(), punten };
    const zegel = crypto.createHash('sha256').update(JSON.stringify(kaal)).digest('hex').slice(0, 32);
    return Object.assign({}, kaal, { zegel });
  }

  /* Afrekenen met een eerder naar buiten gebracht blok. Per journaal het
     oordeel van keten-anker.js; het geheel is pas ok als ze het allemaal zijn.

     Een journaal dat in het blok stond en nu LEEG is, is geen 'ok' maar precies
     het geval waar dit voor bestaat. verifieerTegenAnker() zegt dat al; deze
     laag telt het op zonder het weg te middelen. */
  function reken(eerder) {
    if (!eerder || !eerder.punten) return { ok: false, reden: 'geen bruikbaar blok' };
    const perJournaal = {};
    let alles = true, ingekort = [];
    for (const [naam, haal] of Object.entries(JOURNALEN)) {
      const anker = eerder.punten[naam];
      if (!anker) { perJournaal[naam] = { ok: true, reden: 'stond niet in het blok' }; continue; }
      const uit = verifieerTegenAnker(haal(db), anker);
      perJournaal[naam] = uit;
      if (!uit.ok) { alles = false; if (uit.ingekort) ingekort.push(naam); }
    }
    return { ok: alles, ingekort, perJournaal, blokAt: eerder.at };
  }

  /* De stand, en hij liegt niet over wat hij bewijst.

     Zolang er geen blok naar buiten is gebracht, staat hier 'niet in bedrijf'.
     Dat is geen storing maar de waarheid: een anker dat nergens buiten staat,
     bewijst niets over kopafknipping. Groen tonen omdat de code bestaat, is
     precies de vorm van zelfbedrog waar TOEZICHT.md voor waarschuwt. */
  function stand(eerder) {
    const nuBlok = blok();
    if (!eerder) {
      return { inBedrijf: false, blok: nuBlok,
        uitleg: 'er is nog geen blok naar buiten gebracht. Zet dit blok weg op een GESCHEIDEN plek ' +
          '(een andere machine, een andere partij, een uitdraai) en voer het terug om ermee af te rekenen. ' +
          'Zolang dat niet gebeurt, ziet de keten wel gesleutel MIDDEN in een spoor, maar geen kopafknipping.' };
    }
    return Object.assign({ inBedrijf: true, blok: nuBlok }, reken(eerder));
  }

  return { blok, reken, stand, JOURNALEN: Object.keys(JOURNALEN).concat('ledenBoardLog') };
}

module.exports = { maakAnkerdienst, JOURNALEN };
