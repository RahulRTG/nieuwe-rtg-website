/* ============================================================================
   EEN TWEEDE MENS ONDER EEN KANTOORHANDELING.

   `scripts/overleving.js` had één rij die met zoveel woorden `nee` zei: *een
   medewerker handelt te kwader trouw, in zijn eentje.* De grond was gemeten --
   een medewerker op naam kon in zijn eentje een rekening rood zetten en een
   incassoronde starten, en `KANTOORMACHT.json` telde nul kantoorroutes met een
   tweede handtekening.

   DIT IS DE LIFECYCLE EN NIET DE TOETS. Wie twee mensen zijn, weet
   `kern/appstore/vierogen.js` al; dat wordt geleend, want een tweede kopie van
   die vergelijking loopt binnen een half jaar uiteen met de eerste (LAT.md
   regel 4). Wat ontbrak is wat eromheen hoort: een aanvraag die blijft staan,
   een bevroren lijf, een tweede mens die bevestigt, en een verlooptijd.

   WAAROM NIET `kern/bankregie/autorisatie.js` UITBREIDEN. Die doet vier-ogen op
   de bankKNOP, maar houdt precies ÉÉN openstaande autorisatie (enkelvoud) en
   zijn acties zijn hard ingebakken. Hier staan er meerdere tegelijk open en
   draagt de handeling een ONDERWERP; dat oprekken zou de bankknop verbouwen om
   er iets naast te hangen.

   DRIE DINGEN LIGGEN HARD VAST.

   1 HET LIJF WORDT BEVROREN BIJ DE AANVRAAG; de bevestiger stuurt er geen. Er
     is dus geen tweede lijf om mee te vergelijken, en "keur 250 goed, voer 9000
     uit" kan nergens binnenkomen.

   2 EEN NEE WORDT GEEN JA DOOR HET NOG EENS TE VRAGEN. Een bevestiging wordt
     OPGEBRUIKT, ook wanneer de uitvoering daarna faalt -- de les die
     `bankregie/autorisatie.js` in zijn kop uitschrijft.

   3 DE AANVRAGER IS NOOIT DE BEVESTIGER, en die vergelijking is alleen iets
     waard als beide kanten een ECHTE sleutel hebben. `kluisAuth` levert die
     (`req.officeKey`); de gedeelde code levert `null`, en dan weigert deze laag
     met de reden. Zonder die eis vergelijk je twee lege waarden.

   WAT HIJ NIET DOET: bepalen WELKE handeling een tweede mens verdient. Dat is
   een besluit en geen meting (`KANTOORMACHT.json`, `ongemeten.vierOgenVereist`).
   Wie een actie registreert neemt dat besluit; dit bestand voert het uit.
   ========================================================================== */
'use strict';

const vierogen = require('../appstore/vierogen');
/* De klok van dit huis en niet Date.now(), zodat een tijdproef de verlooptijd
   echt kan verzetten. Rechtstreeks geladen: `klok` staat niet in het
   kantoren-blok van GRENZEN.json, en die grens verruimen voor een klok is de
   verkeerde ruil (zelfde keuze als server/opzet/envelop.js). */
const klokHuis = require('../../lib/klok');

/* Tien minuten, gelijk aan kern/bankregie/autorisatie.js -- niet omdat tien het
   juiste getal is, maar omdat twee verlooptijden voor dezelfde soort ceremonie
   een verschil zijn dat niemand kan uitleggen. */
const VERLOOPT_MS = 10 * 60 * 1000;

/* Een echte mens achter deze sessie. `kluisAuth` zet req.officeKey op de lidKey
   van de sessie of op 'user-<id>' voor de eigenaar; de gedeelde code komt er
   niet langs en levert dus geen sleutel. */
const isMens = (k) => typeof k === 'string' && /^user-\d+$/.test(k);

module.exports = function maakTweedeHandtekening({ db, save }) {
  const nu = () => klokHuis.nu();
  const bak = () => {
    if (!db.data.kantoorHandtekeningen) db.data.kantoorHandtekeningen = [];
    return db.data.kantoorHandtekeningen;
  };

  /* De uitvoerders, per actienaam. Een actie zonder uitvoerder kan geen aanvraag
     worden: anders staat er straks een bevestigde handeling die niemand doet. */
  const uitvoerders = new Map();
  function neemHandelingOp(actie, { wat, voerUit }) {
    if (typeof voerUit !== 'function') throw new Error('tweedehandtekening: ' + actie + ' heeft geen uitvoerder');
    uitvoerders.set(String(actie), { wat: String(wat || actie), voerUit });
  }

  const verlopen = (a) => nu() - a.at > VERLOOPT_MS;
  const pub = (a) => a && {
    id: a.id, actie: a.actie, wat: a.wat, onderwerp: a.onderwerp || null,
    aangevraagdDoor: a.door, aangevraagdOp: new Date(a.at).toISOString(),
    verlooptOverMs: Math.max(0, VERLOOPT_MS - (nu() - a.at))
  };

  /* Verlopen aanvragen verdwijnen bij elke aanraking: geen lijstje met dode
     voorstellen waar iemand op een dag op drukt. */
  function opruimen() {
    const b = bak();
    const over = b.filter(a => !verlopen(a));
    if (over.length !== b.length) { db.data.kantoorHandtekeningen = over; save(); }
    return db.data.kantoorHandtekeningen;
  }

  function vraag({ actie, lijf, onderwerp, door }) {
    const u = uitvoerders.get(String(actie));
    if (!u) return { status: 400, error: 'Onbekende handeling.' };
    if (!isMens(door)) {
      return { status: 403,
        error: 'Deze handeling vraagt twee verschillende mensen. Log in met uw eigen RTG-account ' +
          'en koppel daarin de kantoorrol; met de gedeelde backoffice-code is er niemand om als ' +
          'tweede persoon van te verschillen.',
        watNu: 'inloggen-op-naam', poort: 'tweede-handtekening' };
    }
    opruimen();
    const a = {
      id: 'th-' + nu().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      actie: String(actie), wat: u.wat,
      /* HET LIJF STAAT HIER VAST. De bevestiger stuurt er geen; zie de kop. */
      lijf: lijf == null ? {} : JSON.parse(JSON.stringify(lijf)),
      onderwerp: onderwerp == null ? null : String(onderwerp),
      door, at: nu()
    };
    bak().push(a); save();
    return { ok: true, needsAuth: true, aanvraag: pub(a),
      zegTegenDeGebruiker: 'Aangevraagd. Een tweede persoon met een eigen kantooraccount bevestigt dit.' };
  }

  async function bevestig({ id, door, doorNaam }) {
    opruimen();
    const b = bak();
    const i = b.findIndex(x => x.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Er staat geen aanvraag met dit kenmerk open (of hij is verlopen).' };
    const a = b[i];
    /* EERST DE SLEUTEL, DAN DE VERGELIJKING. Andersom zou `toets` draaien op een
       lege `doorKey` en dan valt hij terug op de naam-tak of op `onbekend` --
       een uitslag die hier nooit mag voorkomen, want beide kanten horen een
       bewezen sleutel te hebben. */
    if (!isMens(door)) {
      return { status: 403,
        error: 'De tweede persoon moet met een eigen RTG-account zijn ingelogd.',
        watNu: 'inloggen-op-naam', poort: 'tweede-handtekening' };
    }
    /* DE VERGELIJKING KOMT UIT kern/appstore/vierogen.js, zodat er maar EEN plek
       is waar dit huis bepaalt of twee handelingen van dezelfde mens zijn. Er
       gaat met opzet geen `naam` in: beide kanten dragen hier een bewezen
       sleutel, en de naam-tak zou een ZWAKKERE vergelijking toelaten waar een
       harde beschikbaar is.

       Wat NIET wordt overgenomen is zijn REDEN. Die is geschreven voor een
       app-inzending ("wie een app inzendt, tekent hem niet af") en zou hier een
       bankmedewerker over apps vertellen. Het OORDEEL wordt geleend, de zin
       niet -- dat is precies waar `code` en `graad` voor zijn. */
    const oordeel = vierogen.toets({ inzender: { id: a.door }, doorKey: door });
    if (!oordeel.mag) {
      return { status: 403, code: oordeel.code,
        error: 'De tweede persoon moet iemand anders zijn dan wie het aanvroeg. ' +
          'Laat een collega met een eigen kantooraccount bevestigen.' };
    }

    /* DE HANDTEKENING WORDT OPGEBRUIKT, ook als de uitvoering hierna faalt. Zie
       punt 2 in de kop: een nee wordt geen ja door het nog eens te proberen. */
    b.splice(i, 1); save();

    const u = uitvoerders.get(a.actie);
    if (!u) return { status: 409, error: 'De handeling bestaat niet meer; vraag hem opnieuw aan.' };
    const r = await u.voerUit(a.lijf, { aangevraagdDoor: a.door, bevestigdDoor: door });
    if (r && r.error) {
      return { status: r.status || 409, error: r.error, handeling: null,
        aangevraagdDoor: a.door, bevestigdDoor: door, scheiding: oordeel.graad };
    }
    /* DE UITSLAG VAN DE HANDELING GAAT EERST, DE CEREMONIE ERNA -- en de
       ceremonie heet `handeling` en niet `uitgevoerd`. Dat is geen smaak: de
       incassoronde geeft zelf een veld `uitgevoerd` terug (het AANTAL geinde
       betalingen), en dat sloeg de naam van de handeling stil dood. Een
       bevestiging meldde dan `uitgevoerd: 0` waar `bank.incasso` hoorde te
       staan, en niets viel om. Gevonden door toets 6. */
    return Object.assign({}, r || {}, { ok: true, handeling: a.actie, wat: a.wat,
      aangevraagdDoor: a.door, bevestigdDoor: door, scheiding: oordeel.graad });
  }

  function annuleer({ id, door }) {
    opruimen();
    const b = bak();
    const i = b.findIndex(x => x.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Er staat geen aanvraag met dit kenmerk open.' };
    const a = b[i];
    b.splice(i, 1); save();
    return { ok: true, ingetrokken: pub(a), door: door || null };
  }

  /* De open aanvragen. Het LIJF gaat niet mee naar buiten: wie bevestigt hoort
     te zien WAT er gebeurt (`wat` en `onderwerp`), niet de rauwe invoer -- daar
     kan een bedrag of een codenaam in staan die op dit scherm niet hoort. */
  function open() { return { ok: true, aanvragen: opruimen().map(pub), verlooptOverMs: VERLOOPT_MS }; }

  return { registreer: neemHandelingOp, vraag, bevestig, annuleer, open, VERLOOPT_MS };
};
