/* HET VOLGSCHERM VOOR HET LID -- waar is mijn bestelling, en hoe lang nog?

   WAT ER EERST WAS: de klant kreeg pas iets te zien zodra de bezorger reed.
   Tussen "betaald" en "onderweg" zit de keuken, en dat is precies de tijd
   waarin iemand zich afvraagt of zijn bestelling wel is aangekomen. In die
   stilte zat geen stap, geen tijd en geen woord.

   WAT HIER GEBEURT: dezelfde stappen die de zaak intern al doorloopt, maar
   dan in de taal van de klant, met per stap wat er gebeurt en hoe lang het
   nog duurt.

   EEN STAP PER TOESTAND, EN NIET MINDER

   Hier stonden vier stappen voor vijf toestanden, en dan liegt er een. "Klaar
   op de pas, wacht op de bezorger" viel samen met "Onderweg": de klant las dat
   er iemand reed terwijl zijn tas nog in de zaak stond. Elke toestand die de
   keten kent heeft nu zijn eigen stap, en een afhaalbon krijgt de keten die
   bij hem hoort: hij haalt zelf op, dus er rijdt nooit iemand.

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

/* De stappen zoals de klant ze kent. De sleutels zijn intern, de namen staan
   op het scherm. Twee ketens, want het zijn er twee: een BEZORGING gaat na de
   pas nog de deur uit, een AFHAALBON blijft staan tot de klant hem komt halen.
   Een afhaalbon "Onderweg" laten oplichten is dezelfde leugen als hierboven,
   alleen dan zonder dat er ooit iemand rijdt. */
const STAPPEN_BEZORGEN = [
  { sleutel: 'bevestigd', naam: 'Bevestigd' },
  { sleutel: 'keuken', naam: 'In de keuken' },
  { sleutel: 'klaar', naam: 'Klaar voor vertrek' },
  { sleutel: 'onderweg', naam: 'Onderweg' },
  { sleutel: 'bezorgd', naam: 'Bezorgd' }
];
const STAPPEN_OPHALEN = [
  { sleutel: 'bevestigd', naam: 'Bevestigd' },
  { sleutel: 'keuken', naam: 'In de keuken' },
  { sleutel: 'klaar', naam: 'Klaar om op te halen' },
  { sleutel: 'opgehaald', naam: 'Opgehaald' }
];
function stappenVoor(o) {
  return o && o.levering === 'ophalen' ? STAPPEN_OPHALEN : STAPPEN_BEZORGEN;
}

/* Wanneer is de keuken klaar? Drie signalen, en alle drie komen ze echt voor:
   pasAt (een bon van de menukaart die langs de keukenlijn gaat en op de pas
   komt te liggen), status "klaar" (de zaak zet hem met een knop klaar; een
   afhaalbon uit het bezorgassortiment krijgt nooit een pasAt) en inpak (tas +
   bonnummer, het signaal van de bezorgketen). Op EEN plek, want de stap en de
   zin eronder moeten hetzelfde zeggen: een ingepakte bon lichtte "Onderweg"
   op terwijl de zin eronder "we zijn begonnen" zei. */
function keukenKlaar(o) {
  return !!(o && (o.pasAt || o.status === 'klaar' || o.inpak));
}

/* Hoe ver is deze bestelling? Geeft de index in de keten van DEZE bon van de
   stap die NU bezig is. Bewust afgeleid uit de echte staat van de bon en niet
   uit een apart veld: een tweede administratie loopt binnen een week uit de
   pas. */
function fase(o) {
  if (!o) return 0;
  const stappen = stappenVoor(o);
  /* Een sleutel die niet in deze keten zit is een fout in DEZE module, geen
     rare bon. findIndex geeft dan -1, stappenVan() zet daarop ALLE stappen op
     "wacht", en de klant ziet een scherm waarop niets oplicht en niets klaagt.
     Liever luid stuk dan stil verkeerd. */
  const ix = (sleutel) => {
    const i = stappen.findIndex(s => s.sleutel === sleutel);
    if (i < 0) throw new Error('bezorgvolg: de keten van "' +
      (o.levering || 'bezorgen') + '" kent geen stap "' + sleutel + '"');
    return i;
  };
  /* Afgerond is geen lopende stap maar een EINDtoestand: voorbij de laatste
     index, zodat stappenVan() alles op "gedaan" zet. Zonder die stand bleef de
     laatste stap voor altijd "bezig" en was een bezorgde bestelling op het
     scherm niet van een lopende te onderscheiden. */
  if (['bezorgd', 'opgehaald'].includes(o.status)) return stappen.length;
  /* "onderweg" bestaat alleen in de bezorgketen: vertrekken vereist een rit,
     en een afhaalbon heeft die niet. Zonder deze voorwaarde vraagt ix() om een
     stap die de afhaalketen niet heeft en klapt hij eruit; met deze voorwaarde
     valt zo'n bon terug op zijn eigen keten en staat hij gewoon klaar. */
  if (o.status === 'onderweg' && o.levering !== 'ophalen') return ix('onderweg');
  if (!o.paid) return ix('bevestigd');
  if (keukenKlaar(o)) return ix('klaar');
  return ix('keuken');
}

function stappenVan(o) {
  const nu = fase(o);
  return stappenVoor(o).map((s, i) => Object.assign({}, s, {
    staat: i < nu ? 'gedaan' : i === nu ? 'bezig' : 'wacht'
  }));
}

/* Wat er nu gebeurt, in een zin. Geen loze bemoediging: elke zin zegt iets
   wat de klant niet al op de knop ziet staan. */
function watGebeurtEr(o, bezorgerNaam) {
  if (!o) return '';
  const ophalen = o.levering === 'ophalen';
  if (o.status === 'opgehaald') return 'Opgehaald. Eet smakelijk.';
  if (o.status === 'bezorgd') return 'Bezorgd. Eet smakelijk.';
  if (o.status === 'onderweg' && !ophalen) {
    return bezorgerNaam
      ? bezorgerNaam + ' is onderweg naar u. U ziet hem op de kaart bewegen.'
      : 'Uw bestelling is onderweg.';
  }
  if (!o.paid) return 'We wachten nog op de betaling; daarna gaat hij meteen naar de keuken.';
  if (keukenKlaar(o)) return ophalen
    ? 'Klaar en ingepakt. U kunt hem komen ophalen.'
    : 'Klaar en ingepakt. Hij wacht op de bezorger.';
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

module.exports = { stappenVoor, keukenKlaar, fase, stappenVan, watGebeurtEr, keukenMinuten, hoelangNog, volgBeeld };
