/* Supplier-submodule "genreblik": de week vooruit voor de acht dunnere
   genres. Vandaag plus zeven dagen op de echte agenda-data van de motor:
   flights en wedstrijden, afspraken, events, vertrek- en ophaaldagen,
   nanny-boekingen en privelessen. Alleen lezen; boeken en verzetten
   blijft in de eigen genre-schermen. */
module.exports = (kern) => {
  const { app, db, supplierAuth } = kern;

  const bak = (naam, code) => (db.data[naam] || {})[code] || null;
  const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  /* Net als de pols: de genre-motor wekken als hij nog nooit is geopend.
     De motoren hangen pas NA deze routes aan de kern -- op aanroepmoment
     via de kern-sleutel pakken, niet destructuren. */
  const WEKKER = { golfclub: 'golfclub', fitnessclub: 'fitclub', beautysalon: 'beauty', petcare: 'petcare',
    kinderopvang: 'opvang', weddingplanner: 'weddings', marina: 'marina', wintersport: 'alpine' };

  const BLIK = {
    golfclub(g, d) {
      const r = [];
      const n = (g.teetimes || []).filter(x => x.datum === d).length;
      if (n) r.push(n + ' flights');
      for (const w of (g.wedstrijden || [])) if (w.datum === d) r.push('Wedstrijd ' + w.naam);
      for (const l of (g.lessen || [])) if (l.datum === d && l.status !== 'gegeven') r.push('Les ' + l.naam + ' ' + l.tijd);
      return r;
    },
    fitnessclub(f) {
      const n = (f.lessen || []).length;
      return n ? [n + ' groepslessen'] : [];
    },
    beautysalon(b, d) {
      const n = (b.afspraken || []).filter(a => a.datum === d && a.status !== 'weg').length;
      return n ? [n + ' afspraken'] : [];
    },
    petcare(p, d) {
      const r = [];
      for (const g of (p.gasten || [])) if (g.tot === d) r.push('Ophaaldag ' + g.naam);
      return r;
    },
    kinderopvang(o, d) {
      const r = [];
      for (const a of (o.nannyBoekingen || [])) if (a.datum === d && a.status !== 'geweigerd') r.push('Nanny bij ' + a.gezin + ' ' + a.van);
      return r;
    },
    weddingplanner(w, d) {
      const r = [];
      for (const e of (w.events || [])) if (e.datum === d) r.push((e.soort || 'event') + ' ' + e.klant);
      return r;
    },
    marina(m, d) {
      const r = [];
      for (const p of (m.ligplaatsen || [])) if (p.boot && !p.vast && p.boot.tot === d) r.push('Vertrek ' + p.boot.naam);
      for (const a of (m.concierge || [])) if (String(a.moment || '').slice(0, 10) === d && a.status !== 'geweigerd') r.push('Concierge ' + a.soort);
      return r;
    },
    wintersport(a, d) {
      const r = [];
      for (const l of (a.privelessen || [])) if (l.datum === d && l.status !== 'gegeven') r.push('Priveles ' + l.naam + ' ' + l.tijd);
      for (const c of (a.chaletBoekingen || [])) if (c.van === d) r.push('Chalet-aankomst ' + (c.naam || ''));
      return r;
    }
  };

  const STORE = { golfclub: 'golfclub', fitnessclub: 'fitclub', beautysalon: 'beauty', petcare: 'petcare',
    kinderopvang: 'opvang', weddingplanner: 'weddings', marina: 'marina', wintersport: 'alpine' };

  app.post('/api/supplier/puls/blik', supplierAuth, (req, res) => {
    const maak = BLIK[req.supplier.type];
    const motor = kern[WEKKER[req.supplier.type]];
    if (maak && motor && !bak(STORE[req.supplier.type], req.supplier.code)) { try { motor.overzicht(req.supplier.code); } catch (e) {} }
    const data = maak ? bak(STORE[req.supplier.type], req.supplier.code) : null;
    if (!maak || !data) return res.json({ ok: true, blik: null });
    const dagen = [];
    for (let i = 0; i < 8; i++) {
      const dt = new Date(Date.now() + i * 86400000);
      const datum = dt.toISOString().slice(0, 10);
      const items = maak(data, datum).slice(0, 4);
      dagen.push({ datum, dag: DAG[dt.getUTCDay()], n: items.length, items });
    }
    res.json({ ok: true, blik: { dagen } });
  });
};
