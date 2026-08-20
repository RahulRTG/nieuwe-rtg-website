/* WAT RTG PUBLIEK BEWEERT -- uit de kern, niet uit een document.

   HET PROBLEEM DAT DIT OPHEFT. Artikel 1 van de partnervoorwaarden beloofde
   "0% commissie" terwijl de boardroom een commissieknop had die op 12 procent
   stond. Dat kon bestaan omdat HTML, code en documenten onafhankelijk over
   hetzelfde getal praatten: drie bronnen, drie antwoorden, en niets dat ze naast
   elkaar legde.

   De reparatie is niet "beter opletten". Een commerciele CLAIM krijgt hier een
   naam en een waarde, en die waarde wordt AFGELEID uit de laag die hem
   waarmaakt. Website en voorwaarden halen hem hier op; ze schrijven hem niet op.

       claim.partner.commission  = ZERO        <- kern/commercie/vergoeding.js
       claim.business_lite.price = FROM_150    <- kern/pasladder.js
       claim.social.share        = 30%         <- kern/commercie/allocatie.js
       ...

   EN DAARNAAST DE KETEN (par. 10 van COMMERCIE.md):

       publieke claim -> commerciele regel -> contractgedrag -> ledgergedrag -> bewijs

   `keten()` loopt die af en zegt per claim hoe ver hij te volgen is. Een claim
   die nergens op uitkomt, is een bewering zonder dekking -- en dat is precies
   wat "0% commissie naast een commissieknop" was.

   WAT DIT NIET IS: een tekstgenerator. De claims zijn WAARDEN met een bron, geen
   volzinnen. De juridische formulering blijft mensenwerk; wat hier vandaan komt,
   zijn de getallen en de status die daarin gaten moeten vullen. Een document dat
   zijn eigen bedragen opschrijft, is precies het gat dat we dichten. */
'use strict';

const ladder = require('../pasladder');
const vergoeding = require('./vergoeding');
const allocatie = require('./allocatie');
const tegoed = require('./tegoed');
const caps = require('./capaciteiten');

/* De dekking van een claim: hoe hard is hij?

     AFGEDWONGEN  er is code die hem waarmaakt EN een toets die zakt als hij
                  wordt weggehaald
     GEBOUWD      er is code, maar de bewering leunt op iets buiten dit huis
     BELOFTE      er is een besluit en geen code -- zichtbaar als gat
*/
const DEKKING = { AFGEDWONGEN: 'AFGEDWONGEN', GEBOUWD: 'GEBOUWD', BELOFTE: 'BELOFTE' };

function bedrag(centen) {
  return '€ ' + (centen / 100).toLocaleString('nl-NL',
    { minimumFractionDigits: centen % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

/* Alle claims, met per stuk: de waarde, waar hij vandaan komt, hoe hard hij is,
   en welke toets hem bewaakt. Die laatste is geen documentatie maar het punt:
   een claim zonder toets is een belofte, hoe stellig hij ook staat. */
function claims() {
  const uit = [];

  // --- prijzen, uit de ladder ---
  for (const t of ladder.treden()) {
    if (!t.beschikbaar) continue;
    const contract = t.contractueel;
    uit.push({
      id: 'claim.' + t.id.replace(/-/g, '_') + '.price',
      onderwerp: t.naam,
      waarde: t.bodemCenten === 0 ? 'GRATIS' : (contract ? 'VANAF_' + t.bodemCenten : 'VAST_' + t.standaardCenten),
      tekst: t.bodemCenten === 0 ? t.naam + ' is en blijft kosteloos'
        : t.naam + (contract ? ' kost vanaf ' + bedrag(t.bodemCenten) + ' per maand (ex btw); de hoogte staat op het contract'
          : ' kost ' + bedrag(t.standaardCenten) + ' per maand (ex btw)'),
      bron: 'kern/pasladder.js',
      dekking: DEKKING.AFGEDWONGEN,
      toets: 'test/pasladder.test.js'
    });
  }

  // --- de partnervergoeding ---
  uit.push({
    id: 'claim.partner.commission',
    onderwerp: 'Partnervergoeding over omzet',
    waarde: vergoeding.PARTNER_COMMISSIE === 0 ? 'ZERO' : String(vergoeding.PARTNER_COMMISSIE),
    tekst: 'RTG rekent geen commissie over de omzet van een partner',
    bron: 'kern/commercie/vergoeding.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/commercie.test.js'
  });

  // --- de sociale afdracht ---
  const regel = allocatie.REGELS[allocatie.HUIDIGE_VERSIE];
  uit.push({
    id: 'claim.social.share',
    onderwerp: 'Sociale afdracht',
    waarde: Math.round(regel.totaalDeel * 100) + '%',
    tekst: Math.round(regel.totaalDeel * 100) + '% van elke bijdrage (ex btw), verdeeld als ' +
      regel.delen.map(d => Math.round(d.deel * 100) + '% ' + d.label.toLowerCase()).join(' en '),
    bron: 'kern/commercie/allocatie.js (' + regel.versie + ')',
    /* GEBOUWD en niet AFGEDWONGEN: de verdeling en het spoor staan vast, maar of
       het geld ECHT bij de stichting aankomt hangt aan een IBAN en een rail
       buiten dit huis. Zolang RTF_IBAN leeg is, staat de afdracht op
       'te_storten' -- en een claim die op een lege omgevingsvariabele wacht,
       hoort niet als afgedwongen te boek te staan. */
    dekking: DEKKING.GEBOUWD,
    toets: 'test/allocatie.test.js',
    kanttekening: 'De verdeling en het spoor zijn afgedwongen; de uitbetaling wacht op RTF_IBAN.'
  });

  // --- de partnerpoort ---
  uit.push({
    id: 'claim.partner.access',
    onderwerp: 'Wie partner kan worden',
    waarde: caps.tredenMet('can_be_partner').join('|'),
    tekst: 'een partnerplek vraagt ' + caps.tredenMet('can_be_partner')
      .map(t => (ladder.trede(t) || {}).naam || t).join(' of '),
    bron: 'kern/commercie/capaciteiten.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/commercie.test.js'
  });

  // --- AI: geen ongemerkte kosten ---
  uit.push({
    id: 'claim.ai.no_surprise',
    onderwerp: 'Variabele AI-kosten',
    waarde: 'NOOIT_ONGEMERKT',
    tekst: 'boven het inbegrepen tegoed gebeurt er niets zonder een keuze vooraf: stoppen, ' +
      'eerst vragen, of automatisch aanvullen met een maandmaximum',
    bron: 'kern/commercie/tegoed.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/tegoed.test.js'
  });
  uit.push({
    id: 'claim.ai.included',
    onderwerp: 'Inbegrepen AI-tegoed',
    waarde: Object.entries(tegoed.INBEGREPEN)
      .filter(([p]) => (ladder.trede(p) || {}).beschikbaar)
      .map(([p, v]) => p + '=' + (v === null ? 'CONTRACT' : v)).join(','),
    tekst: 'elke trede heeft een eigen inbegrepen AI-tegoed per maand',
    bron: 'kern/commercie/tegoed.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/tegoed.test.js'
  });

  // --- de betaaldienst ---
  uit.push({
    id: 'claim.payment.fee_basis',
    onderwerp: 'Grondslag betaaldienst',
    waarde: 'PER_TRANSACTIE',
    tekst: 'de betaaldienst rekent per transactie en nooit over de omzet van de partner',
    bron: 'kern/commercie/vergoeding.js (payment_service)',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/commercie.test.js'
  });

  // --- de prijs-lock ---
  uit.push({
    id: 'claim.contract.price_lock',
    onderwerp: 'Prijs tijdens de looptijd',
    waarde: 'VAST_TOT_EINDE_VERBINTENIS',
    tekst: 'een prijswijziging raakt een lopend contract niet; de afgesproken prijs staat vast ' +
      'tot het einde van de minimumtermijn',
    bron: 'kern/commercie/contract.js',
    dekking: DEKKING.AFGEDWONGEN,
    toets: 'test/contract.test.js'
  });

  // --- wat nog een belofte is ---
  uit.push({
    id: 'claim.partner.entry_fee',
    onderwerp: 'Partner-entree',
    waarde: 'TE_HERZIEN',
    tekst: 'de entree van 10.000 euro uit de partnervoorwaarden staat naast een Business Lite van ' +
      bedrag(ladder.bodemCentenVan('business-lite')) + ' per maand en moet worden ingetrokken of herzien',
    bron: 'alleen partnervoorwaarden.html',
    dekking: DEKKING.BELOFTE,
    toets: null,
    kanttekening: 'Twee toegangsprijzen naast elkaar is onuitlegbaar; zie PRIJZEN.md 4.6.'
  });
  uit.push({
    id: 'claim.member.price_guarantee',
    onderwerp: 'Ledenprijsgarantie',
    waarde: 'PLAFOND_AFGEDWONGEN_RECHTZETTING_NIET',
    tekst: 'een lid betaalt nooit meer dan de publieke prijs van de partner',
    bron: 'kern/util.js + routes/supplier/menukaart.js',
    dekking: DEKKING.GEBOUWD,
    toets: 'test/partner.test.js',
    kanttekening: 'Het plafond wordt server-side afgekapt; de belofte "het verschil wordt rechtgezet" ' +
      'heeft geen meldknop en geen terugbetaalstroom (PRIJZEN.md 4.11).'
  });

  return uit;
}

/* DE RELEASE-GATE. Geen financiele claim zonder bewijs.

   Faalt als een claim zich AFGEDWONGEN noemt zonder toets, of als een claim geen
   bron heeft. Een BELOFTE mag bestaan -- die is per definitie nog niet gedekt --
   maar hij moet wel als belofte te boek staan en een kanttekening dragen die
   zegt wat eraan ontbreekt.

   Dit is met opzet streng op EEN ding: liegen over de hardheid. Een gat dat
   eerlijk "BELOFTE" heet, is geen probleem; een gat dat zich "AFGEDWONGEN"
   noemt, is er twee. */
function poort() {
  const problemen = [];
  for (const c of claims()) {
    if (!c.bron) problemen.push(c.id + ' heeft geen bron: waar komt deze waarde vandaan?');
    if (!c.waarde) problemen.push(c.id + ' heeft geen waarde');
    if (c.dekking === DEKKING.AFGEDWONGEN && !c.toets)
      problemen.push(c.id + ' noemt zich AFGEDWONGEN maar wijst geen toets aan; dan is het een belofte');
    if (c.dekking === DEKKING.BELOFTE && !c.kanttekening)
      problemen.push(c.id + ' is een belofte zonder kanttekening: er hoort te staan wat eraan ontbreekt');
    if (!DEKKING[c.dekking]) problemen.push(c.id + ' heeft een onbekende dekking: ' + c.dekking);
  }
  return { ok: problemen.length === 0, problemen, aantal: claims().length };
}

function publiek() {
  return claims().map(c => ({ id: c.id, onderwerp: c.onderwerp, waarde: c.waarde, tekst: c.tekst,
    dekking: c.dekking, bron: c.bron, kanttekening: c.kanttekening || null }));
}

module.exports = { claims, publiek, poort, DEKKING };
