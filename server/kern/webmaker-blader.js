/* De browser-kant van de Website-maker: leden bekijken en vinden de
   gepubliceerde sites. Staat apart van webmaker.js omdat dit ander werk is
   dan bouwen: hier wordt niets veranderd behalve de bezoekteller, en alles
   wat naar buiten gaat is al online gezet door zijn maker. */
module.exports = ({ store, save, slug, publiek, rijp, meting }) => {
  function gids() {
    return store().lijst.filter(d => d.online && d.adres)
      .sort((a, b) => (b.bezoeken || 0) - (a.bezoeken || 0))
      .slice(0, 200)
      .map(d => ({ adres: d.adres, titel: d.titel, bezoeken: d.bezoeken || 0, blokken: (d.blokken || []).length, zaak: !!d.zaakCode }));
  }
  // het online adres van de site van een zaak (voor zoeken en de actiebalk)
  function adresVanZaak(code) {
    const d = store().lijst.find(x => x.zaakCode === code && x.online && x.adres);
    return d ? d.adres : '';
  }
  /* zoeken over de online sites: titel of adres. Alleen wat toch al in de
     gids staat -- zoeken opent geen offline sites. */
  function zoek(q) {
    const z = String(q || '').toLowerCase().trim();
    if (z.length < 2) return [];
    return store().lijst.filter(d => d.online && d.adres &&
        ((d.titel || '').toLowerCase().includes(z) || d.adres.includes(slug(z))))
      .slice(0, 12)
      .map(d => ({ adres: d.adres, titel: d.titel, bezoeken: d.bezoeken || 0 }));
  }
  // welke zaak hoort bij een online adres (voor het formulier: wie ontvangt)
  function zaakVanAdres(adresIn) {
    const a = slug(adresIn);
    const d = store().lijst.find(x => x.adres === a && x.online);
    return d ? (d.zaakCode || '') : '';
  }
  // welke site staat er op dit adres (voor de formulierteller)
  function idVanAdres(adresIn) {
    const a = slug(adresIn);
    const d = store().lijst.find(x => x.adres === a && x.online);
    return d ? d.id : '';
  }
  // wiens site staat er op dit adres (voor de persoon-balk en het formulier)
  function eigenaarVanAdres(adresIn) {
    const a = slug(adresIn);
    const d = store().lijst.find(x => x.adres === a && x.online);
    return d ? (d.eigenaar || '') : '';
  }
  function open(adresIn, pad, bezoeker) {
    const a = slug(adresIn);
    const d = store().lijst.find(x => x.adres === a && x.online);
    if (!d) return { error: 'Geen RTG-site op dit adres.', status: 404 };
    /* Stond er een publicatie gepland en is dat moment geweest, dan gaat hij
       NU naar buiten -- voordat deze bezoeker de oude stand te zien krijgt.
       De veger doet hetzelfde op een tik, maar een bezoeker hoort niet op een
       tik te hoeven wachten. */
    if (rijp) rijp(d);
    /* Tellen wat er gebeurt, niet wie het deed: de bezoeker gaat hier alleen
       heen om het EIGEN bezoek van de maker niet mee te tellen, en wordt
       nergens bewaard (kern/webmaker-meting.js). */
    if (!bezoeker || bezoeker !== d.eigenaar) d.bezoeken = (d.bezoeken || 0) + 1;
    if (meting) meting.bezoek(d, pad, bezoeker);
    save();
    return { ok: true, site: publiek(d) };
  }
  return { gids, adresVanZaak, zaakVanAdres, eigenaarVanAdres, idVanAdres, zoek, open };
};
