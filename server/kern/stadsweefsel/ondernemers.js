/* RTG Stadsweefsel, deel "ondernemers": de stad zoals een ondernemer hem ziet.

   kern/stadsweefsel/kansen.js gaat over WERK (waar zijn de vacatures, welke
   beroepen zijn schaars); dit gaat over ONDERNEMEN: welke panden staan leeg en
   wat staat daaromheen, welk werk komt eraan waar nog geen partij voor is, en
   wie moet weten dat er komende week een straat open ligt.

   Die laatste is de kortste lijn tussen het weefsel en de lokale economie, en
   het is het soort bericht waarvan een ondernemer zegt "waarom hoorde ik dit
   niet eerder": er ligt een werkorder voor zijn deur en niemand heeft het hem
   verteld. Krijgt de gedeelde ctx plus de bedrijvenlezer uit kansen.js. */
const { schoon } = require('../util');

module.exports = (ctx, bedrijven) => {
  const { d, save, nu, geo, obj, zkn, werk, ond, sim } = ctx;

  const panden = () => { if (!d().weefselPanden || typeof d().weefselPanden !== 'object') d().weefselPanden = {}; return d().weefselPanden; };

  /* Panden. Het object staat in het register, de economische staat hier.
     Leegstand is de meest bruikbare stedelijke voorraad die er is en tegelijk
     de slechtst bijgehouden. */
  function pandZet({ objectId, leeg, m2, huur, wie }) {
    const o = obj.object(objectId);
    if (!o) return { status: 404, error: 'Onbekend object.' };
    if (o.soort !== 'pand') return { status: 400, error: 'Dat object is geen pand maar een ' + o.soort + '.' };
    const p = panden()[o.id] || (panden()[o.id] = { objectId: o.id, leeg: false, m2: null, huur: null, sinds: nu() });
    if (leeg !== undefined && !!leeg !== p.leeg) { p.leeg = !!leeg; p.sinds = nu(); }
    if (m2 !== undefined) p.m2 = Number(m2) > 0 ? Math.round(Number(m2)) : null;
    if (huur !== undefined) p.huur = Number(huur) > 0 ? Math.round(Number(huur)) : null;
    p.door = schoon(wie, 60) || 'kantoor';
    save();
    return { ok: true, pand: publiekPand(o, p) };
  }

  function publiekPand(o, p) {
    const maanden = Math.round((nu() - p.sinds) / (30 * 86400000));
    const zone = geo.gebied(o.zone);
    // wat er OMHEEN staat: dat is wat een starter wil weten, en het is precies
    // wat het weefsel als enige kan beantwoorden
    const omgeving = zone ? {
      haltes: obj.zoek({ gebied: zone.id, soort: 'halte' }).length,
      laadpunten: obj.zoek({ gebied: zone.id, soort: 'laadpaal' }).length,
      bedrijvenInZone: bedrijven().filter(b => b.zone === zone.id).length,
      openZaken: zkn.lijst({ gebied: zone.id }).length
    } : null;
    return { ...p, naam: o.naam, plaats: geo.label(o.gebied), lat: o.lat, lng: o.lng,
      conditie: o.conditie, eigenaar: o.eigenaar, leegMaanden: p.leeg ? maanden : 0, omgeving };
  }

  /* De startvoorraad: twee lege panden, zodat de laag iets te tonen heeft. Dit
     is demodata en dat hoort hardop te staan -- in een echte stad komt de
     leegstand uit de aanslagen, de inschrijvingen of een schouw, en niet uit
     een aanname van de bouwer. */
  function zorgPanden() {
    if (Object.keys(panden()).length) return;
    const rij = obj.zoek({ soort: 'pand' });
    if (!rij.length) return;
    for (const [i, o] of rij.slice(0, 2).entries())
      panden()[o.id] = { objectId: o.id, leeg: true, m2: 120 + i * 260, huur: 900 + i * 1400,
        sinds: nu() - (4 + i * 9) * 30 * 86400000, door: 'seed' };
    save();
  }

  function leegstand() {
    zorgPanden();
    const uit = [];
    for (const o of obj.zoek({ soort: 'pand' })) {
      const p = panden()[o.id];
      if (p && p.leeg) uit.push(publiekPand(o, p));
    }
    return uit.sort((a, b) => b.leegMaanden - a.leegMaanden);
  }

  /* HINDER: welke ondernemers raakt het werk in hun straat? Dit is de kortste
     lijn tussen het weefsel en de lokale economie, en het is het soort bericht
     waarvan een ondernemer zegt "waarom hoorde ik dit niet eerder": er ligt een
     werkorder voor zijn deur en niemand heeft het hem verteld.

     Er wordt hier NIETS verstuurd. De lijst is wat een mens verstuurt; een
     systeem dat zelf bedrijven gaat aanschrijven op basis van een
     locatiematch, stuurt vroeg of laat de verkeerde straat een brief. */
  function hinder({ gebied } = {}) {
    const orders = werk.werklijst(gebied ? { gebied } : {});
    const uit = [];
    for (const w of orders) {
      if (!w.gebied) continue;
      const zone = geo.pad(w.gebied).find(g => g.niveau === 'zone');
      if (!zone) continue;
      const raakt = bedrijven().filter(b => b.gebied === w.gebied || b.zone === zone.id);
      if (!raakt.length) continue;
      uit.push({ werkorder: w.id, omschrijving: w.omschrijving, plaats: w.plaats, prioriteit: w.prioriteit,
        bedrijven: raakt.map(b => ({ code: b.code, naam: b.naam, zone: b.zoneNaam })),
        bericht: 'Er staat werk gepland in ' + (w.plaats || zone.naam) + ': ' + w.omschrijving });
    }
    return uit;
  }

  /* Opdrachten die eraan komen. Twee bronnen: werk dat de stad zelf heeft
     voorzien (de onderhoudsplanning) en soorten werk waar GEEN contract voor
     loopt -- want dat laatste is precies waar een lokale ondernemer op zou
     inschrijven. Dit is geen aanbesteding: het is de aankondiging die eraan
     vooraf hoort te gaan en die nu nergens staat. */
  function opdrachten() {
    const teDoen = ond.teDoen({}).slice(0, 50);
    const perSoort = {};
    for (const x of teDoen) {
      const s = x.object.soort;
      const r = perSoort[s] || (perSoort[s] = { soort: s, label: obj.SOORTEN[s].label, objecten: 0, zones: new Set(), contract: null });
      r.objecten++;
      r.zones.add((geo.gebied(x.object.zone) || {}).naam || '?');
      if (!r.contract) {
        const c = ctx.con.voorWerk({ objectId: x.object.id, gebied: x.object.gebied, prioriteit: 'normaal', at: nu() });
        r.contract = c ? c.partij : null;
      }
    }
    return Object.values(perSoort).map(r => ({ soort: r.soort, label: r.label, objecten: r.objecten,
      zones: [...r.zones], contract: r.contract,
      kans: r.contract ? null : 'Voor ' + r.label.toLowerCase() + ' loopt geen contract; dit werk staat open voor een lokale partij.' }))
      .sort((a, b) => b.objecten - a.objecten);
  }

  /* Een evenement raakt de ondernemers eromheen. De simulatie rekent uit wat
     er op de stad afkomt; hier staat wie dat moet weten. */
  function drukte({ gebied, bezoekers, uren }) {
    const s = sim.evenement({ gebied, bezoekers, uren });
    if (s.error) return s;
    const zone = geo.gebied(gebied);
    const raakt = bedrijven().filter(b => b.gebied === zone.id || b.zone === zone.id ||
      (zone.niveau !== 'zone' && geo.binnen(zone.id, b.gebied)));
    return { status: 200, ...s,
      ondernemers: raakt.map(b => ({ code: b.code, naam: b.naam, zone: b.zoneNaam })),
      bericht: raakt.length
        ? 'Er komen naar verwachting ' + s.bezoekers + ' bezoekers naar ' + zone.naam + '. ' + s.knelpunten[0]
        : 'Er staan geen bedrijven van het platform in dit gebied; er is niemand om te informeren.' };
  }

  return { panden, leegstand, pandZet, hinder, opdrachten, drukte };
};
