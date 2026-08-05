/* ============================================================================
   PDF: samenvoegen en splitsen.

   WAT HIER BIJ KOMT ten opzichte van de redactie (./pdf-redactie.js): die kon
   binnen EEN document blijven en hoefde alleen bytes te vervangen. Samenvoegen
   en splitsen raken de OBJECTGRAAF -- twee documenten hebben allebei een object
   nummer 3, en na het samenvoegen mag er maar een van beide zo heten. Dat
   hernummeren is het echte werk, en het is ook de plek waar dit soort code
   stilletjes fout gaat: een verwijzing die je vergeet, wijst daarna naar het
   verkeerde object en het bestand opent nog steeds -- met de verkeerde pagina.

   DRIE KEUZES DIE DAT AFVANGEN

   1. HERNUMMEREN GEBEURT ALLEEN IN HET WOORDENBOEK, NOOIT IN EEN STREAM. De
      bytes van een inhoudsstroom bevatten van alles wat op "12 0 R" lijkt maar
      het niet is. Wij raken alleen het deel voor `stream` aan.
   2. DE PAGINABOOM WORDT OPNIEUW GEBOUWD, niet gerepareerd. Elke pagina krijgt
      een nieuwe /Parent en er komt een verse catalogus boven. Een oude boom
      "aanpassen" laat altijd iets staan dat naar het verleden wijst.
   3. BIJ SPLITSEN GAAT ALLEEN MEE WAT BEREIKBAAR IS vanaf de gekozen pagina's,
      transitief gevolgd. Alles meenemen is makkelijker en precies verkeerd: dan
      reist de tekst van de pagina's die je NIET deelt gewoon mee in het
      bestand. Dat is dezelfde fout als een zwart balkje.

   Wat de leeslaag weigert (versleuteld, objectstreams, cross-reference
   streams), weigeren deze twee ook -- met de reden van die laag.
   ========================================================================== */
'use strict';
const { lees, kopVan, streamVan } = require('./pdf');

const REF = /\b(\d+)\s+(\d+)\s+R\b/g;

// de tekst van een object opgesplitst in woordenboek en de rest (stream+staart)
function knip(buf, obj) {
  const heel = buf.toString('latin1', obj.start, obj.eind);
  const s = heel.indexOf('stream');
  return s < 0 ? { dict: heel, rest: '' } : { dict: heel.slice(0, s), rest: heel.slice(s) };
}

// alle objectnummers waarnaar dit woordenboek verwijst
function verwijzingen(dict) {
  const uit = [];
  let m;
  REF.lastIndex = 0;
  while ((m = REF.exec(dict)) !== null) uit.push(Number(m[1]));
  return uit;
}

/* Een object overschrijven met nieuwe nummers. Alleen het woordenboek gaat
   door de hernummering; de stream blijft byte voor byte wat hij was. */
function hernummer(buf, obj, kaart, extra) {
  const { dict, rest } = knip(buf, obj);
  let nieuw = dict.replace(/^\s*\d+\s+\d+\s+obj/, (kaart.get(obj.nummer) || obj.nummer) + ' 0 obj');
  nieuw = nieuw.replace(REF, (heel, n, g) => (kaart.has(Number(n)) ? kaart.get(Number(n)) + ' 0 R' : heel));
  if (extra) nieuw = extra(nieuw);
  return nieuw + rest;
}

/* Het bestand wegschrijven: de objecten op volgorde, dan een verse xref.
   Heet niet gewoon `schrijf`: die naam stond al in twee andere kernmodules en
   drie keer dezelfde naam voor drie verschillende dingen is precies waar iemand
   later de verkeerde functie leest. */
function schrijfPdf(delen) {
  const stukken = [Buffer.from('%PDF-1.4\n', 'latin1')];
  let lengte = stukken[0].length;
  const pos = new Map();
  for (const d of delen) {
    pos.set(d.nummer, lengte);
    const b = Buffer.from(d.tekst.replace(/\s*$/, '') + '\n', 'latin1');
    stukken.push(b);
    lengte += b.length;
  }
  const hoogste = Math.max(...pos.keys());
  let tabel = 'xref\n0 ' + (hoogste + 1) + '\n0000000000 65535 f \n';
  for (let n = 1; n <= hoogste; n++) {
    tabel += String(pos.get(n) || 0).padStart(10, '0') + ' 00000 ' + (pos.has(n) ? 'n' : 'f') + ' \n';
  }
  tabel += 'trailer\n<< /Size ' + (hoogste + 1) + ' /Root 1 0 R >>\nstartxref\n' + lengte + '\n%%EOF\n';
  stukken.push(Buffer.from(tabel, 'latin1'));
  return Buffer.concat(stukken);
}

// de catalogus en de paginaboom, altijd vers: 1 = catalogus, 2 = paginaboom
function boom(paginaNummers) {
  return [
    { nummer: 1, tekst: '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' },
    { nummer: 2, tekst: '2 0 obj\n<< /Type /Pages /Kids [' +
        paginaNummers.map(n => n + ' 0 R').join(' ') + '] /Count ' + paginaNummers.length + ' >>\nendobj\n' }
  ];
}
const isPagina = (o) => /\/Type\s*\/Page\b/.test(kopVan(o.lijf)) && !/\/Type\s*\/Pages\b/.test(kopVan(o.lijf));

/* ---------- samenvoegen ---------- */
function voegSamen(buffers) {
  const lijst = (Array.isArray(buffers) ? buffers : []).filter(Buffer.isBuffer);
  if (lijst.length < 2) return { ok: false, waarom: 'geef minstens twee documenten om samen te voegen' };

  const delen = [];
  const paginas = [];
  let volgend = 3;
  for (let i = 0; i < lijst.length; i++) {
    const buf = lijst[i];
    const d = lees(buf);
    if (!d.ok) return { ok: false, waarom: 'document ' + (i + 1) + ': ' + d.waarom };
    // de oude catalogus en paginaboom gaan NIET mee; die bouwen we opnieuw
    const mee = d.objecten.filter(o => !/\/Type\s*\/(Catalog|Pages)\b/.test(kopVan(o.lijf)));
    if (!mee.some(isPagina)) return { ok: false, waarom: 'document ' + (i + 1) + ' bevat geen pagina' };
    const kaart = new Map();
    for (const o of mee) kaart.set(o.nummer, volgend++);
    for (const o of mee) {
      const nr = kaart.get(o.nummer);
      if (isPagina(o)) paginas.push(nr);
      delen.push({ nummer: nr, tekst: hernummer(buf, o, kaart,
        isPagina(o) ? (t => t.replace(/\/Parent\s+\d+\s+\d+\s+R/, '/Parent 2 0 R')) : null) });
    }
  }
  return { ok: true, paginas: paginas.length, documenten: lijst.length,
    bestand: schrijfPdf(boom(paginas).concat(delen.sort((a, b) => a.nummer - b.nummer))),
    let: 'De paginaboom is opnieuw gebouwd en elk object is hernummerd. Een oude boom aanpassen laat altijd iets staan dat naar het verleden wijst.' };
}

/* ---------- splitsen ----------
   `van` en `tot` zijn 1-gebaseerd en tellen inclusief, zoals een mens telt. */
function splits(buf, van, tot) {
  const d = lees(buf);
  if (!d.ok) return d;
  const alle = d.objecten.filter(isPagina);
  if (!alle.length) return { ok: false, waarom: 'dit document bevat geen pagina' };
  const a = Math.max(1, parseInt(van, 10) || 1);
  /* De volgorde van deze twee controles is niet willekeurig: hij stond eerst
     andersom, en dan kreeg "pagina 9 van een document van drie" de melding dat
     de eerste pagina na de laatste ligt -- waar was dan. Een foutmelding die
     naar het verkeerde probleem wijst, kost meer tijd dan geen foutmelding. */
  if (a > alle.length) return { ok: false, waarom: 'dit document heeft ' + alle.length + ' pagina(s); pagina ' + a + ' bestaat niet' };
  const b = Math.min(alle.length, parseInt(tot, 10) || a);
  if (a > b) return { ok: false, waarom: 'de eerste pagina ligt na de laatste' };
  const gekozen = alle.slice(a - 1, b);

  /* Alleen wat BEREIKBAAR is vanaf de gekozen pagina's. Alles meenemen zou
     betekenen dat de tekst van de pagina's die je niet deelt gewoon meereist. */
  const opNummer = new Map(d.objecten.map(o => [o.nummer, o]));
  const houden = new Set();
  const wachtrij = gekozen.map(o => o.nummer);
  while (wachtrij.length) {
    const n = wachtrij.pop();
    if (houden.has(n)) continue;
    const o = opNummer.get(n);
    if (!o) continue;
    if (/\/Type\s*\/(Catalog|Pages)\b/.test(kopVan(o.lijf))) continue;   // de oude boom blijft achter
    houden.add(n);
    for (const r of verwijzingen(knip(buf, o).dict)) if (!houden.has(r)) wachtrij.push(r);
  }

  const mee = d.objecten.filter(o => houden.has(o.nummer)).sort((x, y) => x.nummer - y.nummer);
  const kaart = new Map();
  let volgend = 3;
  for (const o of mee) kaart.set(o.nummer, volgend++);
  const paginas = gekozen.map(o => kaart.get(o.nummer));
  const delen = mee.map(o => ({ nummer: kaart.get(o.nummer),
    tekst: hernummer(buf, o, kaart, isPagina(o) ? (t => t.replace(/\/Parent\s+\d+\s+\d+\s+R/, '/Parent 2 0 R')) : null) }));

  return { ok: true, paginas: paginas.length, van: a, tot: b, uitTotaal: alle.length,
    bestand: schrijfPdf(boom(paginas).concat(delen)),
    let: 'Alleen wat vanaf deze pagina\'s bereikbaar is, is meegegaan. Alles meenemen is makkelijker en precies verkeerd: dan reist de tekst van de pagina\'s die u niet deelt gewoon mee in het bestand.' };
}

module.exports = { voegSamen, splits, verwijzingen };
