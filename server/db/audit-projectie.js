'use strict';
// Een projectie bezit de bytes van haar SQLite-snapshot, nooit een latere query.
// Gesloten pagina's delen onveranderlijke, gecomprimeerde bytes. Alleen de korte
// staart groeit; hoogstens vier pagina's blijven tegelijk als objecten in RAM.
const { deflateRawSync, inflateRawSync } = require('node:zlib');
const OMVANG = 128, CACHE = 4;

module.exports = () => {
  const gelezen = new Map();
  function waarden(pagina) {
    let lijst = gelezen.get(pagina);
    if (lijst) gelezen.delete(pagina);
    else {
      lijst = pagina.bytes ? JSON.parse(inflateRawSync(pagina.bytes).toString('utf8'))
        : pagina.tekst.map(t => JSON.parse(t));
      // Een nog vastgehouden rij behoudt haar identiteit, ook na cacheverdringing.
      lijst = lijst.map((v, i) => {
        if (!v || typeof v !== 'object') return v;
        const nr = pagina.nummers[i], oud = pagina.refs.get(nr)?.deref();
        if (oud) return oud;
        pagina.refs.set(nr, new WeakRef(v)); return v;
      });
    }
    gelezen.set(pagina, lijst);
    if (gelezen.size > CACHE) gelezen.delete(gelezen.keys().next().value);
    return lijst;
  }
  function pagina(rijen, dicht) {
    const tekst = rijen.map(r => r.tekst);
    return { nummers: rijen.map(r => r.nr), refs: rijen.find(r => r.refs)?.refs || new Map(), ...(dicht
      ? { bytes: deflateRawSync('[' + tekst.join(',') + ']') } : { tekst }) };
  }
  function volgende(oud, nieuw, minimum) {
    if (minimum === null) { oud = null; nieuw = []; }
    if (!oud) gelezen.clear();
    const paginas = (oud?.paginas || []).filter(p => p.nummers.at(-1) >= minimum);
    const staart = oud?.staart;
    // Een korte staart kan door retentie nooit vol raken. Deel dan niet eeuwig
    // haar oude Mapkeys/WeakRef-cellen; oude snapshots behouden hun eigen kaart.
    const refs = staart && staart.nummers[0] < minimum
      ? new Map([...staart.refs].filter(([nr]) => nr >= minimum)) : staart?.refs;
    const rijen = staart ? staart.nummers.flatMap((nr, i) => nr >= minimum
      ? [{ nr, tekst: staart.tekst[i], refs }] : []) : [];
    rijen.push(...nieuw);
    while (rijen.length >= OMVANG) paginas.push(pagina(rijen.splice(0, OMVANG), true));
    const over = rijen.length ? pagina(rijen, false) : null;
    let lengte = 0;
    const delen = [...paginas, ...(over ? [over] : [])].map(p => {
      const begin = p.nummers.findIndex(nr => nr >= minimum);
      const vanaf = lengte; lengte += p.nummers.length - begin;
      return { pagina: p, begin, vanaf, einde: lengte };
    });
    return { paginas, staart: over, delen, lengte };
  }
  function lijst(snapshot, omgekeerd) {
    const doel = [];
    const index = k => typeof k === 'string' && /^(0|[1-9][0-9]*)$/.test(k)
      && Number(k) < snapshot.lengte ? Number(k) : -1;
    function lees(i) {
      const positie = omgekeerd ? snapshot.lengte - 1 - i : i;
      let laag = 0, hoog = snapshot.delen.length - 1;
      while (laag < hoog) {
        const midden = (laag + hoog) >>> 1;
        if (snapshot.delen[midden].einde <= positie) laag = midden + 1; else hoog = midden;
      }
      const deel = snapshot.delen[laag];
      return waarden(deel.pagina)[deel.begin + positie - deel.vanaf];
    }
    return new Proxy(doel, {
      get: (o, k) => k === 'length' ? snapshot.lengte : index(k) < 0 ? Reflect.get(o, k) : lees(index(k)),
      has: (o, k) => index(k) >= 0 || Reflect.has(o, k),
      ownKeys: () => [...Array.from({ length: snapshot.lengte }, (_, i) => String(i)), 'length'],
      getOwnPropertyDescriptor: (o, k) => k === 'length'
        ? { ...Reflect.getOwnPropertyDescriptor(o, k), value: snapshot.lengte }
        : index(k) < 0 ? Reflect.getOwnPropertyDescriptor(o, k)
        : { value: lees(index(k)), writable: false, enumerable: true, configurable: true }
    });
  }
  return { volgende, lijst };
};
