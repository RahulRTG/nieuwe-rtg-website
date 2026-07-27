/* Supplier-submodule "genrepuls": de genre-pols voor de zaken die nog
   geen eigen plus-laag hadden -- golf, fitclub, beauty, petcare,
   kinderopvang, weddings, marina en alpine. Een route die uit de
   bestaande genre-motor de meters en signalen van vandaag haalt, zodat
   de backoffice van deze zaken dezelfde kantoren-laag voelt als de rest:
   wat loopt er, en wat verdient nu aandacht. Puur lezen; de acties
   blijven in de eigen genre-schermen. */
module.exports = (kern) => {
  const { app, db, supplierAuth } = kern;

  const vandaag = () => new Date().toISOString().slice(0, 10);
  const overDagen = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const bak = (naam, code) => (db.data[naam] || {})[code] || null;

  const PULS = {
    golfclub(c) {
      const g = bak('golfclub', c); if (!g) return null;
      const d = vandaag();
      const tees = (g.teetimes || []).filter(t => t.datum === d).length;
      const s = [];
      if (g.baanStatus && g.baanStatus !== 'open') s.push('De baan staat op "' + g.baanStatus + '"; zet hem terug op open zodra het kan.');
      for (const w of (g.wedstrijden || [])) if (w.datum >= d && w.datum <= overDagen(7)) s.push('Wedstrijd "' + w.naam + '" op ' + w.datum + '; loop de baan en de flights vooruit na.');
      return { meters: [['Starttijden vandaag', tees], ['Lessen geboekt', (g.lessen || []).filter(l => l.status !== 'gegeven').length], ['Baan', g.baanStatus || 'open']], signalen: s };
    },
    fitnessclub(c) {
      const f = bak('fitclub', c); if (!f) return null;
      const s = [];
      for (const l of (f.lessen || [])) {
        if ((l.deelnemers || []).length >= (l.capaciteit || 0)) s.push('Les "' + l.naam + '" (' + l.tijd + ') zit vol; overweeg een extra tijdslot.');
      }
      return { meters: [['Leden', (f.leden || []).length], ['Nu binnen', (f.leden || []).filter(x => x.binnen).length],
        ['Groepslessen', (f.lessen || []).length]], signalen: s };
    },
    beautysalon(c) {
      const b = bak('beauty', c); if (!b) return null;
      const d = vandaag();
      const af = (b.afspraken || []).filter(a => a.datum === d && a.status !== 'weg');
      const s = [];
      if ((b.wachtrij || []).length) s.push((b.wachtrij || []).length + ' mensen in de wachtrij; kijk of een stoel eerder vrijkomt.');
      return { meters: [['Afspraken vandaag', af.length], ['Stoelen', (b.stoelen || []).length], ['Wachtrij', (b.wachtrij || []).length]], signalen: s };
    },
    petcare(c) {
      const p = bak('petcare', c); if (!p) return null;
      const d = vandaag();
      const s = [];
      for (const g of (p.gasten || [])) if (g.tot && g.tot <= d) s.push(g.naam + ' (' + g.dier + ') heeft vandaag de ophaaldag; leg het baasje-moment klaar.');
      return { meters: [['Gasten in huis', (p.gasten || []).length], ['Rondes gepland', (p.rondes || []).filter(r => r.status !== 'klaar').length],
        ['Trim open', (p.trim || []).filter(t => t.status !== 'klaar').length]], signalen: s };
    },
    kinderopvang(c) {
      const o = bak('opvang', c); if (!o) return null;
      const s = [];
      for (const g of (o.groepen || [])) if ((g.aanwezig || []).length > (g.capaciteit || 0)) s.push('Groep "' + g.naam + '" zit boven de capaciteit; dat mag niet -- regel direct een extra kracht of verdeel.');
      for (const n of (o.nannies || [])) if (!n.gescreend) s.push('Nanny ' + n.naam + ' is nog niet gescreend; niet inzetten tot de screening rond is.');
      return { meters: [['Kinderen aanwezig', (o.groepen || []).reduce((n, g) => n + (g.aanwezig || []).length, 0)],
        ['Groepen', (o.groepen || []).length], ['Nannies gescreend', (o.nannies || []).filter(n => n.gescreend).length]], signalen: s };
    },
    weddingplanner(c) {
      const w = bak('weddings', c); if (!w) return null;
      const d = vandaag();
      const s = [];
      for (const e of (w.events || [])) {
        const open = (e.taken || []).filter(t => t.status === 'open').length;
        if (e.datum >= d && e.datum <= overDagen(14) && open) s.push('"' + e.klant + '" (' + e.datum + ') heeft nog ' + open + ' open taken in het draaiboek.');
      }
      return { meters: [['Events komend', (w.events || []).filter(e => e.datum >= d).length],
        ['Open taken', (w.events || []).reduce((n, e) => n + (e.taken || []).filter(t => t.status === 'open').length, 0)],
        ['In intake', (w.events || []).filter(e => e.status === 'intake').length]], signalen: s };
    },
    marina(c) {
      const m = bak('marina', c); if (!m) return null;
      const d = vandaag();
      const bezet = (m.ligplaatsen || []).filter(p => p.boot);
      const s = [];
      for (const p of bezet) if (p.boot.tot && p.boot.tot <= d) s.push(p.boot.naam + ' op ' + p.id + ' heeft vandaag de vertrekdag; meld je bij de schipper.');
      const serviceOpen = (m.service || []).filter(x => x.status === 'open').length;
      if (serviceOpen) s.push(serviceOpen + ' servicekaart(en) staan open op de werf.');
      return { meters: [['Ligplaatsen bezet', bezet.length + ' / ' + (m.ligplaatsen || []).length],
        ['Service open', serviceOpen], ['Vaste liggers', bezet.filter(p => p.vast).length]], signalen: s };
    },
    wintersport(c) {
      const a = bak('alpine', c); if (!a) return null;
      const dicht = (a.pistes || []).filter(p => p.status !== 'open').length;
      const s = [];
      if ((a.lawine || 0) >= 4) s.push('Lawineniveau ' + a.lawine + ': de zwarte pistes horen uit voorzorg dicht.');
      for (const l of (a.liften || [])) if (l.status && l.status !== 'open') s.push('Lift "' + l.naam + '" staat op "' + l.status + '".');
      return { meters: [['Pistes open', ((a.pistes || []).length - dicht) + ' / ' + (a.pistes || []).length],
        ['Lawineniveau', a.lawine || 1], ['Privelessen open', (a.privelessen || []).filter(l => l.status !== 'gegeven').length]], signalen: s };
    }
  };

  app.post('/api/supplier/puls', supplierAuth, (req, res) => {
    const maak = PULS[req.supplier.type];
    const p = maak ? maak(req.supplier.code) : null;
    if (!p) return res.json({ ok: true, puls: null });
    res.json({ ok: true, puls: { genre: req.supplier.type, meters: p.meters, signalen: p.signalen.slice(0, 10).map(t => ({ tekst: t })) } });
  });
};
