/* RTG Atelier -- Website-studio.

   Het ontwerpbureau bouwt hier met de muis een eigen website-sjabloon op uit
   blokken (hero, koppen, tekst, knoppen, beeld, kolommen, galerij, citaat,
   ruimte, voettekst). Deze laag bewaart en levert die sjablonen; ze staan los
   van de echte marketingsite -- het is een eigen ontwerp dat het Atelier kan
   bewaren en als voorbeeld tonen.

   Alles wordt geschoond en begrensd (lengtes, aantallen) zodat er geen rare of
   te grote inhoud in de opslag belandt. Beeld verwacht een eigen RTG-bron
   (campagne of Salon); we bewaren alleen de verwijzing, geen bestanden. */
module.exports = ({ db, save, crypto, schoon }) => {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const TYPES = ['hero', 'kop', 'tekst', 'knop', 'beeld', 'kolommen', 'galerij', 'citaat', 'ruimte', 'voettekst'];
  const VERSIES = ['telefoon', 'tablet', 'desktop']; // op welke versies een blok verborgen mag zijn

  function store() {
    if (!db.data.atelierSites || !Array.isArray(db.data.atelierSites.lijst)) db.data.atelierSites = { lijst: [] };
    return db.data.atelierSites;
  }

  function schoonBlok(b) {
    b = b || {};
    const t = TYPES.includes(b.type) ? b.type : 'tekst';
    const T = (v, n) => scho(v, n || 400);
    const o = { id: scho(b.id, 20) || ('b' + crypto.randomBytes(4).toString('hex')), type: t };
    if (t === 'hero') { o.kop = T(b.kop, 120); o.sub = T(b.sub, 240); o.knop = T(b.knop, 40); }
    else if (t === 'kop') { o.tekst = T(b.tekst, 160); }
    else if (t === 'tekst') { o.tekst = T(b.tekst, 4000); }
    else if (t === 'knop') { o.tekst = T(b.tekst, 40); o.href = T(b.href, 300); }
    else if (t === 'beeld') { o.src = T(b.src, 400); o.bijschrift = T(b.bijschrift, 160); }
    else if (t === 'kolommen') { o.lk = T(b.lk, 80); o.lt = T(b.lt, 1500); o.rk = T(b.rk, 80); o.rt = T(b.rt, 1500); }
    else if (t === 'galerij') { o.beelden = (Array.isArray(b.beelden) ? b.beelden : []).slice(0, 12).map(s => T(s, 400)).filter(Boolean); }
    else if (t === 'citaat') { o.tekst = T(b.tekst, 600); o.bron = T(b.bron, 80); }
    else if (t === 'ruimte') { o.hoogte = Math.max(8, Math.min(240, Number(b.hoogte) || 40)); }
    else if (t === 'voettekst') { o.tekst = T(b.tekst, 400); }
    // op welke versies (telefoon/tablet/desktop) dit blok verborgen is
    if (Array.isArray(b.verberg)) {
      const v = b.verberg.filter(x => VERSIES.includes(x));
      if (v.length) o.verberg = [...new Set(v)];
    }
    return o;
  }

  function bewaar(d) {
    d = d || {};
    const s = store();
    const id = scho(d.id, 20) || ('s' + crypto.randomBytes(5).toString('hex'));
    const design = {
      id,
      titel: scho(d.titel, 80) || 'Naamloos sjabloon',
      thema: ['licht', 'donker'].includes(d.thema) ? d.thema : 'donker',
      accent: /^#[0-9a-fA-F]{6}$/.test(String(d.accent || '')) ? d.accent : '#7F1634',
      blokken: (Array.isArray(d.blokken) ? d.blokken : []).slice(0, 60).map(schoonBlok),
      bij: new Date().toISOString()
    };
    const i = s.lijst.findIndex(x => x.id === id);
    if (i >= 0) design.gemaakt = s.lijst[i].gemaakt || design.bij, s.lijst[i] = design;
    else { design.gemaakt = design.bij; s.lijst.unshift(design); }
    s.lijst = s.lijst.slice(0, 200);
    save();
    return design;
  }

  function lijst() {
    return store().lijst.map(d => ({ id: d.id, titel: d.titel, bij: d.bij, blokken: (d.blokken || []).length }));
  }
  function haal(id) { return store().lijst.find(x => x.id === scho(id, 20)) || null; }
  function verwijder(id) { const s = store(); s.lijst = s.lijst.filter(x => x.id !== scho(id, 20)); save(); return { ok: true }; }

  return { bewaar, lijst, haal, verwijder, TYPES };
};
