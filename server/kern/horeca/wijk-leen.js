/* Horeca (kern): DE UITGELEENDE TAFEL -- "neem tafel 6 even van me over."

   EEN HALVE WIJK OVERDRAGEN MAG DE KAART NIET HERTEKENEN. Dat is de hele reden
   dat dit een eigen laag is. Wie welke tafels heeft (`wijk.tafels`) is een
   besluit van de leiding en ligt vast voor de hele dienst; wie hem NU draagt
   (`wijkdienst`) is een handeling van een halve seconde. Drie tafels aan een
   collega geven door ze naar zijn wijk te verhuizen, zou een handeling van een
   halve seconde de plattegrond laten veranderen -- en die verandering blijft
   morgen staan, terwijl de reden ervoor (Ayla raakte achterop) allang weg is.

   Dus komt er een DERDE laag, boven de andere twee:

     kaart      welke tafels horen bij welke wijk        de leiding, hele dienst
     wijkdienst wie draagt welke wijk nu                 de mens, halve seconde
     leen       wie draagt deze ENE tafel nu             de mens, halve seconde

   De leen wint van de andere twee. Dat is geen voorrangsspelletje maar precies
   wat "neem tafel 6 even over" betekent: als hij bij allebei blijft staan,
   lopen er twee mensen heen of geen. Zie `vanMij` in ./wijk.js -- daar staat de
   voorrang, op de ene plek waar de vraag "is deze tafel van mij" beantwoord
   wordt (LAT-regel 4).

   EEN LEEN EINDIGT DOORDAT IEMAND HEM TERUGGEEFT, niet vanzelf en niet na een
   tijd. Een tafel die na twintig minuten stilletjes terugspringt naar iemand
   die er niet meer op rekent, is dezelfde fout als een tafel die tussen twee
   mensen door valt -- alleen later op de avond. Teruggeven kan door alle drie
   de mensen die er iets mee te maken hebben: wie hem leende (klaar), wie hem
   uitleende (ik kan weer), en een manager (opruimen). */
'use strict';

// dezelfde klok als de cadans en de werklijst; zie ./wijk-doos.js
const klok = require('../../lib/klok');

const MAXLEEN = 60;

function doos(h) {
  if (!h.tafelleen || typeof h.tafelleen !== 'object') h.tafelleen = {};
  return h.tafelleen;
}

module.exports = ({ horeca, schoon }) => {
  const { nu } = horeca;
  const tafelNaam = (t) => schoon(t, 30).trim();

  const van = (h, tafel) => doos(h)[tafelNaam(tafel)] || null;

  /* Uitlenen. Wordt aangeroepen vanuit de aanvaarding van een deel-aanbod en
     nergens anders: een tafel die zonder aanbod bij iemand terechtkomt, is
     precies het gat dat de overdracht dichtlegt. */
  function zet(h, tafel, wie, herkomst) {
    const t = tafelNaam(tafel);
    if (!t) return null;
    const d = doos(h);
    if (!d[t] && Object.keys(d).length >= MAXLEEN) return null;
    const uit = herkomst || {};
    d[t] = { tafel: t, staffId: String(wie.staffId), naam: wie.naam, at: nu(),
      vanId: uit.vanId == null ? null : String(uit.vanId), vanNaam: uit.vanNaam || null,
      wijkId: uit.wijkId || null, wijkNaam: uit.wijkNaam || null };
    return d[t];
  }

  function terug(h, tafel, wie) {
    const t = tafelNaam(tafel);
    const l = doos(h)[t];
    if (!l) return { status: 404, error: 'Deze tafel is niet uitgeleend.' };
    const mijn = String(l.staffId) === String(wie.staffId);
    const uitgeleend = l.vanId != null && String(l.vanId) === String(wie.staffId);
    if (!mijn && !uitgeleend && !wie.manager) {
      return { status: 409,
        error: l.naam + ' draagt tafel ' + t + '; alleen hij, ' + (l.vanNaam || 'wie hem uitleende') +
          ' of een manager geeft hem terug.' };
    }
    delete doos(h)[t];
    return { ok: true, leen: l,
      let: 'Tafel ' + t + ' hoort weer bij ' + (l.wijkNaam ? l.wijkNaam : 'zijn eigen wijk') + '.' };
  }

  const alle = (h) => Object.keys(doos(h)).map((t) => doos(h)[t]);

  // wat ik van een ander draag, en wat een ander van mij draagt
  const naarMij = (h, staffId) => alle(h).filter((l) => String(l.staffId) === String(staffId));
  const vanMij = (h, staffId) => alle(h).filter((l) => l.vanId != null && String(l.vanId) === String(staffId));

  /* De hele lijst, met minuten. Er staat GEEN grens op hoe lang een tafel
     uitgeleend mag zijn: dat hangt af van de avond, en hem hier verzinnen zou
     een getal maken dat niemand gemeten heeft (HORECA.md, grens 7). */
  function lijst(h) {
    return alle(h)
      .map((l) => Object.assign({}, l, { staat: Math.max(0, Math.round((klok.nu() - Date.parse(l.at)) / 60000)) }))
      .sort((a, b) => b.staat - a.staat);
  }

  return { van, zet, terug, lijst, naarMij, vanMij, MAXLEEN };
};
