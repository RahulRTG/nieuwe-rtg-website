  /* De vaste-PDA-ingang kent niet alleen de geseede demonstratiezaken. Nieuwe
     partners worden na de eerste geldige roster-opvraag aan de lokale
     schermcatalogus toegevoegd; de server blijft de enige bron van waarheid. */
  const DEMO_BEDRIJVEN = new Set(Object.keys(BEDRIJVEN));
  let demoOmgeving = location.protocol === 'file:';
  const geldigeBedrijfscode = c => /^[A-Z0-9_-]{2,32}$/.test(String(c || '').toUpperCase());

  async function laadOmgeving() {
    if (!(location.protocol === 'http:' || location.protocol === 'https:')) return;
    try {
      const r = await fetch('/api/health');
      const h = r.ok ? await r.json() : null;
      demoOmgeving = !!(h && h.demo);
    } catch (e) { demoOmgeving = false; }
  }

  function onthoudBedrijf(s) {
    if (!s || !geldigeBedrijfscode(s.code)) return null;
    const c = String(s.code).toUpperCase();
    BEDRIJVEN[c] = Object.assign({}, BEDRIJVEN[c] || {}, {
      name: String(s.name || s.naam || c),
      icon: (BEDRIJVEN[c] && BEDRIJVEN[c].icon) || '', type: s.type || ''
    });
    return c;
  }
