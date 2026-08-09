/* Media OS (deelmodule): WIE MAG ER NOG MEER BIJ EEN LIJST.

   Losgehouden van ./lijsten.js omdat het een eigen vraag is -- die gaat over
   het maken en ordenen van een lijst, deze over toegang -- en omdat dat bestand
   er anders over de omvangregel gaat.

   DRIE DINGEN, EN ZE HANGEN AAN EEN REGEL: gedeeld is LEZEN.
     - vindGedeeld: een lijst opzoeken die met MIJ gedeeld is. Bewust een eigen
       functie naast het opzoeken van je eigen lijst: dat verschil is de grens
       tussen kijken en veranderen, en een functie voor allebei laat die grens
       vervagen bij de eerstvolgende wijziging.
     - deel: delen met iemand met wie u VERBONDEN bent. Niet met een vreemde --
       een lijst die bij willekeurige mensen kan landen is een publicatie, en
       daar is dit huis anders voor ingericht.
     - metMij: wat anderen met mij deelden, als een APART veld naast mijn eigen
       lijsten. Niet een lijst met een vlaggetje erbij: het zijn twee
       verschillende dingen, want de ene mag ik veranderen en de andere niet.

   Wat een gedeelde lijst NIET doet, is de stukken meesturen. De ontvanger lost
   de id's op met zijn eigen sessie (./lijsten.js, een()), dus wat voor hem
   dicht staat blijft dicht. Zie test/medialijstdelen.test.js. */
'use strict';

module.exports = ({ tabel, kort, nu, save, codenaamVan, keyVanCodenaam, zijnVrienden, MAX_GEDEELD }) => {
  function vindGedeeld(key, lid) {
    const t = tabel();
    for (const eigenaar of Object.keys(t)) {
      if (eigenaar === key) continue;
      const l = (t[eigenaar] || []).find(x => x.id === String(lid || '') && (x.gedeeld || []).includes(key));
      if (l) return { lijst: l, eigenaar };
    }
    return null;
  }

  /* `vanMij` komt uit ./lijsten.js mee: delen is een handeling van de EIGENAAR,
     en die controle hoort op precies een plek te staan. Hem hier overschrijven
     zou een tweede waarheid over hetzelfde maken (LAT.md regel 4). */
  async function deel(sess, opdracht, vanMij) {
    const o = opdracht || {};
    const m = vanMij(sess, o.id); if (m.fout) return m.fout;
    const l = m.l;
    /* De gids is async en geeft een RIJ terug, geen sleutel. Wie dat vergeet,
       deelt met een Promise en dus met niemand -- zonder dat er iets klaagt. */
    const rij = keyVanCodenaam ? await keyVanCodenaam(String(o.codenaam || '')) : null;
    const doel = rij && rij.key ? rij.key : null;
    if (!doel) return { status: 404, error: 'Deze codenaam kent RTG niet.' };
    if (doel === sess.key) return { status: 400, error: 'Met uzelf delen hoeft niet.' };
    if (zijnVrienden && !zijnVrienden(sess.key, doel))
      return { status: 403, error: 'U kunt alleen delen met iemand met wie u verbonden bent.' };
    l.gedeeld = (l.gedeeld || []).filter(x => x !== doel);
    if (o.aan !== false) {
      if (l.gedeeld.length >= MAX_GEDEELD) return { status: 409, error: 'Deze lijst is al met ' + MAX_GEDEELD + ' mensen gedeeld.' };
      l.gedeeld.push(doel);
    }
    l.bijgewerkt = nu(); save();
    return { status: 200, ok: true, lijst: kort(l) };
  }

  function metMij(key) {
    const t = tabel();
    const uit = [];
    for (const eigenaar of Object.keys(t)) {
      if (eigenaar === key) continue;
      for (const l of (t[eigenaar] || [])) {
        if (!(l.gedeeld || []).includes(key)) continue;
        const k = kort(l);
        delete k.gedeeldMet;            // met wie de EIGENAAR nog meer deelt, gaat de lezer niet aan
        k.van = codenaamVan ? codenaamVan(eigenaar) : null;
        uit.push(k);
      }
    }
    return uit;
  }

  return { vindGedeeld, deel, metMij };
};
