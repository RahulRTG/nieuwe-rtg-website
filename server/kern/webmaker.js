/* RTG Website-maker (leden) + de RTG-browser.

   Een lid dat een eigen bedrijf begint, bouwt hier met de muis een website uit
   blokken (dezelfde bloktaal als de Website-studio van het Atelier). Zet hij
   hem "online", dan krijgt de site een RTG-adres (naam.rtg) en verschijnt hij
   in de RTG-browser -- een eigen, besloten web binnen het huis. Geen echte
   domeinen, geen extern hosten: alles blijft in het ecosysteem, op codenaam.

   Alles wordt geschoond en begrensd; beeld verwijst naar eigen RTG-campagne of
   Salon, we bewaren alleen de verwijzing. */
module.exports = ({ db, save, crypto, schoon, media }) => {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const TYPES = ['hero', 'kop', 'tekst', 'knop', 'beeld', 'kolommen', 'galerij', 'citaat', 'ruimte', 'voettekst', 'zaakdata', 'formulier'];
  // de bronnen die een live zaakdata-blok mag aanwijzen (opgelost in kern/webplatform.js)
  const ZAAKBRONNEN = ['menu', 'diensten', 'kamers', 'agenda', 'fotos', 'reviews', 'contact'];
  const VERSIES = ['telefoon', 'tablet', 'desktop'];
  const PER_LID = 12;         // hoeveel sites een lid mag hebben
  const TOTAAL = 20000;       // harde bovengrens op de opslag

  function store() {
    if (!db.data.ledenSites || !Array.isArray(db.data.ledenSites.lijst)) db.data.ledenSites = { lijst: [] };
    if (!db.data.ledenSites.fotos || typeof db.data.ledenSites.fotos !== 'object') db.data.ledenSites.fotos = {};
    return db.data.ledenSites;
  }
  /* De fotobibliotheek staat in ./webmaker-fotos.js: die kant raakt de
     mediastore (een foto die eraf valt of wordt weggehaald, moet ook van
     schijf) en dat is een ander soort werk dan het bouwen van een pagina. */
  const fotolaag = require('./webmaker-fotos')({ store, save, media });
  const { fotos, fotoBewaar, fotoWeg } = fotolaag;
  // meerdere pagina's per site: schoonmaak in ./webmaker-paginas.js
  const paginalaag = require('./webmaker-paginas')({ scho, schoonBlok, crypto, slug });

  function slug(v) {
    return String(v == null ? '' : v).toLowerCase().trim()
      .replace(/^rtg:\/\//, '').replace(/\.rtg$/, '')   // "rtg://naam" of "naam.rtg" mag ook
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
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
    else if (t === 'zaakdata') { o.bron = ZAAKBRONNEN.includes(b.bron) ? b.bron : 'contact'; }
    else if (t === 'formulier') { o.kop = T(b.kop, 120) || 'Stel ons een vraag'; o.knop = T(b.knop, 40) || 'Verstuur'; }
    if (Array.isArray(b.verberg)) {
      const v = b.verberg.filter(x => VERSIES.includes(x));
      if (v.length) o.verberg = [...new Set(v)];
    }
    // per-versie eigen tekst (telefoon/tablet): alleen de tekstvelden die dit blok kent
    if (b.varianten && typeof b.varianten === 'object') {
      const V = {};
      ['telefoon', 'tablet'].forEach(ver => {
        const src = b.varianten[ver];
        if (src && typeof src === 'object') {
          const ov = {};
          Object.keys(o).forEach(k => {
            if (['id', 'type', 'verberg', 'varianten'].includes(k)) return;
            if (typeof o[k] === 'string' && typeof src[k] === 'string') ov[k] = T(src[k], 4000);
          });
          if (Object.keys(ov).length) V[ver] = ov;
        }
      });
      if (Object.keys(V).length) o.varianten = V;
    }
    return o;
  }

  function schoonVolgorde(d, blokken) {
    if (!d.volgorde || typeof d.volgorde !== 'object') return undefined;
    const ids = new Set(blokken.map(b => b.id));
    const V = {};
    ['telefoon', 'tablet'].forEach(ver => {
      const arr = d.volgorde[ver];
      if (!Array.isArray(arr)) return;
      const seen = new Set(); const uit = [];
      arr.forEach(x => { const s = scho(x, 20); if (ids.has(s) && !seen.has(s)) { seen.add(s); uit.push(s); } });
      if (uit.length) V[ver] = uit;
    });
    return Object.keys(V).length ? V : undefined;
  }

  const kort = d => ({ id: d.id, titel: d.titel, adres: d.adres || '', online: !!d.online, bezoeken: d.bezoeken || 0, bij: d.bij, blokken: (d.blokken || []).length });
  // vrije kleuren: alleen echte hex-waarden (#rgb of #rrggbb) worden bewaard;
  // de sleutels die we kennen zijn bg (achtergrond), txt (tekst) en card (kaart).
  // Het accent blijft zijn eigen veld. Ontbreekt een kleur, dan valt de site
  // terug op het thema (licht/donker) -- niets forceren.
  function schoonKleuren(k) {
    if (!k || typeof k !== 'object') return null;
    const hex = v => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || '')) ? String(v) : null;
    const uit = {};
    ['bg', 'txt', 'card'].forEach(n => { const c = hex(k[n]); if (c) uit[n] = c; });
    return Object.keys(uit).length ? uit : null;
  }
  const publiek = d => ({ titel: d.titel, thema: d.thema, accent: d.accent, kleuren: d.kleuren || null, blokken: d.blokken || [], paginas: d.paginas || [], volgorde: d.volgorde || null, adres: d.adres, eigenaar: d.eigenaar, zaakCode: d.zaakCode || '' });

  function mijn(key) { return store().lijst.filter(d => d.eigenaar === key).map(kort); }
  function haal(key, id) { const d = store().lijst.find(x => x.id === scho(id, 20) && x.eigenaar === key); return d || null; }

  /* opts.zaakCode wordt alleen door de zaak-route meegegeven (na supplierAuth):
     dat een site bij een bedrijf hoort is een feit uit de inlog, geen veld dat
     een lid zelf in zijn ontwerp kan zetten. Bij een gewone save blijft de
     bestaande koppeling staan. */
  function bewaar(key, d, opts) {
    d = d || {};
    const s = store();
    let bestaand = null;
    if (d.id) bestaand = s.lijst.find(x => x.id === scho(d.id, 20) && x.eigenaar === key);
    if (!bestaand && s.lijst.filter(x => x.eigenaar === key).length >= PER_LID) {
      return { error: 'Je hebt het maximum aantal websites bereikt. Verwijder er eerst een.', status: 400 };
    }
    const design = {
      id: bestaand ? bestaand.id : ('w' + crypto.randomBytes(5).toString('hex')),
      eigenaar: key,
      titel: scho(d.titel, 80) || 'Mijn website',
      thema: ['licht', 'donker'].includes(d.thema) ? d.thema : 'donker',
      accent: /^#[0-9a-fA-F]{6}$/.test(String(d.accent || '')) ? d.accent : '#7F1634',
      kleuren: schoonKleuren(d.kleuren),
      blokken: (Array.isArray(d.blokken) ? d.blokken : []).slice(0, 60).map(schoonBlok),
      zaakCode: (opts && opts.zaakCode) ? scho(opts.zaakCode, 30) : (bestaand ? (bestaand.zaakCode || '') : ''),
      adres: bestaand ? (bestaand.adres || '') : '',
      online: bestaand ? !!bestaand.online : false,
      bezoeken: bestaand ? (bestaand.bezoeken || 0) : 0,
      gemaakt: bestaand ? bestaand.gemaakt : new Date().toISOString(),
      bij: new Date().toISOString()
    };
    const vg = schoonVolgorde(d, design.blokken); if (vg) design.volgorde = vg;
    const pg = paginalaag.schoonPaginas(d); if (pg) design.paginas = pg;
    if (bestaand) { const i = s.lijst.indexOf(bestaand); s.lijst[i] = design; }
    else { s.lijst.unshift(design); s.lijst = s.lijst.slice(0, TOTAAL); }
    save();
    return { ok: true, design };
  }

  function verwijder(key, id) {
    const s = store(); s.lijst = s.lijst.filter(x => !(x.id === scho(id, 20) && x.eigenaar === key)); save();
    return { ok: true };
  }

  function publiceer(key, id, adresIn) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    const a = slug(adresIn || d.adres || d.titel);
    if (a.length < 2) return { error: 'Kies een adres van minstens twee tekens (letters, cijfers, koppelteken).', status: 400 };
    const bezet = store().lijst.find(x => x.adres === a && x.id !== d.id);
    if (bezet) return { error: 'Dit adres is al bezet. Kies een ander.', status: 409 };
    d.adres = a; d.online = true; d.bij = new Date().toISOString(); save();
    return { ok: true, adres: a, online: true };
  }
  function offline(key, id) {
    const d = haal(key, id);
    if (!d) return { error: 'Website niet gevonden.', status: 404 };
    d.online = false; save();
    return { ok: true, online: false };
  }

  /* De browser-kant (gids, openen, zoeken) staat in ./webmaker-blader.js:
     bekijken is ander werk dan bouwen. */
  const blader = require('./webmaker-blader')({ store, save, slug, publiek });

  return { mijn, haal, bewaar, verwijder, publiceer, offline, slug,
           gids: blader.gids, open: blader.open, zoek: blader.zoek, adresVanZaak: blader.adresVanZaak, zaakVanAdres: blader.zaakVanAdres, eigenaarVanAdres: blader.eigenaarVanAdres,
           fotos, fotoBewaar, fotoWeg, TYPES };
};
