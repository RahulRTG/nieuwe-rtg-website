/* De Residence, deelbestand "suite": de eigen suite van een lid en de gids.
   De suite is een leeg raster dat het lid zelf inricht met de RTG
   Maison-catalogus (inbegrepen bij de pas: geen munten, geen koop-lussen).
   De eigenaar zet meubels neer of haalt ze weg, geeft de suite een naam en
   zet hem open of dicht voor bezoek. De gids toont de zalen en de open
   suites met wie er nu is. Krijgt de motor-ctx van residentie/index.js. */
module.exports = (ctx) => {
  const { R, suiteVan, kamer, sein, save, schoon, MEUBELS, ZALEN, SUITE } = ctx;

  function mijnSuite(key, codenaam) {
    const s = suiteVan(key, codenaam);
    return { status: 200, ok: true, suite: { naam: s.naam, open: s.open, adres: 'suite:' + s.codenaam,
      meubels: s.meubels, max: SUITE.maxMeubels }, catalogus: Object.entries(MEUBELS)
      .map(([soort, m]) => ({ soort, naam: m.naam, b: m.b, d: m.d, zit: !!m.zit, vlak: !!m.vlak })) };
  }

  function suiteZet(key, codenaam, body) {
    const s = suiteVan(key, codenaam);
    if (typeof (body || {}).open === 'boolean') s.open = body.open;
    const naam = schoon((body || {}).naam, 24);
    if (naam) s.naam = naam;
    save();
    return { status: 200, ok: true, suite: { naam: s.naam, open: s.open } };
  }

  function meubelZet(key, codenaam, body) {
    const s = suiteVan(key, codenaam);
    const M = MEUBELS[String((body || {}).soort || '')];
    if (!M) return { status: 400, error: 'Dit meubel kent de catalogus niet.' };
    if (s.meubels.length >= SUITE.maxMeubels) return { status: 409, error: 'De suite is vol (' + SUITE.maxMeubels + ' stuks).' };
    const x = Math.round(Number((body || {}).x)), y = Math.round(Number((body || {}).y));
    if (!(x >= 0 && x + M.b <= SUITE.b && y >= 0 && y + M.d <= SUITE.d))
      return { status: 400, error: 'Dat past daar niet; kies een plek binnen de suite.' };
    s.meubels.push({ soort: body.soort, x, y });
    s.leeg = false;
    save();
    sein('suite:' + s.codenaam, 'meubel', { meubels: s.meubels.map(m => [m.soort, m.x, m.y]) });
    return { status: 200, ok: true, meubels: s.meubels };
  }

  function meubelWeg(key, codenaam, body) {
    const s = suiteVan(key, codenaam);
    const i = Math.round(Number((body || {}).i));
    if (!(i >= 0 && i < s.meubels.length)) return { status: 404, error: 'Dit meubel staat er niet (meer).' };
    s.meubels.splice(i, 1);
    if (!s.meubels.length) s.leeg = true; // bewust leeg: niet opnieuw vullen
    save();
    sein('suite:' + s.codenaam, 'meubel', { meubels: s.meubels.map(m => [m.soort, m.x, m.y]) });
    return { status: 200, ok: true, meubels: s.meubels };
  }

  /* de gids: de vaste zalen en de open suites, met wie er nu binnen is */
  function gids() {
    const telErbij = id => Object.keys(kamer(id).leden).length;
    const zalen = Object.entries(ZALEN).map(([id, z]) => ({ id, naam: z.naam, sub: z.sub, aanwezig: telErbij(id) }));
    const suites = Object.values(R().suites)
      .filter(s => s.open)
      .map(s => ({ adres: 'suite:' + s.codenaam, naam: s.naam, van: s.codenaam,
        meubels: s.meubels.length, aanwezig: telErbij('suite:' + s.codenaam) }))
      .sort((a, b) => (b.aanwezig - a.aanwezig) || (b.meubels - a.meubels))
      .slice(0, 30);
    return { status: 200, ok: true, zalen, suites };
  }

  return { mijnSuite, suiteZet, meubelZet, meubelWeg, gids };
};
