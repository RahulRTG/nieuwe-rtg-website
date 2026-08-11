/* DE KASVOORUITBLIK: waar kom ik uit over dertig dagen.

   Drie beelden die er al zijn, bij elkaar gelegd: wat er binnenkomt
   (./debiteuren.js), wat eruit moet (./crediteuren.js) en wat er niet van u is
   (./belasting.js). Die krijgt hij MEE en rekent hij niet opnieuw uit -- twee
   keer dezelfde vraag stellen kan twee antwoorden geven.

   HET GROOTSTE PROBLEEM IS WAT WIJ NIET WETEN: HET BANKSALDO. RTG ziet
   facturen, geen bankrekening. Een kaspositie of een runway zonder beginsaldo
   is dus geen kaspositie maar een som van bewegingen, en die twee door elkaar
   halen is precies hoe iemand denkt dat het goed komt terwijl de rekening leeg
   is. Daarom staat hier standaard de BEWEGING, en pas een stand zodra de
   ondernemer zelf een saldo opgeeft -- met de datum erbij, want een saldo van
   drie maanden geleden is geen saldo.

   DE ONZEKERHEID LIGT NIET SYMMETRISCH, EN DAT IS EXPRES. Geld dat u nog moet
   krijgen en al te laat is, tellen wij NIET mee als inkomend: te laat is
   precies de reden om er niet op te rekenen. Geld dat u moet betalen en al te
   laat is, telt wel gewoon mee: dat moet u sowieso voldoen. Beide keuzes
   maken het beeld somberder, en dat is de kant waarop een kasprognose hoort
   te leunen. Wie zich rijk rekent op een debiteur van vier maanden oud, komt
   twee keer bedrogen uit.

   EN ER ZIT GEEN VOORSPELLING IN. Wat er de komende maand nog aan nieuwe
   omzet bij komt, weten wij niet en verzinnen wij niet. Dit is een optelsom
   van wat er nu ligt, met de vervaldata die er nu op staan. */
'use strict';

const DAG = 86400000;
/* Een opgegeven saldo dat ouder is dan dit, noemen we verouderd. Een maand:
   lang genoeg om niet te zeuren, kort genoeg om nog iets te betekenen. */
const SALDO_VERVALT_NA = 31;

const rond = (n) => Math.round(n * 100) / 100;

/* Posten die binnen `dagen` vervallen. `metVervallen` bepaalt of posten die
   al over hun datum zijn meetellen -- zie de kop: voor inkomend niet, voor
   uitgaand wel. */
function binnen(posten, dagen, metVervallen) {
  return (posten || []).filter(p => {
    if (p.dagenOver === null || p.dagenOver === undefined) return false;
    if (p.dagenOver > 0) return !!metVervallen;
    return -p.dagenOver <= dagen;
  });
}
const som = (rij) => rond(rij.reduce((n, p) => n + (Number(p.totaal) || 0), 0));

module.exports = ({ save }) => {

  /* Het saldo dat de ondernemer zelf opgaf. Met datum, zodat het kan
     verouderen in plaats van stilletjes te blijven gelden. */
  function kasSaldoZet(o, bedrag, nuMs) {
    const n = Number(bedrag);
    if (!Number.isFinite(n)) return { status: 400, error: 'Vul uw banksaldo in.' };
    o.kasSaldo = { bedrag: rond(n), at: new Date(Number.isFinite(nuMs) ? nuMs : Date.now()).toISOString() };
    save();
    return { ok: true, saldo: o.kasSaldo };
  }

  function kas(o, deb, cred, bel, nuMs, dagen) {
    /* Zonder de drie bronnen valt er niets op te tellen. Dat is niet hetzelfde
       als "nul": zonder zaak bestaan debiteuren en crediteuren niet eens. */
    if (!deb || !cred) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();
    const venster = Number.isFinite(dagen) && dagen > 0 && dagen <= 365 ? Math.round(dagen) : 30;

    /* `alle` en niet `posten`: dat tweede is de schermlijst van vijftig. Zie de
       kop van ./debiteuren.js -- hier telde de vooruitblik over een afgekapte
       lijst, en de posten die er nog netjes bij liepen vielen er als eerste af. */
    const inkomend = binnen(deb.alle || deb.posten, venster, false);
    const uitgaand = binnen(cred.alle || cred.posten, venster, true);
    /* Wat te laat is en dus onzeker. Apart getoond en niet meegeteld: het is
       geen nul (het bestaat) en geen inkomen (het had er al moeten zijn). */
    const teLaat = (deb.alle || deb.posten || []).filter(p => p.dagenOver > 0);

    const binnenkomt = som(inkomend);
    const eruit = som(uitgaand);
    const btw = bel && bel.btw ? Math.max(0, Number(bel.btw.afTeDragen) || 0) : 0;
    const beweging = rond(binnenkomt - eruit - btw);

    /* De stand, alleen als de ondernemer een saldo gaf. */
    let stand = null;
    if (o.kasSaldo && Number.isFinite(o.kasSaldo.bedrag)) {
      const oud = Math.floor((nuT - Date.parse(o.kasSaldo.at)) / DAG);
      stand = {
        start: o.kasSaldo.bedrag, opgegeven: o.kasSaldo.at.slice(0, 10), dagenOud: oud,
        eind: rond(o.kasSaldo.bedrag + beweging),
        verouderd: oud > SALDO_VERVALT_NA,
        let: oud > SALDO_VERVALT_NA
          ? 'Dit saldo is ' + oud + ' dagen oud. Er is sindsdien van alles gebeurd dat wij niet zien; werk het bij voordat u erop stuurt.'
          : null
      };
    }

    return {
      venster,
      inkomend: { bedrag: binnenkomt, aantal: inkomend.length,
        uitleg: 'Facturen die u verstuurde en die binnen ' + venster + ' dagen vervallen.' },
      uitgaand: { bedrag: eruit, aantal: uitgaand.length,
        uitleg: 'Facturen die u moet betalen en die binnen ' + venster + ' dagen vervallen, plus wat al te laat is.' },
      btwOpzij: { bedrag: btw, uitleg: 'Btw die u in rekening bracht en nog moet afdragen. Dit is geen kostenpost maar geld dat nooit van u was.' },
      beweging,
      /* Het getal dat het vaakst mist: wat er wel is maar waar u niet op moet
         rekenen. */
      onzeker: { bedrag: som(teLaat), aantal: teLaat.length,
        uitleg: teLaat.length
          ? 'Deze facturen zijn al over hun vervaldatum en tellen hier NIET mee als inkomend. Komen ze binnen, dan valt het mee.'
          : 'Er staat niets te laat open.' },
      stand,
      voorbehoud: 'Een optelsom van wat er nu ligt, met de vervaldata die er nu op staan. Nieuwe omzet, contante betalingen, loon, huur en abonnementen buiten RTG zitten er niet in. ' +
        (stand ? 'De stand rust op het saldo dat u zelf opgaf.' : 'Wij zien uw bankrekening niet, dus dit is een beweging en geen kaspositie.')
    };
  }

  return { KAS_SALDO_VERVALT_NA: SALDO_VERVALT_NA, kas, kasSaldoZet };
};

/* De opvolgregel: alleen als de beweging negatief is. Een positieve maand is
   geen actie, en een waarschuwing die elke maand komt is geen waarschuwing. */
function kasOpvolging(k) {
  if (!k || k.beweging >= 0) return null;
  const tekort = Math.round(-k.beweging);
  return {
    id: 'kas', soort: 'kas', bedrag: tekort,
    kop: 'Komende ' + k.venster + ' dagen gaat er ' + tekort + ' euro meer uit dan erin komt',
    waarom: k.stand && !k.stand.verouderd
      ? 'Op uw opgegeven saldo komt u dan uit op ' + Math.round(k.stand.eind) + ' euro.'
      : 'Wij zien uw bankrekening niet, dus of dat een probleem is weet u alleen zelf. Geef uw saldo op, dan rekenen wij het door.'
  };
}

module.exports.kasOpvolging = kasOpvolging;
module.exports.SALDO_VERVALT_NA = SALDO_VERVALT_NA;
