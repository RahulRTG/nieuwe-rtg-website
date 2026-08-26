/* DE TARIEFKAART: wat kost één eenheid RTG in het echt.

   EEN TARIEF ZONDER BRON BESTAAT NIET. Dat is de enige regel die dit bestand
   afdwingt, en hij is de reden dat het bestaat. Een kostprijs is namelijk geen
   meting maar een AFSPRAAK met een derde: de prijslijst van een modelaanbieder,
   het contract met de hoster, het tarievenblad van de betaalpartner. Wie zo'n
   getal invult zonder erbij te zetten waar het vandaan komt, levert een factuur
   op die niemand kan navertellen -- ook wijzelf niet, over een half jaar.

   Zonder tarief rekent deze laag dus NIETS uit. Het overzicht toont de soort
   met "geen tarief" en de reden erbij, precies zoals TENANT.md het met
   `nietGebouwd` doet. Dat is met opzet onhandig: het is de enige manier waarop
   een ontbrekend tarief opvalt voordat er een rekening uit rolt.

   MILLICENTEN, EN WAAROM DAT GEEN OVERDRIJVING IS. Duizend AI-tokens kosten in
   de orde van een tiende cent. In hele centen is dat 0, en dan is de AI-kost van
   het hele huis nul. In millicenten (duizendste centen) blijft het verschil
   tussen twee aanbieders zichtbaar, en er wordt pas afgerond op de FACTUURREGEL
   -- één keer, aan het eind, in plaats van bij elke optelling opnieuw.

   DE GESCHIEDENIS IS GEEN LUXE. Een tarief verandert (een aanbieder verhoogt
   zijn prijs, de hoster stuurt een nieuw contract). Rekent het overzicht van
   juni daarna met het julitarief, dan verandert een factuur die al verstuurd is.
   Daarom bewaart elke soort zijn vorige standen en kiest ./overzicht.js het
   tarief dat IN die periode gold. Herschrijven doen we niet. */
'use strict';

const { soort, gemeten } = require('./soorten');

const MAX_MILLICENT = 100000000;  // 1.000 euro per eenheid: een grens op het doel, tegen tikfouten
const HISTORIE_MAX = 24;

module.exports = (ctx) => {
  const { d, save, nu } = ctx;

  function kaart() {
    const k = d();
    if (!k.tarieven || typeof k.tarieven !== 'object') k.tarieven = {};
    return k.tarieven;
  }

  /* Het tarief zoals het op een MOMENT gold. `op` is een ISO-tijd; de jongste
     stand die niet ná dat moment is gezet wint. Geen enkele stand van voor dat
     moment betekent: er was toen geen tarief, en dan rekenen we niet. */
  function tariefOp(soortId, op) {
    const rij = kaart()[String(soortId || '')];
    if (!rij) return null;
    const grens = String(op || nu());
    const standen = [rij].concat(Array.isArray(rij.historie) ? rij.historie : [])
      .filter(s => s && Number.isFinite(s.perEenheid) && s.bron && String(s.gezetOp || '') <= grens)
      .sort((a, b) => String(b.gezetOp).localeCompare(String(a.gezetOp)));
    const g = standen[0];
    return g ? { perEenheid: g.perEenheid, bron: g.bron, gezetOp: g.gezetOp } : null;
  }

  const zicht = (id) => {
    const r = kaart()[id];
    const s = soort(id);
    return { soort: id, naam: s ? s.naam : id, eenheid: s ? s.eenheid : null,
      perEenheid: r && Number.isFinite(r.perEenheid) ? r.perEenheid : null,
      bron: (r && r.bron) || null, gezetOp: (r && r.gezetOp) || null, gezetDoor: (r && r.gezetDoor) || null,
      ontbreekt: !(r && Number.isFinite(r.perEenheid) && r.bron) };
  };

  /* Alle soorten die een tarief NODIG hebben. De toegerekende soorten (stroom,
     hosting) staan er niet bij: die hebben geen prijs per eenheid maar een
     rekening, en die staat in ./huisrekening.js. Twee plekken voor hetzelfde
     bedrag zou precies de dubbele boekhouding zijn die WAARDE.md verbiedt. */
  const tarieven = () => gemeten().map(s => zicht(s.id));
  const ontbrekend = () => tarieven().filter(t => t.ontbreekt).map(t => t.soort);

  /* Zetten. `bron` is verplicht en wordt niet gecontroleerd op waarheid -- dat
     kan software niet -- maar wel op aanwezigheid. Wie hem leeg laat krijgt een
     weigering met de reden, en niet stil een tarief zonder herkomst. */
  function tariefZet(soortId, perEenheid, bron, wie) {
    const s = soort(soortId);
    if (!s) return { status: 400, error: 'Onbekende kostensoort.' };
    if (s.meetweg !== 'gemeten') return { status: 400, error: 'Deze soort heeft geen tarief per eenheid; hij wordt toegerekend uit de huisrekening.' };
    const n = Math.round(Number(perEenheid));
    if (!Number.isFinite(n) || n < 0 || n > MAX_MILLICENT) return { status: 400, error: 'Geen geldig bedrag in millicenten.' };
    const b = String(bron == null ? '' : bron).trim().slice(0, 300);
    if (b.length < 4) return { status: 400, error: 'Een tarief zonder bron bestaat niet; noem het contract, de prijslijst of de factuur waar dit bedrag vandaan komt.' };
    const k = kaart();
    const oud = k[s.id];
    const stand = { perEenheid: n, bron: b, gezetOp: nu(), gezetDoor: String(wie || 'kantoor').slice(0, 80) };
    const historie = oud ? [{ perEenheid: oud.perEenheid, bron: oud.bron, gezetOp: oud.gezetOp, gezetDoor: oud.gezetDoor }]
      .concat(Array.isArray(oud.historie) ? oud.historie : []).slice(0, HISTORIE_MAX) : [];
    k[s.id] = Object.assign(stand, { historie });
    save();
    return { status: 200, ok: true, tarief: zicht(s.id) };
  }

  return { tarieven, tariefZet, tariefOp, ontbrekend, MAX_MILLICENT };
};
