/* Beveiliging-rooster: budget en urenbewaking, het dienstrooster, de
   AI-autoplanner en de inzetaanvragen van klanten. Krijgt de gedeelde
   context een keer bij het opstarten vanuit kern/beveiliging.js. */
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

  /* ---- de AI neemt het rooster over: vul de open plekken van een dag ----
     Kiest per open plek een beschikbare bewaker: niet al op die shift, en met
     rust (niet de aangrenzende shift dezelfde dag). Round-robin over het team,
     zodat de uren eerlijk verdeeld worden. */
  const NAAST = { dag: ['nacht', 'avond'], avond: ['dag', 'nacht'], nacht: ['avond', 'dag'] };
  function planAuto(s, datum) {
    if (!functieAan(s, 'autoplan')) return { status: 409, error: 'AI-planning staat uit in uw boardroom.' };
    const dag = /^\d{4}-\d{2}-\d{2}$/.test(String(datum)) ? datum : vandaag();
    const team = guards(s);
    if (!team.length) return { status: 409, error: 'Nog geen beveiligers in het team om in te plannen.' };
    const rst = rooster(s, dag, 1).dagen[0];
    // lopende toewijzing per bewaker die dag (voor rust + eerlijkheid)
    const shiftVanGuard = new Map(); // gid -> Set(shiftId)
    for (const d of diensten().filter(x => x.supplierCode === s.code && x.datum === dag && x.status !== 'geannuleerd')) {
      if (!shiftVanGuard.has(d.guardId)) shiftVanGuard.set(d.guardId, new Set());
      shiftVanGuard.get(d.guardId).add(d.shiftId);
    }
    const urenTeller = new Map(); // gid -> uren deze maand (eerlijk verdelen)
    for (const d of diensten().filter(x => x.supplierCode === s.code && x.datum.slice(0, 7) === dag.slice(0, 7) && x.status !== 'geannuleerd')) {
      urenTeller.set(d.guardId, (urenTeller.get(d.guardId) || 0) + ((shiftVan(d.shiftId) || {}).uren || 0));
    }
    const gemaakt = [];
    let onvervuld = 0;
    for (const post of rst.posten) {
      for (const sl of post.shifts) {
        for (let k = 0; k < sl.open; k++) {
          const kandidaat = team
            .filter(g => {
              const set = shiftVanGuard.get(g.id) || new Set();
              if (set.has(sl.shiftId)) return false;                 // al op deze shift
              for (const nb of (NAAST[sl.shiftId] || [])) if (set.has(nb)) return false; // rust
              return true;
            })
            .sort((a, b2) => (urenTeller.get(a.id) || 0) - (urenTeller.get(b2.id) || 0))[0];
          if (!kandidaat) { onvervuld++; continue; }
          const r = zetDienst(s, { postId: post.postId, shiftId: sl.shiftId, datum: dag, guardId: kandidaat.id });
          if (r.ok) {
            gemaakt.push(r.dienst);
            if (!shiftVanGuard.has(kandidaat.id)) shiftVanGuard.set(kandidaat.id, new Set());
            shiftVanGuard.get(kandidaat.id).add(sl.shiftId);
            urenTeller.set(kandidaat.id, (urenTeller.get(kandidaat.id) || 0) + ((shiftVan(sl.shiftId) || {}).uren || 0));
          } else onvervuld++;
        }
      }
    }
    const uitleg = gemaakt.length
      ? 'De AI vulde ' + gemaakt.length + ' open dienst(en) in op ' + dag + (onvervuld ? ', maar ' + onvervuld + ' plek(ken) bleven open (te weinig beschikbare bewakers, rust bewaakt).' : '. Alle posten gedekt.')
      : (onvervuld ? 'Geen dienst kon ingevuld worden: te weinig beschikbare bewakers met rust tussen de diensten.' : 'Er stonden geen open diensten op ' + dag + '.');
    return { status: 200, ok: true, datum: dag, gemaakt, onvervuld, uitleg };
  }

  /* ---- inzetaanvragen van klanten (en interne extra-mankracht/verlof) ---- */
  function aanvraag(s, data) {
    if (!functieAan(s, 'aanvragen')) return { status: 409, error: 'Aanvragen staan uit in uw boardroom.' };
    const object = schoon(data.object, 80);
    if (!object) return { status: 400, error: 'Geef het object/de locatie.' };
    const datum = String(data.datum || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { status: 400, error: 'Kies een datum.' };
    const sh = shiftVan(String(data.shiftId || 'dag')) || BEV_SHIFTS[0];
    const a = {
      ref: id('AV').toUpperCase(), supplierCode: s.code,
      soort: ['inzet', 'extra', 'verlof'].includes(data.soort) ? data.soort : 'inzet',
      klant: schoon(data.klant, 80) || 'Klant', object,
      datum, shiftId: sh.id, aantal: getal(data.aantal, 1, 50, 1), uren: getal(data.uren, 1, 24, sh.uren),
      tekst: schoon(data.tekst, 400), status: 'nieuw', at: nu(), stappen: [{ status: 'nieuw', at: nu() }]
    };
    aanvragen().unshift(a);
    db.data.bevAanvragen = aanvragen().slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '🛡️', title: 'Nieuwe inzetaanvraag', body: a.klant + ' · ' + object + ' · ' + datum + ' · ' + a.aantal + ' bewaker(s)' });
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, aanvraag: a };
  }
  function aanvraagLijst(s) {
    const mijn = aanvragen().filter(a => a.supplierCode === s.code);
    return { open: mijn.filter(a => !AANVR_KLAAR[a.status]), afgerond: mijn.filter(a => AANVR_KLAAR[a.status]).slice(0, 60) };
  }
  /* Een aanvraag inplannen zet er meteen open diensten voor klaar (een post per
     aanvraag; bestaat de post nog niet, dan maken we hem aan) zodat de planner
     of de AI ze kan vullen. */
  function beslisAanvraag(s, ref, actie, opts) {
    opts = opts || {};
    const a = aanvragen().find(x => x.ref === ref && x.supplierCode === s.code);
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (AANVR_KLAAR[a.status]) return { status: 409, error: 'Deze aanvraag is al afgerond.' };
    if (actie === 'afwijzen') { a.status = 'afgewezen'; }
    else if (actie === 'plan') {
      const b = defaults(s);
      let post = b.posten.find(p => p.naam.toLowerCase() === a.object.toLowerCase());
      if (!post) { const r = zetPost(s, { naam: a.object, klant: a.klant, minMan: a.aantal, shifts: [a.shiftId] }); post = r.post; }
      // markeer de minMan zodat het rooster de open plekken toont
      post.minMan = Math.max(post.minMan || 1, a.aantal);
      if (!post.shifts.includes(a.shiftId)) post.shifts.push(a.shiftId);
      a.postId = post.id; a.status = 'gepland';
      if (opts.autoPlan !== false && functieAan(s, 'autoplan')) planAuto(s, a.datum);
    } else return { status: 400, error: 'Onbekende actie.' };
    a.stappen.push({ status: a.status, at: nu() });
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, status2: a.status };
  }

  /* ---- PDA: de bewaker op straat ---- */
  return { budget, zetBudget, dienstPubliek, rooster, zetDienst, schrapDienst, planAuto, aanvraag, aanvraagLijst, beslisAanvraag };
};
