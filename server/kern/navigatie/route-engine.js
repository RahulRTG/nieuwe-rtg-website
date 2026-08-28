/* De eigen premium routeberekening. Los van bestemmingen, kaarttekenen en
   partnerinvoer zodat het bronbestand van het navigatiedomein klein blijft. */
'use strict';

module.exports = function maakRouteEngine({ MODI, LANGS_M, GRID, POI, crypto, haversine,
  flitsRond, partners, meters, snap, zoek, stappenVan, intelligence, netwerk }) {
  const langsRoute = (poly, punten) => punten.filter(p => poly.some(q => meters(p, q) <= LANGS_M));
  const schoonPad = poly => poly.filter((p, i) => i === 0 || meters(p, poly[i - 1]) > 5);

  return function route({ van, naar, modus, profiel, vertrekAt, accuProcent, bereikKm }) {
    const gv = van && Number.isFinite(Number(van.lat)) && Number.isFinite(Number(van.lng));
    const gn = naar && Number.isFinite(Number(naar.lat)) && Number.isFinite(Number(naar.lng));
    if (!gv || !gn) return { status: 400, error: 'Geef een geldig vertrek- en aankomstpunt.' };
    const m = MODI[modus] ? modus : 'auto';
    const gekozenProfiel = intelligence.profielVan(profiel || (m === 'ev' ? 'eco' : 'slim'));
    const vanN = snap({ lat: +van.lat, lng: +van.lng }), naarN = snap({ lat: +naar.lat, lng: +naar.lng });
    if (!vanN || !naarN) return { status: 422, error: 'Geen routeerbare weg bij vertrek of bestemming gevonden.' };
    const midden = { lat: (+van.lat + +naar.lat) / 2, lng: (+van.lng + +naar.lng) / 2 };
    const flits = flitsRond ? (flitsRond(midden, van.land || naar.land).meldingen || []).map(x => ({
      ...x, bron: 'netwerk', straalM: LANGS_M, ernst: x.soort === 'file' ? 3 : 2
    })) : [];
    const partnerSignalen = partners.partnerEventsRond(midden, 45);
    const meldingen = flits.concat(partnerSignalen);
    const kern = zoek(vanN, naarN, { modus: m, kost: intelligence.kostenfunctie({ profiel: gekozenProfiel, modus: m, meldingen, meters }) });
    if (!kern) return { status: 422, error: 'Geen route gevonden binnen het netwerk.' };
    const schoon = schoonPad([{ lat: +van.lat, lng: +van.lng },
      ...kern.map(k => ({ lat: k.lat, lng: k.lng, _edgeId: k._edgeId, _seconden: k._seconden,
        _naam: k._naam, _ref: k._ref })), { lat: +naar.lat, lng: +naar.lng }]);
    let afstandM = 0;
    for (let i = 1; i < schoon.length; i++) afstandM += meters(schoon[i - 1], schoon[i]);
    const stappen = stappenVan(schoon);
    const meting = intelligence.meetRoute({ poly: schoon, stappen, modus: m, profiel: gekozenProfiel,
      meldingen, meters, vertrekAt, accuProcent, bereikKm });
    const eta = {};
    for (const k of Object.keys(MODI)) {
      const zelfdeVoertuig = ['auto', 'ev'].includes(k) && ['auto', 'ev'].includes(m);
      eta[k] = k === m || zelfdeVoertuig ? meting.etaMin : Math.max(1, Math.round(afstandM / MODI[k] / 60));
    }
    const langs = {
      laad: langsRoute(schoon, POI.laad.map(p => ({ ...p, laag: 'laad', afstandM: 0 }))),
      tank: langsRoute(schoon, POI.tank.map(p => ({ ...p, laag: 'tank' }))),
      flits: flits.filter(f => schoon.some(q => haversine(f, q) <= LANGS_M)),
      partners: partnerSignalen.filter(f => schoon.some(q => haversine(f, q) <= (f.straalM || LANGS_M)))
    };

    const eerderPad = intelligence.padIds(kern, GRID);
    const alternatiefProfielen = [gekozenProfiel === 'snel' ? 'rustig' : 'snel', m === 'ev' ? 'zeker' : 'rustig'];
    const alternatieven = [];
    for (const altProfiel of alternatiefProfielen) {
      const altKern = zoek(vanN, naarN, { modus: m, kost: intelligence.kostenfunctie({ profiel: altProfiel, modus: m, meldingen, meters, eerderPad }) });
      if (!altKern) continue;
      const altPoly = schoonPad([{ lat: +van.lat, lng: +van.lng },
        ...altKern.map(k => ({ lat: k.lat, lng: k.lng, _edgeId: k._edgeId, _seconden: k._seconden,
          _naam: k._naam, _ref: k._ref })), { lat: +naar.lat, lng: +naar.lng }]);
      const altMeting = intelligence.meetRoute({ poly: altPoly, stappen: stappenVan(altPoly), modus: m,
        profiel: altProfiel, meldingen, meters, vertrekAt, accuProcent, bereikKm });
      const routeId = intelligence.routeSleutel(crypto, altPoly);
      if (!alternatieven.some(a => a.routeId === routeId)) alternatieven.push({
        routeId, profiel: altProfiel, naam: altMeting.naam, etaMin: altMeting.etaMin,
        afstandM: altMeting.afstandM, vertrouwen: altMeting.vertrouwen,
        verkeersbeeld: altMeting.verkeersbeeld, advies: altMeting.advies, route: altPoly
      });
    }
    return {
      status: 200, modus: m, afstandM: Math.round(afstandM), afstandKm: Math.round(afstandM / 100) / 10,
      etaMin: eta, route: schoon, stappen, langs, routeId: intelligence.routeSleutel(crypto, schoon),
      intelligence: meting, alternatieven,
      bron: netwerk && netwerk.bron || 'RTG Route Intelligence op het eigen wegennet (A*); geen externe kaartdienst',
      privacy: 'Uw positie wordt alleen voor deze berekening gebruikt en niet bewaard.'
    };
  };
};
