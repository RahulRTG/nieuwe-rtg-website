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

module.exports = { KLOKSOORTEN, OUDE_KLOKTEKST };
