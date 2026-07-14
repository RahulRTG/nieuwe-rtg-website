/* Kern-module "beveiliging": een commandocentrum voor de meest geavanceerde
   beveiligingsteams die met RTG samenwerken. Een handige POS die het zware
   werk overneemt:
   - het ROOSTER: wie staat wanneer op welke post; de AI neemt het over en
     vult de open diensten zelf in (rust tussen diensten, geen dubbeldiensten),
   - het BUDGET: geplande uren x tarief tegen het contractbudget, per post,
     met een waarschuwing zodra het uit de hand loopt,
   - de AANVRAGEN: een klant vraagt inzet aan (object, datum, shift, aantal
     bewakers), het team plant het in een tik in,
   - de POSTEN/objecten die bewaakt worden.

   En een uitgebreide PDA voor de bewaker op straat: eigen diensten, inklokken
   op post met GPS, patrouillerondes met checkpoints, incidenten melden met
   foto, een SOS-noodknop naar RTG-kantoor en de walkie-talkie van het team.

   Elk team zet zijn eigen functies aan en uit (liever te veel dan te weinig).
   maakBeveiliging(state) volgt het vaste kern-patroon. */

// De functies die een beveiligingsteam zelf aan/uit zet. Standaard alles aan.
const BEV_FUNCTIES = [
  { id: 'rooster', naam: 'Rooster & dienstplanning' },
  { id: 'autoplan', naam: 'AI neemt het rooster over' },
  { id: 'budget', naam: 'Budget & urenbewaking' },
  { id: 'aanvragen', naam: 'Inzetaanvragen van klanten' },
  { id: 'posten', naam: 'Posten & objecten' },
  { id: 'patrouille', naam: 'Patrouillerondes met checkpoints' },
  { id: 'incidenten', naam: 'Incidenten & rapportage' },
  { id: 'sos', naam: 'SOS-noodknop naar RTG-kantoor' },
  { id: 'walkie', naam: 'Walkie-talkie' },
  { id: 'toegang', naam: 'Toegangscontrole & bezoekers' },
  { id: 'bodycam', naam: 'Bodycam-momenten vastleggen' },
  { id: 'mandagstaat', naam: 'Mandagstaat (urenstaat per klant)' },
  { id: 'briefing', naam: 'Dagbriefing & standing orders' },
  { id: 'gps', naam: 'Live locatie van actieve diensten' }
];
// Vaste diensten (shifts). Uren tellen mee voor het budget.
const BEV_SHIFTS = [
  { id: 'dag', naam: 'Dag · 07:00-15:00', uren: 8 },
  { id: 'avond', naam: 'Avond · 15:00-23:00', uren: 8 },
  { id: 'nacht', naam: 'Nacht · 23:00-07:00', uren: 8 }
];
const BEV_ERNST = ['laag', 'midden', 'hoog', 'kritiek'];
const AANVR_KLAAR = { gepland: true, afgewezen: true, geannuleerd: true };

function maakBeveiliging({ db, save, crypto, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine }) {
  const id = (p) => (p || 'b') + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : st; };
  const shiftVan = (sid) => BEV_SHIFTS.find(x => x.id === sid) || null;

  function isBeveiliging(s) { return s && s.type === 'beveiliging'; }
  function defaults(s) {
    if (!s.beveiliging || typeof s.beveiliging !== 'object') s.beveiliging = {};
    const b = s.beveiliging;
    if (!b.functies || typeof b.functies !== 'object') b.functies = {};
    for (const f of BEV_FUNCTIES) if (!(f.id in b.functies)) b.functies[f.id] = true;
    if (!Array.isArray(b.posten)) b.posten = [];
    if (!b.budget || typeof b.budget !== 'object') b.budget = { periodeUren: 480, tariefUur: 45 };
    return b;
  }
  function functieAan(s, fid) { return defaults(s).functies[fid] !== false; }

  // gedeelde tabellen
  const diensten = () => { if (!Array.isArray(db.data.bevDiensten)) db.data.bevDiensten = []; return db.data.bevDiensten; };
  const aanvragen = () => { if (!Array.isArray(db.data.bevAanvragen)) db.data.bevAanvragen = []; return db.data.bevAanvragen; };
  const incidenten = () => { if (!Array.isArray(db.data.bevIncidenten)) db.data.bevIncidenten = []; return db.data.bevIncidenten; };
  const rondes = () => { if (!Array.isArray(db.data.bevRondes)) db.data.bevRondes = []; return db.data.bevRondes; };

  function guards(s) { try { return accounts.listStaff(s.code).map(accounts.publicStaff); } catch (e) { return []; } }
  function guardNaam(s, gid) { const g = guards(s).find(x => x.id === gid); return g ? g.name : null; }
  function postVan(s, pid) { return defaults(s).posten.find(p => p.id === pid) || null; }

  /* ---- functies ---- */
  function functieLijst(s) {
    const b = defaults(s);
    return BEV_FUNCTIES.map(f => ({ id: f.id, naam: f.naam, aan: b.functies[f.id] !== false }));
  }
  function zetFunctie(s, fid, aan) {
    if (!BEV_FUNCTIES.some(f => f.id === fid)) return { status: 400, error: 'Onbekende functie.' };
    defaults(s).functies[fid] = aan !== false;
    save();
    return { status: 200, ok: true, functies: functieLijst(s) };
  }

  /* ---- posten/objecten ---- */
  function zetPost(s, data) {
    const b = defaults(s);
    const naam = schoon(data.naam, 80);
    if (!naam) return { status: 400, error: 'Geef een postnaam.' };
    let p = data.id ? b.posten.find(x => x.id === data.id) : null;
    if (!p) { p = { id: id('p') }; b.posten.push(p); }
    p.naam = naam;
    p.adres = schoon(data.adres, 120) || p.adres || '';
    p.klant = schoon(data.klant, 80) || p.klant || '';
    p.lat = Number.isFinite(Number(data.lat)) ? Number(data.lat) : (p.lat != null ? p.lat : null);
    p.lng = Number.isFinite(Number(data.lng)) ? Number(data.lng) : (p.lng != null ? p.lng : null);
    p.minMan = getal(data.minMan, 1, 50, p.minMan || 1);
    p.shifts = Array.isArray(data.shifts) ? data.shifts.filter(x => shiftVan(x)) : (p.shifts || BEV_SHIFTS.map(x => x.id));
    p.orders = schoon(data.orders, 400) || p.orders || '';   // standing orders / briefing per post
    p.actief = data.actief !== false;
    save();
    return { status: 200, ok: true, post: p };
  }
  function verwijderPost(s, pid) {
    const b = defaults(s);
    const i = b.posten.findIndex(p => p.id === pid);
    if (i < 0) return { status: 404, error: 'Post niet gevonden.' };
    b.posten.splice(i, 1);
    save();
    return { status: 200, ok: true };
  }

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
  function mijnDiensten(supplierCode, gid) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { diensten: [], ronde: null };
    const van = vandaag();
    const lijst = diensten()
      .filter(d => d.supplierCode === s.code && d.guardId === gid && d.status !== 'geannuleerd' && d.datum >= van)
      .sort((a, b) => (a.datum + a.shiftId).localeCompare(b.datum + b.shiftId))
      .slice(0, 30).map(d => dienstPubliek(s, d));
    const ronde = rondes().find(r => r.supplierCode === s.code && r.guardId === gid && !r.klaar) || null;
    return { diensten: lijst, ronde: ronde ? rondePubliek(s, ronde) : null, walkie: functieAan(s, 'walkie') };
  }
  function inklok(supplierCode, gid, dienstId, lat, lng) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const d = diensten().find(x => x.id === dienstId && x.supplierCode === s.code && x.guardId === gid);
    if (!d) return { status: 404, error: 'Dienst niet gevonden.' };
    if (d.status === 'afgerond') return { status: 409, error: 'Deze dienst is al afgerond.' };
    d.status = 'ingeklokt'; d.inklokAt = nu();
    if (Number.isFinite(Number(lat))) { d.lat = Number(lat); d.lng = Number(lng); }
    save();
    logActivity(s.code, { name: d.guardNaam || 'Bewaker' }, 'klokte in op ' + ((postVan(s, d.postId) || {}).naam || 'post'));
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, dienst: dienstPubliek(s, d) };
  }
  function uitklok(supplierCode, gid, dienstId) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const d = diensten().find(x => x.id === dienstId && x.supplierCode === s.code && x.guardId === gid);
    if (!d) return { status: 404, error: 'Dienst niet gevonden.' };
    d.status = 'afgerond'; d.uitklokAt = nu();
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, dienst: dienstPubliek(s, d) };
  }

  function rondePubliek(s, r) {
    const p = postVan(s, r.postId);
    return { id: r.id, postId: r.postId, post: p ? p.naam : 'Post', gestart: r.gestart, klaar: r.klaar || null,
      checkpoints: r.checkpoints || [] };
  }
  function rondeStart(supplierCode, gid, postId) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    if (!functieAan(s, 'patrouille')) return { status: 409, error: 'Patrouillerondes staan uit.' };
    if (rondes().some(r => r.supplierCode === s.code && r.guardId === gid && !r.klaar)) return { status: 409, error: 'U heeft al een lopende ronde. Rond die eerst af.' };
    const p = postVan(s, postId); if (!p) return { status: 404, error: 'Post niet gevonden.' };
    const r = { id: id('r'), supplierCode: s.code, postId: p.id, guardId: gid, guardNaam: guardNaam(s, gid), gestart: nu(), klaar: null, checkpoints: [] };
    rondes().unshift(r);
    db.data.bevRondes = rondes().slice(0, 50000);
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, ronde: rondePubliek(s, r) };
  }
  function rondeCheckpoint(supplierCode, gid, rondeId, naam, lat, lng) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const r = rondes().find(x => x.id === rondeId && x.supplierCode === s.code && x.guardId === gid && !x.klaar);
    if (!r) return { status: 404, error: 'Lopende ronde niet gevonden.' };
    r.checkpoints.push({ naam: schoon(naam, 60) || ('Checkpoint ' + (r.checkpoints.length + 1)), at: nu(),
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null });
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, ronde: rondePubliek(s, r) };
  }
  function rondeKlaar(supplierCode, gid, rondeId) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    const r = rondes().find(x => x.id === rondeId && x.supplierCode === s.code && x.guardId === gid && !x.klaar);
    if (!r) return { status: 404, error: 'Lopende ronde niet gevonden.' };
    r.klaar = nu();
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, ronde: rondePubliek(s, r) };
  }

  function incidentPubliek(x) {
    return { id: x.id, postId: x.postId, post: x.postNaam, guardNaam: x.guardNaam, soort: x.soort, ernst: x.ernst,
      tekst: x.tekst, foto: x.foto || null, sos: !!x.sos, status: x.status, lat: x.lat != null ? x.lat : null,
      lng: x.lng != null ? x.lng : null, at: x.at };
  }
  function meldIncident(supplierCode, gid, data) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    if (!functieAan(s, 'incidenten')) return { status: 409, error: 'Incidenten melden staat uit.' };
    const tekst = schoon(data.tekst, 400);
    if (!tekst) return { status: 400, error: 'Beschrijf het incident.' };
    const p = data.postId ? postVan(s, data.postId) : null;
    let foto = null;
    if (typeof data.foto === 'string' && /^data:image\//.test(data.foto) && data.foto.length <= 2 * 1024 * 1024 && functieAan(s, 'bodycam')) foto = data.foto;
    const x = {
      id: id('i'), supplierCode: s.code, postId: p ? p.id : null, postNaam: p ? p.naam : (schoon(data.post, 60) || 'Onbekend'),
      guardId: gid, guardNaam: guardNaam(s, gid), soort: schoon(data.soort, 40) || 'melding',
      ernst: BEV_ERNST.includes(data.ernst) ? data.ernst : 'midden', tekst, foto,
      lat: Number.isFinite(Number(data.lat)) ? Number(data.lat) : null, lng: Number.isFinite(Number(data.lng)) ? Number(data.lng) : null,
      sos: false, status: 'open', at: nu()
    };
    incidenten().unshift(x);
    db.data.bevIncidenten = incidenten().slice(0, 50000);
    save();
    notifySupplier(s.code, { icon: x.ernst === 'kritiek' || x.ernst === 'hoog' ? '🚨' : '📋', title: 'Incident · ' + x.ernst, body: x.guardNaam + ' @ ' + x.postNaam + ': ' + tekst.slice(0, 80) });
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    if (x.ernst === 'kritiek' || x.ernst === 'hoog') sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, incident: incidentPubliek(x) };
  }
  function beslisIncident(s, incidentId) {
    const x = incidenten().find(i => i.id === incidentId && i.supplierCode === s.code);
    if (!x) return { status: 404, error: 'Incident niet gevonden.' };
    x.status = x.status === 'open' ? 'afgehandeld' : 'open';
    save();
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, status2: x.status };
  }
  /* SOS: de noodknop van de bewaker. Meteen een kritiek incident, melding aan
     het team EN aan RTG-kantoor met de live locatie. */
  function sos(supplierCode, gid, lat, lng) {
    const s = findSupplier(supplierCode); if (!isBeveiliging(s)) return { status: 404, error: 'Team niet gevonden.' };
    if (!functieAan(s, 'sos')) return { status: 409, error: 'De SOS-knop staat uit.' };
    const naam = guardNaam(s, gid) || 'Bewaker';
    const x = {
      id: id('i'), supplierCode: s.code, postId: null, postNaam: 'SOS', guardId: gid, guardNaam: naam,
      soort: 'sos', ernst: 'kritiek', tekst: 'SOS-noodknop ingedrukt door ' + naam, foto: null,
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      sos: true, status: 'open', at: nu()
    };
    incidenten().unshift(x);
    db.data.bevIncidenten = incidenten().slice(0, 50000);
    save();
    notifySupplier(s.code, { icon: '🆘', title: 'SOS · ' + naam, body: 'Noodknop ingedrukt. Bekijk de live locatie en stuur bijstand.' });
    logActivity(s.code, { name: naam }, 'drukte de SOS-noodknop in');
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    sseToOffice('sync', { scope: 'beveiliging' });
    return { status: 200, ok: true, incident: incidentPubliek(x) };
  }

  /* ---- het commandocentrum: alles in een oogopslag ---- */
  function command(s) {
    const b = defaults(s);
    const dag = vandaag();
    const rst = rooster(s, dag, 1).dagen[0];
    const opDienst = diensten().filter(d => d.supplierCode === s.code && d.status === 'ingeklokt')
      .map(d => dienstPubliek(s, d));
    const openVandaag = rst ? rst.open : 0;
    const postenStatus = rst ? rst.posten.map(p => ({ post: p.post, klant: p.klant, open: p.open,
      gedekt: p.shifts.reduce((t, x) => t + x.bezet.length, 0), nodig: p.shifts.reduce((t, x) => t + x.minMan, 0) })) : [];
    const av = aanvraagLijst(s);
    const inc = incidenten().filter(i => i.supplierCode === s.code);
    return {
      team: guards(s).length,
      posten: b.posten.filter(p => p.actief !== false).length,
      postenLijst: b.posten.map(p => ({ id: p.id, naam: p.naam, klant: p.klant || '', minMan: p.minMan || 1, orders: p.orders || '', actief: p.actief !== false })),
      opDienst, openVandaag, postenStatus,
      budget: functieAan(s, 'budget') ? budget(s) : null,
      openAanvragen: av.open.length,
      sosActief: inc.some(i => i.sos && i.status === 'open'),
      incidentenOpen: inc.filter(i => i.status === 'open').length,
      incidenten: inc.slice(0, 12).map(incidentPubliek),
      rondesActief: rondes().filter(r => r.supplierCode === s.code && !r.klaar).map(r => rondePubliek(s, r)),
      functies: functieLijst(s)
    };
  }

  return {
    BEVEILIGING_FUNCTIES: BEV_FUNCTIES, BEVEILIGING_SHIFTS: BEV_SHIFTS, BEVEILIGING_ERNST: BEV_ERNST,
    bevIsBeveiliging: isBeveiliging, bevDefaults: defaults, bevFunctieAan: functieAan,
    bevFunctieLijst: functieLijst, bevZetFunctie: zetFunctie,
    bevPosten: (s) => defaults(s).posten, bevZetPost: zetPost, bevVerwijderPost: verwijderPost,
    bevBudget: budget, bevZetBudget: zetBudget,
    bevRooster: rooster, bevZetDienst: zetDienst, bevSchrapDienst: schrapDienst, bevPlanAuto: planAuto,
    bevAanvraag: aanvraag, bevAanvraagLijst: aanvraagLijst, bevBeslisAanvraag: beslisAanvraag,
    bevMijnDiensten: mijnDiensten, bevInklok: inklok, bevUitklok: uitklok,
    bevRondeStart: rondeStart, bevRondeCheckpoint: rondeCheckpoint, bevRondeKlaar: rondeKlaar,
    bevMeldIncident: meldIncident, bevBeslisIncident: beslisIncident, bevSos: sos,
    bevCommand: command
  };
}

module.exports = { BEVEILIGING_FUNCTIES: BEV_FUNCTIES, BEVEILIGING_SHIFTS: BEV_SHIFTS, maakBeveiliging };
