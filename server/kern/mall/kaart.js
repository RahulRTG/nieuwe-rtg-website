/* RTG Mall, deelbestand "kaart": DE LIGGING VAN DE TREFFERS.

   ================== WAT DIT WEL EN NIET IS ==================

   Dit is GEEN straatkaart. Er komt geen tegel van een tegelserver, want de CSP
   van dit huis staat dat niet toe (`default-src 'self'`) en een kaartdienst
   inhuren betekent dat elke zoekopdracht van een lid langs een vreemde server
   komt -- inclusief waar hij staat. Dat is precies het soort lek waar de rest
   van dit huis omheen is gebouwd.

   Wat het WEL is: de onderlinge ligging. De treffers worden geprojecteerd op
   een vierkant vlak, met het punt van de zoeker in het midden, en het scherm
   tekent daar bolletjes van. Je ziet daarmee wat je van een kaart wilt weten
   in een zoeklijst -- ligt dit bij elkaar, ligt dit bij mij, ligt dit aan de
   verkeerde kant van het eiland -- zonder ook maar iets naar buiten te sturen.
   Het scherm zet er met zoveel woorden bij dat het geen straatkaart is; doen
   alsof is erger dan het niet hebben.

   ================== DE PROJECTIE ==================

   Equirectangular, met een cosinus-correctie op de lengtegraad. Op de schaal
   van een stad of een eiland (waar deze kaart voor is) is dat op een paar
   meter na juist. Op de schaal van een werelddeel klopt het niet meer, en
   daarom zegt `schaalKm` hoe groot het vlak is: staat daar 2.400, dan kijk je
   naar een projectie die je niet als kaart moet lezen.

   ================== WAT ER NIET OP STAAT, MET NAAM ==================

   Lang niet elk aanbod heeft een coordinaat. Een landelijke jurist heeft er
   geen, een marktplaatsadvertentie vaak ook niet, en een zaak die haar adres
   nooit heeft ingevuld evenmin. Die verdwijnen NIET stilletjes van de kaart:
   ze komen als `zonderPunt` terug met hun aantal, zodat het scherm "8 van de
   40 treffers staan niet op de kaart" kan tonen (LAT-regel 5). Een kaart die
   driekwart van de treffers weglaat en er niets over zegt, liegt harder dan
   een lijst. */

const RAD = Math.PI / 180;
const AARDE_KM = 111.32;   // km per graad breedte
const MIN_SPAN = 0.004;    // ~450 m; anders wordt een enkel punt oneindig uitvergroot

// het punt van een aanbod: de zaak zelf, anders het middelpunt van zijn plek
function puntVan(a) {
  const p = a.plek || {};
  const q = p.punt || null;
  if (!q || typeof q.lat !== 'number' || typeof q.lng !== 'number') return null;
  if (!isFinite(q.lat) || !isFinite(q.lng)) return null;
  if (Math.abs(q.lat) > 90 || Math.abs(q.lng) > 180) return null;
  return { lat: q.lat, lng: q.lng };
}

/* De projectie van een lijst aanbod op een vlak van 0..1 bij 0..1. `midden` is
   het punt van de zoeker als hij er een heeft, anders het zwaartepunt van de
   treffers -- zonder midden zou het vlak verspringen zodra er een treffer bij
   komt en beweegt de hele kaart onder je hand vandaan. */
function kaartVan(items, punt) {
  const lijst = Array.isArray(items) ? items : [];
  const met = [], zonder = [];
  for (const a of lijst) {
    const q = puntVan(a);
    if (q) met.push({ a, q }); else zonder.push(a);
  }
  if (!met.length) {
    return {
      punten: [], midden: punt || null, schaalKm: 0,
      zonderPunt: zonder.length, totaal: lijst.length,
      opmerking: 'Geen van deze treffers heeft een coordinaat, dus er valt niets te plaatsen.',
      geenStraatkaart: true
    };
  }
  const midden = (punt && typeof punt.lat === 'number' && typeof punt.lng === 'number') ? punt : {
    lat: met.reduce((s, x) => s + x.q.lat, 0) / met.length,
    lng: met.reduce((s, x) => s + x.q.lng, 0) / met.length
  };
  const cos = Math.max(0.15, Math.cos(midden.lat * RAD));

  /* Het vlak is VIERKANT en gecentreerd op het midden: de grootste afwijking
     in beide richtingen bepaalt de halve zijde. Een vlak dat per as anders
     schaalt, zet noord-zuid en oost-west in een andere maat en dan liegt de
     vorm van de spreiding. */
  let half = MIN_SPAN;
  for (const { q } of met) {
    half = Math.max(half, Math.abs(q.lat - midden.lat), Math.abs(q.lng - midden.lng) * cos);
  }
  half *= 1.08;  // marge, zodat een bolletje op de rand niet half buiten het vlak valt

  const punten = met.map(({ a, q }) => ({
    id: a.id, titel: a.titel, type: a.type, verdieping: a.verdieping,
    aanbieder: a.aanbieder.naam, prijs: a.prijs ? a.prijs.bedrag : null,
    open: a.open ? a.open.open : null,
    // 0..1, met y naar beneden zoals een scherm rekent: noord staat boven
    x: 0.5 + ((q.lng - midden.lng) * cos) / (2 * half),
    y: 0.5 - (q.lat - midden.lat) / (2 * half),
    afstand: a.afstand != null ? a.afstand : null
  }));

  return {
    punten, midden,
    schaalKm: Math.round(half * 2 * AARDE_KM * 10) / 10,
    zonderPunt: zonder.length, totaal: lijst.length,
    /* Deze twee regels zijn geen sier. Ze staan in het antwoord zodat het
       scherm ze niet kan vergeten en een tweede scherm ze niet anders
       verzint. */
    opmerking: zonder.length
      ? zonder.length + ' van de ' + lijst.length + ' treffers hebben geen coordinaat en staan hier niet op.'
      : null,
    geenStraatkaart: true
  };
}

module.exports = { kaartVan, puntVan, MIN_SPAN };
