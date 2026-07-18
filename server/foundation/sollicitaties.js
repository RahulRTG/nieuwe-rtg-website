/* RTFoundation-sollicitaties: de server (routes/member/werk.js) handelt het
   echte solliciteren af (bij de partner), maar controleert eerst hier of het
   gezin-token klopt en bewaart daarna een verwijzing bij het gezin, zodat de
   sollicitant in de app zijn eigen sollicitaties met live status terugziet.
   Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, db, save, nu, G, profielVan, familieVan, isGast, ensureCodenaam, rtfHandle, isBeschermd } = ctx;

  function verifieerProfiel(code, token) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return null;
    const p = profielVan(g, token);
    if (!p) return null;
    if (!isGast(p)) ensureCodenaam(p);
    return { g, p, gast: isGast(p), handle: rtfHandle(g.code, p.id), codenaam: p.codenaam, kind: p.rol === 'kind', beschermd: isBeschermd(p), beheerder: p.rol === 'beheerder' };
  }
  function bewaarSollicitatie(code, profielId, ref) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return false;
    if (!Array.isArray(g.sollicitaties)) g.sollicitaties = [];
    g.sollicitaties.unshift(Object.assign({ profielId, at: nu() }, ref));
    g.sollicitaties = g.sollicitaties.slice(0, 100);
    save();
    return true;
  }
  // heeft dit profiel al op deze vacature gesolliciteerd?
  function alGesolliciteerd(code, profielId, vacatureId) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g || !Array.isArray(g.sollicitaties)) return false;
    return g.sollicitaties.some(s => s.profielId === profielId && s.vacatureId === vacatureId);
  }
  // de eigen sollicitaties van het ingelogde profiel, met de actuele status uit de
  // partneradministratie (db.data.applications).
  router.post('/gezin/sollicitaties', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const lijst = (s.g.sollicitaties || []).filter(x => x.profielId === s.p.id).map(x => {
      let status = 'nieuw';
      const apps = (db.data.applications && db.data.applications[x.supplierCode]) || [];
      const a = apps.find(y => y.id === x.appId);
      if (a) status = a.status; else if (x.appId) status = 'onbekend';
      const chat = (db.data.applyChats && db.data.applyChats[x.appId]) ? x.appId : null;
      return { bedrijf: x.bedrijf, func: x.func, land: x.land || null, landNaam: x.landNaam || null, at: x.at, status, chatId: chat };
    });
    res.json({ sollicitaties: lijst });
  });

  return { verifieerProfiel, bewaarSollicitatie, alGesolliciteerd };
};
