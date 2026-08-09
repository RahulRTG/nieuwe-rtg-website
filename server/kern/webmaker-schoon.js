/* De schoonmaak van de bloktaal: wat een blok mag bevatten, hoe lang, en wat
   er van een adres, een kleur of een blokvolgorde overblijft.

   Staat apart van webmaker.js omdat dit ander werk is dan het beheren van
   sites: hier wordt niets bewaard en niets opgezocht, hier wordt alleen
   ingeperkt. Elke ingang die iets van buiten aanneemt -- de maker, de
   AI-assistent, een sjabloon, een extra pagina -- loopt hier langs, en dat is
   precies de reden om het op EEN plek te houden. */
module.exports = ({ scho, crypto }) => {
  const TYPES = ['hero', 'kop', 'tekst', 'knop', 'beeld', 'kolommen', 'galerij', 'citaat', 'ruimte', 'voettekst', 'zaakdata', 'formulier', 'faq', 'prijzen'];
  // de bronnen die een live zaakdata-blok mag aanwijzen (opgelost in kern/webplatform.js)
  const ZAAKBRONNEN = ['menu', 'diensten', 'kamers', 'agenda', 'events', 'vacatures', 'openingstijden', 'team', 'fotos', 'reviews', 'contact'];
  const RIJ_MAX = 12;   // hoeveel vragen of prijsregels een blok mag dragen
  const VERSIES = ['telefoon', 'tablet', 'desktop'];

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
    /* Blokken met rijen: elke rij wordt afzonderlijk geschoond en begrensd, en
       een rij zonder inhoud valt weg -- anders staat er een lege regel op de
       site die niemand kan zien zitten. */
    /* Eerst de lege rijen eruit, dan pas begrenzen: andersom eet een lege rij
       in het midden een van de twaalf plekken op en raakt de maker een regel
       kwijt die hij wel had ingevuld. De eerste slice houdt het werk begrensd
       voor het geval er duizend rijen worden ingestuurd. */
    else if (t === 'faq') {
      o.kop = T(b.kop, 120) || 'Veelgestelde vragen';
      o.vragen = (Array.isArray(b.vragen) ? b.vragen : []).slice(0, RIJ_MAX * 5)
        .map(x => ({ v: T(x && x.v, 200), a: T(x && x.a, 1200) })).filter(x => x.v || x.a).slice(0, RIJ_MAX);
    } else if (t === 'prijzen') {
      o.kop = T(b.kop, 120) || 'Wat het kost';
      o.regels = (Array.isArray(b.regels) ? b.regels : []).slice(0, RIJ_MAX * 5)
        .map(x => ({ naam: T(x && x.naam, 80), prijs: T(x && x.prijs, 40), wat: T(x && x.wat, 300) })).filter(x => x.naam || x.prijs || x.wat).slice(0, RIJ_MAX);
    }
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

  /* De eigen blokvolgorde per toestel: alleen id's die echt bestaan, elk een
     keer -- een volgorde die naar een weggehaald blok wijst, laat een gat. */
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

  /* Vrije kleuren: alleen echte hex-waarden (#rgb of #rrggbb) worden bewaard;
     de sleutels die we kennen zijn bg (achtergrond), txt (tekst) en card
     (kaart). Het accent blijft zijn eigen veld. Ontbreekt een kleur, dan valt
     de site terug op het thema (licht/donker) -- niets forceren. */
  function schoonKleuren(k) {
    if (!k || typeof k !== 'object') return null;
    const hex = v => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || '')) ? String(v) : null;
    const uit = {};
    ['bg', 'txt', 'card'].forEach(n => { const c = hex(k[n]); if (c) uit[n] = c; });
    return Object.keys(uit).length ? uit : null;
  }

  return { TYPES, slug, schoonBlok, schoonVolgorde, schoonKleuren };
};
