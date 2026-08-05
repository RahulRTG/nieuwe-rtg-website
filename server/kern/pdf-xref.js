/* PDF 1.5 EN LATER: cross-reference streams en objectstreams.

   WAT DIT OPLOST. ./pdf.js weigerde tot vandaag elk bestand met /Type /XRef of
   /Type /ObjStm, met een reden erbij. Dat weigeren was juist -- een halve
   ontleding levert een bestand op dat opent maar stiekem stuk is -- maar het
   raakte wel het MEESTE van wat mensen tegenwoordig aanleveren: sinds PDF 1.5
   (2003) verpakken vrijwel alle schrijvers hun objecten zo.

   WAT ER ECHT ANDERS IS: OBJECTEN ZITTEN IN EEN ANDER OBJECT. Een /ObjStm
   draagt een reeks objecten achter elkaar, met vooraan een lijstje "nummer,
   plek". Die moeten uitgepakt worden voordat je ze kunt lezen. Dat is wat
   hieronder gebeurt.

   WAT WIJ NIET NODIG HEBBEN, EN DAT IS EEN KEUZE VAN ./pdf.js. De
   kruisverwijzing zelf -- de binaire tabel met plekken per object -- wordt hier
   NIET ontleed. Ik had die eerst wel gebouwd (kaartVan, met /W en /Index), tot
   twee mutaties erop niet beten: hij werd nergens aangeroepen. Dat is terecht,
   want ./pdf.js vindt objecten door de bytes af te SCANNEN op "N G obj" en niet
   door plekken op te zoeken -- met de reden die daar staat: in een beschadigd
   bestand is de kruisverwijzing vaak juist het kapotte deel. Een tabel die
   niemand raadpleegt, is geen voorzorg maar ballast, en die is er dus weer
   uitgegaan.

   WAT DEZE LAAG BEWUST NIET DOET: hij SCHRIJFT geen xref-streams. Wat er via
   ./pdf-bouw.js uitkomt is een klassieke tabel -- die is door elke lezer te
   openen, ook door hele oude. Lezen doen we modern, schrijven doen we
   behoudend; dat is bij bestandsformaten bijna altijd de goede kant op.

   EN WAT ER NOG STEEDS WORDT GEWEIGERD: een versleutelde PDF. Daar heeft
   redactie geen betekenis zolang we de inhoud niet kunnen lezen, en dat is
   niet veranderd. */
'use strict';

module.exports = ({ objecten, kopVan, streamVan, pakUit }) => {
  /* De objecten UIT een objectstream halen. Vooraan staat een lijstje
     "nummer plek nummer plek ..." met /N paren, en /First zegt waar de inhoud
     begint. */
  function uitObjStm(buf, obj) {
    const kop = kopVan(obj.lijf);
    const n = Number((/\/N\s+(\d+)/.exec(kop) || [])[1] || 0);
    const eerste = Number((/\/First\s+(\d+)/.exec(kop) || [])[1] || 0);
    if (!n) return { error: 'deze objectstream zegt niet hoeveel objecten hij draagt' };
    const st = streamVan(buf, obj);
    if (!st) return { error: 'de objectstream heeft geen inhoud' };
    const uit = pakUit(kop, st.bytes);
    if (!uit.ok) return { error: 'de objectstream is niet uit te pakken' };
    const tekst = uit.data.toString('latin1');
    const koppen = tekst.slice(0, eerste).trim().split(/\s+/).map(Number);
    const rijen = [];
    for (let i = 0; i < n; i++) {
      const nummer = koppen[i * 2], plek = koppen[i * 2 + 1];
      if (!Number.isFinite(nummer) || !Number.isFinite(plek)) continue;
      const volgend = (i + 1 < n && Number.isFinite(koppen[i * 2 + 3])) ? eerste + koppen[i * 2 + 3] : tekst.length;
      rijen.push({ nummer, generatie: 0, lijf: tekst.slice(eerste + plek, volgend), inObjStm: obj.nummer });
    }
    return { ok: true, objecten: rijen };
  }

  /* Alle objecten van een modern bestand: de losse (die ./pdf.js al vindt door
     te scannen) plus alles wat in objectstreams zit. De losse WINNEN bij een
     botsing -- een los object is een latere schrijfactie dan de stream waar
     hetzelfde nummer in zat, en dat is precies wat een incrementele update doet. */
  function alleObjecten(buf) {
    const los = objecten(buf);
    const uit = los.slice();
    const bekend = new Set(los.map(o => o.nummer));
    const fouten = [];
    for (const o of los) {
      if (!/\/Type\s*\/ObjStm/.test(kopVan(o.lijf))) continue;
      const r = uitObjStm(buf, o);
      if (r.error) { fouten.push('objectstream ' + o.nummer + ': ' + r.error); continue; }
      for (const x of r.objecten) if (!bekend.has(x.nummer)) { uit.push(x); bekend.add(x.nummer); }
    }
    return { objecten: uit, fouten };
  }

  // draagt dit bestand een moderne kruisverwijzing?
  const modern = (tekst) => /\/Type\s*\/XRef/.test(tekst) || /\/Type\s*\/ObjStm/.test(tekst);

  return { uitObjStm, alleObjecten, modern };
};
