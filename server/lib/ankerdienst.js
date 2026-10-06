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
   DE ZEGEL bindt de koppen aan elkaar, zodat er niet een journaal uit een blok
   te knippen valt. DE HANDTEKENING (Ed25519, sleutel buiten de database; zie
   hieronder) bewijst dat het blok van deze installatie komt.
   ========================================================================== */
'use strict';


const crypto = require('crypto');
const { verankerPunt, verifieerTegenAnker } = require('./keten-anker');
const klok = require('./klok');

/* Welke journalen, hoe ze als ankerbare rij gelezen worden en hun bewaring:
   ./ankerjournalen.js. De handtekening: ./ankerzegel.js. */
const { JOURNALEN, BEWARING, zegelRij } = require('./ankerjournalen');
const { zaadUit, sleutelpaar, kanoniek, teTekenen, DOEL } = require('./ankerzegel');

function maakAnkerdienst({ db, nu, sleutel, omgeving }) {
  const tijd = nu || klok.nu;
  const env = omgeving || process.env;
  let paar = null, paarGezocht = false;
  /* Laat: het procesgeheim staat pas klaar als de kluis is opgestart. Zolang
     er geen zaad is, wordt het later opnieuw geprobeerd. */
  function eigenPaar() {
    if (paarGezocht) return paar;
    const zaad = zaadUit(env.RTG_ANKER_SIGN_KEY) ||
      (typeof sleutel === 'function' ? sleutel(DOEL) : (Buffer.isBuffer(sleutel) ? sleutel : null));
    if (!zaad) return null;
    paarGezocht = true; paar = sleutelpaar(zaad);
    return paar;
  }

  /* De koppen van de per-lid journalen samengevat tot één punt. Zie de uitleg
     bij JOURNALEN: niet duizend ankers, maar één dat over alle duizend gaat. */
  function boardroomPunt() {
    const bak = (db.data && db.data.ledenBoardLog) || {};
    const koppen = [];
    for (const lid of Object.keys(bak).sort()) {
      const p = verankerPunt(bak[lid]);
      if (p) koppen.push(lid + ':' + p.nr + ':' + p.hash);
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
    const uit = Object.assign({}, kaal, { zegel });
    const p = eigenPaar();
    if (p) uit.handtekening = { alg: 'ed25519', sleutelId: p.sleutelId, publiek: p.publiekB64,
      waarde: crypto.sign(null, teTekenen(uit), p.prive).toString('base64') };
    return uit;
  }

  /* Is dit blok door DEZE installatie getekend? `null` als deze dienst geen
     sleutel heeft (een los toetsstel): dan is er niets te bewijzen, en dat
     zegt de uitslag ook (`ondertekend: null`). */
  function handtekeningGeldig(b) {
    const p = eigenPaar();
    if (!p) return { geldig: null, reden: 'deze dienst heeft geen ondertekensleutel' };
    const h = b && b.handtekening;
    if (!h || h.alg !== 'ed25519' || typeof h.waarde !== 'string')
      return { geldig: false, reden: 'het blok draagt geen handtekening van deze installatie' };
    let goed = false;
    try { goed = crypto.verify(null, teTekenen(b), p.publiek, Buffer.from(h.waarde, 'base64')); }
    catch (e) { goed = false; }
    if (!goed) return { geldig: false, reden: 'de handtekening is niet van deze installatie, of het blok is gewijzigd' };
    return { geldig: true, reden: null };
  }

  /* Afrekenen met een eerder naar buiten gebracht blok. Per journaal het
     oordeel van keten-anker.js; het geheel is pas ok als ze het allemaal zijn.

     Een journaal dat in het blok stond en nu LEEG is, is geen 'ok' maar precies
     het geval waar dit voor bestaat. verifieerTegenAnker() zegt dat al; deze
     laag telt het op zonder het weg te middelen.

     EERST DE HANDTEKENING. Een blok dat niet van ons komt, rekent niet af --
     anders past een vervalser een eigen blok bij zijn herschreven journaal. */
  function reken(eerder) {
    if (!eerder || !eerder.punten) return { ok: false, reden: 'geen bruikbaar blok' };
    const teken = handtekeningGeldig(eerder);
    if (teken.geldig === false) return { ok: false, ondertekend: false, reden: teken.reden, blokAt: eerder.at };
    const perJournaal = {};
    let alles = true; const ingekort = [];
    for (const [naam, haal] of Object.entries(JOURNALEN)) {
      const anker = eerder.punten[naam];
      if (!anker) { perJournaal[naam] = { ok: true, reden: 'stond niet in het blok' }; continue; }
      const uit = verifieerTegenAnker(haal(db), anker, Object.assign({ nu: tijd }, BEWARING[naam] || {}));
      perJournaal[naam] = uit;
      if (!uit.ok) { alles = false; if (uit.ingekort) ingekort.push(naam); }
    }
    return { ok: alles, ondertekend: teken.geldig, ingekort, perJournaal, blokAt: eerder.at };
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

  function publiekeSleutel() {
    const p = eigenPaar();
    return p ? { alg: 'ed25519', sleutelId: p.sleutelId, publiek: p.publiekB64 } : null;
  }

  return { blok, reken, stand, handtekeningGeldig, publiekeSleutel,
    JOURNALEN: Object.keys(JOURNALEN).concat('ledenBoardLog') };
}

module.exports = { maakAnkerdienst, JOURNALEN, BEWARING, zegelRij, kanoniek };
