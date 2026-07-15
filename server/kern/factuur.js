/* Facturen en overzichten als download, zonder externe pakketten
   (docs/de-lijn.md: zelf bouwen waar controle waarde schept). Twee dingen:

   1. een kleine, correcte PDF 1.4-schrijver: een A4-pagina, Helvetica, tekst en
      lijnen op vaste posities. Genoeg voor een nette, downloadbare factuur.
   2. composities: een RTG-ledenfactuur en een omzet-/boekhoudoverzicht, plus een
      CSV-hulp voor boekhoud-exports.

   Bedragen tonen we als "EUR 1.234,56": geen euroteken, zodat we niet afhankelijk
   zijn van de tekstcodering van de viewer. Alles blijft ASCII en dus robuust. */

const RTG = {
  naam: 'Rahul Travel Group',
  kvk: 'KvK 82273510',
  btwnr: 'btw NL002291440B89',
  iban: 'NL62 INGB 0111 1775 88'
};

function euroTekst(n) {
  const v = Number(n) || 0;
  return 'EUR ' + v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Alleen tekens die veilig in een PDF-tekststring staan; escape (, ) en \.
function escPdf(s) {
  return String(s == null ? '' : s)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7e]/g, ' ') // buiten ASCII: vervang door spatie (robuust)
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const A4 = { b: 595, h: 842 };

/* Bouw een 1-pagina PDF uit regels ({x, y (van boven), size, font:'F1'|'F2',
   text}) en lijnen ({x1, y1, x2, y2, w}). Geeft een Buffer terug. De xref-offsets
   worden exact meegeteld, zodat het bestand geldig is. */
function pdf({ regels = [], lijnen = [] }) {
  let inhoud = '';
  for (const l of lijnen) {
    inhoud += (l.w || 0.6) + ' w ' + l.x1 + ' ' + (A4.h - l.y1) + ' m ' + l.x2 + ' ' + (A4.h - l.y2) + ' l S\n';
  }
  for (const r of regels) {
    const font = r.font === 'F2' ? 'F2' : 'F1';
    inhoud += 'BT /' + font + ' ' + (r.size || 10) + ' Tf ' + r.x + ' ' + (A4.h - r.y) + ' Td (' + escPdf(r.text) + ') Tj ET\n';
  }
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + A4.b + ' ' + A4.h + ']/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>',
    '<</Length ' + Buffer.byteLength(inhoud, 'latin1') + '>>\nstream\n' + inhoud + '\nendstream',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>'
  ];
  let doc = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(Buffer.byteLength(doc, 'latin1'));
    doc += (i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  const xref = Buffer.byteLength(doc, 'latin1');
  doc += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  for (const off of offsets) doc += String(off).padStart(10, '0') + ' 00000 n \n';
  doc += 'trailer\n<</Size ' + (objs.length + 1) + '/Root 1 0 R>>\nstartxref\n' + xref + '\n%%EOF';
  return Buffer.from(doc, 'latin1');
}

function isContrib(desc) { return /lidmaatschap|jaarbijdrage|maandbijdrage/i.test(String(desc || '')); }

/* Een RTG-ledenfactuur. inv: {id, desc, netto, bijdrage, btw, status, date}.
   who: {codename, tier}. Geeft een PDF-Buffer terug. */
function ledenFactuur(inv, who) {
  const total = (inv.netto || 0) + (inv.bijdrage || 0);
  const foundation = isContrib(inv.desc) ? Math.round((inv.bijdrage || 0) / 1.21 * 0.3 * 100) / 100 : 0;
  const pasNaam = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' }[who.tier] || 'RTG';
  const regels = [];
  const lijnen = [];
  const R = (x, y, text, size, font) => regels.push({ x, y, text, size, font });
  // kop
  R(56, 64, RTG.naam.toUpperCase(), 18, 'F2');
  R(56, 82, 'Factuur', 11, 'F1');
  R(400, 64, 'Factuurnummer', 9, 'F1');
  R(400, 78, inv.id || '-', 12, 'F2');
  R(400, 96, 'Datum: ' + (inv.date || '-'), 9, 'F1');
  R(400, 110, 'Status: ' + (inv.status === 'paid' ? 'Betaald' : 'Openstaand'), 9, 'F1');
  lijnen.push({ x1: 56, y1: 128, x2: 539, y2: 128, w: 0.8 });
  // op naam van
  R(56, 150, 'Op naam van', 9, 'F1');
  R(56, 164, (who.codename || '-') + '  .  ' + pasNaam, 12, 'F2');
  // omschrijving
  R(56, 210, 'Omschrijving', 9, 'F2');
  R(400, 210, 'Bedrag', 9, 'F2');
  lijnen.push({ x1: 56, y1: 218, x2: 539, y2: 218, w: 0.5 });
  R(56, 238, inv.desc || '-', 11, 'F1');
  R(400, 238, euroTekst(total), 11, 'F1');
  // specificatie
  let y = 280;
  const spec = (l, v, bold) => { R(56, y, l, 10, bold ? 'F2' : 'F1'); R(400, y, v, 10, bold ? 'F2' : 'F1'); y += 20; };
  if ((inv.netto || 0) > 0) spec('Nettoprijs (inkoop)', euroTekst(inv.netto));
  spec('Ledenbijdrage', euroTekst(inv.bijdrage || 0));
  if (foundation > 0) spec('waarvan naar de RTFoundation (30%)', euroTekst(foundation));
  spec('Btw 21% (in de bijdrage begrepen)', euroTekst(inv.btw || 0));
  lijnen.push({ x1: 56, y1: y - 4, x2: 539, y2: y - 4, w: 0.5 });
  y += 8;
  spec('Totaal', euroTekst(total), true);
  // voet
  lijnen.push({ x1: 56, y1: 792, x2: 539, y2: 792, w: 0.5 });
  R(56, 808, RTG.naam + '  .  ' + RTG.kvk + '  .  ' + RTG.btwnr, 8, 'F1');
  R(56, 820, 'IBAN ' + RTG.iban + '  .  o.v.v. codenaam en factuurnummer', 8, 'F1');
  return pdf({ regels, lijnen });
}

/* Een transactiefactuur tussen twee partijen (verkoper -> koper/huurder), zoals
   de facturatielaag die maakt bij elke verkoop/dienst/verhuur. EGn nette bon die
   beide partijen downloaden. f is de opgeslagen factuur (zie kern/facturatie.js). */
function transactieFactuur(f) {
  const regels = [];
  const lijnen = [];
  const R = (x, y, text, size, font) => regels.push({ x, y, text, size, font });
  const soortLabel = { verkoop: 'Verkoopfactuur', dienst: 'Dienstfactuur', huur: 'Huurfactuur' }[f.soort] || 'Factuur';
  R(56, 64, RTG.naam.toUpperCase(), 18, 'F2');
  R(56, 82, soortLabel + ' via RTG', 11, 'F1');
  R(400, 64, 'Factuurnummer', 9, 'F1');
  R(400, 78, f.nummer || '-', 12, 'F2');
  R(400, 96, 'Datum: ' + (f.datum || '-'), 9, 'F1');
  if (f.methode) R(400, 110, 'Betaling: ' + f.methode, 9, 'F1');
  lijnen.push({ x1: 56, y1: 128, x2: 539, y2: 128, w: 0.8 });
  R(56, 150, 'Van (verkoper)', 9, 'F1');
  R(56, 164, f.verkoper.naam || '-', 12, 'F2');
  R(300, 150, 'Aan (koper)', 9, 'F1');
  R(300, 164, (f.koper.naam || '-') + (f.koper.codenaam ? '  .  ' + f.koper.codenaam : ''), 12, 'F2');
  // regels
  R(56, 210, 'Omschrijving', 9, 'F2');
  R(330, 210, 'Aantal', 9, 'F2');
  R(390, 210, 'Stuk', 9, 'F2');
  R(470, 210, 'Bedrag', 9, 'F2');
  lijnen.push({ x1: 56, y1: 218, x2: 539, y2: 218, w: 0.5 });
  let y = 238;
  for (const r of (f.regels || []).slice(0, 22)) {
    R(56, y, String(r.omschrijving || '-').slice(0, 46), 10, 'F1');
    R(330, y, String(r.aantal), 10, 'F1');
    R(390, y, euroTekst(r.stuk), 10, 'F1');
    R(470, y, euroTekst(r.incl != null ? r.incl : r.aantal * r.stuk), 10, 'F1');
    y += 18;
  }
  lijnen.push({ x1: 56, y1: y - 2, x2: 539, y2: y - 2, w: 0.5 });
  y += 14;
  const spec = (l, v, bold) => { R(330, y, l, 10, bold ? 'F2' : 'F1'); R(470, y, v, 10, bold ? 'F2' : 'F1'); y += 20; };
  spec('Subtotaal (excl. btw)', euroTekst(f.subtotaal));
  spec('Btw', euroTekst(f.btwBedrag));
  spec('Totaal', euroTekst(f.totaal), true);
  lijnen.push({ x1: 56, y1: 792, x2: 539, y2: 792, w: 0.5 });
  R(56, 808, RTG.naam + '  .  bemiddelaar  .  ' + RTG.kvk + '  .  ' + RTG.btwnr, 8, 'F1');
  R(56, 820, 'Deze factuur is via het RTG-platform tot stand gekomen tussen de bovengenoemde partijen.', 8, 'F1');
  return pdf({ regels, lijnen });
}

/* Een omzet-/boekhoudoverzicht (bijv. voor een leverancier of de eigen zaak).
   kop: {titel, periode, opnaam}. rijen: [{label, waarde}]. Geeft een PDF-Buffer. */
function overzichtPdf(kop, rijen) {
  const regels = [];
  const lijnen = [];
  const R = (x, y, text, size, font) => regels.push({ x, y, text, size, font });
  R(56, 64, RTG.naam.toUpperCase(), 16, 'F2');
  R(56, 84, kop.titel || 'Overzicht', 12, 'F1');
  R(400, 64, kop.periode || '', 10, 'F1');
  if (kop.opnaam) R(400, 80, kop.opnaam, 10, 'F1');
  lijnen.push({ x1: 56, y1: 100, x2: 539, y2: 100, w: 0.8 });
  let y = 128;
  for (const rij of rijen) {
    R(56, y, rij.label, 10, rij.bold ? 'F2' : 'F1');
    R(400, y, rij.waarde, 10, rij.bold ? 'F2' : 'F1');
    if (rij.streep) lijnen.push({ x1: 56, y1: y + 6, x2: 539, y2: y + 6, w: 0.5 });
    y += rij.streep ? 26 : 20;
    if (y > 780) break;
  }
  lijnen.push({ x1: 56, y1: 800, x2: 539, y2: 800, w: 0.5 });
  R(56, 816, RTG.naam + '  .  ' + RTG.kvk + '  .  ' + RTG.btwnr, 8, 'F1');
  return pdf({ regels, lijnen });
}

// Kleine CSV-hulp: rijen (arrays) naar een veilige CSV-string (RFC 4180-achtig).
function csv(rijen) {
  const veld = v => {
    const s = String(v == null ? '' : v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rijen.map(r => r.map(veld).join(';')).join('\r\n') + '\r\n';
}

module.exports = { pdf, ledenFactuur, transactieFactuur, overzichtPdf, csv, euroTekst, isContrib, RTG };
