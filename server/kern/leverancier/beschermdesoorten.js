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

const { KLOKSOORTEN, OUDE_KLOKTEKST } = require('../../lib/logboekretentie');

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
