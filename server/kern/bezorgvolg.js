/* HET VOLGSCHERM VOOR HET LID -- waar is mijn bestelling, en hoe lang nog?

   WAT ER EERST WAS: de klant kreeg pas iets te zien zodra de bezorger reed.
   Tussen "betaald" en "onderweg" zit de keuken, en dat is precies de tijd
   waarin iemand zich afvraagt of zijn bestelling wel is aangekomen. In die
   stilte zat geen stap, geen tijd en geen woord.

   WAT HIER GEBEURT: dezelfde vier stappen die de zaak intern al doorloopt,
   maar dan in de taal van de klant, met per stap wat er gebeurt en hoe lang
   het nog duurt.

   DE VERWACHTING IS GEMETEN, NIET VERZONNEN

   De verleiding is om "ongeveer 30 minuten" neer te zetten. Dat is een getal
   dat vertrouwen wekt zonder het te verdienen, en bij de eerste drukke avond
   is het een leugen. Daarom komt de keukentijd hier uit de EIGEN historie van
   de zaak: de mediaan van de tijd tussen betalen en het moment dat de keuken
   klaar is, over de recente bestellingen. Is die historie er nog niet, dan geeft dit scherm
   GEEN getal en zegt het waarom. Liever geen verwachting dan een verzonnen.

   De mediaan en niet het gemiddelde: een enkele bon die drie uur op de pas
   bleef liggen omdat er iemand vergat af te vinken, hoort de verwachting van
   alle anderen niet te verzieken. */
'use strict';
const { haversine, etaMinutes } = require('../lib/geo');

/* Minstens zoveel afgeronde bestellingen voordat we een keukentijd durven te
   noemen. Onder dit aantal is de mediaan een toevalstreffer. */
const MINIMAAL = 3;
const TERUG = 40;   // hoeveel recente bestellingen we meewegen

/* De vier stappen zoals de klant ze kent. De sleutels zijn intern, de namen
   staan op het scherm. */
const STAPPEN = [
  { sleutel: 'bevestigd', naam: 'Bevestigd' },
  { sleutel: 'keuken', naam: 'In de keuken' },
  { sleutel: 'onderweg', naam: 'Onderweg' },
  { sleutel: 'bezorgd', naam: 'Bezorgd' }
];

/* Hoe ver is deze bestelling? Geeft de index in STAPPEN van de stap die NU
   bezig is. Bewust afgeleid uit de echte staat van de bon en niet uit een
   apart veld: een tweede administratie loopt binnen een week uit de pas. */
function fase(o) {
  if (!o) return 0;
  if (['bezorgd', 'opgehaald'].includes(o.status)) return 3;
  if (o.status === 'onderweg') return 2;
  if (!o.paid) return 0;
  // betaald: de keuken is bezig zodra er iets in bereiding is, en klaar zodra
  // de bon op de pas ligt of is ingepakt
  if (o.pasAt || o.status === 'klaar' || o.inpak) return 2;   // wacht op vertrek
  return 1;
}

function stappenVan(o) {
  const nu = fase(o);
  return STAPPEN.map((s, i) => Object.assign({}, s, {
    staat: i < nu ? 'gedaan' : i === nu ? 'bezig' : 'wacht'
  }));
}

/* Wat er nu gebeurt, in een zin. Geen loze bemoediging: elke zin zegt iets
   wat de klant niet al op de knop ziet staan. */
function watGebeurtEr(o, bezorgerNaam) {
  if (!o) return '';
  if (['bezorgd', 'opgehaald'].includes(o.status)) return 'Bezorgd. Eet smakelijk.';
  if (o.status === 'onderweg') {
    return bezorgerNaam
      ? bezorgerNaam + ' is onderweg naar u. U ziet hem op de kaart bewegen.'
      : 'Uw bestelling is onderweg.';
  }
  if (!o.paid) return 'We wachten nog op de betaling; daarna gaat hij meteen naar de keuken.';
  if (o.pasAt || o.status === 'klaar') return 'Klaar en ingepakt. Hij wacht op de bezorger.';
  if (o.status === 'in bereiding') return 'De keuken is met uw bestelling bezig.';
  return 'We hebben uw bestelling ontvangen en zijn begonnen.';
}

/* De gemeten keukentijd van deze zaak, in minuten. Null als er te weinig
   historie is -- en dat is een uitkomst en geen storing. */
function keukenMinuten(orders, code) {
  const duren = [];
  for (const o of orders) {
    if (o.supplierCode !== code) continue;
    /* WANNEER IS DE KEUKEN KLAAR? Dat verschilt per soort bon, en dat is geen
       slordigheid maar het model: een bon van de MENUKAART loopt langs de
       keukenlijn (secties, stations) en komt "op de pas" te liggen -- o.pasAt.
       Een BEZORGING komt uit het bezorgassortiment, staat niet op de menukaart
       en gaat dus nooit langs die lijn; daar is het inpakmoment het signaal dat
       de keuken klaar is. Alleen op pasAt meten zou betekenen dat een zaak die
       uitsluitend bezorgt nooit een verwachting krijgt. */
    const klaar = o.pasAt || (o.inpak && o.inpak.at);
    if (!klaar) continue;
    const start = o.paidAt || o.at;
    if (!start) continue;
    const min = (new Date(klaar) - new Date(start)) / 60000;
    if (min > 0 && min < 240) duren.push(min);       // meer dan vier uur is geen keukentijd maar een vergeten bon
    if (duren.length >= TERUG) break;
  }
  if (duren.length < MINIMAAL) return null;
  duren.sort((a, b) => a - b);
  const m = duren.length % 2
    ? duren[(duren.length - 1) / 2]
    : (duren[duren.length / 2 - 1] + duren[duren.length / 2]) / 2;
  return Math.max(1, Math.round(m));
}

/* Hoe lang nog, en waar dat getal vandaan komt. De bron staat erbij zodat het
   scherm eerlijk kan zijn over wat het weet:
     'rit'      -- de bezorger rijdt en we meten zijn afstand (het scherpst)
     'gemeten'  -- keukentijd uit de historie van deze zaak plus de rijtijd
     null       -- we weten het niet, en dan zeggen we dat */
function hoelangNog({ order, orders, zaakLoc, positie }) {
  const o = order;
  if (!o || ['bezorgd', 'opgehaald'].includes(o.status)) return { etaMin: null, bron: null };

  if (o.status === 'onderweg') {
    if (positie && o.geo && Number.isFinite(o.geo.lat)) {
      return { etaMin: etaMinutes(haversine(positie, o.geo), 'driving'), bron: 'rit' };
    }
    return { etaMin: o.etaMin || null, bron: o.etaMin ? 'rit' : null };
  }

  const keuken = keukenMinuten(orders, o.supplierCode);
  if (keuken == null) return { etaMin: null, bron: null };

  // wat er van de keukentijd nog over is, plus de rit naar het adres
  const bezig = (Date.now() - new Date(o.paidAt || o.at)) / 60000;
  const resterend = Math.max(0, keuken - (Number.isFinite(bezig) ? bezig : 0));
  const rit = (zaakLoc && o.geo && Number.isFinite(o.geo.lat) && Number.isFinite(zaakLoc.lat))
    ? etaMinutes(haversine(zaakLoc, o.geo), 'driving') : 0;
  return { etaMin: Math.max(1, Math.round(resterend + rit)), bron: 'gemeten' };
}

function volgBeeld({ order, orders, zaakLoc, positie, bezorgerNaam }) {
  const { etaMin, bron } = hoelangNog({ order, orders: orders || [], zaakLoc, positie });
  return {
    stappen: stappenVan(order),
    wat: watGebeurtEr(order, bezorgerNaam),
    etaMin,
    etaBron: bron
  };
}

module.exports = { STAPPEN, fase, stappenVan, watGebeurtEr, keukenMinuten, hoelangNog, volgBeeld };
