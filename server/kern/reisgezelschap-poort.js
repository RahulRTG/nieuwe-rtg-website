/* DE POORT VAN HET REISGEZELSCHAP -- wie ziet wat van een reis.

   Dit is het hart van kern/reisgezelschap.js en daarom een eigen bestand: het
   is het enige dat tussen de boekingsgegevens van een reiziger en het scherm
   van iemand anders staat.

   HIJ WERKT MET EEN WITTE LIJST. Per rol staat opgeschreven welke velden
   meegaan. Een veld dat morgen aan een reisonderdeel wordt toegevoegd -- een
   stoelnummer, een adres, een prijs -- komt er dus NIET vanzelf bij. Dat is de
   enige richting die veilig is: een zwarte lijst vergeet je een keer, en dan
   staat er een boekingsnummer op het scherm van iemands schoonmoeder.

   WIE WAT ZIET (test/reisgezelschap.test.js houdt deze tabel eerlijk, en is met
   een mutatie nagerekend: draai de lijst om en er zakken drie toetsen):

     van de reis            eigenaar   reisgenoot        meekijker
     bestemming, periode    ja         ja                ja
     draaiboek en tijden    ja         ja                nee
     kenmerk (boeking)      ja         nee               nee
     prijs, documenten      ja         nee               nee
     aankomstmelding        ja         ja                als hij aanstaat
     wat de reiziger deelt  ja         ja                ja */
'use strict';

const ROLLEN = ['reisgenoot', 'meekijker'];
const STANDEN = ['gevraagd', 'aanvaard'];

/* WAT ER PER ROL MEEGAAT -- de witte lijst uit de kop, als code.
   Van een REIS zelf, en van een ONDERDEEL apart: een onderdeel draagt het
   kenmerk (het boekingsnummer) en dat is precies wat nooit naar buiten mag. */
const REISVELDEN = {
  eigenaar: ['id', 'bestemming', 'venster', 'personen', 'sig', 'telling', 'grond', 'apps', 'herkomsten'],
  reisgenoot: ['id', 'bestemming', 'venster', 'personen', 'sig', 'telling'],
  meekijker: ['id', 'bestemming', 'venster']
};
const ONDERDEELVELDEN = {
  eigenaar: null,                                   // alles, het is zijn eigen reis
  reisgenoot: ['soort', 'titel', 'bestemming', 'van', 'tot', 'sig'],
  meekijker: []                                     // geen draaiboek: de lijst blijft leeg
};

  /* De rol van een KIJKER bij een reis van een ander. `null` = hij hoort er
   niet bij, en dan bestaat de reis voor hem niet -- geen 403 met inhoud
   eromheen, maar niets. */
const maakRolVan = (leden) => function rolVan(reisId, eigenaarKey, kijkerKey) {
  if (kijkerKey === eigenaarKey) return 'eigenaar';
  const l = leden().find(x => x.reis === reisId && x.eigenaar === eigenaarKey
    && x.lid === kijkerKey && x.stand === 'aanvaard');
  return l ? l.rol : null;
};

/* DE POORT. Geeft terug wat deze rol van deze reis mag zien -- opgebouwd uit
   de witte lijst, dus wat er niet in staat, gaat niet mee. */
function zicht(reis, rol) {
  if (!reis || !REISVELDEN[rol]) return null;
  const uit = {};
  for (const veld of REISVELDEN[rol]) if (reis[veld] !== undefined) uit[veld] = reis[veld];
  const velden = ONDERDEELVELDEN[rol];
  if (velden === null) uit.onderdelen = reis.onderdelen || [];
  else {
    uit.onderdelen = (reis.onderdelen || []).map((o) => {
      const d = {};
      for (const veld of velden) if (o[veld] !== undefined) d[veld] = o[veld];
      return d;
    }).filter(o => Object.keys(o).length);
  }
  uit.rol = rol;
  /* Wat deze rol NIET ziet, staat er met zoveel woorden bij. Een meekijker
     die een lege lijst krijgt hoort te weten dat er iets is en dat hij het
     niet ziet -- anders lijkt de reis leeg (BESTUUR.md: niet vast te stellen
     is een uitslag, geen stilte). */
  uit.nietZichtbaar = rol === 'eigenaar' ? []
    : rol === 'reisgenoot' ? ['boekingskenmerken', 'prijzen', 'documenten']
      : ['draaiboek', 'tijden', 'boekingskenmerken', 'prijzen', 'documenten'];
  return uit;
}

module.exports = { ROLLEN, STANDEN, REISVELDEN, ONDERDEELVELDEN, zicht, maakRolVan };
