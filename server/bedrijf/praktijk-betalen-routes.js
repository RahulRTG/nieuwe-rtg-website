'use strict';
module.exports = ({ app, db, kern }, deel, betalen, stuur) => {
  const weg = { status:404, error:'Deze link is verlopen, ingetrokken of niet geldig.' };
  async function actueel() {
    if (typeof db.verversVerzoekCollectie === 'function') {
      for (const c of ['tenants','werkruimtes','betaalWaarheid','betaalWaarheidMeldingen']) await db.verversVerzoekCollectie(c);
    } else if (process.env.NODE_ENV === 'production') throw new Error('Actuele betaalbevoegdheid ontbreekt');
  }
  app.post('/api/werk-gast/betaling/start', async (req,res) => {
    await actueel(); let r;
    await kern.bijeen(() => {
      const g = deel.gast(req.body || {});
      r = g ? betalen.voorbereid(g,req.body || {}) : weg;
    }, { duurzaam:true });
    if (!r.ok) return stuur(res,r);
    try {
      // Ontvanger, bedrag, provideropties en hervatsleutel zijn al duurzaam.
      const uit = await kern.betaalWaarheid.begin(r.id,{});
      return stuur(res,{ ok:true, ...uit });
    } catch (_) {
      return stuur(res,{ status:502, error:'De betaalprovider gaf nog geen uitsluitsel. Vernieuw de betaalstatus; start geen andere betaling.' });
    }
  });
  app.post('/api/werk-gast/betaling/status', async (req,res) => {
    await actueel();
    const g = deel.gast(req.body || {}); if (!g) return stuur(res,weg);
    const r = betalen.record(g.w,g.p,g.x);
    if (r?.providerId && ['WACHT_OP_KLANT','IN_BEHANDELING'].includes(r.status)) {
      try {
        const p = await kern.betaal.haalBetaling(r.provider,r.providerId);
        await kern.bijeen(() => kern.betaalWaarheid.providerMelding({
          ...p, providerId:p.id, eventId:'werk-controle:'+p.id+':'+p.status, gebeurtenis:'status.controle'
        }), { duurzaam:true });
      } catch (_) { /* Toon de bekende stand; een mislukte controle bewijst geen betaling. */ }
    }
    // Hercontroleer capability na een trage provider; nooit een ingetrokken link herleven.
    await actueel(); const vers = deel.gast(req.body || {});
    return stuur(res,vers ? { ok:true, betaling:betalen.beeld(vers.w,vers.p,vers.x) } : weg);
  });
};
