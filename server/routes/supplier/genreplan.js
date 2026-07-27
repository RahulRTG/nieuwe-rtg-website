/* Supplier-submodule "genreplan": het draaiboek van vandaag voor de acht
   dunnere genres. De genre-motor wordt vertaald naar een geprioriteerde,
   afvinkbare takenlijst (1 = nu, 2 = vandaag, 3 = deze week) plus een
   "dit eerst"-advies. De vinkjes zijn per zaak per dag; om middernacht
   begint het draaiboek schoon. Puur organiseren -- de echte acties
   blijven in de eigen genre-schermen. */
module.exports = (kern) => {
  const { app, db, save, supplierAuth } = kern;

  const vandaag = () => new Date().toISOString().slice(0, 10);
  const overDagen = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const bak = (naam, code) => (db.data[naam] || {})[code] || null;
  const t = (id, prio, tekst) => ({ id, prio, tekst });
  /* Net als de pols: de genre-motor wekken als hij nog nooit is geopend.
     De motoren hangen pas NA deze routes aan de kern -- op aanroepmoment
     via de kern-sleutel pakken, niet destructuren. */
  const MOTOR = { golfclub: ['golfclub', 'golfclub'], fitnessclub: ['fitclub', 'fitclub'], beautysalon: ['beauty', 'beauty'],
    petcare: ['petcare', 'petcare'], kinderopvang: ['opvang', 'opvang'], weddingplanner: ['weddings', 'weddings'],
    marina: ['marina', 'marina'], wintersport: ['alpine', 'alpine'] };
  const wek = (type, code) => {
    const m = MOTOR[type], motor = m && kern[m[0]];
    if (motor && !(db.data[m[1]] || {})[code]) { try { motor.overzicht(code); } catch (e) {} }
  };

  const PLAN = {
    golfclub(c) {
      const g = bak('golfclub', c); if (!g) return null;
      const d = vandaag(), r = [];
      if (g.baanStatus && g.baanStatus !== 'open') r.push(t('baan', 1, 'De baan staat op "' + g.baanStatus + '"; beoordeel of hij weer open kan.'));
      for (const w of (g.wedstrijden || [])) if (w.datum >= d && w.datum <= overDagen(7)) r.push(t('wed-' + w.id, 2, 'Wedstrijd "' + w.naam + '" (' + w.datum + '): baan nalopen, flights indelen, ' + (w.inschrijvingen || []).length + ' inschrijvingen.'));
      for (const l of (g.lessen || [])) if (l.datum === d && l.status !== 'gegeven') r.push(t('les-' + l.id, 2, 'Les van ' + l.naam + ' om ' + l.tijd + '; zet de pro en de mat klaar.'));
      const n = (g.teetimes || []).filter(x => x.datum === d).length;
      if (n) r.push(t('tee', 3, n + ' flights vandaag; ontvang ze bij de caddiemaster.'));
      return r;
    },
    fitnessclub(c) {
      const f = bak('fitclub', c); if (!f) return null;
      const r = [];
      for (const l of (f.lessen || [])) {
        const vol = (l.deelnemers || []).length >= (l.capaciteit || 0);
        if (vol) r.push(t('vol-' + l.id, 2, '"' + l.naam + '" (' + l.tijd + ') zit vol; open een extra tijdslot of een wachtlijst.'));
        else if (!(l.deelnemers || []).length) r.push(t('leeg-' + l.id, 3, '"' + l.naam + '" (' + l.tijd + ') heeft nog geen deelnemers; zet hem in de Salon.'));
      }
      const binnen = (f.leden || []).filter(x => x.binnen).length;
      if (binnen) r.push(t('vloer', 3, binnen + ' leden nu binnen; loop een rondje over de vloer.'));
      return r;
    },
    beautysalon(c) {
      const b = bak('beauty', c); if (!b) return null;
      const d = vandaag(), r = [];
      if ((b.wachtrij || []).length) r.push(t('rij', 1, (b.wachtrij || []).length + ' mensen in de wachtrij; kijk welke stoel eerder vrijkomt.'));
      const af = (b.afspraken || []).filter(a => a.datum === d && a.status !== 'weg').sort((x, y) => String(x.van).localeCompare(String(y.van)));
      for (const a of af.slice(0, 5)) r.push(t('af-' + a.id, 2, a.van + ' ' + (a.behandeling || 'behandeling') + (a.klant ? ' voor ' + a.klant : '') + '; stoel en producten klaar.'));
      if (af.length > 5) r.push(t('af-rest', 2, 'Nog ' + (af.length - 5) + ' afspraken later vandaag; check de agenda.'));
      return r;
    },
    petcare(c) {
      const p = bak('petcare', c); if (!p) return null;
      const d = vandaag(), r = [];
      for (const g of (p.gasten || [])) if (g.tot && g.tot <= d) r.push(t('op-' + g.naam, 1, 'Ophaaldag ' + g.naam + ' (' + g.dier + '); spullen en het baasje-moment klaarzetten.'));
      for (const x of (p.rondes || [])) if (x.status !== 'klaar') r.push(t('ronde-' + x.id, 2, 'Uitlaatronde ' + x.tijd + ' met ' + (x.honden || []).join(', ') + '.'));
      const tr = (p.trim || []).filter(x => x.status !== 'klaar').length;
      if (tr) r.push(t('trim', 2, tr + ' trimbeurt(en) open; plan ze tussen de rondes.'));
      return r;
    },
    kinderopvang(c) {
      const o = bak('opvang', c); if (!o) return null;
      const d = vandaag(), r = [];
      for (const n of (o.nannies || [])) if (!n.gescreend) r.push(t('scr-' + n.id, 1, 'Screening van nanny ' + n.naam + ' afronden; tot die tijd niet inzetten.'));
      for (const g of (o.groepen || [])) if ((g.aanwezig || []).length > (g.capaciteit || 0)) r.push(t('cap-' + g.id, 1, 'Groep "' + g.naam + '" boven capaciteit; direct een extra kracht of verdelen.'));
      for (const a of (o.nannyBoekingen || [])) {
        if (a.status === 'aangevraagd') r.push(t('nb-' + a.id, 2, 'Nanny-aanvraag van ' + a.gezin + ' (' + a.datum + ' ' + a.van + '); wijs een gescreende nanny toe.'));
        else if (a.status === 'bevestigd' && a.datum === d) r.push(t('nbd-' + a.id, 2, 'Nanny ' + (a.nanny || '') + ' vandaag om ' + a.van + ' bij ' + a.gezin + '; even vooraf bellen.'));
      }
      r.push(t('verslag', 3, 'Dagverslagen voor de ouders klaarzetten voor het ophalen.'));
      return r;
    },
    weddingplanner(c) {
      const w = bak('weddings', c); if (!w) return null;
      const d = vandaag(), r = [];
      for (const e of (w.events || [])) {
        const open = (e.taken || []).filter(x => x.status === 'open').length;
        if (e.datum === d) r.push(t('dag-' + e.id, 1, 'Draaidag "' + e.klant + '" op ' + e.locatie + '; het draaiboek is vandaag leidend.'));
        else if (e.datum > d && e.datum <= overDagen(14) && open) r.push(t('taak-' + e.id, 1, open + ' open taken voor "' + e.klant + '" (' + e.datum + '); vandaag wegwerken.'));
        else if (e.status === 'intake') r.push(t('in-' + e.id, 2, 'Intake "' + e.klant + '" (' + e.datum + '): wensen, budget en locatie vastleggen.'));
        else if (open) r.push(t('wk-' + e.id, 3, open + ' taken open voor "' + e.klant + '" (' + e.datum + ').'));
      }
      return r;
    },
    marina(c) {
      const m = bak('marina', c); if (!m) return null;
      const d = vandaag(), r = [];
      for (const p of (m.ligplaatsen || [])) if (p.boot && !p.vast && p.boot.tot && p.boot.tot <= d) r.push(t('uit-' + p.id, 1, 'Vertrek ' + p.boot.naam + ' (' + p.id + '); afrekenen en de plaats vrijmelden.'));
      for (const s of (m.service || [])) if (s.status === 'open') r.push(t('srv-' + s.id, 2, 'Servicekaart ' + s.boot + ': ' + (s.wens || s.soort) + '.'));
      for (const b of (m.brandstof || [])) if (b.status === 'gevraagd') r.push(t('brand-' + b.id, 2, 'Brandstof voor ' + b.boot + ' (' + b.liters + ' l); plan de steiger in.'));
      for (const a of (m.concierge || [])) if (a.status === 'aangevraagd') r.push(t('con-' + a.id, 2, 'Concierge (' + a.soort + ') voor ' + a.voorWie + ' om ' + a.moment + '; een mens bevestigt.'));
      return r;
    },
    wintersport(c) {
      const a = bak('alpine', c); if (!a) return null;
      const d = vandaag(), r = [];
      if ((a.lawine || 0) >= 4) r.push(t('lawine', 1, 'Lawineniveau ' + a.lawine + ': controleer dat alle zwarte pistes dicht zijn en gemarkeerd.'));
      for (const l of (a.liften || [])) if (l.status && l.status !== 'open') r.push(t('lift-' + (l.id || l.naam), 2, 'Lift "' + l.naam + '" staat op "' + l.status + '"; beoordeel de heropening.'));
      for (const l of (a.privelessen || [])) if (l.datum === d && l.status !== 'gegeven') r.push(t('pl-' + l.id, 2, 'Priveles ' + l.naam + ' om ' + l.tijd + ' bij ' + l.instructeur + '.'));
      return r;
    }
  };

  app.post('/api/supplier/puls/plan', supplierAuth, (req, res) => {
    wek(req.supplier.type, req.supplier.code);
    const maak = PLAN[req.supplier.type];
    const taken = maak ? maak(req.supplier.code) : null;
    if (!taken) return res.json({ ok: true, plan: null });
    const d = vandaag();
    const st = ((db.data.genrePlanKlaar || {})[req.supplier.code] || {})[d] || {};
    const lijst = taken.slice(0, 12).map(x => ({ id: x.id, tekst: x.tekst, prio: x.prio, klaar: !!st[x.id] }))
      .sort((a, b) => a.prio - b.prio);
    const open = lijst.filter(x => !x.klaar);
    const advies = open.length ? 'Begin hier: ' + open[0].tekst : 'Alles afgevinkt; de dag is onder controle.';
    res.json({ ok: true, plan: { datum: d, taken: lijst, open: open.length, advies } });
  });

  app.post('/api/supplier/puls/plan/klaar', supplierAuth, (req, res) => {
    const id = String(req.body.taakId || '').slice(0, 60);
    if (!id) return res.status(400).json({ error: 'Welke taak vink je af?' });
    const d = vandaag();
    const m = db.data.genrePlanKlaar = db.data.genrePlanKlaar || {};
    const perZaak = m[req.supplier.code] = m[req.supplier.code] || {};
    for (const k of Object.keys(perZaak)) if (k !== d) delete perZaak[k]; // gisteren opruimen
    const st = perZaak[d] = perZaak[d] || {};
    if (st[id]) delete st[id]; else st[id] = true;
    save();
    res.json({ ok: true, klaar: !!st[id] });
  });
};
