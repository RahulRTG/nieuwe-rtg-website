/* RTG Office: een rekenblad als XLSX (OFFICE.md punt 23, par. 9 fase 2).

   Het bladmodel bestond al (`cellen`, `opmaak`, `rijen`, `kolommen`), dus dit
   is vertalen en geen nieuw model. Drie dingen gaan mee en worden niet geraden:

   - DE WAARDE. Elke formulecel krijgt de uitkomst van DEZELFDE motor die het
     scherm gebruikt (shared/rekenmotor.js) als bewaarde waarde, zodat het
     bestand ook klopt in een programma dat niet herrekent.
   - DE FORMULE, alleen als hij in Excel aantoonbaar hetzelfde rekent
     (./formuletaal.js). Anders gaat de waarde mee en staat de cel in de
     TROUWLIJST: wat er niet als formule meekwam, met de reden. Een export die
     stil een formule in een getal verandert, laat iemand denken dat zijn blad
     nog rekent.
   - DE CLASSIFICATIE, op twee plekken: als documenteigenschap (RTG-Classificatie,
     leesbaar voor een DLP-scanner) en in de koptekst van elke afgedrukte pagina
     (OFFICE.md par. 4, grens 4). */
'use strict';

const M = require('../../../public/shared/rekenmotor.js');
const { naarExcel, kolNaam } = require('./formuletaal');
const { pak } = require('./zip');
const { kantoorProps, xmlEsc } = require('./ooxml');

const FOUT_EXCEL = { '#DEEL/0!': '#DIV/0!', '#NAAM?': '#NAME?', '#WAARDE!': '#VALUE!', '#VERW!': '#REF!',
  '#GETAL!': '#NUM!', '#LUS!': '#REF!', '#LEEG!': '#NULL!' };
// celopmaak -> stijlindex in styles.xml hieronder
const STIJL = { kop: 1, geld: 2, procent: 3, getal: 4, datum: 5 };
const EPOCH = Date.UTC(1899, 11, 30);

function celXml(ref, s, inhoud) {
  return '<c r="' + ref + '"' + (s ? ' s="' + s + '"' : '') + inhoud + '</c>';
}
function waardeXml(v) {
  if (typeof v === 'number') return '><v>' + v + '</v>';
  if (typeof v === 'boolean') return ' t="b"><v>' + (v ? 1 : 0) + '</v>';
  if (M.isFout(v)) return ' t="e"><v>' + (FOUT_EXCEL[v] || '#VALUE!') + '</v>';
  return ' t="str"><v>' + xmlEsc(v == null ? '' : v) + '</v>';
}

function schrijfXlsx({ titel, inhoud, label }) {
  const cellen = (inhoud && inhoud.cellen) || {}, opmaak = (inhoud && inhoud.opmaak) || {};
  const motor = M.maak({ ruw: (blad, k, r) => cellen[kolNaam(k) + (r + 1)] || '' });
  const trouw = [];
  const perRij = {};
  for (const [ref, ruw] of Object.entries(cellen)) {
    if (ruw === '' || ruw == null) continue;
    const m = /^([A-Z]{1,2})(\d+)$/.exec(ref);
    if (!m) continue;
    const rij = +m[2];
    const s = STIJL[opmaak[ref]] || 0;
    let xml;
    if (String(ruw).charAt(0) === '=') {
      const v = motor.waarde(String(ruw).slice(1));
      const f = naarExcel(ruw);
      if (f.formule) xml = celXml(ref, s, waardeXml(v).replace(/^([^>]*)>/, '$1><f>' + xmlEsc(f.formule) + '</f>'));
      else { xml = celXml(ref, s, waardeXml(v)); trouw.push({ cel: ref, wat: 'formule als waarde meegegeven', reden: f.fout }); }
    } else if (opmaak[ref] === 'datum' && /^\d{4}-\d{2}-\d{2}$/.test(ruw)) {
      const [j, mnd, d] = ruw.split('-').map(Number);
      xml = celXml(ref, s, '><v>' + Math.round((Date.UTC(j, mnd - 1, d) - EPOCH) / 864e5) + '</v>');
    } else if (M.isGetallig(ruw)) xml = celXml(ref, s, '><v>' + M.getalVan(ruw) + '</v>');
    else xml = celXml(ref, s, ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(ruw) + '</t></is>');
    (perRij[rij] = perRij[rij] || []).push({ kol: m[1], xml });
  }
  const volg = (a, b) => a.kol.length - b.kol.length || (a.kol < b.kol ? -1 : 1);
  const rijen = Object.keys(perRij).map(Number).sort((a, b) => a - b)
    .map(r => '<row r="' + r + '">' + perRij[r].sort(volg).map(x => x.xml).join('') + '</row>').join('');
  const kop = '&amp;C' + xmlEsc('Classificatie: ' + label);
  const blad = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' + rijen + '</sheetData>' +
    '<headerFooter><oddHeader>' + kop + '</oddHeader></headerFooter></worksheet>';
  const stijlen = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;€&quot;\\ #,##0.00"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>' +
    '<cellXfs count="6"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/>' +
    '<xf numFmtId="10" applyNumberFormat="1"/><xf numFmtId="4" applyNumberFormat="1"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const bestanden = Object.assign({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>' +
      '</Types>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' + NS_R + '">' +
      '<sheets><sheet name="Blad1" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="' + NS_R + '/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="' + NS_R + '/styles" Target="styles.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': blad,
    'xl/styles.xml': stijlen
  }, kantoorProps({ hoofd: 'xl/workbook.xml', titel, label }));
  return { buffer: pak(bestanden), trouw };
}

module.exports = { schrijfXlsx, FOUT_EXCEL, EPOCH };
