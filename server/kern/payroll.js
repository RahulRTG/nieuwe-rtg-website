/* RTG Payroll: het moderne loonkantoor van de RTG-kantoren. Omdat het
   platform de klok, het rooster en de contracten al kent, kan RTG de
   personeelsbetalingen van de zaken zelf draaien:
   - de LOONRUN per zaak en periode: geklokte uren x uurloon, plus
     vakantiegeld, min loonheffing; de werkgeverslasten komen uit de
     fiscale landtabellen (kern/fiscaal). Elke medewerker krijgt een
     loonstrook; de uitbetaling loopt via de RTG Pay-naad.
   - WIE WERKT WAAR: het kantoor ziet alle medewerkers over alle zaken,
     met een "past het"-signaal op de weekuren (overbelast/rustig/in balans).
   - de MATCHING (een soort Indeed): medewerkers die zichzelf "open voor
     werk" zetten, krijgen bedrijven en vacatures gesuggereerd die bij ze
     passen -- en elke vacature krijgt kandidaat-suggesties. Wie de
     schakelaar uit laat, is voor werkgevers onvindbaar (privacy eerst). */
module.exports = ({ db, save, crypto, accounts, LANDEN, klokVan, openVacatures, findSupplier }) => {
  const rond = n => Math.round(n * 100) / 100;
  const HEFFING = 0.37; // eenvoudige vlakke loonheffing voor de demo-lonen
  const landVan = s => LANDEN[(s.settings && s.settings.land) || 'NL'] || LANDEN.NL;
  const uurloonVan = (s, rol) => {
    const min = landVan(s).uurloonMin || 12;
    return rond(Math.max(min, rol === 'manager' ? min * 1.6 : min * 1.15));
  };

  /* Geklokte uren van een medewerker binnen een periode (YYYY-MM). */
  function urenIn(code, staffId, periode) {
    const ms = ((db.data.klok || {})[code] || [])
      .filter(e => e.staffId === staffId && e.out && String(e.in).slice(0, 7) === periode)
      .reduce((s, e) => s + (new Date(e.out) - new Date(e.in)), 0);
    return Math.round(ms / 360000) / 10;
  }

  /* De loonrun: een periode per zaak, elke medewerker een loonstrook. */
  function loonrun(code, periode, door) {
    if (!/^\d{4}-\d{2}$/.test(String(periode || ''))) return { status: 400, error: 'Kies een periode als 2026-07.' };
    const s = findSupplier(code);
    if (!s) return { status: 404, error: 'Zaak niet gevonden.' };
    const runs = (db.data.payrollRuns = db.data.payrollRuns || {});
    const lijst = (runs[code] = runs[code] || []);
    if (lijst.some(r => r.periode === periode)) return { status: 409, error: 'Deze periode is al gedraaid voor ' + s.name + '.' };
    const land = landVan(s);
    const regels = [];
    for (const m of accounts.listStaff(code)) {
      const uren = urenIn(code, m.id, periode);
      const uurloon = uurloonVan(s, m.role);
      const bruto = rond(uren * uurloon);
      const vakantiegeld = rond(bruto * (land.vakantiegeld || 0.08));
      const loonheffing = rond((bruto + vakantiegeld) * HEFFING);
      const netto = rond(bruto + vakantiegeld - loonheffing);
      regels.push({ staffId: m.id, naam: m.name, rol: m.role, uren, uurloon, bruto, vakantiegeld, loonheffing, netto,
        werkgeverslasten: rond(bruto * (land.lasten || 0.25)) });
    }
    const run = { id: 'pr' + crypto.randomBytes(3).toString('hex'), code, zaak: s.name, periode, land: land.naam,
      regels, totaalNetto: rond(regels.reduce((x, r) => x + r.netto, 0)),
      totaalKosten: rond(regels.reduce((x, r) => x + r.bruto + r.vakantiegeld + r.werkgeverslasten, 0)),
      status: 'uitbetaald via RTG Pay', door: door || 'Payroll', at: new Date().toISOString() };
    lijst.unshift(run); if (lijst.length > 24) lijst.length = 24;
    save();
    return { ok: true, run };
  }

  const runsVan = code => ((db.data.payrollRuns || {})[code] || []);
  const strokenVan = (code, staffId) => runsVan(code)
    .map(r => ({ periode: r.periode, zaak: r.zaak, status: r.status, at: r.at, regel: r.regels.find(x => x.staffId === staffId) }))
    .filter(x => x.regel);

  /* Wie werkt waar: alle medewerkers over alle zaken, met het past-signaal. */
  function wieWerktWaar() {
    const uit = [];
    for (const s of db.data.suppliers) {
      for (const m of accounts.listStaff(s.code)) {
        const week = klokVan(s.code, m.id).weekUren;
        uit.push({ zaak: s.name, code: s.code, stad: s.city, type: s.type, staffId: m.id, naam: m.name, rol: m.role,
          weekUren: week, past: week > 48 ? 'overbelast' : week < 8 ? 'rustig' : 'in balans',
          openVoorWerk: !!openVoor(s.code, m.id) });
      }
    }
    return uit;
  }

  /* Open voor werk: de medewerker kiest ZELF of hij vindbaar is. */
  const sleutel = (code, staffId) => code + ':' + staffId;
  const openVoor = (code, staffId) => (db.data.payrollOpen || {})[sleutel(code, staffId)];
  function zetOpenVoorWerk(code, staffId, aan, wens) {
    const O = (db.data.payrollOpen = db.data.payrollOpen || {});
    if (aan) O[sleutel(code, staffId)] = { aan: true, wens: String(wens || '').slice(0, 120), at: new Date().toISOString() };
    else delete O[sleutel(code, staffId)];
    save();
    return { ok: true, aan: !!aan };
  }

  /* De match-score: vak/functiewoorden, plaats en het past-signaal. */
  function score(profiel, vac) {
    let n = 0;
    const woorden = (profiel.rol + ' ' + (profiel.wens || '') + ' ' + (profiel.type || '')).toLowerCase();
    const vacTekst = (vac.func + ' ' + (vac.omschrijving || '') + ' ' + (vac.typeLabel || '')).toLowerCase();
    for (const w of woorden.split(/[^a-z]+/)) if (w.length > 3 && vacTekst.includes(w)) n += 3;
    if (profiel.stad && vac.plaats && vac.plaats.toLowerCase().includes(String(profiel.stad).toLowerCase())) n += 2;
    if (profiel.past === 'rustig') n += 1; // wie weinig uren maakt, kan er werk bij hebben
    return n;
  }

  /* Kansen voor een medewerker: vacatures van ANDERE zaken die passen. */
  function kansenVoor(code, staffId) {
    const s = findSupplier(code);
    const m = accounts.listStaff(code).find(x => x.id === staffId);
    if (!s || !m) return [];
    const o = openVoor(code, staffId);
    const profiel = { rol: m.role, stad: s.city, type: (db.data.supplierTypes[s.type] || {}).label,
      wens: o && o.wens, past: klokVan(code, staffId).weekUren < 8 ? 'rustig' : 'in balans' };
    return openVacatures(null, null).filter(v => v.supplierCode !== code)
      .map(v => ({ vacature: v, score: score(profiel, v) }))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
  }

  /* Kandidaten voor een vacature: ALLEEN medewerkers die open voor werk staan. */
  function kandidatenVoor(vac) {
    const uit = [];
    for (const p of wieWerktWaar()) {
      if (!p.openVoorWerk || p.code === vac.supplierCode) continue;
      const o = openVoor(p.code, p.staffId) || {};
      const n = score({ rol: p.rol, stad: p.stad, type: p.type, wens: o.wens, past: p.past }, vac);
      if (n > 0) uit.push({ naam: p.naam.split(' ')[0], rol: p.rol, sector: p.type, stad: p.stad, past: p.past, wens: o.wens || '', score: n });
    }
    return uit.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  return { payroll: { loonrun, runsVan, strokenVan, wieWerktWaar, zetOpenVoorWerk, openVoor, kansenVoor, kandidatenVoor } };
};
