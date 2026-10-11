/* RTG Office: een tekstdocument als DOCX (OFFICE.md punt 23, par. 9 fase 2).

   Een tekstdocument heeft hier geen model: het IS HTML (OFFICE.md par. 1). DOCX
   LEZEN vraagt daarom eerst dat model en staat op "maanden"; DOCX SCHRIJVEN kan
   nu, want HTML omzetten naar WordprocessingML is een vertaling in een richting.
   Wat de editor maakt (koppen, alinea's, vet, cursief, onderstreept, doorhalen,
   markeren, opsommingen, genummerde lijsten, citaten, tabellen, regeleinden)
   gaat mee. Wat er verder in de HTML staat -- een link, een afbeelding, een
   onbekende tag -- gaat als TEKST mee of valt weg, en dat staat in de
   TROUWLIJST per soort met een aantal. Een export die zwijgt over wat hij liet
   vallen, is een export waarop niemand kan bouwen.

   De classificatie staat in de koptekst van elke pagina en als eigenschap van
   het bestand (./ooxml.js). */
'use strict';

const { pak } = require('./zip');
const { xmlEsc } = require('./ooxml');
const { docxPakket } = require('./docx-pakket');

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const KOP = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const INLINE = { b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', s: 's', strike: 's', del: 's', mark: 'mark' };
const STIJLEN = { h1: 'Kop1', h2: 'Kop2', h3: 'Kop3', h4: 'Kop3', h5: 'Kop3', h6: 'Kop3', blockquote: 'Citaat' };
const BLOK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li']);
const STIL = new Set(['span', 'font', 'br', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'body', 'html']);

function ontsnapUit(t) {
  return String(t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch (x) { return ''; } }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()] || m;
  });
}

function htmlNaarDocx({ titel, html, label }) {
  const trouw = {};
  const noteer = (wat) => { trouw[wat] = (trouw[wat] || 0) + 1; };
  const lichaam = [];
  const lijsten = [];           // per <ol>/<ul>: { soort, numId }
  const nums = [];              // numId -> abstractNum (0 opsomming, 1 genummerd)
  const opmaak = {};            // actieve inline-opmaak: teller per soort
  let alinea = null;            // { stijl, runs, lijst }
  let tabel = null;             // { rijen: [[cel]] } ; cel = [alinea-xml]
  let stijlBlok = null;

  const runXml = (tekst, o) => {
    const rpr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.u ? '<w:u w:val="single"/>' : '') +
      (o.s ? '<w:strike/>' : '') + (o.mark ? '<w:highlight w:val="yellow"/>' : '');
    return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') +
      (tekst === '\n' ? '<w:br/>' : '<w:t xml:space="preserve">' + xmlEsc(tekst) + '</w:t>') + '</w:r>';
  };
  const begin = (stijl) => { if (!alinea) alinea = { stijl: stijl || stijlBlok, runs: [], lijst: null }; return alinea; };
  const sluit = () => {
    if (!alinea) return;
    const a = alinea; alinea = null;
    if (!a.runs.length && !a.lijst) return;
    let ppr = a.stijl ? '<w:pStyle w:val="' + a.stijl + '"/>' : '';
    if (a.lijst) ppr = '<w:pStyle w:val="Lijstalinea"/><w:numPr><w:ilvl w:val="' + Math.min(8, a.lijst.niveau) +
      '"/><w:numId w:val="' + a.lijst.numId + '"/></w:numPr>';
    const xml = '<w:p>' + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + a.runs.join('') + '</w:p>';
    if (tabel && tabel.cel) tabel.cel.push(xml); else lichaam.push(xml);
  };
  const tekst = (t) => {
    const kaal = ontsnapUit(t).replace(/[\r\n\t ]+/g, ' ');
    if (!kaal.trim() && !alinea) return;
    const o = {}; for (const k of Object.keys(opmaak)) if (opmaak[k] > 0) o[k] = true;
    begin().runs.push(runXml(kaal, o));
  };

  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|[^<]+/g;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const stuk = m[0];
    if (stuk.startsWith('<!--')) continue;
    if (!m[1]) { tekst(stuk); continue; }
    const tag = m[1].toLowerCase(), dicht = stuk[1] === '/';
    if (INLINE[tag]) { opmaak[INLINE[tag]] = (opmaak[INLINE[tag]] || 0) + (dicht ? -1 : 1); continue; }
    if (tag === 'br') { if (!dicht) begin().runs.push(runXml('\n', {})); continue; }
    if (tag === 'ul' || tag === 'ol') {
      sluit();
      if (dicht) lijsten.pop();
      else { nums.push(tag === 'ol' ? 1 : 0); lijsten.push({ numId: nums.length }); }
      continue;
    }
    if (tag === 'table') { sluit(); if (dicht && tabel) { lichaam.push(tabelXml(tabel), '<w:p/>'); tabel = null; } else if (!dicht) tabel = { rijen: [] }; continue; }
    if (tag === 'tr' && tabel) { sluit(); if (!dicht) tabel.rijen.push([]); continue; }
    if ((tag === 'td' || tag === 'th') && tabel) {
      sluit();
      if (!dicht) { tabel.cel = []; (tabel.rijen[tabel.rijen.length - 1] || tabel.rijen[tabel.rijen.push([]) - 1]).push(tabel.cel); if (tag === 'th') opmaak.b = (opmaak.b || 0) + 1; }
      else { if (tag === 'th') opmaak.b = Math.max(0, (opmaak.b || 0) - 1); tabel.cel = null; }
      continue;
    }
    if (tag === 'hr') { sluit(); lichaam.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="DEDBD5"/></w:pBdr></w:pPr></w:p>'); continue; }
    if (BLOK.has(tag)) {
      sluit();
      if (tag === 'blockquote') stijlBlok = dicht ? null : 'Citaat';
      if (!dicht) {
        const a = begin(STIJLEN[tag] || stijlBlok);
        if (tag === 'li') {
          const l = lijsten[lijsten.length - 1];
          if (l) a.lijst = { numId: l.numId, niveau: lijsten.length - 1 }; else noteer('lijstpunt zonder lijst, als gewone alinea');
        }
      }
      continue;
    }
    if (tag === 'a') { if (!dicht) noteer('link, als tekst zonder adres'); continue; }
    if (tag === 'img') { noteer('afbeelding, weggelaten'); continue; }
    if (!STIL.has(tag) && !dicht) noteer('opmaak van <' + tag + '>, alleen de tekst');
  }
  sluit();
  if (tabel) lichaam.push(tabelXml(tabel));

  const document = KOP + '<w:document xmlns:w="' + W + '" xmlns:r="' + NS_R + '"><w:body>' + lichaam.join('') +
    '<w:sectPr><w:headerReference w:type="default" r:id="rIdKop"/>' +
    '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';
  const koptekst = KOP + '<w:hdr xmlns:w="' + W + '"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
    runXml('Classificatie: ' + label, {}) + '</w:p></w:hdr>';

  const bestanden = docxPakket({ document, koptekst, nums, titel, label });
  return { buffer: pak(bestanden), trouw: Object.entries(trouw).map(([wat, aantal]) => ({ wat, aantal })) };
}

function tabelXml(tabel) {
  const breed = Math.max(1, ...tabel.rijen.map(r => r.length));
  const rand = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(k => '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="8A8680"/>').join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' + rand + '</w:tblBorders></w:tblPr>' +
    '<w:tblGrid>' + '<w:gridCol/>'.repeat(breed) + '</w:tblGrid>' +
    tabel.rijen.filter(r => r.length).map(r => '<w:tr>' + Array.from({ length: breed }, (_, i) =>
      '<w:tc>' + ((r[i] && r[i].length) ? r[i].join('') : '<w:p/>') + '</w:tc>').join('') + '</w:tr>').join('') + '</w:tbl>';
}

module.exports = { htmlNaarDocx };
