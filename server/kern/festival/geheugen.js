/* RTG Festival (deelmodule): HET GEHEUGEN. Wat er werkelijk gebeurde.

   EEN AFGESLOTEN DAG IS EEN AFDRUK EN GEEN BEREKENING, en dat is het enige punt
   in deze wereld waar met opzet een tweede waarheid ontstaat. Overal anders
   geldt LAT-regel 4: niet twee plekken die hetzelfde weten. Hier niet, en om
   een reden: scans worden opgeruimd, een terrein wordt volgend jaar anders
   ingedeeld, een norm verandert. Een geheugen dat elke keer opnieuw uitrekent
   wat er vorig jaar gebeurde, is geen geheugen maar een schatting die
   meebeweegt met vandaag. Dus: op het moment van afsluiten wordt het VASTGELEGD,
   met de naam van wie afsloot erbij, en het wordt daarna niet meer herrekend.

   ER STAAN AANTALLEN IN EN GEEN MENSEN (FESTIVAL.md par. 5.1). Geen codenamen,
   geen pascodes, geen tijdstip waarop iemand ergens was. Een bezoeker is een
   telling; wat hier bewaard blijft is hoeveel er waren, niet wie.

   DE PIEK WORDT GEVONDEN DOOR DE DAG NA TE LOPEN. Bezetting is de stand op een
   moment (./bezetting.js), dus de hoogste stand vraagt om meerdere momenten. Er
   wordt gekeken op elk moment waarop er werkelijk iets veranderde -- elke scan
   -- en pas als dat er te veel zijn, wordt er per kwartier gekeken. Welke van
   de twee het was, staat IN de afdruk (`gemetenOp`), want een piek die tussen
   twee kwartieren in viel, kan gemist zijn en dat hoort niemand later te
   moeten raden.

   HET ADVIES IS EEN WAARNEMING EN GEEN VOORSPELLING. "Vorig jaar kwam 78% van
   de geldige passen binnen" is iets anders dan "dit jaar komt 78%". Er staat
   dus ook nergens een verwachting voor de volgende editie; er staat wat er was,
   en hoeveel edities dat waren. Een lijn door een punt is geen lijn. */
'use strict';

const MAX_MOMENTEN = 200;

module.exports = (ctx) => {
  const { save, schoon, editieVind, dagVind, festivalVind, offset, momentOffset,
    duurVan, bezetting, bemensing, gereedheid } = ctx;

  const nuIso = () => new Date().toISOString();
  const bak = (e) => {
    if (!e.afgesloten || typeof e.afgesloten !== 'object') e.afgesloten = {};
    return e.afgesloten;
  };

  /* De momenten waarop er iets veranderde. Te veel? Dan per kwartier, en dat
     zegt de afdruk erbij. */
  function momenten(e, dag) {
    const uit = new Set();
    for (const s of e.scans || []) {
      if (s.dag !== dag.id) continue;
      const o = momentOffset(dag, s.datum, s.tijd);
      if (o !== null) uit.add(o);
    }
    if (uit.size <= MAX_MOMENTEN) return { lijst: [...uit].sort((a, b) => a - b), hoe: 'elke scan' };
    const lijst = [];
    for (let m = 0; m <= duurVan(dag); m += 15) lijst.push(m);
    return { lijst, hoe: 'elk kwartier' };
  }

  function piekVan(fid, eid, e, dag) {
    const m = momenten(e, dag);
    const hoogste = new Map();
    for (const moment of m.lijst) {
      const tel = bezetting(fid, eid, dag.id, moment);
      if (!tel.ok) continue;
      for (const p of tel.plekken) {
        const h = hoogste.get(p.id);
        if (!h || p.aanwezig > h.aantal) {
          hoogste.set(p.id, { plek: p.id, naam: p.naam, aantal: p.aanwezig, opMinuut: moment,
            veiligeCapaciteit: p.veiligeCapaciteit });
        }
      }
    }
    return { hoe: m.hoe, momenten: m.lijst.length,
      plekken: [...hoogste.values()].sort((a, b) => b.aantal - a.aantal) };
  }

  /* Hoe vaak stond er een gat in de bemensing. Per kwartier nagelopen; dat is
     grof genoeg om snel te zijn en fijn genoeg om een avond te herkennen. */
  function gatenVan(fid, eid, dag) {
    let kwartieren = 0, grootste = 0, gemeten = 0;
    for (let m = 0; m <= duurVan(dag); m += 15) {
      const tijd = tijdVan(dag, m);
      if (!tijd) continue;
      const r = bemensing(fid, eid, { dag: dag.id, tijd, vooruit: 0 });
      if (!r.ok) continue;
      gemeten++;
      if (!r.gaten.length) continue;
      kwartieren++;
      grootste = Math.max(grootste, ...r.gaten.map(g => g.gat));
    }
    return { kwartieren, grootste, gemeten };
  }

  /* Een minuut na opening terug naar uu:mm op de klok van die dag. */
  function tijdVan(dag, minuut) {
    const start = Number(String(dag.open).slice(0, 2)) * 60 + Number(String(dag.open).slice(3, 5));
    const k = (start + minuut) % 1440;
    return String(Math.floor(k / 60)).padStart(2, '0') + ':' + String(k % 60).padStart(2, '0');
  }

  function dagSluiten(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const dag = dagVind(e, d.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const door = schoon(d.door, 60);
    if (!door) return { status: 400, error: 'Wie sluit deze dag af?' };

    const b = bak(e);
    const eerder = b[dag.id];
    if (eerder && d.opnieuw !== true) {
      return { status: 409, error: 'Deze dag is al afgesloten op ' + eerder.at.slice(0, 16).replace('T', ' ')
        + ' door ' + eerder.door + '. Opnieuw afsluiten kan, maar dan staat dat er ook bij.' };
    }

    const passen = Object.values(e.passen || {});
    const geldig = passen.filter(p => !p.ingetrokken && (p.rechten || [])
      .some(r => !r.dagen || !r.dagen.length || r.dagen.includes(dag.id))).length;
    const binnen = new Set();
    let scansIn = 0, scansUit = 0;
    for (const s of e.scans || []) {
      if (s.dag !== dag.id) continue;
      if (s.richting === 'in') { scansIn++; binnen.add(s.pas); } else scansUit++;
    }

    const boekingen = Object.values(e.boekingen || {}).filter(x => x.dag === dag.id);
    const keuring = gereedheid(fid, eid, { op: dag.datum });

    const afdruk = {
      dag: dag.id, datum: dag.datum, at: nuIso(), door,
      herzien: eerder ? (eerder.herzien || 0) + 1 : 0,
      passenGeldig: geldig, passenBinnen: binnen.size,
      opkomst: geldig ? Math.round((binnen.size / geldig) * 1000) / 10 : null,
      scansIn, scansUit,
      piek: piekVan(fid, eid, e, dag),
      bemensing: gatenVan(fid, eid, dag),
      programma: { sets: boekingen.length,
        bevestigd: boekingen.filter(x => x.stand === 'bevestigd').length,
        afgezegd: boekingen.filter(x => x.stand === 'afgezegd').length,
        riderOpen: boekingen.reduce((n, x) => n + (x.rider || []).filter(r => !r.klaar).length, 0) },
      gereedheid: keuring.ok ? { deel: keuring.deel, stand: keuring.stand } : null
    };
    b[dag.id] = afdruk;
    save();
    return { ok: true, afdruk };
  }

  function geheugenVan(fid, eid) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const dagen = Object.values(bak(e)).sort((a, b) => a.datum.localeCompare(b.datum));
    const open = (e.dagen || []).filter(d => !bak(e)[d.id]).length;
    return { ok: true, editie: e.id, jaar: e.jaar, dagen, nogOpen: open,
      passenBinnen: dagen.reduce((n, d) => n + d.passenBinnen, 0) };
  }

  /* DEZE EDITIE NAAST DE VORIGE. Zonder vorige: dat zegt hij, en verder niets.
     Een percentage tegenover niets is geen vergelijking maar een suggestie. */
  function vergelijk(fid, eid) {
    const f = festivalVind(fid);
    if (!f) return { status: 404, error: 'Dit festival bestaat niet.' };
    const nu = geheugenVan(fid, eid);
    if (!nu.ok) return nu;
    const e = editieVind(fid, eid);

    const eerder = Object.values(f.edities || {})
      .filter(x => x.id !== e.id && x.jaar < e.jaar)
      .sort((a, b) => b.jaar - a.jaar)
      .map(x => geheugenVan(fid, x.id))
      .find(g => g.ok && g.dagen.length);

    if (!eerder) {
      return { ok: true, bekend: false, nu,
        zin: 'Er is geen eerdere afgesloten editie om naast te leggen. Wat hier staat, staat op zichzelf.' };
    }
    const middel = (g, veld) => g.dagen.length
      ? Math.round((g.dagen.reduce((n, d) => n + (d[veld] || 0), 0) / g.dagen.length) * 10) / 10 : null;
    return { ok: true, bekend: true, nu, eerder: { jaar: eerder.jaar, dagen: eerder.dagen.length },
      opkomst: { nu: middel(nu, 'opkomst'), eerder: middel(eerder, 'opkomst') },
      passenBinnen: { nu: nu.passenBinnen, eerder: eerder.passenBinnen },
      zin: 'Naast ' + eerder.jaar + ' (' + eerder.dagen.length
        + (eerder.dagen.length === 1 ? ' afgesloten dag' : ' afgesloten dagen') + '). Een editie is geen patroon.' };
  }

  return { dagSluiten, geheugenVan, vergelijk };
};
