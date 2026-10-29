/* Gedeeld append-/retentiecontract van het activiteitenlog. De gesloten
   classificatie en legacyherkenning zijn dezelfde voor schrijvers, opslagmerge
   en zichtprojectie. Actorautorisatie en uitlevering blijven in het domein.
   Verplaatst zonder beleidswijziging uit leverancier/beschermdesoorten en
   logboekzicht; geen tweede lijst of opslagafhankelijkheid naar het domein. */
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

const LOGBOEK_PER_KLASSE = 80;
function bewaarLogboek(lijst) {
  /* De beschermde regels per EIGENAAR (staffId): ook iemands eigen beschermde
     regel, die hij wel ziet, mag niet verdwijnen doordat een collega veel klokt. */
  const tel = new Map();
  return (Array.isArray(lijst) ? lijst : []).filter((r) => {
    const bak = isKlokregel(r) ? 'b:' + (r && r.staffId != null ? r.staffId : '-') : 'g';
    const n = (tel.get(bak) || 0) + 1;
    tel.set(bak, n);
    return n <= LOGBOEK_PER_KLASSE;
  });
}

const isKlokSoort = (soort) => Object.prototype.hasOwnProperty.call(KLOKSOORTEN, soort);

function isKlokregel(regel) {
  // een regel waarvan de vorm onbekend is, kan niets bewijzen: niet uitleveren
  if (!regel || typeof regel !== 'object') return true;
  if (regel.soort != null && isKlokSoort(regel.soort)) return true;
  const tekst = String(regel.text || '');
  return OUDE_KLOKTEKST.some((re) => re.test(tekst));
}

module.exports = { KLOKSOORTEN, OUDE_KLOKTEKST, LOGBOEK_PER_KLASSE, bewaarLogboek, isKlokSoort, isKlokregel };
