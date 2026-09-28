/* ZOEKKWALITEIT MEETBAAR MAKEN -- voor de zoekproefset van TOESTEL.md par. 13.

   Twee dingen en niet meer:
     rangorde()  per vraag de notities op volgorde, uit een scorefunctie
     maat()      treffer@1, treffer@3 en MRR, per SOORT vraag en over alles

   En een BASISLIJN zonder model, want een vectorgetal zonder vergelijking zegt
   niets: bm25() is de klassieke woordtelling (k1 1,2, b 0,75) op dezelfde
   normalisering als het vectormodel, zodat het verschil niet uit het knippen
   komt. Een model dat de basislijn niet verslaat op 'omschrijving', verdient
   zijn megabytes niet. Dit is een meetinstrument en woont daarom in scripts/. */
'use strict';
const V = require('../../public/shared/toestel/vector.js');

const woorden = (t) => V.voorknip(V.normaliseer(t)).filter((w) => /[\p{L}\p{N}]/u.test(w));

function bm25(notities) {
  const docs = notities.map((n) => woorden(n.tekst));
  const N = docs.length, gem = docs.reduce((t, d) => t + d.length, 0) / N, df = {};
  docs.forEach((d) => new Set(d).forEach((w) => { df[w] = (df[w] || 0) + 1; }));
  return function score(vraag, i) {
    const d = docs[i], tf = {};
    d.forEach((w) => { tf[w] = (tf[w] || 0) + 1; });
    return woorden(vraag).reduce((s, w) => {
      if (!tf[w]) return s;
      const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
      return s + idf * (tf[w] * 2.2) / (tf[w] + 1.2 * (0.25 + 0.75 * d.length / gem));
    }, 0);
  };
}

/* Gelijke scores worden op id gesorteerd en niet op volgorde van de lijst: een
   methode die niets weet, mag niet toevallig goed scoren doordat het antwoord
   bovenaan de set staat. */
function rangorde(notities, score) {
  return notities.map((n, i) => ({ id: n.id, s: score(i) }))
    .sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1)).map((x) => x.id);
}

/* Reciprocal rank fusion (Cormack e.a. 2009, k = 60): elke lijst geeft een
   notitie 1/(k + plek). Er is niets af te stellen, en dat is met opzet: een
   gewicht tussen model en woordtelling zou op DEZE achttien vragen worden
   afgesteld en daarna op deze achttien vragen worden geprezen. */
function samen(rangordes, k) {
  const K = k || 60, s = {};
  rangordes.forEach((r) => r.forEach((id, p) => { s[id] = (s[id] || 0) + 1 / (K + p + 1); }));
  return Object.keys(s).sort((a, b) => s[b] - s[a] || (a < b ? -1 : 1));
}

function maat(vragen, rangordes) {
  const per = {};
  vragen.forEach((v, i) => {
    const r = rangordes[i], plek = r.findIndex((id) => v.relevant.includes(id));
    [v.soort, 'alles'].forEach((s) => {
      const m = per[s] || (per[s] = { vragen: 0, treffer1: 0, treffer3: 0, rr: 0 });
      m.vragen++;
      if (plek === 0) m.treffer1++;
      if (plek >= 0 && plek < 3) m.treffer3++;
      if (plek >= 0) m.rr += 1 / (plek + 1);
    });
  });
  Object.values(per).forEach((m) => {
    m.treffer1 = +(m.treffer1 / m.vragen).toFixed(3);
    m.treffer3 = +(m.treffer3 / m.vragen).toFixed(3);
    m.mrr = +(m.rr / m.vragen).toFixed(3);
    delete m.rr;
  });
  return per;
}

module.exports = { woorden, bm25, rangorde, samen, maat };
