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

  /* EEN HALF AANBOD AANVAARDEN. Staat hier en niet bij de overdracht, want dit
     IS de leen: de overdracht bepaalt alleen wie er iets mag, en wat er dan
     gebeurt is een zaak van deze laag. Alles of niets is het NIET -- wat er
     binnen de grens past gaat mee, en de aanroeper krijgt te horen wat. */
  function neemOver(h, tafels, wie, uit) {
    const gedaan = [];
    for (const t of (Array.isArray(tafels) ? tafels : [])) if (zet(h, t, wie, uit)) gedaan.push(t);
    if (!gedaan.length) return { status: 409, error: 'Er staan te veel tafels uitgeleend.' };
    return { ok: true, tafels: gedaan,
      let: gedaan.join(', ') + ' ' + (gedaan.length === 1 ? 'is' : 'zijn') + ' nu van u; ' +
        ((uit && uit.vanNaam) || 'uw collega') + ' houdt de rest van ' +
        ((uit && uit.wijkNaam) || 'de wijk') + '.' };
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

  /* IS DE DRAGER ER NOG? -- het einde van de dienst, GELEZEN en niet gezet.

     Een leen eindigt doordat iemand hem teruggeeft (zie de kop). Dat blijft zo:
     uitklokken geeft hier NIETS vanzelf terug, want een tafel die stil
     terugspringt naar iemand die er niet op rekent is dezelfde fout als een
     tafel die tussen twee mensen door valt. Wat wel kan, en wat ontbrak, is
     ZIEN dat de drager naar huis is -- uit het klokboek dat de zaak al bijhoudt
     (/api/staff/clock), zonder een tweede register voor "wie is er".

     DRIE STANDEN, NOOIT TWEE, net als bij de plaats op de klokregel:
       ingeklokt     er staat een open klokregel van deze mens
       uitgeklokt    hij klokte uit NA het uitlenen, en niet meer in
       niet-gemeten  geen klokregel na de leen: veel zaken klokken niet, en
                     "niemand klokte" is geen "hij is weg"
     Die derde weglaten zou elke zaak zonder prikklok een vloer vol
     verlaten tafels geven. */
  function drager(l, klokBoek) {
    if (!Array.isArray(klokBoek)) return { stand: 'niet-gemeten', reden: 'Deze zaak heeft geen klokboek.' };
    const zijne = klokBoek.filter((e) => e && String(e.staffId) === String(l.staffId) && e.in);
    if (zijne.some((e) => !e.out)) return { stand: 'ingeklokt' };
    const sinds = Date.parse(l.at) || 0;
    const na = zijne.filter((e) => (Date.parse(e.out) || 0) >= sinds)
      .sort((a, b) => Date.parse(b.out) - Date.parse(a.out))[0];
    if (na) return { stand: 'uitgeklokt', om: na.out };
    return { stand: 'niet-gemeten',
      reden: 'Er staat geen klokregel van na het uitlenen; of ' + (l.naam || 'de drager') + ' er nog is, weet het systeem niet.' };
  }

  /* De hele lijst, met minuten. Er staat GEEN grens op hoe lang een tafel
     uitgeleend mag zijn: dat hangt af van de avond, en hem hier verzinnen zou
     een getal maken dat niemand gemeten heeft (HORECA.md, grens 7). Met een
     klokboek erbij draagt elke leen ook de stand van zijn drager. */
  function lijst(h, klokBoek) {
    return alle(h)
      .map((l) => Object.assign({}, l, { staat: Math.max(0, Math.round((klok.nu() - Date.parse(l.at)) / 60000)) },
        klokBoek === undefined ? {} : { drager: drager(l, klokBoek) }))
      .sort((a, b) => b.staat - a.staat);
  }

  /* WIE ZIJN WIJK LOSLAAT, GAAT MEESTAL NAAR HUIS -- en kan dan nog tafels van
     een collega dragen. Die gaan NIET mee terug: loslaten gaat over de wijk, en
     een leen eindigt doordat iemand hem teruggeeft. Wat wel gebeurt is dat het
     antwoord het ZEGT, op het moment dat de mens nog een PDA in zijn hand
     heeft. Draagt hij niets, dan komt er niets bij. */
  function herinnering(h, staffId) {
    const nog = staffId == null ? [] : naarMij(h, staffId);
    if (!nog.length) return {};
    const eenUitlener = nog[0].vanNaam && nog.every((l) => l.vanNaam === nog[0].vanNaam);
    return {
      nogGeleend: nog.map((l) => ({ tafel: l.tafel, vanNaam: l.vanNaam, wijkNaam: l.wijkNaam })),
      herinnering: 'U draagt nog ' + (nog.length === 1 ? 'tafel ' : 'de tafels ') +
        nog.map((l) => l.tafel).join(', ') + (eenUitlener ? ' van ' + nog[0].vanNaam : '') +
        '. Die blijven op uw naam tot u ze teruggeeft.' };
  }

  return { van, zet, neemOver, terug, lijst, naarMij, vanMij, drager, herinnering, MAXLEEN };
};
