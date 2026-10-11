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
     tekst als nul, hier niet);
   - zoeken: VERT.ZOEKEN, HORIZ.ZOEKEN en VERGELIJKEN zoeken hier altijd
     exact, Excel standaard bij benadering (shared/rekenfuncties3.js zegt dat
     zelf);
   - tekst uit getallen: `&`, TEKST.SAMENVOEGEN, LINKS, LENGTE en hun familie
     maken van 1,5 hier "1,5" en in Excel "1,5" of "1.5" naar gelang de taal
     van Excel -- dat is per definitie niet zeker hetzelfde;
   - SOM.ALS en verwanten met een * of ? in het criterium: Excel leest dat als
     joker, deze motor niet.
   De tegenlezing van 11 oktober 2026 vond de laatste drie; ze stonden eerst
   in de tabel.
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
  ISLEEG: 'ISBLANK', ISGETAL: 'ISNUMBER', ISTEKST: 'ISTEXT', BET: 'PMT', TW: 'FV', HW: 'PV'
};
// criteriumfuncties: alleen zonder joker in een tekstargument
const CRITERIUM = new Set(['SUMIF', 'COUNTIF', 'AVERAGEIF']);
// functies die in beide programma's dezelfde naam hebben
const ZELFDE = ['PRODUCT', 'ABS', 'EXP', 'LN', 'LOG', 'PI', 'MIN', 'MAX', 'STDEV', 'INDEX'];
const EXCEL = new Set([...Object.values(NL_EN), ...ZELFDE, 'STDEV.S']);
// functies die Excel alleen met een voorvoegsel in het bestand herkent
const XLFN = { 'STDEV.S': '_xlfn.STDEV.S' };

/* Wat in BEIDE richtingen een formule tot "niet zeker hetzelfde" maakt, los
   van de functienamen: tekst plakken en een joker in een criterium. */
function nietZeker(t, naamVan) {
  if (t.some(x => x.s === '&')) return 'tekst plakken (&) hangt in Excel af van de taalinstelling';
  /* Het criterium (het tweede argument) moet een LETTERLIJKE waarde zonder joker
     zijn. Uit een cel kan het later alsnog een * dragen, en dat zie je hier niet. */
  for (let i = 0; i < t.length; i++) {
    if (t[i].s !== 'naam' || !CRITERIUM.has(naamVan(t[i].v))) continue;
    let diepte = 0, arg = 0;
    for (let j = i + 1; j < t.length; j++) {
      const x = t[j];
      if (x.s === '(') { diepte++; continue; }
      if (x.s === ')') { if (--diepte === 0) break; continue; }
      if (diepte === 1 && x.s === ';') { arg++; continue; }
      if (diepte === 1 && arg === 1) {
        if (x.s !== 'tekst' && x.s !== 'getal') return 'het criterium komt niet letterlijk uit de formule, en Excel leest * en ? als joker';
        if (x.s === 'tekst' && /[*?~]/.test(x.v)) return 'een * of ? in het criterium is in Excel een joker';
      }
    }
  }
  return null;
}

const zeg = (fout) => ({ fout });

/* Van het rekenblad naar Excel. `f` begint met '='. Geeft { formule } zonder
   '=' (zo staat hij in <f>), of { fout } met de reden in woorden. */
function naarExcel(f) {
  const t = LEZER.knip(String(f || '').replace(/^=/, ''));
  if (!t || !LEZER.ontleed(t)) return zeg('de formule is ongeldig');
  const bezwaar = nietZeker(t, n => NL_EN[n] || n);
  if (bezwaar) return zeg(bezwaar);
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
      uit += XLFN[en] || en;
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
  const bezwaar = nietZeker(t, n => n);
  if (bezwaar) return zeg(bezwaar);
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
