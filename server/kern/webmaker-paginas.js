/* Meerdere pagina's per site: naast de voorpagina (design.blokken) draagt een
   ontwerp extra pagina's, elk met een eigen naam, slug en blokken. Dezelfde
   schoonmaak en dezelfde grenzen als de voorpagina -- een tweede pagina is
   geen achterdeur om meer of viezer op te slaan. */
module.exports = ({ scho, schoonBlok, crypto, slug }) => {
  const MAX_PAGINAS = 7;
  function schoonPaginas(d) {
    if (!Array.isArray(d.paginas)) return undefined;
    const gezien = new Set(['']);   // '' is de voorpagina; die slug kan niet nog eens
    const uit = [];
    d.paginas.slice(0, MAX_PAGINAS).forEach(p => {
      if (!p || typeof p !== 'object') return;
      const naam = scho(p.naam, 40) || 'Pagina';
      let s = slug(p.slug || naam).slice(0, 24);
      if (!s || gezien.has(s)) return;   // dubbele of lege slugs vallen weg
      gezien.add(s);
      uit.push({
        id: scho(p.id, 20) || ('p' + crypto.randomBytes(4).toString('hex')),
        naam, slug: s,
        blokken: (Array.isArray(p.blokken) ? p.blokken : []).slice(0, 60).map(schoonBlok)
      });
    });
    return uit.length ? uit : undefined;
  }
  return { schoonPaginas };
};
