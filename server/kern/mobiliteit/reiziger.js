/* De reizigersingangen van Mobility OS. De motor wordt in index.js gebouwd;
   hier wordt dat ene model tot antwoorden voor het ledenkanaal samengesteld. */
'use strict';

module.exports = function maakReiziger({ ctx, schoon }) {
  /* Wat een reiziger te kiezen heeft, hier, nu. Dit antwoord bouwt de app uit
     de actuele modules op, zodat de keuzes nooit naast het register bestaan. */
  function mobAanbod(waar = {}) {
    const uit = [];
    for (const [cat, c] of Object.entries(ctx.CATEGORIEEN)) {
      const m = ctx.modAan(c.module, waar);
      if (!m.aan) continue;
      uit.push({ categorie: cat, naam: c.naam, laag: c.laag, boeking: c.boeking, module: c.module,
        plaatsen: c.plaatsen, bagage: c.bagage, rolstoel: !!c.rolstoel });
    }
    /* Charter hoort bij elk voertuig dat op aanvraag te boeken is. Voor de
       overige ritsoorten bepaalt het centrale register de vereiste module. */
    const soorten = ctx.RITSOORTEN.filter(r => {
      if (r === 'charter') return uit.some(c => c.boeking === 'aanvraag');
      const modId = ctx.moduleVoor(r, null);
      return modId ? ctx.modAan(modId, waar).aan : false;
    });
    return { ok: true, waar, categorieen: uit, ritsoorten: soorten,
      direct: uit.filter(c => c.boeking === 'direct'),
      opAanvraag: uit.filter(c => c.boeking === 'aanvraag'),
      ervaringen: uit.filter(c => c.boeking === 'ervaring') };
  }

  function mobMijn(session) {
    const eigen = ctx.opdrachtenVan(session.key);
    const lopend = eigen.find(o => !['afgerekend', 'geannuleerd', 'voltooid'].includes(o.status)) || null;
    return { ok: true,
      lopend: lopend ? Object.assign(ctx.opdrachtBeeld(lopend, true),
        { positie: lopend.positie || null, mag: ctx.opdrachtVolgende(lopend) }) : null,
      ritten: eigen.slice(0, 25).map(o => ctx.opdrachtBeeld(o)),
      favorieten: ctx.favLijst(session).favorieten };
  }

  function mobVraag(session, body = {}) {
    if (session.tier === 'guest') return { status: 403, error: 'RTG Vervoer is voor leden.' };
    return ctx.opdrachtMaak({ soort: 'lid', key: session.key, session, groep: session.tier,
      org: body.namensOrganisatie ? schoon(body.namensOrganisatie, 20) : null,
      stad: schoon(body.stad, 40) || null }, body);
  }

  /* Alleen de reiziger zelf kan zijn rit annuleren; dispatch heeft een eigen
     ingang met zijn eigen bevoegdheidscontrole. */
  function mobAnnuleer(session, body = {}) {
    const o = ctx.opdrachtMet(schoon(body.ref, 30));
    if (!o) return { status: 404, error: 'Opdracht niet gevonden.' };
    if (o.reiziger !== session.key) return { status: 403, error: 'Dit is uw rit niet.' };
    return ctx.opdrachtAnnuleer(o.ref, 'lid', body.reden);
  }

  return { mobAanbod, mobMijn, mobVraag, mobAnnuleer };
};
