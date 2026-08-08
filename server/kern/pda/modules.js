/* WELKE PDA-MODULES KRIJGT DEZE ZAAK.

   Waarom dit aan de serverkant staat. De personeels-PDA is een app die zich
   voegt naar de zaak: een chauffeur ziet ritten, een hotelmedewerker kamers,
   een beveiliger rondes. Welke tab daarvoor aangaat werd tot nu toe in de
   BROWSER bepaald, met regels als `caps.includes('marina')` verspreid over de
   delen van personeel.js. Daarmee wisten twee plekken hetzelfde: de server welke
   caps een zaak heeft, en de PDA welke caps een tab verdienen. Dat is de vorm
   die LAT-regel 4 verbiedt, en bij 73 genres -- en straks meer -- lopen die twee
   gegarandeerd uit elkaar: een nieuw genre krijgt zijn caps op de server en
   blijft in de PDA onzichtbaar, zonder dat iets klaagt.

   Nu bepaalt de server de lijst en schakelt de PDA daarop. Een genre erbij is
   dan een regel in het genre-register plus eventueel een regel hier, en nooit
   meer een wijziging aan beide kanten van de lijn.

   WAT HIER NIET IN HOORT. Alleen modules die uit de CAPS of het GENRE volgen.
   Tabs die volgen uit wat een zaak feitelijk heeft -- kamers, een menukaart met
   een barstation, een bezorgdienst die aanstaat -- blijven in de PDA, want die
   leest hij af aan gegevens die hij toch al binnenkrijgt. Dat is geen tweede
   kopie van deze afbeelding maar een gevolgtrekking uit de eigen inhoud. */
'use strict';

/* De afbeelding cap -> module. Een zaak die de cap heeft, krijgt de tab. */
const PER_CAP = {
  gebouw: 'gebouw',        // kantoorgebouw: receptie, bezoekers, ruimtes
  marina: 'marina',        // jachthaven: ligplaatsen en aanloop
  polis: 'verzekeraar',    // verzekeringsadvies: polissen en claims
  rides: 'ritten',         // taxi, jet, helikopter, transfers
  retail: 'winkel',        // winkelvloer: voorraad, scannen, mobiel afrekenen
  boerderij: 'boer',       // percelen, oogst, dieren
  tickets: 'entree',       // deurverkoop en gastenlijst
  charter: 'vaart'         // boten en jachten: vaarklaar, opstappers
};

/* De afbeelding genre -> module, voor het handjevol dat niet aan een cap hangt
   maar aan wat de zaak IS. */
const PER_GENRE = {
  verhuur: 'verkoop',          // autoverhuur verkoopt ook occasions
  beveiliging: 'beveiliging'   // rondes, incidenten, objecten
};

/* De modules die deze zaak aanzetten. Geeft altijd een array, ook als er niets
   bij zit -- een PDA zonder eigen modules is de gewone PDA, geen fout. */
function modulesVoor(supplier, caps) {
  const uit = [];
  for (const cap of caps || []) if (PER_CAP[cap] && !uit.includes(PER_CAP[cap])) uit.push(PER_CAP[cap]);
  const perGenre = PER_GENRE[supplier && supplier.type];
  if (perGenre && !uit.includes(perGenre)) uit.push(perGenre);
  return uit;
}

module.exports = { PER_CAP, PER_GENRE, modulesVoor };
