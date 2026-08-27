/* Horeca-kern (deelmodule): DE BEZORGREKENSOM -- zones, kosten en tijdsloten.

   WAAROM DIT HIER STAAT EN NIET IN DE ROUTE. Dit is de tweede keer dat dezelfde
   verhuizing nodig is (de eerste was ./regel.js). Het patroon is elke keer
   hetzelfde: de rekensom stond in de handler omdat er een aanroeper was, en
   zodra de gast dezelfde vraag stelt -- kan ik hier bezorgd krijgen, wat kost
   het, is er nog ruimte om zeven uur -- zouden er twee antwoorden ontstaan.

   Dat is bij bezorging erger dan bij een prijs. Een zone die de zaak anders
   uitrekent dan de gast betekent een bestelling die wordt aangenomen en niet
   kan worden gereden, en dat merkt niemand tot de bezorger belt.

   TWEE REGELS DIE UIT DE OUDE ROUTE MEEKOMEN EN HIER BLIJVEN:
   - Een zone antwoordt altijd met een REDEN. Niet "dat gaat niet" maar "u zit
     9,2 km verderop en we rijden tot 7 km".
   - Een vol tijdslot noemt het EERSTVOLGENDE. Een capaciteitsrem die alleen nee
     zegt, stuurt de klant naar een ander. De rem telt in keukenminuten en niet
     in bestellingen: tien pizza's zijn geen tien diners. */
'use strict';

module.exports = ({ save, horeca, haversine }) => {
  const { H, nu, id, heleCenten } = horeca;

  const B = (code) => {
    const h = H(code);
    if (!h.bezorg) h.bezorg = { zones: [], sloten: {}, open: true, ritten: {} };
    return h.bezorg;
  };
  const pc = (s) => String(s || '').toUpperCase().replace(/\s+/g, '').slice(0, 6);

  /* Welke zone hoort bij dit adres? Geeft de zone of een reden -- nooit alleen
     een nee. `zaak` draagt lat/lng voor de straalzones. */
  function zoekZone(b, { postcode, lat, lng }, zaak) {
    const code = pc(postcode);
    for (const z of b.zones) if (z.postcodes.length && z.postcodes.some(p => code.startsWith(p))) return { zone: z, hoe: 'postcode' };
    if (lat != null && lng != null && zaak && zaak.lat != null && zaak.lng != null) {
      const km = haversine(Number(lat), Number(lng), Number(zaak.lat), Number(zaak.lng));
      for (const z of b.zones) if (z.straalKm && km <= z.straalKm) return { zone: z, hoe: 'straal', km: Math.round(km * 10) / 10 };
      const grootste = b.zones.filter(z => z.straalKm).sort((a, c) => c.straalKm - a.straalKm)[0];
      if (grootste) return { zone: null, reden: 'U zit ' + (Math.round(km * 10) / 10) + ' km verderop; we bezorgen tot ' + grootste.straalKm + ' km.', km: Math.round(km * 10) / 10 };
    }
    return { zone: null, reden: code ? 'Postcode ' + code + ' valt buiten onze bezorgzones.' : 'Geef een postcode of een locatie op.' };
  }

  /* Het volledige antwoord op "kan dit hier bezorgd worden en voor hoeveel".
     Eén vorm voor de zaak en voor de gast, want het is dezelfde vraag. */
  function bezorgCheck(zaakcode, zaak, { postcode, lat, lng, bedragCenten }) {
    const b = B(zaakcode);
    if (!b.zones.length) return { status: 409, error: 'Deze zaak bezorgt niet: er zijn geen bezorgzones ingesteld.', code: 'geen-zones' };
    const uit = zoekZone(b, { postcode, lat, lng }, zaak);
    if (!uit.zone) return { ok: true, bezorgbaar: false, reden: uit.reden, code: 'buiten-zone', km: uit.km || null };
    const z = uit.zone;
    const bedrag = heleCenten(bedragCenten);
    const gratis = !!(z.gratisVanafCenten && bedrag >= z.gratisVanafCenten);
    return {
      ok: true, bezorgbaar: b.open, gesloten: !b.open,
      redenDicht: b.open ? null : (b.redenDicht || 'De bezorging is tijdelijk gesloten.'),
      zone: { id: z.id, naam: z.naam, minuten: z.minuten }, hoe: uit.hoe, km: uit.km || null,
      kostenCenten: gratis ? 0 : z.kostenCenten, gratisBezorging: gratis,
      minimumCenten: z.minimumCenten,
      haaltMinimum: !z.minimumCenten || bedrag >= z.minimumCenten,
      tekort: z.minimumCenten && bedrag < z.minimumCenten ? z.minimumCenten - bedrag : 0
    };
  }

  function slotenVan(zaakcode, datum) {
    const b = B(zaakcode);
    const dag = datum || nu().slice(0, 10);
    const bezet = (b.sloten[dag] || {});
    return { datum: dag, sloten: Object.entries(b.slotInstel || {}).sort().map(([tijd, cap]) => ({
      tijd, capaciteitMinuten: cap, gebruiktMinuten: bezet[tijd] || 0,
      vrij: Math.max(0, cap - (bezet[tijd] || 0)), vol: (bezet[tijd] || 0) >= cap })) };
  }

  /* Reserveert keukenminuten in een slot. Faalt hij, dan noemt hij het
     eerstvolgende slot dat wél kan -- dat is het verschil tussen een rem en een
     dichte deur. */
  function reserveerSlot(zaakcode, { datum, tijd, minuten }) {
    const b = B(zaakcode);
    const dag = datum || nu().slice(0, 10);
    const m = Math.max(1, Math.min(600, parseInt(minuten, 10) || 15));
    const cap = (b.slotInstel || {})[tijd];
    if (cap == null) return { status: 404, error: 'Dat tijdslot bestaat niet.', code: 'slot-onbekend' };
    b.sloten[dag] = b.sloten[dag] || {};
    const gebruikt = b.sloten[dag][tijd] || 0;
    if (gebruikt + m > cap) {
      const volgende = Object.entries(b.slotInstel).sort()
        .find(([t, c]) => t > tijd && (c - ((b.sloten[dag] || {})[t] || 0)) >= m);
      return { status: 409, code: 'slot-vol',
        error: 'Dat tijdslot is vol (' + gebruikt + ' van ' + cap + ' minuten bezet).',
        vol: true, eerstvolgende: volgende ? volgende[0] : null,
        let: volgende ? 'Om ' + volgende[0] + ' is er nog ruimte.' : 'Er is vandaag geen slot meer vrij met genoeg ruimte.' };
    }
    b.sloten[dag][tijd] = gebruikt + m;
    save();
    return { ok: true, datum: dag, tijd, gereserveerd: m, gebruikt: b.sloten[dag][tijd], capaciteit: cap };
  }

  /* Een slot weer vrijgeven. Nodig zodra een gast zelf reserveert: een mandje
     dat halverwege strandt zou anders capaciteit blijven vasthouden die niemand
     gebruikt, en de rem knijpt dan een keuken dicht die leegstaat. */
  function geefSlotTerug(zaakcode, { datum, tijd, minuten }) {
    const b = B(zaakcode);
    const dag = datum || nu().slice(0, 10);
    if (!b.sloten[dag] || b.sloten[dag][tijd] == null) return { ok: true, teruggegeven: 0 };
    const m = Math.max(0, parseInt(minuten, 10) || 0);
    b.sloten[dag][tijd] = Math.max(0, b.sloten[dag][tijd] - m);
    save();
    return { ok: true, teruggegeven: m, gebruikt: b.sloten[dag][tijd] };
  }

  return { B, pc, zoekZone, bezorgCheck, slotenVan, reserveerSlot, geefSlotTerug, id };
};
