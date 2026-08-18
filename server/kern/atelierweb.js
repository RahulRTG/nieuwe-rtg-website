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
  /* De bloktaal wordt NIET hier geschoond maar in ./webmaker-schoon.js.

     Hier stonden een eigen schoonBlok en schoonVolgorde: teken voor teken
     dezelfde tien takken, dezelfde lengtes, dezelfde verberg- en
     variantenafhandeling als daar. Dat is precies wat de kop van dat bestand
     zegt te willen voorkomen -- "elke ingang die iets van buiten aanneemt loopt
     hier langs, en dat is precies de reden om het op EEN plek te houden". Bij
     twee kopieen van een schoonmaker komt een aangescherpte grens maar op een
     van de twee ingangen terecht, en dat merk je niet.

     Het Atelier kent zijn eigen tien blokken en geeft die mee; die lijst kan
     daar alleen versmallen, nooit verbreden. */
  const ATELIER_TYPES = ['hero', 'kop', 'tekst', 'knop', 'beeld', 'kolommen', 'galerij', 'citaat', 'ruimte', 'voettekst'];
  const { TYPES, schoonBlok, schoonVolgorde } = require('./webmaker-schoon')({ scho, crypto, types: ATELIER_TYPES });

  const FOTO_MAX = 40;        // hoeveel eigen foto's het Atelier in zijn beeldbank houdt
  function store() {
    if (!db.data.atelierSites || !Array.isArray(db.data.atelierSites.lijst)) db.data.atelierSites = { lijst: [] };
    if (!Array.isArray(db.data.atelierSites.fotos)) db.data.atelierSites.fotos = [];
    return db.data.atelierSites;
  }
  // De gedeelde beeldbank van het Atelier: alleen veilige /media-verwijzingen (het
  // scannen en opslaan gebeurt in de route, hier bewaren we alleen de url).
  function fotos() { return store().fotos.slice(); }
  function fotoBewaar(url) {
    if (!/^\/media\/[A-Za-z0-9._-]+$/.test(String(url || ''))) return { error: 'Ongeldige foto.', status: 400 };
    const s = store();
    if (!s.fotos.includes(url)) s.fotos.unshift(url);
    if (s.fotos.length > FOTO_MAX) s.fotos.length = FOTO_MAX;
    save();
    return { ok: true, url, fotos: s.fotos.slice() };
  }
  function fotoWeg(url) { const s = store(); s.fotos = s.fotos.filter(u => u !== url); save(); return { ok: true, fotos: s.fotos.slice() }; }

  function bewaar(d) {
    d = d || {};
    const s = store();
    const id = scho(d.id, 20) || ('s' + crypto.randomBytes(5).toString('hex'));
    const design = {
      id,
      titel: scho(d.titel, 80) || 'Naamloos sjabloon',
      thema: ['licht', 'donker'].includes(d.thema) ? d.thema : 'donker',
      accent: /^#[0-9a-fA-F]{6}$/.test(String(d.accent || '')) ? d.accent : '#7F1634',
      kleuren: (() => {
        const k = d.kleuren; if (!k || typeof k !== 'object') return null;
        const hex = v => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || '')) ? String(v) : null;
        const uit = {}; ['bg', 'txt', 'card'].forEach(n => { const c = hex(k[n]); if (c) uit[n] = c; });
        return Object.keys(uit).length ? uit : null;
      })(),
      blokken: (Array.isArray(d.blokken) ? d.blokken : []).slice(0, 60).map(schoonBlok),
      bij: new Date().toISOString()
    };
    const vg = schoonVolgorde(d, design.blokken); if (vg) design.volgorde = vg;
    const i = s.lijst.findIndex(x => x.id === id);
    // de etalage-stand overleeft het bewerken; publiceren is een aparte handeling
    if (i >= 0 && s.lijst[i].etalage) design.etalage = true;
    if (i >= 0) design.gemaakt = s.lijst[i].gemaakt || design.bij, s.lijst[i] = design;
    else { design.gemaakt = design.bij; s.lijst.unshift(design); }
    s.lijst = s.lijst.slice(0, 200);
    save();
    return design;
  }

  function lijst() {
    return store().lijst.map(d => ({ id: d.id, titel: d.titel, bij: d.bij, blokken: (d.blokken || []).length, etalage: !!d.etalage }));
  }
  function haal(id) { return store().lijst.find(x => x.id === scho(id, 20)) || null; }
  function verwijder(id) { const s = store(); s.lijst = s.lijst.filter(x => x.id !== scho(id, 20)); save(); return { ok: true }; }

  /* De etalage: sjablonen die het Atelier vrijgeeft als startpunt voor
     ledensites. Vrijgeven is een uitdrukkelijke handeling van het kantoor --
     werk in uitvoering blijft binnen. */
  function zetEtalage(id, aan) {
    const d = haal(id);
    if (!d) return { error: 'Sjabloon niet gevonden.', status: 404 };
    d.etalage = !!aan; save();
    return { ok: true, etalage: d.etalage };
  }
  function etalage() {
    return store().lijst.filter(d => d.etalage)
      .map(d => ({ id: d.id, titel: d.titel, thema: d.thema, accent: d.accent, blokken: (d.blokken || []).length }));
  }
  function etalageHaal(id) {
    const d = haal(id);
    if (!d || !d.etalage) return null;   // wat niet in de etalage staat, bestaat buiten het Atelier niet
    return { titel: d.titel, thema: d.thema, accent: d.accent, kleuren: d.kleuren || null, blokken: d.blokken || [], volgorde: d.volgorde || null };
  }

  return { bewaar, lijst, haal, verwijder, zetEtalage, etalage, etalageHaal, fotos, fotoBewaar, fotoWeg, TYPES };
};
