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

   Deze module kent geen enkele rail: wie hem gebruikt geeft `railInzenden` mee
   en meldt per SOORT hoe het geld terugkomt (`registreerTeruggang`). Er is met
   opzet EEN rij voor het hele huis -- de bank-SEPA, de partneruitbetaling van
   Pay en de afdracht van het fonds -- want anders staat het antwoord op "wat
   is er geboekt maar niet aangekomen" op drie plekken en telt niemand ze op.
   Elke rail boekt in zijn eigen grootboek terug, en dat weet alleen die rail
   zelf; vandaar een tabel en geen gedeelde teruggang.

   Drie delen, op hun eigen naad:
     hier         wat een opdracht IS -- de statussen, wanneer hij mag veranderen
     ./inzending  hem aanbieden bij de rail, opgeven, en het geld terugdraaien
     ./rij        de verzameling -- wie is aan de beurt, wat staat er open */
'use strict';

const { STATUS, OVERGANG, AF, OPEN, DEFINITIEF,
  BACKOFF_MS, MAX_POGINGEN, RAM_MAX } = require('./status');

module.exports = function maakBetaalopdrachten(opties) {
  const { d, save, crypto, nu, railInzenden, log } = opties || {};
  const maxPogingen = Number.isFinite(opties && opties.maxPogingen) ? opties.maxPogingen : MAX_POGINGEN;
  const backoffMs = (opties && Array.isArray(opties.backoffMs) && opties.backoffMs.length) ? opties.backoffMs : BACKOFF_MS;

  function rij() { if (!Array.isArray(d().betaalOpdrachten)) d().betaalOpdrachten = []; return d().betaalOpdrachten; }
  const wacht = n => backoffMs[Math.min(Math.max(0, n - 1), backoffMs.length - 1)];
  const klacht = (bericht, gegevens) => { if (log && log.warn) log.warn(bericht, gegevens); else console.warn('[betaalopdracht] ' + bericht, gegevens || ''); };

  const publiek = o => ({
    id: o.id, soort: o.soort, rail: o.rail, status: o.status, centen: o.centen, valuta: o.valuta,
    bron: o.bron, bestemming: o.bestemming, oms: o.oms, ledgerRef: o.ledgerRef,
    economicIntentId: o.economicIntentId || null, settlementId: o.settlementId || null,
    claimId: o.claimId || null,
    tariefCenten: o.tariefCenten || 0, settlementRef: o.settlementRef || null,
    pogingen: o.pogingen, volgendeAt: o.volgendeAt || null, laatsteFout: o.laatsteFout || null,
    afwikkelingNodig: !!o.afwikkelingNodig, afwikkelingVerwerktAt: o.afwikkelingVerwerktAt || null,
    afwikkelFout: o.afwikkelFout || null,
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
  function maak({ soort, rail, centen, valuta = 'eur', bron, bestemming, begunstigde, oms, ledgerRef,
    tariefCenten = 0, tariefRef = null, idemSleutel, economicIntentId, settlementId, claimId }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c <= 0) throw new Error('Een betaalopdracht heeft een positief bedrag in centen nodig.');
    if (!ledgerRef) throw new Error('Een betaalopdracht hoort bij een boeking; ledgerRef ontbreekt.');
    return ctx.plaats({
      id: 'BO' + crypto.randomBytes(6).toString('hex').toUpperCase(),
      soort: String(soort || 'uitbetaling'), rail: String(rail || 'betaalnaad'),
      status: STATUS.GEBOEKT, centen: c, valuta,
      bron: bron || null, bestemming: bestemming || null, begunstigde: begunstigde || '',
      oms: String(oms || '').slice(0, 200), ledgerRef,
      economicIntentId: economicIntentId || null, settlementId: settlementId || null, claimId: claimId || null,
      tariefCenten: Math.max(0, Math.round(Number(tariefCenten) || 0)), tariefRef,
      idemSleutel: idemSleutel || ('opdracht:' + ledgerRef),
      pogingen: 0, volgendeAt: nu(), laatsteFout: null, settlementRef: null,
      afwikkelingNodig: afwikkelingen.has(String(soort || 'uitbetaling')),
      afwikkelingVerwerktAt: null, afwikkelFout: null,
      at: nu(), klaarAt: null
    });
  }

  /* De twee delen kennen elkaar over en weer: de rij dient in, de inzending
     zoekt op. Dat wordt hier laat gebonden op een gedeelde ctx -- hetzelfde
     patroon als kern/bank/index.js met rekeningOpen -- zodat geen van beide de
     ander hoeft te requiren en er dus geen kringetje ontstaat. */
  /* De teruggangen per soort. Een soort zonder teruggang krijgt een weigering
     en geen gok: een teruggeboeking moet naar dezelfde tegenrekening als waar
     het geld heen ging, en die weet alleen de rail die de opdracht maakte.
     Zonder deze tabel zou een nieuwe rail zijn mislukking stil naar de
     verkeerde kant boeken. */
  const teruggangen = new Map();
  function registreerTeruggang(soort, fn) {
    if (typeof fn !== 'function') throw new Error('Een teruggang is een functie.');
    if (teruggangen.has(soort)) throw new Error('Voor soort "' + soort + '" staat al een teruggang.');
    teruggangen.set(String(soort), fn);
  }
  const terugboeken = async (o) => {
    const fn = teruggangen.get(o.soort);
    if (!fn) return { error: 'Voor soort "' + o.soort + '" is geen teruggang geregistreerd.' };
    return fn(o);
  };

  /* Een definitieve railbevestiging is nog niet hetzelfde als interne
     afwikkeling. Gebruikers met claims/ledger registreren hier hun ene
     finalize-stap. Faalt die na de externe bevestiging, dan blijft de opdracht
     AFGEWIKKELD maar zichtbaar onafgewerkt en probeert de ronde de hook opnieuw. */
  const afwikkelingen = new Map();
  function registreerAfwikkeling(soort, fn) {
    if (typeof fn !== 'function') throw new Error('Een afwikkeling is een functie.');
    if (afwikkelingen.has(soort)) throw new Error('Voor soort "' + soort + '" staat al een afwikkeling.');
    afwikkelingen.set(String(soort), fn);
  }
  async function verwerkAfwikkeling(o) {
    if (!o || !o.afwikkelingNodig || o.afwikkelingVerwerktAt) return true;
    const fn = afwikkelingen.get(o.soort);
    let uit = null, err = null;
    try { uit = fn ? await fn(o) : null; } catch (e) { err = e; }
    if (err || !uit || uit.error || uit.ok === false) {
      o.afwikkelFout = String((err && err.message) || (uit && uit.error) || 'afwikkelhaak ontbreekt').slice(0, 300);
      save(); klacht('externe betaling is afgewikkeld maar interne finalisatie niet', { id: o.id, fout: o.afwikkelFout });
      return false;
    }
    o.afwikkelingVerwerktAt = nu(); o.afwikkelFout = null; save();
    return true;
  }

  const ctx = { rij, save, nu, klacht, publiek, zet, wacht, maxPogingen,
    STATUS, AF, OPEN, DEFINITIEF, ramMax: RAM_MAX, railInzenden, terugboeken, verwerkAfwikkeling };
  const derij = require('./rij')(ctx);
  ctx.plaats = derij.plaats;
  ctx.vind = derij.vind;
  const inzending = require('./inzending')(ctx);
  ctx.dienIn = inzending.dienIn;
  ctx.draaiTerug = inzending.draaiTerug;   // bevestig() met een mislukking gebruikt dezelfde teruggang

  return { STATUS, maak, publiek, registreerTeruggang, registreerAfwikkeling,
    dienIn: inzending.dienIn, ...derij };
};
module.exports.STATUS = STATUS;
