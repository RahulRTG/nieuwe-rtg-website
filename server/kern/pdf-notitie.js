/* PDF: een notitie op een pagina, via een INCREMENTELE UPDATE.

   WAAROM DIT ANDERS SCHRIJFT DAN ./pdf-bouw.js. Samenvoegen en splitsen bouwen
   het hele bestand opnieuw op: elk object hernummerd, een verse paginaboom, een
   nieuwe xref. Dat mag daar, want er komt sowieso een ander document uit.

   Bij annoteren mag dat juist NIET. Wie een opmerking op een contract zet, wil
   dat de rest van het bestand byte voor byte hetzelfde blijft -- de
   handtekening van iemand anders, de opmaak, de metadata. En hij wil kunnen
   aantonen wat er is toegevoegd. Daarom schrijft deze laag de manier waarop het
   formaat dat zelf bedoeld heeft:

     [het originele bestand, ONAANGERAAKT]
     [de nieuwe objecten]
     [een tweede xref-tabel, met /Prev naar de eerste]
     startxref -> de tweede tabel

   Een lezer volgt /Prev terug en ziet beide lagen. Het origineel staat er dus
   letterlijk nog in, en dat is een EIGENSCHAP en geen lek: een annotatie hoort
   het onderliggende stuk niet te wijzigen. Wie iets echt weg wil hebben,
   gebruikt de redactie (./pdf-redactie.js) -- die haalt het uit de bytes en
   geeft een nieuw bestand terug.

   DRIE DINGEN DIE HIER VASTLIGGEN

   1. HET ORIGINEEL BLIJFT DE EERSTE BYTES. Er wordt niets herschreven, niets
      hernummerd en niets weggelaten. Dat is te controleren, en de toets doet
      dat ook: de eerste N bytes zijn gelijk.
   2. NIEUWE OBJECTNUMMERS BEGINNEN NA HET HOOGSTE BESTAANDE. Een bestaand
      object overschrijven zou precies de wijziging zijn die we niet willen.
      Uitzondering: het pagina-object zelf, dat een /Annots-verwijzing nodig
      heeft -- die wordt OPNIEUW GESCHREVEN als nieuwe versie van hetzelfde
      nummer, wat exact is waar een incrementele update voor bestaat.
   3. GEEN NOTITIE OP EEN BESTAND DAT WE NIET BEGRIJPEN. Dezelfde weigering als
      de rest van de laag: versleuteld gaat er niet doorheen. */
'use strict';
const { lees, kopVan } = require('./pdf');

const kap = (s, n) => String(s == null ? '' : s).slice(0, n);
// tekst in een PDF-string: haakjes en backslash moeten ontsnapt
const pdfTekst = (s) => kap(s, 2000).replace(/[\\()]/g, c => '\\' + c).replace(/[\r\n]+/g, ' ');

module.exports = () => {
  /* Een notitie plaatsen. `pagina` telt 1-gebaseerd zoals een mens telt;
     `rechthoek` is [x1, y1, x2, y2] in punten vanaf linksonder. */
  function annoteer(buf, { pagina, tekst, wie, rechthoek } = {}) {
    const d = lees(buf);
    if (!d.ok) return d;
    const t = kap(tekst, 2000).trim();
    if (!t) return { ok: false, waarom: 'wat moet er in de notitie staan?' };

    const paginas = d.objecten.filter(o => /\/Type\s*\/Page\b/.test(kopVan(o.lijf)) && !/\/Type\s*\/Pages\b/.test(kopVan(o.lijf)));
    if (!paginas.length) return { ok: false, waarom: 'dit document bevat geen pagina' };
    const nr = Math.max(1, parseInt(pagina, 10) || 1);
    if (nr > paginas.length) return { ok: false, waarom: 'dit document heeft ' + paginas.length + ' pagina(s); pagina ' + nr + ' bestaat niet' };
    const doel = paginas[nr - 1];

    /* Een object in een objectstream is niet ter plekke te herschrijven -- de
       stream is een geheel. Dat weigeren we met de reden, in plaats van het
       halve werk te doen dat de rest van deze laag juist vermijdt. */
    if (doel.inObjStm != null) {
      return { ok: false, waarom: 'de pagina van dit document zit in een objectstream; deze laag kan daar geen notitie aan hangen zonder het bestand te herschrijven, en dat is precies wat een annotatie niet hoort te doen' };
    }

    const hoogste = d.objecten.reduce((m, o) => Math.max(m, o.nummer), 0);
    const annId = hoogste + 1;
    const r = Array.isArray(rechthoek) && rechthoek.length === 4 && rechthoek.every(x => Number.isFinite(Number(x)))
      ? rechthoek.map(Number) : [72, 720, 92, 740];

    /* Het pagina-object opnieuw, MET /Annots. Een bestaande /Annots-lijst gaat
       mee -- een notitie hoort andermans notities niet weg te gooien. */
    const oudeKop = kopVan(doel.lijf).replace(/^\s*\d+\s+\d+\s+obj\s*/, '');
    const bestaande = /\/Annots\s*\[([^\]]*)\]/.exec(oudeKop);
    const lijst = (bestaande ? bestaande[1].trim() + ' ' : '') + annId + ' 0 R';
    const paginaKop = bestaande
      ? oudeKop.replace(/\/Annots\s*\[[^\]]*\]/, '/Annots [' + lijst + ']')
      : oudeKop.replace(/>>\s*$/, '/Annots [' + lijst + '] >>');

    const nieuw = [];
    const stukken = [];
    let lengte = buf.length;
    const zet = (nummer, tekst2) => {
      nieuw.push({ nummer, plek: lengte });
      const b = Buffer.from(tekst2, 'latin1');
      stukken.push(b);
      lengte += b.length;
    };
    zet(doel.nummer, doel.nummer + ' 0 obj\n' + paginaKop.trim() + '\nendobj\n');
    zet(annId, annId + ' 0 obj\n<< /Type /Annot /Subtype /Text /Rect [' + r.join(' ') + ']' +
      ' /Contents (' + pdfTekst(t) + ')' + (wie ? ' /T (' + pdfTekst(wie) + ')' : '') +
      ' /Name /Comment /F 4 >>\nendobj\n');

    /* De tweede kruisverwijzingstabel. Alleen de gewijzigde objecten staan
       erin, elk als een eigen deelreeks -- dat is wat /Prev mogelijk maakt. */
    const opVolgorde = nieuw.slice().sort((a, b) => a.nummer - b.nummer);
    let tabel = 'xref\n';
    for (const o of opVolgorde) tabel += o.nummer + ' 1\n' + String(o.plek).padStart(10, '0') + ' 00000 n \n';
    const vorige = /startxref\s+(\d+)\s*%%EOF\s*$/.exec(buf.toString('latin1').slice(-2048));
    const prev = vorige ? Number(vorige[1]) : 0;
    const xrefPlek = lengte;
    tabel += 'trailer\n<< /Size ' + (Math.max(hoogste, annId) + 1) +
      (d.wortel ? ' /Root ' + d.wortel + ' R' : '') + ' /Prev ' + prev + ' >>\n' +
      'startxref\n' + xrefPlek + '\n%%EOF\n';
    stukken.push(Buffer.from(tabel, 'latin1'));

    return { ok: true, pagina: nr, annotatie: annId,
      bestand: Buffer.concat([buf, ...stukken]),
      let: 'Het originele bestand staat er onaangeraakt in; hierachter staan alleen de nieuwe objecten en een tweede kruisverwijzing die met /Prev naar de eerste wijst. Wie iets ECHT weg wil hebben, gebruikt de redactie -- die haalt het uit de bytes.' };
  }

  /* De notities van een document teruglezen -- VIA DE PAGINA, want zo doet een
     lezer het ook. Hier stond eerst een scan over alle objecten met /Type
     /Annot, en die vond ze allemaal ongeacht of de pagina er nog naar verwees.
     Een mutatie die de bestaande /Annots-lijst weggooide, beet daardoor niet:
     de notitie stond nog in het bestand maar was in elke echte lezer
     onzichtbaar geworden. Dit loopt nu de lijst af die de pagina draagt. */
  function notities(buf) {
    const d = lees(buf);
    if (!d.ok) return d;
    const opNummer = new Map(d.objecten.map(o => [o.nummer, o]));
    const verwezen = new Set();
    for (const o of d.objecten) {
      if (!/\/Type\s*\/Page\b/.test(kopVan(o.lijf)) || /\/Type\s*\/Pages\b/.test(kopVan(o.lijf))) continue;
      const m = /\/Annots\s*\[([^\]]*)\]/.exec(kopVan(o.lijf));
      if (!m) continue;
      for (const r of m[1].matchAll(/(\d+)\s+\d+\s+R/g)) verwezen.add(Number(r[1]));
    }
    const uit = [];
    for (const nummer of verwezen) {
      const o = opNummer.get(nummer);
      if (!o) continue;
      const kop = kopVan(o.lijf);
      if (!/\/Type\s*\/Annot\b/.test(kop)) continue;
      const c = /\/Contents\s*\(((?:\\.|[^\\()])*)\)/.exec(kop);
      const w = /\/T\s*\(((?:\\.|[^\\()])*)\)/.exec(kop);
      uit.push({ object: o.nummer,
        tekst: c ? c[1].replace(/\\([()\\])/g, '$1') : '',
        wie: w ? w[1].replace(/\\([()\\])/g, '$1') : null });
    }
    return { ok: true, aantal: uit.length, notities: uit };
  }

  return { annoteer, notities };
};
