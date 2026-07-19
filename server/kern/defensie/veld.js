/* De defensie-toren, deelbestand "veld": het veldhospitaal (gewondenopvang met
   triage, zelfde kleuren als de SEH, met evacuatie naar een echt ziekenhuis) en de
   verplaatsingen (transport van mensen, materieel en voorraad over land, water of
   lucht). Humanitaire zorg en logistiek, geen gevechtsfunctie. Krijgt de gedeelde ctx
   van kern/defensie/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, schoon, bak, TRIAGE, VERPL_SOORT, VERPL_LADING, VERPL_KETEN } = ctx;

  /* ---------- het veldhospitaal: gewondenopvang met triage ---------- */
  function gewondeMaak(code, b) {
    if (!TRIAGE.includes(b.triage)) return { status: 400, error: 'Kies een triagekleur: rood, oranje, geel, groen of blauw.' };
    const klacht = schoon(b.klacht, 200);
    if (!klacht) return { status: 400, error: 'Wat is het letsel of de klacht?' };
    const g = { id: crypto.randomBytes(4).toString('hex'), aanduiding: schoon(b.aanduiding, 40) || 'gewonde', triage: b.triage, klacht, status: 'wacht', at: nu() };
    bak(code).gewonden.unshift(g);
    if (bak(code).gewonden.length > 300) bak(code).gewonden.pop();
    save();
    return { ok: true, gewonde: g };
  }
  function gewondeZet(code, id, status) {
    const g = bak(code).gewonden.find(x => x.id === id);
    if (!g) return { status: 404, error: 'Deze gewonde staat niet op het bord.' };
    if (!['in-behandeling', 'stabiel', 'ontslagen'].includes(status)) return { status: 400, error: 'Kies in-behandeling, stabiel of ontslagen.' };
    g.status = status;
    save();
    return { ok: true, gewonde: g };
  }
  // markeer een gewonde als geevacueerd (de routelaag maakt de ziekenhuis-SEH aan)
  function gewondeEvac(code, id, ziekenhuisNaam) {
    const g = bak(code).gewonden.find(x => x.id === id);
    if (!g) return { status: 404, error: 'Deze gewonde staat niet op het bord.' };
    if (g.status === 'geevacueerd') return { status: 409, error: 'Deze gewonde is al geevacueerd.' };
    g.status = 'geevacueerd';
    g.naar = schoon(ziekenhuisNaam, 60);
    save();
    return { ok: true, gewonde: g };
  }

  /* ---------- verplaatsingen: mensen, materieel en voorraad verzetten ---------- */
  function verplaatsingMaak(code, b) {
    if (!VERPL_SOORT.includes(b.soort)) return { status: 400, error: 'Kies land, water of lucht.' };
    if (!VERPL_LADING.includes(b.lading)) return { status: 400, error: 'Kies lading: troepen, materieel, gewonden of voorraad.' };
    const van = schoon(b.van, 60), naar = schoon(b.naar, 60);
    if (!van || !naar) return { status: 400, error: 'Vul een vertrek- en aankomstpunt in.' };
    const v = { id: crypto.randomBytes(4).toString('hex'), soort: b.soort, lading: b.lading, van, naar,
      wanneer: schoon(b.wanneer, 40), aantal: schoon(b.aantal, 40), status: 'gepland', at: nu() };
    bak(code).verplaatsingen.unshift(v);
    if (bak(code).verplaatsingen.length > 300) bak(code).verplaatsingen.pop();
    save();
    return { ok: true, verplaatsing: v };
  }
  function verplaatsingZet(code, id, status) {
    const v = bak(code).verplaatsingen.find(x => x.id === id);
    if (!v) return { status: 404, error: 'Deze verplaatsing staat niet op het bord.' };
    if (!VERPL_KETEN.includes(status)) return { status: 400, error: 'Onbekende status.' };
    v.status = status;
    save();
    return { ok: true, verplaatsing: v };
  }

  return { gewondeMaak, gewondeZet, gewondeEvac, verplaatsingMaak, verplaatsingZet };
};
