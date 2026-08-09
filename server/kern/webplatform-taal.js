/* Een site lezen in je eigen taal.

   Dit huis doet dat bij berichten al zo: iedereen schrijft de eigen taal,
   iedereen leest de zijne. Voor websites is dat de enige vorm die werkt --
   een ondernemer die zijn site met de hand in zes talen moet bijhouden, doet
   het niet, en dan staat er in vijf talen niets.

   Drie dingen liggen hier vast:

   - EEN NAAM IS GEEN ZIN. De titel van de site en de kop van een hero blijven
     staan zoals ze zijn: dat is de naam van een bedrijf of de codenaam van een
     lid, en die hoort niemand vertaald te zien. Hetzelfde geldt voor een
     bronvermelding bij een citaat, een prijs, en alles wat geen tekst is
     (adressen van beeld, links).
   - HET WORDT GEZEGD. Het antwoord draagt dat het machinevertaald is en uit
     welke taal, zodat het scherm dat kan tonen. Een vertaling die zich
     voordoet als het origineel is een bewering die de maker niet heeft gedaan.
   - HET IS BEGRENSD. Per site vertalen we hooguit een paar honderd unieke
     zinnen; wat daarboven komt blijft in de oorspronkelijke taal staan. Liever
     een halve vertaling dan een pagina die blijft hangen. */
module.exports = ({ vertaler }) => {
  const MAX_UNIEK = 200;

  /* Per bloktype: welke velden lopende tekst zijn. Wat hier niet staat, blijft
     zoals de maker het schreef -- dat is met opzet een witte lijst en geen
     zwarte: een nieuw veld hoort niet per ongeluk mee te gaan. */
  const VELDEN = {
    hero: ['sub', 'knop'],            // kop niet: dat is de naam
    kop: ['tekst'],
    tekst: ['tekst'],
    knop: ['tekst'],                  // href niet
    beeld: ['bijschrift'],            // src niet
    kolommen: ['lk', 'lt', 'rk', 'rt'],
    citaat: ['tekst'],                // bron niet: meestal een mens
    voettekst: ['tekst'],
    formulier: ['kop', 'knop'],
    faq: ['kop'],
    prijzen: ['kop']
  };
  // rijen binnen een blok: welke velden van elke rij tekst zijn (prijs niet)
  const RIJVELDEN = { faq: ['vragen', ['v', 'a']], prijzen: ['regels', ['naam', 'wat']] };

  // alle te vertalen zinnen van een blok verzamelen of terugschrijven
  function loop(blok, doe) {
    (VELDEN[blok.type] || []).forEach(f => { if (typeof blok[f] === 'string') blok[f] = doe(blok[f]); });
    const rij = RIJVELDEN[blok.type];
    if (rij && Array.isArray(blok[rij[0]])) {
      blok[rij[0]] = blok[rij[0]].map(r => {
        const o = Object.assign({}, r);
        rij[1].forEach(f => { if (typeof o[f] === 'string') o[f] = doe(o[f]); });
        return o;
      });
    }
  }

  async function vertaalSite(site, naar) {
    const alle = [];
    const blokken = [...(site.blokken || []), ...(site.paginas || []).flatMap(p => p.blokken || [])];
    // eerst alleen verzamelen, zodat we elke unieke zin een keer vertalen
    blokken.forEach(b => loop(Object.assign({}, b), t => { if (t.trim()) alle.push(t); return t; }));
    const uniek = [...new Set(alle)].slice(0, MAX_UNIEK);
    if (!uniek.length) return { site, vertaald: null };

    const uit = new Map();
    let van = null;
    await Promise.all(uniek.map(async t => {
      try {
        const r = await vertaler.translate(t, naar);
        if (r && r.translated) { uit.set(t, r.text); if (!van) van = r.from; }
      } catch (e) { /* deze zin blijft staan zoals hij was */ }
    }));
    if (!uit.size) return { site, vertaald: null };

    const zet = t => uit.get(t) || t;
    const nieuw = Object.assign({}, site, {
      blokken: (site.blokken || []).map(b => { const c = Object.assign({}, b); loop(c, zet); return c; }),
      paginas: (site.paginas || []).map(p => Object.assign({}, p, {
        blokken: (p.blokken || []).map(b => { const c = Object.assign({}, b); loop(c, zet); return c; })
      }))
    });
    // de paginanamen in de navigatie horen ook mee
    await Promise.all(nieuw.paginas.map(async p => {
      try { const r = await vertaler.translate(p.naam, naar); if (r && r.translated) p.naam = r.text; } catch (e) {}
    }));
    return { site: nieuw, vertaald: { naar, van: van || null } };
  }

  return { vertaalSite };
};
