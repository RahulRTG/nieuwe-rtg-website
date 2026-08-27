/* Fiscaal (deelmodule): het dagrapport (Z-rapport) en de shift-samenvatting
   van een zaak. Krijgt de gedeelde context een keer bij het opstarten vanuit
   maakFiscaal in kern/fiscaal.js. */
const { FISCAAL_PEILJAAR, LANDEN, FIN_CAT, ZZP } = require('./landen');
module.exports = (ctx) => {
  const { db, rondEuro, btwSplit, financeVoor } = ctx;
  const ordersVoor = typeof ctx.ordersVanZaak === 'function'
    ? ctx.ordersVanZaak
    : code => (db.data.orders || []).filter(o => o.supplierCode === code);
  function dagrapport(s, datum) {
    const dag = /^\d{4}-\d{2}-\d{2}$/.test(String(datum || '')) ? String(datum) : new Date().toISOString().slice(0, 10);
    const opDag = iso => String(iso || '').slice(0, 10) === dag;
    const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
    const L = LANDEN[landCode];
    const caps = db.capsVan(s);
    const basisCat = caps.includes('rides') ? (s.type === 'jet' ? 'jet' : 'vervoer') : caps.includes('rooms') ? 'logies' : 'eten';
    const menuStations = new Map((s.menu || []).map(m => [m.name, m.station]));
    const catVan = naam => menuStations.get(naam) === 'bar' ? 'drank' : basisCat === 'eten' ? 'eten' : basisCat;
    const potten = {};
    const betaalwijzen = {};
    let bonnen = 0, fooien = 0, omzet = 0;
    const tel = (cat, bedrag) => { if (bedrag > 0) potten[cat] = (potten[cat] || 0) + bedrag; };
    for (const o of db.data.orders) {
      if (o.supplierCode !== s.code || !o.paid || !opDag(o.paidAt || o.at)) continue;
      bonnen++;
      fooien += o.fooi || 0;
      let t = 0;
      for (const it of o.items || []) { const b = (it.price || 0) * (it.qty || 1); t += b; tel(catVan(it.name), b); }
      omzet += t;
      betaalwijzen.app = rondEuro((betaalwijzen.app || 0) + t);
    }
    for (const v of db.data.posSales[s.code] || []) {
      if (!opDag(v.at)) continue;
      bonnen++;
      omzet += v.total || 0;
      const m = v.method || 'contant';
      betaalwijzen[m] = rondEuro((betaalwijzen[m] || 0) + (v.total || 0));
      if (m === 'rtg' || m === 'kamer' || m === 'tafel') continue; // interne verrekening: de btw loopt via de hoofdboeking
      if (v.items && v.items.length) for (const it of v.items) tel(catVan(it.name), (it.price || 0) * (it.qty || 1));
      else tel(basisCat, v.total || 0);
    }
    const btw = Object.entries(potten).map(([cat, o2]) => {
      const t = L.tarieven[cat] != null ? L.tarieven[cat] : L.tarieven.standaard;
      return { cat, label: FIN_CAT[cat] || cat, ...btwSplit(o2, t) };
    }).sort((a, b) => b.omzet - a.omzet);
    return { ok: true, datum: dag, land: landCode, bonnen, omzet: rondEuro(omzet), fooien: rondEuro(fooien), betaalwijzen, btw };
  }

  /* De shift-samenvatting: het avondbriefing-moment in een kaart. De cijfers
     van het Z-rapport plus de gasten (reserveringen, walk-ins, no-shows), de
     toppers van de dag, de geboekte derving en wie er op de kassa stond. */
  function shiftSamenvatting(s, datum) {
    const z = dagrapport(s, datum);
    const opDag = iso => String(iso || '').slice(0, 10) === z.datum;
    // toppers: de meest verkochte items over kassa en app samen
    const per = {};
    const telItems = items => { for (const it of items || []) per[it.name] = (per[it.name] || 0) + (it.qty || 1); };
    for (const o of ordersVoor(s.code)) if (o.paid && opDag(o.paidAt || o.at)) telItems(o.items);
    for (const v of db.data.posSales[s.code] || []) if (opDag(v.at)) telItems(v.items);
    const toppers = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([naam, aantal]) => ({ naam, aantal }));
    // de gasten van vandaag
    // Eén pass, zonder vier tijdelijke arrays. Op grote reserveringsbestanden
    // scheelt dit zowel CPU als kortlevende heapobjecten/GC-pauzes.
    const gasten = { reserveringen: 0, walkIns: 0, noShows: 0, personen: 0 };
    for (const r of db.data.reserveringen || []) {
      if (r.supplierCode !== s.code || r.datum !== z.datum) continue;
      if (r.walkIn) gasten.walkIns++;
      else if (r.status !== 'geannuleerd' && r.status !== 'geweigerd') gasten.reserveringen++;
      if (r.status === 'no-show') gasten.noShows++;
      if (r.status === 'aangekomen' || r.status === 'afgerond') gasten.personen += r.personen || 0;
    }
    // de derving van vandaag, tegen kostprijs
    let derving = 0;
    for (const l of s.voorraadLog || []) {
      if (l.soort !== 'verspilling' || !opDag(l.at)) continue;
      const art = (s.voorraad || []).find(a => a.id === l.artikelId);
      derving += Math.abs(l.delta || 0) * ((art && art.kostprijs) || 0);
    }
    // wie stond er op de kassa
    const team = {};
    for (const v of db.data.posSales[s.code] || []) if (opDag(v.at) && v.actor) team[v.actor] = rondEuro((team[v.actor] || 0) + (v.total || 0));
    // de hotelkant: bezetting, aankomsten en vertrekken van vandaag, en de
    // gemiddelde kamerprijs van wie er nu slaapt (ADR)
    let verblijf = null;
    if (Array.isArray(s.rooms) && s.rooms.length) {
      let aankomsten = 0, vertrekken = 0, noShows = 0, inHuis = 0, kamerOmzet = 0;
      for (const v of db.data.verblijven || []) {
        if (v.supplierCode !== s.code) continue;
        if (opDag(v.ingechecktAt)) aankomsten++;
        if (opDag(v.uitgechecktAt)) vertrekken++;
        if (v.status === 'no-show' && v.aankomst === z.datum) noShows++;
        if (v.status === 'ingecheckt') { inHuis++; kamerOmzet += v.prijsPerNacht || 0; }
      }
      verblijf = {
        bezet: s.rooms.filter(r => r.hk && r.hk.status === 'bezet').length,
        totaal: s.rooms.length,
        aankomsten, vertrekken, noShows,
        adr: inHuis ? rondEuro(kamerOmzet / inHuis) : 0
      };
    }
    return {
      ok: true, datum: z.datum,
      omzet: z.omzet, bonnen: z.bonnen, fooien: z.fooien, betaalwijzen: z.betaalwijzen,
      gasten, toppers, derving: rondEuro(derving), verblijf,
      team: Object.entries(team).sort((a, b) => b[1] - a[1]).map(([naam, omzet]) => ({ naam, omzet }))
    };
  }

  return { dagrapport, shiftSamenvatting };
};
