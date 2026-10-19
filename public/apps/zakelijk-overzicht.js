(function (w) {
  'use strict';
  /* Het maandoverzicht van Zakelijk vervoer (zakelijk.html), op het RTG
     Design System: per kostenplaats, per medewerker en de ritten zelf als
     rustige lijst. Dezelfde aanroep als ervoor: /api/supplier/mob/zakelijk. */
  w.RTGZakelijkOverzicht = function (c) {
    const { $, api, eur, leeg, p, maak, rij } = c;
    /* Een groep als lijst: de naam, ritten en kilometers eronder, het bedrag rechts. */
    function groep(waar, rijen) {
      leeg(waar);
      if (!rijen.length) { p(waar, 'Niets in deze maand.'); return; }
      for (const [naam, sub, bedrag] of rijen) waar.appendChild(rij(naam, sub, maak('span', 'ds-lijst__tijd', bedrag)));
    }
    async function haalOverzicht() {
      const r = await api('zakelijk', { maand: $('#oMaand').value || undefined });
      if (r.status !== 200) { $('#oTotaal').textContent = r.body.error || 'geen toegang'; return; }
      const b = r.body;
      $('#oMaand').value = b.maand;
      $('#oTotaal').textContent = b.totaal.aantal + ' ritten · ' + eur(b.totaal.centen);
      $('#oCo2').textContent = Math.round(b.totaal.co2Gram / 1000) + ' kg CO₂ · ' + b.co2Uitleg +
        (b.wachtend ? ' · ' + b.wachtend + ' wacht(en) nog op akkoord' : '') +
        (b.geweigerd ? ' · ' + b.geweigerd + ' geweigerd' : '');
      groep($('#oKp'), b.perKostenplaats.map(k => [k.kostenplaats, k.aantal + ' ritten · ' + k.km + ' km', eur(k.centen)]));
      groep($('#oMw'), b.perMedewerker.map(m => [m.medewerker, m.aantal + ' ritten · ' + m.km + ' km', eur(m.centen)]));
      groep($('#oRitten'), b.ritten.map(o => [o.van + ' → ' + o.naar, o.gemaakt.slice(0, 10) + ' · ' + (o.medewerker || '') +
        (o.kostenplaats ? ' · ' + o.kostenplaats : '') + ' · ' + o.km + ' km', eur(o.prijs)]));
    }
      return haalOverzicht;
  };
})(window);
