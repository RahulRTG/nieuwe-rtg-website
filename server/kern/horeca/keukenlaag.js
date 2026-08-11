/* Horeca (kern): hoe lang een gerecht duurt, en hoeveel werk er open staat.

   WAAROM DIT HIER STAAT EN NIET MEER IN DE ROUTE. `bereidingsMinuten` en de
   drukterem woonden in routes/supplier/horeca/keuken*.js en werden aan `kern`
   gehangen (`kern.horecaBereidingsMinuten`). Dat werkte zolang er een
   leverancier ingelogd was. Zodra de polslaag dezelfde wachttijd wilde tonen
   aan een gast, bleek hij er niet bij te kunnen -- precies de fout die
   `horecaFolioVan` eerder maakte: een rekensom die twee domeinen nodig hebben
   staat niet op een eigenschap die een van de twee toevallig zet, maar in de
   kern (LAT-regel 4).

   De rekensom zelf is met opzet simpel en navertelbaar: alle openstaande
   bereidingsminuten gedeeld door het aantal koks. Geen weging, geen historisch
   gemiddelde, geen model. Wie het getal niet vertrouwt, kan het narekenen -- en
   dat is de enige reden dat iemand een wachttijd gelooft. */
'use strict';

// hoe lang een gerecht normaal duurt zonder eigen opgave van de zaak
const STANDAARD = { koud: 6, warm: 14, grill: 12, frituur: 8, pizza: 9, sushi: 10,
  patisserie: 10, bar: 3, koffie: 3, roomservice: 18, afhaal: 10 };

// de kanalen waarbij iemand fysiek in de zaak zit: die tellen mee voor bezetting
const BINNEN = ['tafel', 'qr', 'bar', 'terras', 'club', 'hotelrestaurant'];

function bereidingsMinuten(h, regel) {
  const eigen = ((h.instel || {}).bereidingstijden || {})[String(regel.naam || '').toLowerCase()];
  if (eigen) return Math.max(1, Math.min(180, Number(eigen)));
  return STANDAARD[String(regel.station || '').toLowerCase()] || 12;
}

/* Het openstaande werk, per station en in totaal. `kokken` mag worden
   meegegeven (de chef die een scenario doorrekent); anders staat het in de
   zaakinstelling en anders is het er drie. */
function openWerk(h, kokken) {
  const capaciteit = Math.max(1, Math.min(60, parseInt(kokken, 10) || (h.instel || {}).kokken || 3));
  const perStation = {};
  let regels = 0;
  for (const rek of Object.values(h.rekeningen || {})) {
    if (rek.status !== 'open') continue;
    for (const regel of (rek.regels || [])) {
      if (regel.stand === 'klaar' || regel.stand === 'uitgegeven') continue;
      const st = String(regel.station || 'warm');
      perStation[st] = (perStation[st] || 0) + bereidingsMinuten(h, regel) * regel.aantal;
      regels++;
    }
  }
  const openMinuten = Object.values(perStation).reduce((t, x) => t + x, 0);
  return { kokken: capaciteit, perStation, openMinuten, regels,
    wachttijd: Math.round(openMinuten / capaciteit),
    rekensom: openMinuten + ' bereidingsminuten open, gedeeld door ' + capaciteit + ' kok(s).' };
}

module.exports = { STANDAARD, BINNEN, bereidingsMinuten, openWerk };
