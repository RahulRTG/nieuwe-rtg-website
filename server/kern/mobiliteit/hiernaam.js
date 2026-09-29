/* Mobility OS (deelmodule): een reis die "hier" begint, bewaart een PLAATSNAAM
   en geen GPS (NAVIGATIE.md N21).

   WAAROM. Wie een reis plant vanaf "Huidige locatie" gaf zijn live positie mee
   (`{ hier: true }` in ./plekken.js), en die positie belandde als `van` in de
   geboekte reis en in elke etappe ervan -- zonder termijn, aan de sleutel van
   het lid. Het plannen en routeren mag dat punt gebruiken zolang het verzoek
   loopt (N11): daar is het voor. Maar wat er daarna in het reisoverzicht blijft
   staan, is een plek om terug te lezen ("vertrokken bij de halte Marina") en
   geen coordinaat van waar iemand stond.

   DE PLAATSNAAM komt uit wat dit domein al kent: de haltes van de OV-lijnen en
   de zaken met een plek op de kaart. De dichtstbijzijnde wint; er wordt niets
   buiten het huis gevraagd. Is er niets bekends in de buurt, dan staat er
   "Vertrekpunt" en geen verzonnen naam.

   De taxi-OPDRACHT krijgt het exacte ophaalpunt wel: de chauffeur moet weten
   waar hij moet stoppen. Dat punt valt onder N16 (exact tijdens de rit, bij
   afronden de plaatsnaam van de factuur) en niet onder deze regel. */
'use strict';

const BUURT_M = 5000;   // verder dan dit is een naam geen "bij" meer

module.exports = ({ ovHaltes, opslag, haversine }) => {
  function plaatsKandidaten() {
    const uit = [];
    for (const h of (ovHaltes ? ovHaltes() : [])) uit.push({ naam: h.naam, lat: h.lat, lng: h.lng });
    for (const s of (opslag.vreemd.leveranciers() || [])) {
      if (s && s.loc && Number.isFinite(s.loc.lat) && Number.isFinite(s.loc.lng))
        uit.push({ naam: s.name, lat: s.loc.lat, lng: s.loc.lng });
    }
    return uit;
  }

  /* Een plek met bron 'live' wordt { label, bron: 'hier' } zonder lat en lng.
     Elke andere plek (zaak, halte, favoriet, kaart) blijft zoals hij is: die
     komt niet van het toestel van het lid. */
  function hierAlsNaam(plek) {
    if (!plek || plek.bron !== 'live') return plek;
    let beste = null, af = Infinity;
    for (const k of plaatsKandidaten()) {
      const m = haversine({ lat: plek.lat, lng: plek.lng }, { lat: k.lat, lng: k.lng });
      if (m != null && m < af) { af = m; beste = k; }
    }
    const naam = beste && af <= BUURT_M ? 'Bij ' + beste.naam : 'Vertrekpunt';
    return { label: naam, bron: 'hier' };
  }

  /* De geboekte reis vlak voor hij wordt opgeslagen: vertrek, bestemming en
     elke etappe. Het plannen en de taxi-opdracht hebben het punt dan al gehad. */
  function reisZonderGps(r) {
    r.van = hierAlsNaam(r.van); r.naar = hierAlsNaam(r.naar);
    for (const e of r.etappes || []) { e.van = hierAlsNaam(e.van); e.naar = hierAlsNaam(e.naar); }
    return r;
  }

  return { hierAlsNaam, reisZonderGps };
};
