/* RTG Office: een XLSX inlezen als rekenblad (OFFICE.md punt 23: "XLSX lezen,
   het goedkoopst en het meest gevraagd").

   EEN BESTAND VAN BUITEN IS INVOER VAN EEN VREEMDE. De zip wordt gelezen met
   plafonds (./zip.js), de XML met een paar vaste patronen en nooit met een
   parser die entiteiten of externe verwijzingen volgt, en een formule gaat door
   dezelfde lezer als een getypte (shared/rekenlezer.js) -- wat niet in de
   grammatica past, wordt geen formule.

   WAT ER NIET MEEKOMT, STAAT IN DE TROUWLIJST. Het blad heeft een raster van
   500 rijen bij 60 kolommen, een werkblad per document en een korte lijst
   celopmaak; een XLSX kan veel meer. Alles wat daarbuiten valt wordt geteld en
   bij naam genoemd (met de eerste cellen erbij), in plaats van stil weg te
   vallen. Een import die "gelukt" zegt terwijl kolom BI ontbreekt, is erger
   dan een import die weigert. */
'use strict';

const { lees } = require('./zip');
// een werkblad is tekst; 4 MB uitgepakt per onderdeel is ruim voor 500 x 60 cellen
const GRENS_XLSX = { perBestand: 4 * 1024 * 1024, totaal: 12 * 1024 * 1024, aantal: 200 };
const { vanExcel, kolNaam } = require('./formuletaal');
const { EPOCH } = require('./xlsx-schrijf');

const MAX_RIJEN = 500, MAX_KOLOMMEN = 60, MAX_CELLEN = 4000;

const uitXml = t => String(t).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  if (e[0] === '#') { try { return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)); } catch (x) { return ''; } }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
});
const attr = (tag, naam) => { const m = new RegExp('\\s' + naam + '="([^"]*)"').exec(tag); return m ? uitXml(m[1]) : null; };
/* ELEMENTEN ZOEKEN IN EEN DOORLOOP. Hier stond een reguliere expressie met een
   luie staart (`<c ...>` tot de eerstvolgende `</c>`); een werkblad vol `<c>`
   zonder sluittag liet elke treffer tot het einde van het bestand doorlezen --
   kwadratisch, en met een paar kB ingepakt legde het de server minutenlang
   stil (gevonden door de tegenlezing). Deze scanner loopt met indexOf altijd
   vooruit, en een element zonder sluittag beeindigt de lezing in plaats van de
   rest opnieuw te doorzoeken. */
function blokken(xml, tag) {
  const uit = [], s = String(xml || ''), open = '<' + tag, dicht = '</' + tag + '>';
  let i = 0;
  for (;;) {
    let a = s.indexOf(open, i);
    while (a >= 0 && /[A-Za-z0-9:_-]/.test(s.charAt(a + open.length))) a = s.indexOf(open, a + 1);
    if (a < 0) break;
    const eindKop = s.indexOf('>', a);
    if (eindKop < 0) break;
    const kop = s.slice(a, eindKop + 1);
    if (kop.endsWith('/>')) { uit.push({ kop, binnen: '' }); i = eindKop + 1; continue; }
    const b = s.indexOf(dicht, eindKop + 1);
    if (b < 0) break;
    uit.push({ kop, binnen: s.slice(eindKop + 1, b) });
    i = b + dicht.length;
  }
  return uit;
}
// de tekst van een cel of gedeelde tekst; fonetische hulptekst (<rPh>) hoort er niet bij
const teksten = xml => {
  const s = String(xml || '');
  let schoon = '', i = 0;
  for (;;) {
    const a = s.indexOf('<rPh', i);
    if (a < 0) { schoon += s.slice(i); break; }
    schoon += s.slice(i, a);
    const b = s.indexOf('</rPh>', a);
    if (b < 0) break;
    i = b + 6;
  }
  return blokken(schoon, 't').map(x => uitXml(x.binnen)).join('');
};
const kolIndex = s => { let n = 0; for (const c of s) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

function opmaakSoorten(stijlXml) {
  if (!stijlXml) return [];
  const eigen = {};
  for (const m of stijlXml.matchAll(/<numFmt\b[^>]*>/g)) eigen[attr(m[0], 'numFmtId')] = attr(m[0], 'formatCode') || '';
  const fonts = blokken((blokken(stijlXml, 'fonts')[0] || {}).binnen, 'font')
    .map(f => /<b\/>|<b val="(1|true)"\/>/.test(f.binnen));
  const xfs = blokken((blokken(stijlXml, 'cellXfs')[0] || {}).binnen, 'xf').map(x => x.kop);
  return xfs.map(xf => {
    const id = +(attr(xf, 'numFmtId') || 0);
    const code = (eigen[id] || '').replace(/"[^"]*"|\[[^\]]*\]/g, m => /€|EUR/.test(m) ? '€' : '');
    if ((id >= 14 && id <= 17) || id === 22 || (/[dy]/i.test(code) && !/[h0#]/i.test(code))) return 'datum';
    if (id === 9 || id === 10 || /%/.test(code)) return 'procent';
    if (/€/.test(code) || [5, 6, 7, 8].includes(id)) return 'geld';
    if (fonts[+(attr(xf, 'fontId') || 0)]) return 'kop';
    return null;
  });
}

function leesXlsx(buf) {
  const delen = lees(buf, GRENS_XLSX);
  const tekst = naam => delen[naam] ? delen[naam].toString('utf8') : null;
  const werkboek = tekst('xl/workbook.xml');
  if (!werkboek) { const e = new Error('Dit is geen XLSX: er zit geen werkboek in.'); e.zipFout = true; throw e; }
  const bladen = werkboek.match(/<sheet\b[^>]*>/g) || [];
  if (!bladen.length) { const e = new Error('Dit werkboek heeft geen werkblad.'); e.zipFout = true; throw e; }
  const rels = tekst('xl/_rels/workbook.xml.rels') || '';
  const rid = attr(bladen[0], 'r:id');
  const rel = (rels.match(/<Relationship\b[^>]*>/g) || []).find(r => attr(r, 'Id') === rid);
  const doel = rel ? attr(rel, 'Target') : 'worksheets/sheet1.xml';
  const pad = doel.startsWith('/') ? doel.slice(1) : 'xl/' + doel.replace(/^\.\//, '');
  const blad = tekst(pad);
  if (!blad) { const e = new Error('Het eerste werkblad ontbreekt in dit bestand.'); e.zipFout = true; throw e; }

  const gedeeld = blokken(tekst('xl/sharedStrings.xml'), 'si').map(x => teksten(x.binnen));
  const soorten = opmaakSoorten(tekst('xl/styles.xml'));
  const trouw = {};
  const noteer = (wat, cel) => { const t = trouw[wat] = trouw[wat] || { wat, aantal: 0, cellen: [] }; t.aantal++; if (cel && t.cellen.length < 10) t.cellen.push(cel); };
  if (bladen.length > 1) {
    const wat = 'andere werkbladen niet ingelezen (alleen "' + (attr(bladen[0], 'name') || 'het eerste') + '")';
    trouw[wat] = { wat, aantal: bladen.length - 1, cellen: [] };
  }

  const cellen = {}, opmaak = {};
  let rijen = 1, kolommen = 1, n = 0;
  for (const { kop, binnen } of blokken(blad, 'c')) {
    const ref = attr(kop, 'r');
    const r = /^([A-Z]{1,3})(\d+)$/.exec(ref || '');
    if (!r) continue;
    const v = blokken(binnen, 'v')[0];
    const fBlok = blokken(binnen, 'f')[0];
    const vMatch = v ? [null, v.binnen] : null;
    const fMatch = fBlok ? [null, fBlok.kop, fBlok.binnen] : null;
    const t = attr(kop, 't');
    let waarde = vMatch ? uitXml(vMatch[1]) : null;
    if (t === 's') waarde = gedeeld[+waarde] != null ? gedeeld[+waarde] : '';
    else if (t === 'inlineStr') waarde = teksten(binnen);
    else if (t === 'b') waarde = waarde === '1' ? 'WAAR' : 'ONWAAR';
    if ((waarde == null || waarde === '') && !fMatch) continue;
    const kol = kolIndex(r[1]), rij = +r[2];
    if (kol >= MAX_KOLOMMEN || rij > MAX_RIJEN) { noteer('buiten het raster van ' + MAX_RIJEN + ' rijen bij ' + MAX_KOLOMMEN + ' kolommen, weggelaten', ref); continue; }
    if (++n > MAX_CELLEN) { noteer('boven de ' + MAX_CELLEN + ' cellen, weggelaten', ref); continue; }
    const soort = soorten[+(attr(kop, 's') || 0)] || null;
    let inhoud = waarde == null ? '' : String(waarde);
    if (fMatch && fMatch[2] && fMatch[2].trim()) {
      const f = vanExcel(uitXml(fMatch[2]));
      if (f.formule) inhoud = f.formule;
      else noteer('formule als waarde overgenomen: ' + f.fout, ref);
    } else if (fMatch) noteer('gedeelde formule als waarde overgenomen', ref);
    if (t === 'e' && inhoud.charAt(0) !== '=') noteer('foutwaarde uit het bestand overgenomen als tekst', ref);
    if (soort === 'datum' && (!t || t === 'n') && /^-?\d+(\.\d+)?$/.test(inhoud)) {
      inhoud = new Date(EPOCH + Math.floor(+inhoud) * 864e5).toISOString().slice(0, 10);
    }
    const doelRef = kolNaam(kol) + rij;
    cellen[doelRef] = inhoud.slice(0, 400);
    if (inhoud.length > 400) noteer('cel langer dan 400 tekens, afgekapt', ref);
    if (soort) opmaak[doelRef] = soort;
    rijen = Math.max(rijen, rij); kolommen = Math.max(kolommen, kol + 1);
  }
  if (/<mergeCell\b/.test(blad)) noteer('samengevoegde cellen, als losse cellen', null);
  if (/<drawing\b|<legacyDrawing\b/.test(blad)) noteer('grafieken of afbeeldingen, weggelaten', null);
  return { inhoud: { cellen, opmaak, rijen: Math.max(20, rijen), kolommen: Math.max(8, kolommen) },
    trouw: Object.values(trouw), naam: attr(bladen[0], 'name') || '' };
}

module.exports = { leesXlsx, MAX_RIJEN, MAX_KOLOMMEN };
