/* Mobility OS (deelmodule): hoe een kaartje eruitziet. Het beeld voor de
   reiziger, zijn eigen kaartjes, en wat er op een lijn te koop is. De uitgifte
   staat in ./kaartje.

   Afgesplitst omdat het geheel over de 10 kB-grens liep. De naad valt waar hij
   hoort: hierboven wordt er een vervoerbewijs gemaakt, hier wordt er een
   getoond. */
module.exports = (ctx) => {
  const { schoon, findSupplier, modAan, magVerkopen, kaartenVan, kaartStand, KAART_PRODUCTEN: PRODUCTEN } = ctx;

  /* Wat de reiziger ziet. `eigen` geeft de CODE erbij -- die is het kaartje, en
     hoort alleen bij de eigenaar en bij het personeel dat hem controleert. */
  function kaartBeeld(k, eigen) {
    const p = PRODUCTEN[k.product] || {};
    const st = kaartStand(k);
    const b = { id: k.id, product: k.product, productNaam: p.naam || k.product,
      vervoerder: k.vervoerder, vervoerderNaam: k.vervoerderNaam,
      lijnId: k.lijnId, lijnNaam: k.lijnNaam, soort: k.soort,
      van: k.van, naar: k.naar, km: k.km, prijs: k.prijs,
      geldigVan: k.geldigVan, geldigTot: k.geldigTot,
      stand: st.stand, reden: st.reden, rittenOver: st.rittenOver != null ? st.rittenOver : 0,
      validaties: (k.validaties || []).map(v => ({ at: v.at, lijn: v.lijnNaam || null })),
      terugbetaald: k.terugbetaald || null, gekocht: k.gekocht };
    if (eigen) b.code = k.code;
    return b;
  }

  /* De losse kaartjes. Abonnementen liggen in DEZELFDE voorraad (zodat de
     conducteur langs een weg controleert), maar ze horen hier niet in de lijst:
     ze hebben hun eigen blok met hun eigen looptijd, en anders staat hetzelfde
     ding twee keer op het scherm. */
  const kaartMijn = session => ({ ok: true,
    kaartjes: kaartenVan(session.key).filter(k => k.product !== 'abonnement')
      .slice(-25).reverse().map(k => kaartBeeld(k, true)) });

  /* Wat er te koop is op een lijn, met de reden erbij als er niets te koop is.
     Dit voedt het scherm: een lege lijst zonder uitleg leest als een storing. */
  function kaartAanbod(session, body = {}) {
    const zaak = findSupplier(schoon(body.vervoerder, 20));
    if (!zaak || zaak.type !== 'ov') return { status: 404, error: 'Onbekende OV-vervoerder.' };
    const waar = { stad: schoon(body.stad, 40) || zaak.city || null, vervoerder: zaak.code,
      groep: session.tier, key: session.key };
    const m = modAan('public_transport_ticketing', waar);
    const uit = [];
    for (const lijn of zaak.lijnen || []) {
      for (const [prod, p] of Object.entries(PRODUCTEN)) {
        const mag = m.aan ? magVerkopen(zaak.code, lijn.id, prod) : { mag: false, reden: m.reden };
        if (mag.mag) uit.push({ lijnId: lijn.id, lijnNaam: lijn.naam, soort: lijn.soort,
          product: prod, productNaam: p.naam, urenGeldig: p.urenGeldig,
          haltes: (lijn.haltes || []).map(h => ({ id: h.id, naam: h.naam })) });
      }
    }
    return { ok: true, vervoerder: zaak.code, aanbod: uit,
      reden: uit.length ? null : (m.aan ? 'Er is geen geldige overeenkomst die kaartverkoop op deze lijnen dekt.' : m.reden) };
  }
  return { kaartBeeld, kaartMijn, kaartAanbod };
};
