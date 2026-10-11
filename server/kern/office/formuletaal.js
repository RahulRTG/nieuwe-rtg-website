/* RTG Office: formules vertalen tussen het rekenblad en Excel (XLSX).

   Het rekenblad typt Nederlands met een puntkomma (=SOM(A1;A3)), een XLSX
   bewaart Engels met een komma (SUM(A1,A3)). De motor (shared/rekenmotor.js)
   kent al beide namen; wat hier staat is welke functies HETZELFDE betekenen in
   beide programma's, met de hand en met opzet kort.

   EEN FORMULE DIE NIET ZEKER HETZELFDE REKENT, GAAT NIET ALS FORMULE MEE. Dan
   gaat de uitgerekende WAARDE mee en staat de cel in de trouwlijst. Drie
   groepen staan er daarom bewust niet in:
   - datums: dit blad rekent met ISO-datums (2026-07-26), Excel met
     volgnummers. =JAAR(A1) op een tekstdatum en YEAR(A1) op een getal zijn
     twee verschillende sommen;
   - TEKST/TEXT: de opmaakcodes verschillen per taal van Excel zelf;
   - wat alleen hier bestaat (BTW) of hier anders telt (STDEVA telt in Excel
     tekst als nul, hier niet).
   Liever een eerlijke waarde dan een formule die er hetzelfde uitziet en iets
   anders uitrekent. */
'use strict';

const LEZER = require('../../../public/shared/rekenlezer.js');

// Nederlands -> Excel. Alleen paren die aantoonbaar hetzelfde rekenen.
const NL_EN = {
  SOM: 'SUM', WORTEL: 'SQRT', MACHT: 'POWER', INTEGER: 'INT', REST: 'MOD',
  AFRONDEN: 'ROUND', 'AFRONDEN.NAAR.BOVEN': 'ROUNDUP', 'AFRONDEN.NAAR.BENEDEN': 'ROUNDDOWN',
  GEMIDDELDE: 'AVERAGE', GEM: 'AVERAGE', AANTAL: 'COUNT', AANTALARG: 'COUNTA', MEDIAAN: 'MEDIAN',
  GROOTSTE: 'LARGE', KLEINSTE: 'SMALL', 'SOM.ALS': 'SUMIF', 'AANTAL.ALS': 'COUNTIF',
  'GEMIDDELDE.ALS': 'AVERAGEIF', 'GEM.ALS': 'AVERAGEIF', SOMPRODUCT: 'SUMPRODUCT',
  ALS: 'IF', EN: 'AND', OF: 'OR', NIET: 'NOT', 'ALS.FOUT': 'IFERROR', ISFOUT: 'ISERROR',
  ISLEEG: 'ISBLANK', ISGETAL: 'ISNUMBER', ISTEKST: 'ISTEXT', BET: 'PMT', TW: 'FV', HW: 'PV',
  'TEKST.SAMENVOEGEN': 'CONCATENATE', LINKS: 'LEFT', RECHTS: 'RIGHT', DEEL: 'MID', LENGTE: 'LEN',
  HOOFDLETTERS: 'UPPER', 'KLEINE.LETTERS': 'LOWER', BEGINLETTERS: 'PROPER', 'SPATIES.WISSEN': 'TRIM',
  VERVANGEN: 'SUBSTITUTE', 'VIND.SPEC': 'FIND', 'VIND.ALLES': 'SEARCH', WAARDE: 'VALUE',
  'VERT.ZOEKEN': 'VLOOKUP', 'HORIZ.ZOEKEN': 'HLOOKUP', VERGELIJKEN: 'MATCH'
};
// functies die in beide programma's dezelfde naam hebben
const ZELFDE = ['PRODUCT', 'ABS', 'EXP', 'LN', 'LOG', 'PI', 'MIN', 'MAX', 'STDEV', 'INDEX'];
const EXCEL = new Set([...Object.values(NL_EN), ...ZELFDE, 'STDEV.S']);

const zeg = (fout) => ({ fout });

/* Van het rekenblad naar Excel. `f` begint met '='. Geeft { formule } zonder
   '=' (zo staat hij in <f>), of { fout } met de reden in woorden. */
function naarExcel(f) {
  const t = LEZER.knip(String(f || '').replace(/^=/, ''));
  if (!t || !LEZER.ontleed(t)) return zeg('de formule is ongeldig');
  let uit = '';
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (x.s === 'getal') uit += String(x.v);
    else if (x.s === 'tekst') uit += '"' + x.v.replace(/"/g, '""') + '"';
    else if (x.s === 'bool') uit += x.v ? 'TRUE' : 'FALSE';
    else if (x.s === 'blad') return zeg('verwijst naar een ander blad');
    else if (x.s === 'ref') uit += (x.vastK ? '$' : '') + kolNaam(x.kol) + (x.vastR ? '$' : '') + (x.rij + 1);
    else if (x.s === 'naam') {
      const en = NL_EN[x.v] || (EXCEL.has(x.v) ? x.v : null);
      if (!en) return zeg('functie ' + x.v + ' rekent in Excel niet zeker hetzelfde');
      uit += en;
    } else if (x.s === ';') uit += ',';
    else uit += x.s;
  }
  return { formule: uit };
}

/* Van Excel naar het rekenblad. `f` is de inhoud van <f>, zonder '='. */
function vanExcel(f) {
  const bron = String(f || '').replace(/_xlfn\./g, '');
  // komma's buiten tekst worden puntkomma's; binnen "..." blijft alles staan
  let omgezet = '', inTekst = false;
  for (const c of bron) {
    if (c === '"') inTekst = !inTekst;
    omgezet += (!inTekst && c === ',') ? ';' : c;
  }
  const t = LEZER.knip(omgezet);
  if (!t || !LEZER.ontleed(t)) return zeg('de formule kon niet worden gelezen');
  for (let i = 0; i < t.length; i++) {
    if (t[i].s === 'blad') return zeg('verwijst naar een ander werkblad');
    if (t[i].s === 'naam' && !EXCEL.has(t[i].v)) return zeg('functie ' + t[i].v + ' rekent hier niet zeker hetzelfde');
  }
  return { formule: '=' + omgezet };
}

function kolNaam(i) {
  let s = '', n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

module.exports = { naarExcel, vanExcel, NL_EN, EXCEL, kolNaam };
