/* RTG Festival (deelmodule): HET PRODUCT. Wat er te koop is.

   Afgesplitst van ./rechten.js op de 10 kB-grens, langs een echte naad: daar
   staat wat een RECHT is en hoe een PAS eruitziet, hier staat wat er te KOOP is
   -- prijs, voorraad en bundels. Een product is een verzameling rechten met een
   prijs eromheen, en dus data en geen code: een nieuw pakket verzinnen is een
   regel in een tabel, geen release.

   TWEE LUSSEN WORDEN HIER GEWEIGERD, en dat is de reden dat dit bestand meer
   doet dan velden opslaan. Een bundel die zichzelf bevat is de makkelijke; A
   bevat B en B daarna A is dezelfde lus een stap verderop, en die ziet een
   controle op `o === d.id` niet. Beide gaan langs ./bundel.js, dat de keten
   uitrekent.

   keurRecht komt uit ./rechten.js en wordt LAAT uit de gedeelde context gepakt
   (zie ./index.js voor de volgorde). */
'use strict';

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind } = ctx;

  function productZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const naam = schoon(d.naam, 80);
    if (!naam) return { status: 400, error: 'Geef het product een naam.' };
    const prijs = Number(d.prijs);
    if (!(prijs >= 0) || prijs > 100000) return { status: 400, error: 'Geef een geldige prijs op.' };
    const ruw = Array.isArray(d.rechten) ? d.rechten : [];
    /* Een bundel mag zelf leeg zijn: hij ontleent zijn rechten aan wat erin
       zit. Een LOS product zonder rechten geeft nergens toegang toe. */
    if (!ruw.length && !(Array.isArray(d.onderdelen) && d.onderdelen.length)) {
      return { status: 400, error: 'Een product zonder rechten geeft nergens toegang toe.' };
    }
    if (ruw.length > 50) return { status: 400, error: 'Tot vijftig rechten per product.' };
    const rechten = [];
    for (const r of ruw) {
      const k = ctx.keurRecht(e, r);
      if (k.error) return { status: 400, error: k.error };
      rechten.push(k.recht);
    }
    /* VOORRAAD: null is ongelimiteerd. Wat er al weg is wordt GETELD en niet
       bijgehouden (./verkoop.js) -- een bewaarde teller loopt uit de pas zodra
       er een reservering vervalt. */
    const voorraad = d.voorraad == null || d.voorraad === ''
      ? null : Math.max(0, Math.min(1000000, parseInt(d.voorraad, 10) || 0));

    /* ONDERDELEN maken er een BUNDEL van: die verbruikt ook de voorraad van
       wat erin zit. Zichzelf bevatten mag niet -- ./verkoop.js loopt de keten
       af en zou dan in een lus komen (zelfde les als de terreinboom). */
    const onderdelen = [];
    for (const oid of (Array.isArray(d.onderdelen) ? d.onderdelen.slice(0, 20) : [])) {
      const o = String(oid);
      if (!e.producten[o]) return { status: 404, error: 'Een onderdeel van deze bundel bestaat niet.' };
      if (d.id && o === String(d.id)) return { status: 400, error: 'Een bundel kan zichzelf niet bevatten.' };
      if (!onderdelen.includes(o)) onderdelen.push(o);
    }

    /* EEN LUS OM DE HOEK. Hierboven wordt geweigerd dat een bundel ZICHZELF
       noemt, en dat is niet genoeg: A kan B bevatten en B daarna A. Dat is
       dezelfde lus, alleen een stap verderop. De keten van elk onderdeel wordt
       daarom afgelopen; komt dit product daarin voor, dan zou de bundel rond
       gaan lopen.

       ctx.keten en ctx.ketenDiepte komen uit ./bundel.js en worden LAAT uit de
       gedeelde context gepakt: dat deel wordt na dit deel samengesteld (zie
       ./index.js), dus vroeg uitpakken zou een undefined vasthouden. */
    if (d.id && onderdelen.length && typeof ctx.keten === 'function') {
      for (const oid of onderdelen) {
        const k = ctx.keten(e, oid, new Set());
        if (k && k.has(String(d.id))) {
          return { status: 400, error: 'Dat maakt een lus: dit product zit al in ' + oid + '.' };
        }
      }
    }
    /* En de DIEPTE, ook bij het schrijven -- een bundel die netjes wordt
       aangenomen en daarna nergens meer te lezen is, is een stille fout. */
    if (onderdelen.length && typeof ctx.ketenDiepte === 'function'
        && ctx.ketenDiepte(e, onderdelen, 1) > ctx.KETEN_MAX) {
      return { status: 400, error: 'Een bundel gaat tot ' + ctx.KETEN_MAX + ' lagen diep.' };
    }

    const p = d.id && e.producten[String(d.id)] ? e.producten[String(d.id)]
      : { id: 'prod' + crypto.randomBytes(4).toString('hex') };
    Object.assign(p, { naam, prijs, rechten, voorraad, onderdelen });
    e.producten[p.id] = p;
    save();
    return { ok: true, product: p };
  }

  return { productZet };
};
