/* DE GESLOTEN LIJST BESCHERMDE LOGBOEKSOORTEN, en de vaste teksten waaraan een
   regel van voor het soortveld wordt herkend. Uit ./logboekzicht.js gelicht toen
   de eigenaar er op 11 oktober 2026 drie klassen bij besloot; de regels over wie
   wat ontvangt blijven daar.

   Een beschermde regel wordt volledig geschreven, maar alleen een manager en de
   medewerker zelf (op staffId) krijgen hem terug. Elke soort noemt wie hem
   schrijft. noteerActiviteit() (opzet/leverancierpoort.js) weigert een soort die
   hier niet staat. De naam KLOKSOORTEN is gebleven omdat de klok de eerste klasse
   was; afwezigheid en werving zijn er met hetzelfde gezag bij gekomen. */
'use strict';

const KLOKSOORTEN = Object.freeze({
  'klok-in': 'een medewerker klokte in (routes/staff/dienst-klok.js; kern/beveiliging/pda/patrouille.js, op een post; ' +
    'kern/mobiliteit/cdt.js, op een chauffeurskaart; routes/supplier/orders/keukenlijn.js, op een kant)',
  'klok-uit': 'een medewerker klokte uit (routes/staff/dienst-klok.js; kern/mobiliteit/cdt.js, van een chauffeurskaart; ' +
    'routes/supplier/orders/keukenlijn.js, van een kant)',
  'klok-correctie': 'een manager boekte uren bij voor een collega (routes/staff/collega.js)',
  'klok-inlog': 'een medewerker kwam binnen in een werksessie (routes/supplier/toegang.js; kern/eenaccount/startspoor.js; ' +
    'routes/supplier/pda/posities-inlog.js; kern/werkbijlogin.js; routes/supplier/pda/posities.js, wisselen)',
  // besluit B1: gezondheid en afwezigheid; een collega ziet alleen "afwezig"
  'afwezig': 'een medewerker meldde zich ziek of vroeg verlof aan, of een manager besliste erover ' +
    '(routes/staff/dienst.js; routes/supplier/tafels-team.js)',
  // sollicitatiegegevens horen bij wie bevoegd betrokken is bij de werving: de manager
  'werving': 'een stap in de werving (routes/supplier/werving/sollicitaties.js)'
});

// de vaste teksten van de schrijvers van voor het soortveld
const OUDE_KLOKTEKST = Object.freeze([/^klokte (?:in|uit)(?: op |$)/, /^boekte een klokcorrectie voor /,
  / logde in(?: met het RTG-account| \(RTG-account\))?$/, / kwam binnen met het RTG-account$/,
  / wisselde (?:van afdeling \(vanuit |naar deze werkplek$)/, /^meldde zich (?:aan|af) op kaart /,
  /^meldde zich (?:aan op|af van) de kant /, /^meldde zich ziek$/, /^vroeg verlof aan \(/,
  /^(?:keurde verlof goed|wees verlof af) van /, /^nodigde .+ uit voor een gesprek$/, /^nam .+ aan als /,
  /^wees de sollicitatie van .+ af$/, /^(?:toonde wederzijdse interesse in|sloot een talentmatch voor) /]);

/* BEPERKTE MELDINGEN (de bel van de zaak, opzet/leveranciersmeldingen.js). Een
   melding met `beperkt` uit deze lijst gaat alleen naar de managers en, met
   `alleenVoor.staffId`, naar die ene medewerker. De INGANG dwingt dat af: een
   beperkte melding zonder `alleenVoor` krijgt { staffId: null } (alleen de
   managers), zodat een volgende schrijver de beperking niet kan vergeten. Een
   melding van voor dit veld wordt herkend aan haar vaste titel. */
const MELDINGBEPERKING = Object.freeze({
  werving: 'sollicitaties en wat erbij hoort (routes/supplier/werving/; routes/member/werk.js; routes/member/werk/rtf.js; kern/werk.js)',
  afwezig: 'ziekmelding en verlofaanvraag (routes/staff/dienst.js)'
});
const BEPERKTE_TITELS = Object.freeze({
  'Ziekmelding': 'afwezig', 'Verlofaanvraag': 'afwezig',
  'Nieuwe sollicitatie': 'werving', 'Sollicitatie via RTG': 'werving'
});
// de beperking van een melding, of null; een onbekende `beperkt` is een fout van de schrijver
function meldingBeperking(n) {
  if (!n || typeof n !== 'object') return null;
  if (n.beperkt != null) {
    if (!Object.prototype.hasOwnProperty.call(MELDINGBEPERKING, n.beperkt)) throw new Error('Onbekende meldingbeperking: ' + n.beperkt);
    return n.beperkt;
  }
  return Object.prototype.hasOwnProperty.call(BEPERKTE_TITELS, n.title) ? BEPERKTE_TITELS[n.title] : null;
}

/* BEPERKTE POST in een gedeeld zaakpostvak (kern/rtmail.js). Een systeembericht
   van een soort hieronder krijgt de beperking VERPLICHT mee bij de bezorging,
   en een postvak levert hem alleen aan wie er expliciet om vraagt (de
   supplierroute: alleen een manager). Een bericht van voor het veld wordt
   herkend aan soort + afzender. */
const BEPERKTE_POSTSOORTEN = Object.freeze({ personeel: 'werving' });
const postBeperking = (m, systeem) => (m && (m.beperkt ||
  (m.van === systeem && Object.prototype.hasOwnProperty.call(BEPERKTE_POSTSOORTEN, m.soort) ? BEPERKTE_POSTSOORTEN[m.soort] : null))) || null;

module.exports = { KLOKSOORTEN, OUDE_KLOKTEKST, MELDINGBEPERKING, BEPERKTE_TITELS, meldingBeperking, BEPERKTE_POSTSOORTEN, postBeperking };
