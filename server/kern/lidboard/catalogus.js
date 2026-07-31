/* Boardroom van het lid, deel "catalogus": WAT er op het bord staat. Pure data,
   geen state: de categorieen, de functies met hun standaarden, de pad-kaart voor
   de handhaving, en de brug naar de platform-schakelkast.

   Deze drie tabellen horen bij elkaar en horen nergens anders:

   CAPS        de functies zelf. `standaard: false` betekent privacy by design --
               alles wat gegevens DEELT (locatie, GPS, paspoort, Bluetooth) staat
               uit tot iemand het bewust aanzet. `kind: false` houdt een functie
               van de boardroom van een beschermd kind (die de ouder beheert).
               `vast: true` is een functie die niet uit KAN: zet je die uit, dan
               kun je hem daarna niet meer aanzetten omdat het scherm waarop de
               knop staat er niet meer is. Dat is geen keuze maar een val.

   PAD_FUNCTIE welke API-pad-prefix bij welke functie hoort. Alleen ondubbelzinnige
               prefixen: een functie uitzetten moet die API ook echt dichtzetten,
               zonder gedeelde routes mee te nemen. Langste prefix wint.

   PLATFORM    welke functie in de RTG-schakelkast (server/functies) over deze
               functie gaat. Zet RTG iets platform-breed of voor jouw pas uit, dan
               is de knop op je eigen bord een knop naar niets. Die tonen we dan
               als BEHEERD: zichtbaar, met de reden erbij, en niet te schakelen.
               Alleen een echte een-op-een-relatie staat hier; bij twijfel niets,
               want een verkeerde koppeling zou een knop grendelen die het wel
               doet. */

// De categorieen in de volgorde waarin ze op het bord verschijnen.
const CATEGORIEEN = [
  { id: 'app', naam: 'App-onderdelen', uitleg: 'De hoofdmodules van je app.' },
  { id: 'privacy', naam: 'Privacy & sociaal', uitleg: 'Wie mag wat zien en vragen.' },
  { id: 'ai', naam: 'AI & meldingen', uitleg: 'De slimme en attente laag.' },
  { id: 'verbinding', naam: 'Verbindingen', uitleg: 'De toestel- en verbindingskant.' }
];

const CAPS = [
  // --- App-onderdelen ---
  { id: 'reizen', cat: 'app', naam: 'Reizen & boekingen', uitleg: 'Reizen zoeken, boeken en beheren.' },
  { id: 'salon', cat: 'app', naam: 'De Salon', uitleg: 'Het besloten sociale netwerk.' },
  { id: 'spelen', cat: 'app', naam: 'Spelen', uitleg: 'Spellen met vrienden.' },
  { id: 'bestellen', cat: 'app', naam: 'Bestellen', uitleg: 'Ophalen en bezorgen bij partners.' },
  { id: 'care', cat: 'app', naam: 'RTG Care', uitleg: 'Zorg, spa en wellness.', kind: false },
  { id: 'werk', cat: 'app', naam: 'Werk & vacatures', uitleg: 'Solliciteren bij partners.' },
  { id: 'tickets', cat: 'app', naam: 'Tickets & entree', uitleg: 'Activiteiten en evenementen.' },
  { id: 'vervoer', cat: 'app', naam: 'Vervoer & ritten', uitleg: 'Ritten en transfers.' },
  { id: 'pay', cat: 'app', naam: 'RTG Pay', uitleg: 'Betalen en tikken tussen vrienden.', kind: false },
  { id: 'wallet', cat: 'app', naam: 'Wallet & ledenpas', uitleg: 'Je pas, tickets, sleutels en munten.', vast: true },
  // --- Privacy & sociaal (gevoelige deel-functies standaard uit) ---
  { id: 'gids', cat: 'privacy', naam: 'Zichtbaar in de gids', uitleg: 'Vindbaar voor andere leden.' },
  { id: 'verzoeken', cat: 'privacy', naam: 'Vriendschapsverzoeken', uitleg: 'Anderen mogen je een verzoek sturen.' },
  { id: 'dm', cat: 'privacy', naam: 'Directe berichten', uitleg: 'Privéberichten ontvangen.' },
  { id: 'locatie', cat: 'privacy', naam: 'Locatie delen', uitleg: 'Je live locatie met wie jij kiest.', standaard: false },
  { id: 'paspoort', cat: 'privacy', naam: 'Paspoort / ID delen', uitleg: 'Geverifieerde identiteit op verzoek delen.', standaard: false, kind: false },
  // --- AI & meldingen ---
  { id: 'rahul', cat: 'ai', naam: 'Rahul (AI-hulp)', uitleg: 'Je persoonlijke reis-AI.' },
  { id: 'spraak', cat: 'ai', naam: 'Spraakbediening', uitleg: 'Rahul met je stem bedienen.' },
  { id: 'push', cat: 'ai', naam: 'Pushmeldingen', uitleg: 'Meldingen op je toestel.' },
  { id: 'streak', cat: 'ai', naam: 'Dag-opdracht', uitleg: 'De dagelijkse foto-uitnodiging. Overslaan kost je niets.' },
  // --- Verbindingen (toestel; deel standaard uit) ---
  { id: 'gps', cat: 'verbinding', naam: 'GPS-tracking', uitleg: 'Locatiebepaling door het toestel.', standaard: false },
  { id: 'wifi', cat: 'verbinding', naam: 'Wifi-koppeling', uitleg: 'Koppelen met lokale wifi (bijv. een Zaakdoos).' },
  { id: 'bluetooth', cat: 'verbinding', naam: 'Bluetooth-koppeling', uitleg: 'Koppelen met Bluetooth-apparaten.', standaard: false }
];

const OP_ID = Object.fromEntries(CAPS.map(c => [c.id, c]));
const standaardAan = c => c.standaard !== false;

const PAD_FUNCTIE = [
  ['/api/member/spel', 'spelen'],
  ['/api/ai', 'rahul'],
  ['/api/fluister', 'rahul'],
  ['/api/pay', 'pay'],
  ['/api/care', 'care'],
  ['/api/paspoort', 'paspoort'],
  ['/api/locatie', 'locatie'],
  ['/api/dm', 'dm'],
  ['/api/salon', 'salon'],
  ['/api/ticket', 'tickets'],
  ['/api/order', 'bestellen'],
  ['/api/bezorg', 'bestellen'],
  ['/api/charter', 'vervoer'],
  ['/api/book', 'reizen'],
  ['/api/reserveer', 'reizen'],
  ['/api/reservering', 'reizen']
].sort((a, b) => b[0].length - a[0].length);

function padFunctie(pad) {
  const p = String(pad || '').split('?')[0];
  for (const [pre, fid] of PAD_FUNCTIE) {
    if (p === pre || p.indexOf(pre + '/') === 0) return fid;
  }
  return null;
}

/* De brug naar de platform-schakelkast (server/functies/register). Links de
   functie op JOUW bord, rechts de functie waarmee RTG hem platform-breed kan
   sluiten. Wat hier niet staat, kent geen platform-tegenhanger en is dus altijd
   van jou alleen. */
const PLATFORM = {
  salon: 'salon',
  dm: 'member-dm',
  verzoeken: 'member-connect',
  werk: 'member-werk',
  bestellen: 'bestellen',
  tickets: 'tickets',
  vervoer: 'charter',
  pay: 'betalen',
  paspoort: 'paspoort',
  spelen: 'spellen',
  locatie: 'onderweg'
};

module.exports = { CATEGORIEEN, CAPS, OP_ID, standaardAan, PAD_FUNCTIE, padFunctie, PLATFORM };
