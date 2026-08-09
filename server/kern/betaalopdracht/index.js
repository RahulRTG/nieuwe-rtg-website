/* DE BETAALOPDRACHT: het verschil tussen "geboekt" en "echt weg".

   Dit is de reparatie van een gat dat het grootboek per definitie niet kon zien.
   In kern/bank/overboeken.js stond bij de uitgaande SEPA een aanroep van
   betaal.maakUitbetaling in een try, met een lege catch eronder en daarin de
   opmerking "eventueel-consistent: de payout kan later opnieuw; de boeking
   staat al".

   Er was geen "later opnieuw": geen rij, geen herhaling, geen reconciliatie.
   Mislukte de rail, dan stond de boeking er wel -- het geld van de rekening af,
   geparkeerd op extern:sepa -- en het grootboek SLOOT NETJES, want de
   tegenboeking klopte. De sluitcontrole kan dit dus nooit vinden. Het lid zag
   een geslaagde overboeking terwijl er buiten RTG niets was gebeurd: de stilste
   vorm die er is (LAT.md regel 5), op het enige pad waar geld het huis verlaat.

   De oorzaak is niet die ene catch, maar dat "geboekt" en "de rail heeft het
   aangenomen" hetzelfde moment waren terwijl het twee gebeurtenissen zijn.
   Vandaar twee dingen naast elkaar: de BOEKING (wat RTG administratief weet,
   blijft in het grootboek) en de OPDRACHT (wat er buiten RTG moet gebeuren).

   Een opdracht wordt DUURZAAM VASTGELEGD VOORDAT de rail wordt gebeld. Valt het
   proces om tijdens de aanroep, dan zegt de rij na de herstart nog steeds dat er
   iets moet gebeuren; de ronde probeert hem opnieuw met dezelfde
   idempotentiesleutel, zodat een herhaling nooit een tweede betaling wordt.

   Deze module kent geen enkele rail: wie hem gebruikt geeft `railInzenden` en
   `terugboeken` mee (voor de bank: ../bank/uitgang.js). Dezelfde vorm past op de
   partner-uitbetaling van Pay en de afdracht van het fonds -- TAKEN.md 4.22.

   Drie delen, op hun eigen naad:
     hier         wat een opdracht IS -- de statussen, wanneer hij mag veranderen
     ./inzending  hem aanbieden bij de rail, opgeven, en het geld terugdraaien
     ./rij        de verzameling -- wie is aan de beurt, wat staat er open */
'use strict';

/* GEBOEKT/booked (de rail weet van niets), INGEDIEND/submitted (aangenomen, nog
   niet definitief), AFGEWIKKELD/settled, MISLUKT/failed (opgegeven, het geld
   moet terug), TERUGGEBOEKT/reversed. De Engelse namen staan erbij omdat ze in
   elk betaalontwerp voorkomen; de code van dit huis is Nederlands. */
const STATUS = { GEBOEKT: 'GEBOEKT', INGEDIEND: 'INGEDIEND', AFGEWIKKELD: 'AFGEWIKKELD', MISLUKT: 'MISLUKT', TERUGGEBOEKT: 'TERUGGEBOEKT' };

/* Welke stap na welke mag. Een overgang die hier niet staat is een
   programmeerfout en wordt geweigerd -- niet stil doorgevoerd, want een status
   die achteruit kan lopen maakt elk getal eronder waardeloos. Opnieuw indienen
   vanuit MISLUKT mag met de hand: dat is een besluit van het kantoor. */
const OVERGANG = {
  GEBOEKT: ['INGEDIEND', 'AFGEWIKKELD', 'MISLUKT'],
  INGEDIEND: ['AFGEWIKKELD', 'MISLUKT'],
  AFGEWIKKELD: [],
  MISLUKT: ['TERUGGEBOEKT', 'INGEDIEND'],
  TERUGGEBOEKT: []
};

const AF = new Set([STATUS.AFGEWIKKELD, STATUS.TERUGGEBOEKT]);          // klaar
const OPEN = new Set([STATUS.GEBOEKT, STATUS.INGEDIEND, STATUS.MISLUKT]); // telt in de reconciliatie

/* Wat de rail terugmeldt als "hier ben ik klaar mee". Alles wat hier niet in
   staat is aangenomen maar niet afgerond -- dus INGEDIEND, en de definitieve
   bevestiging komt later via bevestig() (de webhook). Liever een opdracht die
   te lang open staat dan een die te vroeg dicht gaat. */
const DEFINITIEF = new Set(['betaald', 'succeeded', 'paid', 'settled', 'afgewikkeld']);

// oplopend wachten tussen pogingen; de laatste waarde geldt voor alles daarna
const BACKOFF_MS = [30000, 120000, 600000, 1800000, 3600000];
const MAX_POGINGEN = 6;
const RAM_MAX = 50000;

module.exports = function maakBetaalopdrachten(opties) {
  const { d, save, crypto, nu, railInzenden, terugboeken, log } = opties || {};
  const maxPogingen = Number.isFinite(opties && opties.maxPogingen) ? opties.maxPogingen : MAX_POGINGEN;
  const backoffMs = (opties && Array.isArray(opties.backoffMs) && opties.backoffMs.length) ? opties.backoffMs : BACKOFF_MS;

  function rij() { if (!Array.isArray(d().betaalOpdrachten)) d().betaalOpdrachten = []; return d().betaalOpdrachten; }
  const wacht = n => backoffMs[Math.min(Math.max(0, n - 1), backoffMs.length - 1)];
  const klacht = (bericht, gegevens) => { if (log && log.warn) log.warn(bericht, gegevens); else console.warn('[betaalopdracht] ' + bericht, gegevens || ''); };

  const publiek = o => ({
    id: o.id, soort: o.soort, rail: o.rail, status: o.status, centen: o.centen, valuta: o.valuta,
    bron: o.bron, bestemming: o.bestemming, oms: o.oms, ledgerRef: o.ledgerRef,
    tariefCenten: o.tariefCenten || 0, settlementRef: o.settlementRef || null,
    pogingen: o.pogingen, volgendeAt: o.volgendeAt || null, laatsteFout: o.laatsteFout || null,
    at: o.at, klaarAt: o.klaarAt || null
  });

  /* De enige plek waar een status verandert. Een geweigerde overgang is een
     fout in de aanroeper en moet opvallen, dus hij wordt geklaagd en niet
     uitgevoerd -- de opdracht blijft dan staan waar hij stond en komt vanzelf
     terug in openstaand(). */
  function zet(o, nieuw, velden) {
    if (o.status === nieuw) return false;
    if (!OVERGANG[o.status] || !OVERGANG[o.status].includes(nieuw)) {
      klacht('geweigerde statusovergang', { id: o.id, van: o.status, naar: nieuw });
      return false;
    }
    o.status = nieuw;
    Object.assign(o, velden || {});
    if (AF.has(nieuw)) { o.klaarAt = nu(); o.volgendeAt = null; }
    return true;
  }

  /* Vastleggen VOORDAT de rail wordt gebeld. Alles wat nodig is om de inzending
     later opnieuw te doen staat in de rij zelf; de aanroeper hoeft na een
     herstart niets te onthouden. */
  function maak({ soort, rail, centen, valuta = 'eur', bron, bestemming, begunstigde, oms, ledgerRef, tariefCenten = 0, tariefRef = null, idemSleutel }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c <= 0) throw new Error('Een betaalopdracht heeft een positief bedrag in centen nodig.');
    if (!ledgerRef) throw new Error('Een betaalopdracht hoort bij een boeking; ledgerRef ontbreekt.');
    return ctx.plaats({
      id: 'BO' + crypto.randomBytes(6).toString('hex').toUpperCase(),
      soort: String(soort || 'uitbetaling'), rail: String(rail || 'betaalnaad'),
      status: STATUS.GEBOEKT, centen: c, valuta,
      bron: bron || null, bestemming: bestemming || null, begunstigde: begunstigde || '',
      oms: String(oms || '').slice(0, 200), ledgerRef,
      tariefCenten: Math.max(0, Math.round(Number(tariefCenten) || 0)), tariefRef,
      idemSleutel: idemSleutel || ('opdracht:' + ledgerRef),
      pogingen: 0, volgendeAt: nu(), laatsteFout: null, settlementRef: null,
      at: nu(), klaarAt: null
    });
  }

  /* De twee delen kennen elkaar over en weer: de rij dient in, de inzending
     zoekt op. Dat wordt hier laat gebonden op een gedeelde ctx -- hetzelfde
     patroon als kern/bank/index.js met rekeningOpen -- zodat geen van beide de
     ander hoeft te requiren en er dus geen kringetje ontstaat. */
  const ctx = { rij, save, nu, klacht, publiek, zet, wacht, maxPogingen,
    STATUS, AF, OPEN, DEFINITIEF, ramMax: RAM_MAX, railInzenden, terugboeken };
  const derij = require('./rij')(ctx);
  ctx.plaats = derij.plaats;
  ctx.vind = derij.vind;
  const inzending = require('./inzending')(ctx);
  ctx.dienIn = inzending.dienIn;

  return { STATUS, maak, publiek, dienIn: inzending.dienIn, ...derij };
};
module.exports.STATUS = STATUS;
