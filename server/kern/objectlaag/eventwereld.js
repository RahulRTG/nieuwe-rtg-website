/* De objectlaag, deelbestand "eventwereld": het Event dat de rest van het
   platform bereikt (LIFE.md fase 6).

   HET PROBLEEM, EN WAAROM DE VOOR DE HAND LIGGENDE OPLOSSING FOUT IS. Een
   bijeenkomst is een moment waar mensen naartoe gaan: er hoort een tafel bij,
   vervoer, soms een overnachting, soms een kaartje. Vandaag weet een
   genootschap-bijeenkomst daar niets van, en de verleiding is om per stuk een
   koppeling te bouwen -- bijeenkomst naar horeca, dan bijeenkomst naar taxi,
   dan bijeenkomst naar hotel. Dat is de N²-val die PLATFORM.md beschrijft:
   het tweede paar kost weer evenveel als het eerste, en bij tien domeinen bouw
   je tien keer.

   DE GENERIEKE VORM, en die bestaat hier al. De handelsketen maakte van N² weer
   N door een aanvraag naar een GENRE te sturen in plaats van naar een adres.
   Hier gaat het een stap verder terug: een bijeenkomst vraagt niet om een genre
   maar om een CAPABILITY -- een tafel, vervoer, een verblijf, een kaartje -- en
   elk genre dat die cap draagt kan hem leveren. Het genre-register
   (server/seed/genres-lijst.js) draagt die caps al voor alle 73 genres.

   Een domein erbij is dus geen koppeling erbij: het genre krijgt zijn cap in het
   register, en het verschijnt hier vanzelf.

   WAT DEZE LAAG NIET DOET, EN NOOIT MAG DOEN. Boeken. Reserveren. Vragen. Er
   gaat hier niets de deur uit en er wordt niets beloofd. Het werkwoord van deze
   wereld is samenstellen en klaarzetten, en bij een bijeenkomst raakt elke
   handeling een DERDE partij -- een zaak die een tafel vrijhoudt, een chauffeur
   die rijdt. `CLAUDE.md` verbiedt bovendien met zoveel woorden te doen alsof een
   boeking verwerkt is. Wat hier staat is: dit hoort bij dit moment, en dit is de
   app waar u het regelt.

   ELKE WEG WIJST NAAR EEN PAGINA DIE BESTAAT. Zelfde regel als bij de caps in
   ./caps.js, en om dezelfde reden: PLATFORM.md documenteert zeventien
   app-teksten die functies beloofden zonder route. Een toets zakt zodra een
   bestemming hier niet bestaat. */
'use strict';

/* WAT EEN MOMENT KAN GEBRUIKEN. De sleutel is de capability zoals het
   genre-register hem kent; de bestemming is de app waar een lid het regelt.

   Alleen caps die een lid ECHT ergens kan regelen staan hier. `orders`,
   `retail`, `doors` en de rest bestaan wel in het register maar horen niet bij
   een bijeenkomst -- die erbij zetten zou een lijst maken in plaats van een
   antwoord. */
const NODIG = {
  reservations: { naam: 'Een tafel', wat: 'Reserveren met een tijdslot bij een zaak in de buurt.',
    app: 'Food Court', link: '/apps/foodcourt.html' },
  rides: { naam: 'Vervoer erheen', wat: 'Rit, transfer of openbaar vervoer naar de plek.',
    app: 'RTG OV', link: '/apps/ov.html' },
  bookings: { naam: 'Blijven slapen', wat: 'Een verblijf voor wie niet terug wil dezelfde avond.',
    app: 'Verblijven', link: '/apps/hotels.html' },
  tickets: { naam: 'Kaarten', wat: 'Entree waar dat nodig is.',
    app: 'Uitgaan', link: '/apps/uitgaan.html' }
};

module.exports = ({ kern }) => {

  /* De genres die deze cap dragen, uit het register. Ze worden hier GETELD en
     niet opgesomd: een lijst van zestig genres onder een bijeenkomst is geen
     hulp, en welke zaak het wordt beslist het lid in de app die het regelt.

     Het register wordt LAAT gelezen zodat de mountvolgorde er niet toe doet, en
     via de kern in plaats van met een eigen require -- twee plekken die de
     genres kennen, is precies wat het register kwam oplossen. */
  function genresMet(cap) {
    /* `db.data.supplierTypes` is de LEVENDE waarheid: het register wordt bij het
       opstarten geseed en een genre dat later bijkomt staat er dan ook in. Het
       bestand server/seed/genres-lijst.js rechtstreeks lezen zou een tweede
       waarheid geven die alleen bij het opstarten klopt -- en dat register kwam
       er juist om zestien kopieen op te ruimen. */
    const d = kern.db && kern.db.data;
    const reg = (d && d.supplierTypes && typeof d.supplierTypes === 'object') ? d.supplierTypes : {};
    let n = 0;
    for (const id of Object.keys(reg)) {
      const r = reg[id];
      if (r && Array.isArray(r.caps) && r.caps.includes(cap)) n++;
    }
    return n;
  }

  /* Wat er bij DIT moment hoort. De bijeenkomst zelf bepaalt wat er relevant is,
     en dat is met opzet mager afgeleid -- uit wat het domein weet en niet uit
     een gok over wat voor avond het wordt:

       een tafel        altijd: mensen komen ergens samen
       vervoer          altijd: er moet heen gereisd worden
       blijven slapen   alleen als het 's avonds is; overdag slaapt niemand elders
       kaarten          alleen als de bijeenkomst plaatsen kent -- dan is er een
                        capaciteit, en dat is het enige signaal in de data dat
                        op entree lijkt

     WAT HIER NIET GEBEURT: raden. Er staat geen "u wilt vast een taxi" en geen
     voorkeur uit gedrag. Elke regel hangt aan een feit uit de bijeenkomst zelf,
     en dat feit reist mee als `waarom` -- net als bij de caps. */
  function nodigVoor(b) {
    const uit = [];
    const uur = Number(String((b && b.tijd) || '').slice(0, 2));
    const laat = Number.isFinite(uur) && uur >= 18;

    uit.push({ cap: 'reservations', waarom: 'u komt ergens samen' });
    uit.push({ cap: 'rides', waarom: b && b.waar ? 'naar ' + b.waar : 'er moet heen gereisd worden' });
    if (laat) uit.push({ cap: 'bookings', waarom: 'het begint om ' + b.tijd });
    if (b && b.plaatsen) uit.push({ cap: 'tickets', waarom: b.plaatsen + ' plaatsen' });
    return uit;
  }

  /* De wereld om een bijeenkomst heen. Geeft per cap de weg erheen plus hoeveel
     genres hem kunnen leveren -- en verder niets. Geen aanvraag, geen
     reservering, geen belofte.

     HIER STAAT GEEN AFGELAST-CONTROLE, en dat is bewust. Die regel woont in
     ./event.js, dat bij een afgelaste bijeenkomst vroeg terugkeert met een
     andere vorm: alleen de weg naar de groep, en `eromheen: []`. Er stond hier
     eerst een tweede controle naast, en de mutatie liet zien dat hij niets deed
     -- weghalen liet geen enkele toets zakken. Dode code die op een wacht lijkt
     is erger dan geen wacht, want de volgende vertrouwt hem (LAT.md regel 4). */
  function eromheen(b) {
    if (!b) return [];
    return nodigVoor(b).map(n => {
      const d = NODIG[n.cap];
      if (!d) return null;
      return { cap: n.cap, naam: d.naam, wat: d.wat, app: d.app, link: d.link,
        waarom: n.waarom, genres: genresMet(n.cap) };
    }).filter(Boolean);
  }

  return { eromheen, nodigVoor, NODIG };
};
