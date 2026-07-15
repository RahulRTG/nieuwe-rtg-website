/* De AI-bedrijfsagent: de zaak koppelt een vaste leverancier (groothandel);
   de AI stelt inkooplijsten voor op basis van de eigen verkoop, de mise en
   place en de verwachte drukte, en maakt een weekroostervoorstel op de
   verwachte drukte per dag. Niets gaat vanzelf de deur uit: de gemachtigde
   (manager) keurt goed, past aan of wijst af. Pas bij akkoord wordt de
   bestelling echt bij de gekoppelde groothandel geplaatst. */

function maakAgent({ db, crypto, findSupplier, notifySupplier, ghBijbestelVoorstel, ghPlaatsBestelling, accounts, weekdagFactor, SHIFT_NAMES, save, logActivity }) {
  const agentVan = s => (s.agent = s.agent || { partnerCode: null, auto: false, voorstellen: [], rooster: null });

  function agentPubliek(s) {
    const a = agentVan(s);
    const g = a.partnerCode ? findSupplier(a.partnerCode) : null;
    return { partnerCode: a.partnerCode, partnerNaam: g ? g.name : null, auto: a.auto,
             voorstellen: a.voorstellen.slice(-10).reverse(), rooster: a.rooster };
  }

  // de vaste leverancier koppelen (of loskoppelen met een lege code)
  function agentKoppel(s, partnerCode, auto) {
    if (partnerCode) {
      const g = findSupplier(partnerCode);
      if (!g || g.type !== 'groothandel') return { status: 404, error: 'Groothandel niet gevonden.' };
    }
    const a = agentVan(s);
    a.partnerCode = partnerCode || null;
    a.auto = !!auto;
    save();
    return { status: 200, ok: true, agent: agentPubliek(s) };
  }

  /* Het inkoopvoorstel: de AI-bijbestellijst van de gekoppelde groothandel
     (verkoop + mise en place van de afgelopen twee weken), opgeschaald met
     de verwachte drukte uit de MEP-voorspelling. */
  function agentVoorstel(s, wie) {
    const a = agentVan(s);
    if (!a.partnerCode) return { status: 409, error: 'Koppel eerst een vaste leverancier (groothandel) in het Kantoor.' };
    const basis = ghBijbestelVoorstel(s, a.partnerCode);
    if (basis.error) return basis;
    const dms = s.dailyMeps || {};
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const plan = dms[morgen] || dms[new Date().toISOString().slice(0, 10)];
    const stoelen = (s.tables || []).reduce((n, t) => n + (t.seats || 0), 0) || 24;
    const factor = plan ? Math.max(0.6, Math.min(2, plan.covers / (stoelen * 2))) : 1;
    const regels = basis.regels.map(r => ({ ...r, aantal: Math.max(1, Math.round(r.aantal * factor)) }));
    const totaal = Math.round(regels.reduce((n, r) => n + r.aantal * r.prijs, 0) * 100) / 100;
    const v = {
      id: crypto.randomBytes(4).toString('hex'), at: new Date().toISOString(), soort: 'inkoop',
      groothandelCode: a.partnerCode, groothandelNaam: basis.groothandelNaam,
      regels: regels.slice(0, 40), totaal,
      uitleg: basis.uitleg + (plan ? ' Aantallen geschaald op de verwachte drukte (' + plan.covers + ' couverts, factor ' + factor.toFixed(1) + ').' : ''),
      status: 'wacht-op-goedkeuring', door: wie || 'AI-agent', ref: null
    };
    a.voorstellen.push(v);
    if (a.voorstellen.length > 20) a.voorstellen = a.voorstellen.slice(-20);
    save();
    notifySupplier(s.code, { icon: '\u{1F9E0}', title: 'AI-inkoopvoorstel', body: regels.length + ' regel(s), € ' + totaal + '. De gemachtigde kan goedkeuren of aanpassen in het Kantoor.' });
    return { status: 200, ok: true, voorstel: v };
  }

  // de gemachtigde beslist: goedkeuren (eventueel met aangepaste regels) of afwijzen
  function agentBeslis(s, id, actie, regels, wie) {
    const a = agentVan(s);
    const v = a.voorstellen.find(x => x.id === id);
    if (!v) return { status: 404, error: 'Voorstel niet gevonden.' };
    if (v.status !== 'wacht-op-goedkeuring') return { status: 409, error: 'Dit voorstel is al behandeld (' + v.status + ').' };
    if (actie === 'afwijzen') {
      v.status = 'afgewezen'; v.doorBeslist = wie || null;
      save();
      return { status: 200, ok: true, voorstel: v };
    }
    const koop = Array.isArray(regels) && regels.length
      ? regels.map(r => ({ productId: r.productId, aantal: Math.max(1, parseInt(r.aantal, 10) || 1) }))
      : v.regels.map(r => ({ productId: r.productId, aantal: r.aantal }));
    const r = ghPlaatsBestelling(v.groothandelCode, { soort: 'partner', id: s.code, naam: s.name }, koop, { bezorgen: true, bron: 'ai-agent' });
    if (r.error) return r;
    v.status = 'besteld'; v.ref = r.order.ref; v.doorBeslist = wie || null;
    save();
    logActivity(s.code, wie || 'manager', 'keurde het AI-inkoopvoorstel goed (' + r.order.ref + ')');
    return { status: 200, ok: true, voorstel: v, order: r.order };
  }

  /* Het AI-weekrooster: de verwachte drukte per dag (weekdagFactor) bepaalt
     de bezetting. Drukke dagen staat iedereen ingepland, rustige dagen
     krijgt het personeel om de beurt vrij; managers draaien overdag. */
  function roosterVoorstel(s) {
    const staff = accounts.listStaff(s.code).map(accounts.publicStaff);
    if (!staff.length) return { status: 409, error: 'Geen personeel gevonden.' };
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.now() + d * 86400000);
      const [factor, label] = weekdagFactor(date);
      const druk = factor >= 1.1;
      const rows = staff.map((m, i) => {
        let shift;
        if (m.role === 'manager') shift = SHIFT_NAMES[0];
        else if (!druk && (i + d) % Math.max(2, staff.length) === 0) shift = SHIFT_NAMES[2];
        else shift = SHIFT_NAMES[(i + d) % 2];
        return { id: m.id, name: m.name, role: m.role, shift };
      });
      days.push({ date: date.toISOString().slice(0, 10), label, factor, staff: rows });
    }
    agentVan(s).rooster = { days, status: 'voorstel', at: new Date().toISOString() };
    save();
    return { status: 200, ok: true, rooster: agentVan(s).rooster };
  }

  function roosterBeslis(s, actie, wie) {
    const a = agentVan(s);
    if (!a.rooster) return { status: 404, error: 'Er ligt geen roostervoorstel.' };
    if (actie === 'afwijzen') { a.rooster = null; save(); return { status: 200, ok: true }; }
    a.rooster.status = 'vast';
    // het vastgestelde rooster wint van het standaardpatroon (zie kern/personeel.js)
    s.roosterVast = {};
    for (const day of a.rooster.days) {
      s.roosterVast[day.date] = {};
      for (const m of day.staff) s.roosterVast[day.date][m.id] = m.shift;
    }
    save();
    logActivity(s.code, wie || 'manager', 'stelde het AI-weekrooster vast');
    return { status: 200, ok: true, rooster: a.rooster };
  }

  return { agentKoppel, agentPubliek, agentVoorstel, agentBeslis, roosterVoorstel, roosterBeslis };
}

module.exports = { maakAgent };
