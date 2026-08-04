/* ============================================================================
   PDF: lezen en ontleden, op eigen kracht.

   WAAROM DIT ER IS. TAKEN 5.9 noemde PDF-bewerking als het laatste gat van de
   kantoorlaag, met een maat erbij: een geredigeerde passage moet ook echt UIT
   de bytes zijn. Dit bestand is de leeshelft daarvan; het redigeren staat in
   ./pdf-redactie.js.

   WAT DIT WEL DOET. De klassieke PDF met een xref-TABEL: objecten opzoeken,
   streams uitpakken (ongecomprimeerd of FlateDecode, met zlib uit Node zelf),
   de tekst eruit halen, en het geheel weer opbouwen met een verse xref.

   WAT DIT WEIGERT, EN DAT IS HET BELANGRIJKSTE. Een PDF die dit bestand niet
   BEGRIJPT, wordt niet half bewerkt maar geweigerd, met de reden erbij:

   - versleutelde PDF's (/Encrypt): daar heeft redactie geen betekenis zolang
     we de inhoud niet kunnen lezen;
   - cross-reference streams en objectstreams (PDF 1.5+, /Type /XRef of
     /ObjStm): die dragen objecten IN een stream, en een halve ontleding daarvan
     levert een bestand op dat opent maar stiekem stuk is;
   - alles zonder de kop %PDF-.

   Dat weigeren is geen tekortkoming maar de hele reden dat dit veilig is. Een
   redactielaag die bij twijfel toch iets teruggeeft, geeft een document terug
   waarvan iemand DENKT dat het schoon is. Dat is erger dan geen redactielaag.
   ========================================================================== */
'use strict';
const zlib = require('zlib');

const KOP = Buffer.from('%PDF-');

/* Alle objecten in het bestand, gevonden door te scannen op "N G obj". Dat is
   bewust niet via de xref-tabel: die is in beschadigde bestanden vaak juist
   het kapotte deel, en wij bouwen hem straks toch opnieuw op. */
function objecten(buf) {
  const uit = [];
  const tekst = buf.toString('latin1');
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(tekst)) !== null) {
    const start = m.index;
    const eind = tekst.indexOf('endobj', re.lastIndex);
    if (eind < 0) continue;
    const lijf = tekst.slice(re.lastIndex, eind);
    uit.push({ nummer: Number(m[1]), generatie: Number(m[2]), start, eind: eind + 6, lijf });
  }
  return uit;
}

// het woordenboek van een object: alles tot aan het eerste "stream"
function kopVan(lijf) {
  const s = lijf.indexOf('stream');
  return s < 0 ? lijf : lijf.slice(0, s);
}

/* De ruwe bytes van een stream. De lengte uit /Length is niet te vertrouwen
   (hij kan een indirecte verwijzing zijn), dus we zoeken het einde op de
   markering -- die staat er altijd. */
function streamVan(buf, obj) {
  const i = obj.lijf.indexOf('stream');
  if (i < 0) return null;
  let begin = obj.start + (obj.lijf.length ? 0 : 0);
  const tekst = buf.toString('latin1', obj.start, obj.eind);
  const s = tekst.indexOf('stream');
  if (s < 0) return null;
  let na = s + 6;
  if (tekst[na] === '\r') na++;
  if (tekst[na] === '\n') na++;
  const e = tekst.indexOf('endstream', na);
  if (e < 0) return null;
  let eind = e;
  while (eind > na && (tekst[eind - 1] === '\n' || tekst[eind - 1] === '\r')) eind--;
  begin = obj.start + na;
  return { begin, eind: obj.start + eind, bytes: buf.slice(obj.start + na, obj.start + eind) };
}

const isFlate = (kop) => /\/Filter\s*\/FlateDecode/.test(kop) || /\/Filter\s*\[\s*\/FlateDecode\s*\]/.test(kop);

function pakUit(kop, bytes) {
  if (!isFlate(kop)) return { ok: true, data: bytes, gecomprimeerd: false };
  try { return { ok: true, data: zlib.inflateSync(bytes), gecomprimeerd: true }; }
  catch (e) {
    try { return { ok: true, data: zlib.inflateRawSync(bytes), gecomprimeerd: true, rauw: true }; }
    catch (e2) { return { ok: false, waarom: 'een stream is niet uit te pakken' }; }
  }
}

/* Lezen. Geeft ok:false met een REDEN bij alles wat we niet begrijpen; de
   aanroeper hoort dan niets te bewerken. */
function lees(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8 || !buf.slice(0, 5).equals(KOP))
    return { ok: false, waarom: 'dit is geen PDF (de kop %PDF- ontbreekt)' };
  const tekst = buf.toString('latin1');
  if (/\/Encrypt\b/.test(tekst))
    return { ok: false, waarom: 'deze PDF is versleuteld; redactie heeft geen betekenis zolang de inhoud niet te lezen is' };
  if (/\/Type\s*\/ObjStm/.test(tekst))
    return { ok: false, waarom: 'deze PDF draagt zijn objecten in een objectstream (PDF 1.5+); die laag begrijpt dit bestand niet en bewerkt hem daarom niet' };
  if (/\/Type\s*\/XRef/.test(tekst))
    return { ok: false, waarom: 'deze PDF gebruikt een cross-reference stream; die laag begrijpt dit bestand niet en bewerkt hem daarom niet' };
  const objs = objecten(buf);
  if (!objs.length) return { ok: false, waarom: 'er staan geen objecten in dit bestand' };

  const wortel = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(tekst);
  const paginas = objs.filter(o => /\/Type\s*\/Page\b/.test(kopVan(o.lijf))).length;
  const versie = (tekst.slice(5, 8) || '').trim();
  return { ok: true, versie, objecten: objs, paginas, wortel: wortel ? wortel[1] + ' ' + wortel[2] : null,
    heeftTrailer: /\btrailer\b/.test(tekst) };
}

/* De tekst die in dit document GETEKEND wordt: alles tussen haakjes in een
   inhoudsstroom. Bewust geen mooie tekstopmaak -- dit dient om te ZOEKEN, en
   voor de toets die bewijst dat een geredigeerde passage weg is. */
function tekstVan(buf) {
  const d = lees(buf);
  if (!d.ok) return d;
  const stukken = [];
  for (const o of d.objecten) {
    const st = streamVan(buf, o);
    if (!st) continue;
    const uit = pakUit(kopVan(o.lijf), st.bytes);
    if (!uit.ok) continue;
    const inhoud = uit.data.toString('latin1');
    if (!/(BT|Tj|TJ)\b/.test(inhoud)) continue;
    const re = /\(((?:\\.|[^\\()])*)\)/g;
    let m;
    while ((m = re.exec(inhoud)) !== null) stukken.push(m[1].replace(/\\([()\\])/g, '$1'));
  }
  return { ok: true, tekst: stukken.join(' '), stukken };
}

/* De tekst PER PAGINA, in de volgorde van de paginaboom. Dit is iets anders
   dan tekstVan(): die veegt alle stromen op en zegt niets over waar iets
   staat. Deze functie loopt de OBJECTGRAAF af -- van de catalogus naar
   /Pages, langs /Kids, en per pagina naar zijn /Contents.

   Dat verschil is niet academisch. Een samenvoeging die vergeet de
   verwijzingen te hernummeren, levert een bestand op waarin alle tekst nog
   aanwezig is (tekstVan ziet hem gewoon) maar waarin de pagina's naar de
   verkeerde inhoud wijzen. Alleen wie de graaf afloopt, ziet dat. */
function perPagina(buf) {
  const d = lees(buf);
  if (!d.ok) return d;
  const opNummer = new Map(d.objecten.map(o => [o.nummer, o]));
  const wortel = d.wortel ? opNummer.get(Number(d.wortel.split(' ')[0])) : null;
  const boomRef = wortel ? /\/Pages\s+(\d+)\s+\d+\s+R/.exec(kopVan(wortel.lijf)) : null;
  const boom = boomRef ? opNummer.get(Number(boomRef[1])) : null;
  if (!boom) return { ok: false, waarom: 'de paginaboom is niet te vinden vanaf de catalogus' };
  const kids = /\/Kids\s*\[([^\]]*)\]/.exec(kopVan(boom.lijf));
  if (!kids) return { ok: false, waarom: 'de paginaboom heeft geen /Kids' };

  const uit = [];
  for (const m of kids[1].matchAll(/(\d+)\s+\d+\s+R/g)) {
    const pagina = opNummer.get(Number(m[1]));
    if (!pagina) { uit.push({ ok: false, waarom: 'pagina-object ' + m[1] + ' bestaat niet' }); continue; }
    const c = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(kopVan(pagina.lijf));
    const stroom = c ? opNummer.get(Number(c[1])) : null;
    if (!stroom) { uit.push({ ok: false, waarom: 'de inhoud van deze pagina is niet te vinden' }); continue; }
    const st = streamVan(buf, stroom);
    const p = st ? pakUit(kopVan(stroom.lijf), st.bytes) : { ok: false };
    if (!p.ok) { uit.push({ ok: false, waarom: 'de inhoudsstroom is niet uit te pakken' }); continue; }
    const inhoud = p.data.toString('latin1');
    const stukken = [];
    for (const t of inhoud.matchAll(/\(((?:\\.|[^\\()])*)\)/g)) stukken.push(t[1].replace(/\\([()\\])/g, '$1'));
    uit.push({ ok: true, tekst: stukken.join(' ') });
  }
  return { ok: true, paginas: uit };
}

module.exports = { lees, tekstVan, perPagina, objecten, kopVan, streamVan, pakUit, isFlate };
