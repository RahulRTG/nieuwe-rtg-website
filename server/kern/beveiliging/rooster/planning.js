/* Beveiliging-rooster (deelmodule): budget en urenbewaking, het raster van
   diensten met de open plekken, en diensten zetten/schrappen. Krijgt de
   gedeelde context een keer bij het opstarten vanuit
   kern/beveiliging/rooster.js. */
module.exports = (ctx) => {
  const { db, save, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine,
    BEV_FUNCTIES, BEV_SHIFTS, BEV_ERNST, AANVR_KLAAR,
    id, nu, vandaag, schoon, getal, shiftVan, isBeveiliging, defaults, functieAan,
    diensten, aanvragen, incidenten, rondes, guards, guardNaam, postVan, functieLijst, zetPost } = ctx;
  /* ---- budget: geplande uren x tarief tegen het contractbudget ---- */
  function budget(s, opts) {
    opts = opts || {};
    const b = defaults(s);
    const maand = opts.maand || vandaag().slice(0, 7);   // YYYY-MM
    const tarief = b.budget.tariefUur || 0;
    const budgetUren = b.budget.periodeUren || 0;
    const budgetBedrag = Math.round(budgetUren * tarief);
    const mijn = diensten().filter(d => d.supplierCode === s.code && d.datum.slice(0, 7) === maand && d.status !== 'geannuleerd');
    let urenGepland = 0;
    const perPost = {};
    for (const d of mijn) {
      const sh = shiftVan(d.shiftId); const u = sh ? sh.uren : 0;
      urenGepland += u;
      const pn = (postVan(s, d.postId) || {}).naam || 'Onbekende post';
      perPost[pn] = (perPost[pn] || 0) + u;
    }
    const bestedBedrag = Math.round(urenGepland * tarief);
    const restUren = budgetUren - urenGepland;
    const pct = budgetUren ? Math.round((urenGepland / budgetUren) * 100) : 0;
    const advies = pct >= 100
      ? 'Het budget is op: ' + urenGepland + ' van ' + budgetUren + ' uur gepland. Schrap diensten of vraag budget bij de klant.'
      : pct >= 85
        ? 'Bijna aan het budget (' + pct + '%). Plan de rest van de maand strak en houd overuren tegen.'
        : 'Ruimte in het budget: nog ' + restUren + ' uur (' + (100 - pct) + '%) te plannen deze maand.';
    return {
      maand, tariefUur: tarief, budgetUren, budgetBedrag,
      urenGepland, bestedBedrag, restUren, pct,
      overschrijding: urenGepland > budgetUren,
      perPost: Object.entries(perPost).map(([naam, uren]) => ({ naam, uren, bedrag: Math.round(uren * tarief) })).sort((a, b2) => b2.uren - a.uren),
      advies
    };
  }
  function zetBudget(s, data) {
    const b = defaults(s);
    b.budget.periodeUren = getal(data.periodeUren, 0, 1e6, b.budget.periodeUren || 0);
    b.budget.tariefUur = getal(data.tariefUur, 0, 1e5, b.budget.tariefUur || 0);
    save();
    return { status: 200, ok: true, budget: budget(s) };
  }

  /* ---- rooster: het raster van diensten, plus de open (ongedekte) plekken ---- */
  function dienstPubliek(s, d) {
    const p = postVan(s, d.postId); const sh = shiftVan(d.shiftId);
    return {
      id: d.id, datum: d.datum, shiftId: d.shiftId, shift: sh ? sh.naam : d.shiftId, uren: sh ? sh.uren : 0,
      postId: d.postId, post: p ? p.naam : 'Post', klant: p ? p.klant : '',
      guardId: d.guardId, guardNaam: d.guardNaam || guardNaam(s, d.guardId), status: d.status,
      inklokAt: d.inklokAt || null, uitklokAt: d.uitklokAt || null
    };
  }
  function rooster(s, van, dagen) {
    const b = defaults(s);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(van)) ? van : vandaag();
    const n = getal(dagen, 1, 31, 7);
    // een prefilter over de dienstentabel in plaats van een volledige scan per
    // dag: bij 31 dagen scheelt dat dertig keer door alle diensten lopen
    const eind = new Date(new Date(start).getTime() + (n - 1) * 86400000).toISOString().slice(0, 10);
    const perDag = new Map(); // datum -> diensten van deze zaak
    for (const d of diensten()) {
      if (d.supplierCode !== s.code || d.status === 'geannuleerd') continue;
      if (d.datum < start || d.datum > eind) continue;
      if (!perDag.has(d.datum)) perDag.set(d.datum, []);
      perDag.get(d.datum).push(d);
    }
    const dagenUit = [];
    for (let i = 0; i < n; i++) {
      const datum = new Date(new Date(start).getTime() + i * 86400000).toISOString().slice(0, 10);
      const opDag = perDag.get(datum) || [];
      const posten = b.posten.filter(p => p.actief !== false).map(p => {
        const shifts = (p.shifts && p.shifts.length ? p.shifts : BEV_SHIFTS.map(x => x.id)).map(sid => {
          const bezet = opDag.filter(d => d.postId === p.id && d.shiftId === sid);
          return { shiftId: sid, shift: (shiftVan(sid) || {}).naam || sid, minMan: p.minMan || 1,
            bezet: bezet.map(d => dienstPubliek(s, d)), open: Math.max(0, (p.minMan || 1) - bezet.length) };
        });
        return { postId: p.id, post: p.naam, klant: p.klant, shifts, open: shifts.reduce((t, x) => t + x.open, 0) };
      });
      dagenUit.push({ datum, posten, open: posten.reduce((t, p) => t + p.open, 0) });
    }
    return { van: start, dagen: dagenUit, shifts: BEV_SHIFTS };
  }
  function zetDienst(s, data) {
    if (!functieAan(s, 'rooster')) return { status: 409, error: 'Rooster staat uit in uw boardroom.' };
    const p = postVan(s, String(data.postId || ''));
    if (!p) return { status: 404, error: 'Post niet gevonden.' };
    const sh = shiftVan(String(data.shiftId || ''));
    if (!sh) return { status: 400, error: 'Onbekende shift.' };
    const datum = String(data.datum || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { status: 400, error: 'Kies een datum.' };
    const gid = Number(data.guardId);
    if (!guards(s).some(g => g.id === gid)) return { status: 404, error: 'Beveiliger niet in het team.' };
    // geen dubbele dienst in dezelfde shift, en rust: niet ook de aangrenzende shift
    const zelfde = diensten().find(d => d.supplierCode === s.code && d.datum === datum && d.guardId === gid && d.shiftId === sh.id && d.status !== 'geannuleerd');
    if (zelfde) return { status: 409, error: guardNaam(s, gid) + ' staat al op deze shift.' };
    const dienst = { id: id('d'), supplierCode: s.code, datum, shiftId: sh.id, postId: p.id,
      guardId: gid, guardNaam: guardNaam(s, gid), status: 'gepland', at: nu() };
    diensten().unshift(dienst);
    db.data.bevDiensten = diensten().slice(0, 100000);
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, dienst: dienstPubliek(s, dienst) };
  }
  function schrapDienst(s, dienstId) {
    const d = diensten().find(x => x.id === dienstId && x.supplierCode === s.code);
    if (!d) return { status: 404, error: 'Dienst niet gevonden.' };
    if (d.status === 'ingeklokt') return { status: 409, error: 'Deze bewaker is ingeklokt; eerst uitklokken.' };
    d.status = 'geannuleerd';
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true };
  }
  return { budget, zetBudget, dienstPubliek, rooster, zetDienst, schrapDienst };
};
