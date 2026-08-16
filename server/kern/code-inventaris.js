/* Doorzoekbare live inventaris van runtimebestanden, routes en schakelaars.
   Geeft metadata terug, nooit broninhoud. */
'use strict';

const { redenVoor } = require('./bestuursroutes');

module.exports = function maakInventaris({ app, functies, integriteit }) {
  function routes() {
    const perPad = new Map();
    const rauw = app && typeof app._routes === 'function' ? app._routes() : [];
    for (const r of rauw) {
      const pad = String(r.pad || '');
      if (!pad || pad === '/') continue;
      if (!perPad.has(pad)) perPad.set(pad, new Set());
      perPad.get(pad).add(String(r.methode || '').toUpperCase());
    }
    return [...perPad].sort((a, b) => a[0].localeCompare(b[0])).map(([pad, methoden]) => {
      const f = pad.startsWith('/api/') ? functies.functieVoorPad(pad) : null;
      const reden = pad.startsWith('/api/') ? redenVoor(pad) : null;
      return { pad, methoden: [...methoden].filter(Boolean).sort(), soort: pad.startsWith('/api/') ? 'api' : 'pagina',
        functie: f ? f.id : null, functienaam: f ? f.naam : null,
        beschermd: !!reden, beschermreden: reden || null };
    });
  }

  function mappen(bestanden) {
    const per = new Map();
    for (const b of bestanden) {
      const map = b.pad.includes('/') ? b.pad.split('/')[0] : '(wortel)';
      const x = per.get(map) || { map, bestanden: 0, bytes: 0 };
      x.bestanden++; x.bytes += Number(b.bytes) || 0; per.set(map, x);
    }
    return [...per.values()].sort((a, b) => b.bytes - a.bytes);
  }

  function samenvatting() {
    const rs = routes();
    const bs = integriteit.bestanden();
    const api = rs.filter(r => r.soort === 'api');
    return {
      bestanden: bs.length,
      bytes: bs.reduce((n, b) => n + (Number(b.bytes) || 0), 0),
      mappen: mappen(bs),
      routes: rs.length,
      apiRoutes: api.length,
      schakelaars: functies.FUNCTIES.length,
      schakelbaar: api.filter(r => r.functie).length,
      beschermd: api.filter(r => r.beschermd).length,
      zonderSchakelaar: api.filter(r => !r.functie && !r.beschermd).length
    };
  }

  function pagina(soort, vraag) {
    vraag = vraag || {};
    const bron = soort === 'routes' ? routes() : integriteit.bestanden();
    const zoek = String(vraag.zoek || '').trim().toLowerCase().slice(0, 120);
    const gefilterd = zoek ? bron.filter(x => JSON.stringify(x).toLowerCase().includes(zoek)) : bron;
    const limiet = Math.max(1, Math.min(250, Number(vraag.limiet) || 50));
    const nr = Math.max(1, Number(vraag.pagina) || 1);
    const begin = (nr - 1) * limiet;
    return { soort: soort === 'routes' ? 'routes' : 'bestanden', zoek, pagina: nr, limiet,
      totaal: gefilterd.length, paginas: Math.max(1, Math.ceil(gefilterd.length / limiet)),
      resultaten: gefilterd.slice(begin, begin + limiet) };
  }

  return { samenvatting, pagina };
};
