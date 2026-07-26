/* De verzonnen namen voor het salongesprek.

   Waarom dit bestaat: twee Rahuls kletsen over de dag van hun mens. Dat is
   leuk, maar het gaat wel over WAAR iemand was en met wie. Een gesprek dat
   letterlijk "we aten bij Maison Sakura, kamer 4" zegt, is geen gimmick meer
   maar een lek. Dus gaat elke echte naam eerst door deze laag en komt er een
   verzonnen naam uit.

   Drie eisen, in deze volgorde:

   1. BINNEN EEN GESPREK ALTIJD DEZELFDE. Anders klopt het verhaal niet: dan
      heet dezelfde tent in zin 3 anders dan in zin 7 en valt de illusie weg.
   2. TUSSEN GESPREKKEN ALTIJD ANDERS. Elk gesprek krijgt een eigen zout, dus
      dezelfde zaak heet morgen anders. Zonder dat kun je namen over gesprekken
      heen naast elkaar leggen en alsnog uitrekenen waar iemand komt.
   3. NOOIT PER ONGELUK EEN ECHT MERK. De woordenlijsten hieronder zijn met
      opzet verzonnen: geen bestaande hotels, restaurants, plaatsen of ketens.
      Dat is ook de huisregel van RTG (nooit echte merken als partner opvoeren).

   Pure functies, geen crypto en geen context; zo is dit los te toetsen. Het
   zout komt van buiten (kern/kletspraat/index.js gebruikt crypto). */

// verzonnen eigennamen; klinken Middellandse-Zee-achtig maar bestaan niet
const NAMEN = [
  'Amaranth', 'Solene', 'Mirabel', 'Valmont', 'Estrelle', 'Lucerna', 'Novaro',
  'Tramonta', 'Belvera', 'Serrana', 'Auralis', 'Cassine', 'Ravelle', 'Ondine',
  'Verano', 'Calisto', 'Marelle', 'Sabline', 'Tessaro', 'Vialta', 'Corvane',
  'Aldenna', 'Pruvel', 'Montara', 'Ysandre', 'Fioretta', 'Lombera', 'Anzuela'
];
const SOORTEN = {
  horeca: ['Cafe', 'Bistro', 'Brasserie', 'Taverna', 'Trattoria', 'Osteria'],
  hotel: ['Hotel', 'Villa', 'Residenza', 'Palazzo', 'Maison'],
  winkel: ['Atelier', 'Boutique', 'Huis', 'Magazijn'],
  plek: ['Port', 'Cap', 'Alta', 'Costa', 'Vall'],
  dienst: ['Studio', 'Kabinet', 'Praktijk', 'Werkplaats'],
  ding: ['']                   // een activiteit of gerecht: kale naam
};
// Een dienst of activiteit is soms geen naam maar een bezigheid. Dan blijft de
// AARD staan (een duik, een rondrit) en verdwijnt alleen wie het aanbood: dat
// houdt het gesprek leuk zonder de plek te verraden.
const BEZIG = ['de rondvaart', 'de wandeltocht', 'de duikles', 'het proeverijtje',
  'de kookles', 'de fietstocht', 'het concert', 'de markt', 'de tentoonstelling'];

/* Een kleine, stabiele hash (FNV-1a, 32 bits). Geen crypto nodig: dit hoeft
   niet onvoorspelbaar te zijn, alleen goed verdeeld en overal hetzelfde. Het
   ONVOORSPELBARE zit in het zout, dat per gesprek nieuw is. */
function hash(s) {
  let h = 0x811c9dc5;
  const t = String(s == null ? '' : s);
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/* Een namenboek voor EEN gesprek. `zout` hoort per gesprek verse willekeur te
   zijn; hetzelfde zout geeft gegarandeerd hetzelfde boek terug (handig in een
   toets, en nodig om een bewaard gesprek later opnieuw te kunnen tonen).

   voor(soort, echt) geeft de verzonnen naam. Botsingen lopen door naar de
   volgende vrije naam: twee zaken die in hetzelfde gesprek hetzelfde gaan
   heten, is precies het soort scheefheid waardoor een verhaal niet meer klopt. */
function maakNamen(zout) {
  const boek = new Map();          // 'soort echt' -> verzonnen
  const bezet = new Set();

  function voor(soort, echt) {
    const kaal = String(echt == null ? '' : echt).trim().toLowerCase();
    if (!kaal) return '';                            // niets in, niets uit
    const sleutel = String(soort || 'ding') + ' ' + kaal;
    if (boek.has(sleutel)) return boek.get(sleutel);

    const voorvoegsels = SOORTEN[soort] || SOORTEN.ding;
    const h = hash(zout + '|' + sleutel);
    const v = voorvoegsels[(h >>> 8) % voorvoegsels.length];
    let uit = '';
    for (let stap = 0; stap < NAMEN.length && !uit; stap++) {
      const kandidaat = (v ? v + ' ' : '') + NAMEN[(h + stap) % NAMEN.length];
      if (!bezet.has(kandidaat)) uit = kandidaat;
    }
    // alle namen op (meer dan 28 zaken op een dag): dan mag er een cijfer bij
    if (!uit) uit = (v ? v + ' ' : '') + NAMEN[h % NAMEN.length] + ' ' + (bezet.size + 1);
    bezet.add(uit); boek.set(sleutel, uit);
    return uit;
  }

  // een bezigheid in plaats van een naam, ook stabiel per gesprek
  function bezigheid(echt) {
    const sleutel = 'bezig ' + String(echt == null ? '' : echt).trim().toLowerCase();
    if (boek.has(sleutel)) return boek.get(sleutel);
    const uit = BEZIG[hash(zout + '|' + sleutel) % BEZIG.length];
    boek.set(sleutel, uit);
    return uit;
  }

  return { voor, bezigheid, boek };
}

module.exports = { maakNamen, hash, NAMEN, SOORTEN, BEZIG };
