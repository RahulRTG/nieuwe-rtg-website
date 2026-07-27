/* RTG Journalistiek, de bloktaal: het schoonmaken van site-blokken en de
   volgorde per schermversie (dezelfde bloktaal als de Website-studio). De
   redactie zelf (artikelen, rubrieken, de krant) staat in ./journalistiek.js
   en geeft zijn helpers hier door. */
function maakBlokSchoon({ scho, id, TYPES, VERSIES }) {
  function schoonBlok(b) {
    b = b || {};
    const t = TYPES.includes(b.type) ? b.type : 'tekst';
    const T = (v, n) => scho(v, n || 400);
    const o = { id: scho(b.id, 20) || id('b'), type: t };
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
    if (Array.isArray(b.verberg)) { const v = b.verberg.filter(x => VERSIES.includes(x)); if (v.length) o.verberg = [...new Set(v)]; }
    if (b.varianten && typeof b.varianten === 'object') {
      const V = {};
      ['telefoon', 'tablet'].forEach(ver => {
        const src = b.varianten[ver];
        if (src && typeof src === 'object') {
          const ov = {};
          Object.keys(o).forEach(k => { if (['id', 'type', 'verberg', 'varianten'].includes(k)) return; if (typeof o[k] === 'string' && typeof src[k] === 'string') ov[k] = T(src[k], 4000); });
          if (Object.keys(ov).length) V[ver] = ov;
        }
      });
      if (Object.keys(V).length) o.varianten = V;
    }
    return o;
  }
  function schoonVolgorde(v, blokken) {
    if (!v || typeof v !== 'object') return null;
    const ids = new Set(blokken.map(b => b.id)); const V = {};
    ['telefoon', 'tablet'].forEach(ver => {
      const arr = v[ver]; if (!Array.isArray(arr)) return;
      const seen = new Set(); const uit = [];
      arr.forEach(x => { const s = scho(x, 20); if (ids.has(s) && !seen.has(s)) { seen.add(s); uit.push(s); } });
      if (uit.length) V[ver] = uit;
    });
    return Object.keys(V).length ? V : null;
  }
  return { schoonBlok, schoonVolgorde };
}

module.exports = { maakBlokSchoon };
