/* WAAR DE PRIJS VAN EEN REIS VANDAAN KOMT -- de commerciële bron onder de geldrij.

   Dit is de schakel die ontbrak, en het ontbreken ervan was gemeten en niet
   vermoed. `DOORBELASTING.json` telt 26 geldvormen met een aantoonbare herkomst
   en daar zit GEEN ENKELE reisbetaling bij; de reiswereld draagt wel een
   `herkomst` per regel (kern/reiswereld-regel.js, REIZEN.md par. 2.2) maar die
   regel kent geen bedrag, en `partnerTrips` draagt wel een bedrag maar dat is
   EEN getal met marketingtekst ernaast (`includes`, vier zinnen).

   RTG wist dus van een reisonderdeel WAAR het vandaan kwam, en wist van een reis
   WAT hij kostte, en die twee stonden nooit op dezelfde rij. Precies daarom kon
   niemand zeggen welk deel van EUR 2.200 aan een hotel toekomt.

   WAT EEN ONDERDEEL DRAAGT, en waarom elk veld:

     soort        wat de reiziger ziet (verblijf, vervoer, activiteit, dienst)
     herkomst     wat het systeem weet: van wie deze waarde kwam
     eigenaar     aan wie hij economisch toekomt -- NOOIT afgeleid uit herkomst
     ppCenten     per persoon, in CENTEN
     wat          de menselijke naam, voor op een bon
     leverancier  een VERWIJZING en nooit een kopie van de partnerrij

   `herkomst` en `eigenaar` staan er allebei omdat ze uiteenlopen, en dat is de
   hele les van kern/waarde/economischeherkomst.js: een transfer die RTG inkoopt
   bij een lokale vervoerder heeft herkomst `partner` en eigenaar `derde`, maar
   het samenstellen van de reis heeft herkomst `rtg` en eigenaar `rtg`. Wie de
   ene uit de andere afleidt, verzint de helft.

   CENTEN EN GEEN EURO'S. `partnerTrips[].netto` staat in EURO'S (2200 betekent
   tweeduizend tweehonderd euro), en `reisbureau.js` rekent daarmee door in
   euro's. Dat is de fout die COMMERCE.md al een keer noteerde over
   kern/mall/aanbod.js, en hij wordt hier niet herhaald: een samenstelling telt
   in centen, en de omrekening staat op EEN plek (`nettoCenten`).

   EN EEN REIS ZONDER SAMENSTELLING IS ONBEKEND EN NIET LEEG. Twee van de drie
   reizen in de zaaiset hebben er vandaag geen. Die leveren hier geen lege lijst
   op maar een uitslag met `bekend: false` en de reden erbij -- een lege lijst
   zou als "er zijn geen derden" lezen, en dat is een bewering die niemand heeft
   gedaan. */
'use strict';

/* De soorten die een reiziger ziet. Gesloten lijst: een typefout mag geen
   nieuwe soort worden, want dan telt hij nergens mee. */
const SOORTEN = Object.freeze(['verblijf', 'vervoer', 'activiteit', 'dienst', 'heffing']);

/* Waar de waarde vandaan kwam. Dezelfde woorden als kern/reiswereld-regel.js
   gebruikt, zodat de twee lagen over hetzelfde spreken. */
const HERKOMSTEN = Object.freeze(['partner', 'rtg', 'extern']);

/* Aan wie hij economisch toekomt. Dit zijn de partijsoorten van
   kern/waarde/economischeherkomst.js en met opzet geen eigen lijst: een tweede
   woordenlijst voor dezelfde vraag is de VERMOGENS-botsing uit SEMANTIEK.json. */
const { isSoort } = require('./waarde/economischeherkomst');

const centenVanEuro = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

/* ---------- de samenstelling van EEN reis ---------- */
function samenstellingVan(trip) {
  if (!trip || typeof trip !== 'object') {
    return { bekend: false, waarom: 'geen reis meegegeven', onderdelen: [], nettoCenten: null };
  }
  const nettoCenten = centenVanEuro(trip.netto);
  const rauw = Array.isArray(trip.samenstelling) ? trip.samenstelling : null;

  if (!rauw || !rauw.length) {
    return {
      bekend: false, onderdelen: [], nettoCenten,
      waarom: 'deze reis draagt geen samenstelling. Dat is ONBEKEND en niet "geen derden": ' +
        'het veld `includes` is marketingtekst zonder bedrag of leverancier, en daar valt geen ' +
        'doorbelasting uit af te leiden zonder hem te verzinnen.'
    };
  }

  const onderdelen = [];
  const bezwaren = [];
  for (const [i, o] of rauw.entries()) {
    const soort = String((o && o.soort) || '').toLowerCase();
    const herkomst = String((o && o.herkomst) || '').toLowerCase();
    const eigenaar = String((o && o.eigenaar) || '').toLowerCase();
    const pp = Number(o && o.ppCenten);
    const plek = 'onderdeel ' + (i + 1) + ' (' + ((o && o.wat) || 'zonder naam') + ')';

    if (!SOORTEN.includes(soort)) bezwaren.push(plek + ': soort "' + soort + '" bestaat niet');
    if (!HERKOMSTEN.includes(herkomst)) bezwaren.push(plek + ': herkomst "' + herkomst + '" bestaat niet');
    if (!isSoort(eigenaar) || eigenaar === 'onbekend') {
      bezwaren.push(plek + ': eigenaar "' + eigenaar + '" is geen vastgestelde partijsoort');
    }
    if (!Number.isInteger(pp) || pp < 0) bezwaren.push(plek + ': ppCenten is geen heel, niet-negatief getal');

    onderdelen.push({
      soort, herkomst, eigenaar, ppCenten: Number.isInteger(pp) ? pp : null,
      wat: String((o && o.wat) || '').slice(0, 120) || null,
      leverancier: (o && o.leverancier) ? String(o.leverancier).slice(0, 80) : null
    });
  }

  /* DE INVARIANT VAN DEZE LAAG: de onderdelen tellen op tot de prijs. Niet
     "ongeveer" -- een verschil hier betekent dat een deel van de reissom nergens
     aan toekomt, en dat is precies de cent die straks stil aan de verkeerde kant
     van de streep belandt. Er wordt niets bijgeschaald en niets afgerond naar de
     prijs toe: de samenstelling is de waarheid of hij is stuk. */
  const som = onderdelen.reduce((a, o) => a + (o.ppCenten || 0), 0);
  const verschil = nettoCenten == null ? null : som - nettoCenten;
  if (verschil !== 0 && bezwaren.length === 0) {
    bezwaren.push('de onderdelen tellen op tot ' + som + ' cent terwijl de reis ' + nettoCenten +
      ' cent kost; verschil ' + verschil + '. Er wordt niets bijgeschaald: een samenstelling die ' +
      'niet sluit, is geen samenstelling.');
  }

  return {
    bekend: bezwaren.length === 0,
    waarom: bezwaren.length ? bezwaren.join(' | ') : null,
    onderdelen, nettoCenten, somCenten: som, verschil
  };
}

/* ---------- de samenstelling maal het aantal personen ----------
   Het bedrag hangt aan het aantal reizigers, en dat staat op EEN plek zodat er
   geen tweede vermenigvuldiging ontstaat (dezelfde reden als in
   kern/reisbureau-nazorg.js, waar een derde persoon anders meereist voor het
   bedrag van twee). */
function voorAanvraag(trip, personen) {
  const s = samenstellingVan(trip);
  const n = Math.max(1, Math.round(Number(personen) || 1));
  if (!s.bekend) return Object.assign({}, s, { personen: n, totaalCenten: null, regels: [] });
  return Object.assign({}, s, {
    personen: n,
    totaalCenten: s.somCenten * n,
    regels: s.onderdelen.map(o => Object.assign({}, o, { centen: o.ppCenten * n }))
  });
}

module.exports = { SOORTEN, HERKOMSTEN, samenstellingVan, voorAanvraag };
