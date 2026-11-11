/* De aangeboden samenstelling hoort bij de aanvraag, niet bij de catalogus
   van de betaaldag. Deze kleine waarde bevat geen rechten of providerbewijs. */
'use strict';

const { createHash } = require('node:crypto');
const { samenstellingVan, voorAanvraag } = require('./reisbureau-samenstelling');

const hash = waarde => createHash('sha256').update(JSON.stringify(waarde)).digest('hex');

function maakPrijsgrond(trip) {
  const s = samenstellingVan(trip);
  if (!s.bekend) return null;
  const inhoud = { versie: 1, tripId: String(trip.id), ppCenten: s.nettoCenten,
    onderdelen: s.onderdelen.map(o => ({ ...o })) };
  return { ...inhoud, hash: hash(inhoud) };
}

function leesPrijsgrond(a) {
  const g = a && a.prijsgrond;
  const fout = waarom => ({ ok: false, waarom });
  if (!g || g.versie !== 1)
    return fout('Deze aanvraag heeft geen vastgelegde commerciële samenstelling. Een adviseur moet een nieuwe aanvraag met een vaststaande prijs voorbereiden voordat RTG kan innen.');
  const inhoud = { versie: g.versie, tripId: g.tripId, ppCenten: g.ppCenten, onderdelen: g.onderdelen };
  if (g.hash !== hash(inhoud) || g.tripId !== a.tripId || !Number.isSafeInteger(g.ppCenten))
    return fout('De vastgelegde prijsgrond is gewijzigd of hoort niet bij deze aanvraag. Herstel door een adviseur is vereist; RTG int niets.');
  if (!Number.isSafeInteger(a.personen) || a.personen < 1 || a.personen > 20)
    return fout('Het aantal reizigers is ongeldig; de commerciële samenstelling kan niet veilig worden afgerekend.');
  const trip = { id: g.tripId, netto: g.ppCenten / 100, samenstelling: g.onderdelen };
  const opbouw = voorAanvraag(trip, a.personen);
  const prijs = a.prijs || {};
  if (!opbouw.bekend || prijs.valuta !== 'EUR' || Math.round(Number(prijs.pp) * 100) !== g.ppCenten ||
      Math.round(Number(prijs.totaal) * 100) !== opbouw.totaalCenten)
    return fout('De aanvraagprijs en de vastgelegde samenstelling sluiten niet op elkaar aan. RTG int niets totdat de adviseur dit heeft hersteld.');
  return { ok: true, trip, personen: a.personen, centen: opbouw.totaalCenten, hash: g.hash };
}

// Bewaar intern de leveranciersverdeling; het lid ziet de afgesproken prijs.
function lidPrijsbeeld(a) {
  if (!a) return a;
  const { prijsgrond, inning, ...uit } = a;
  return uit;
}

module.exports = { maakPrijsgrond, leesPrijsgrond, lidPrijsbeeld };
