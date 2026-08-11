/* Magnaat: HOE EEN ONDERZOEK UITPAKT -- volledig, gedeeltelijk, of anders.

   Afgesplitst van ./onderzoek.js, en de naad is echt. Dat bestand gaat over de
   MECHANIEK van onderzoek doen: wat het kost, hoe lang het duurt, hoe de
   voortgang loopt en hoe een uitgerolde uitvinding op de motor aangrijpt. Dit
   bestand gaat over EEN vraag -- wat er uiteindelijk uitkomt -- en dat is een
   onderwerp met een eigen leven. De boom zelf staat weer ergens anders
   (./onderzoek-boom.js): vorm, mechaniek en uitkomst, drie dingen.

   De aanleiding was de 10 kB-grens die scripts/check.js bewaakt, en die grens
   dwong de vraag op het moment dat het antwoord nog kort was.

   ALLE TREKKINGEN KOMEN UIT DEZELFDE HASH als de risico's (./risico.js). De klok
   rekent bij (GAMEHALL.md 12.4), dus tien maanden in een keer moet dezelfde
   uitkomst geven als tien maanden los -- ook voor de vraag hoe een onderzoek
   afloopt. */
const { trek } = require('./risico');
const { BOOM, PADEN, PAD, SECTORLIJST } = require('./onderzoek-boom');

/* ---------- de uitkomst ----------
   ONDERZOEK SLAAGT NIET OF FAALT; HET LOOPT ANDERS. Drie uitkomsten, en dat is
   het verschil tussen een boom die je afwerkt en innovatie die je meemaakt:

     VOLLEDIG      het effect zoals het op papier stond
     GEDEELTELIJK  de helft van elke stap -- ook van de KEERZIJDE. Half
                   ingevoerde techniek geeft minder capaciteit maar kost ook
                   minder onderhoud; dat is geen troostprijs maar een andere
                   uitkomst.
     ANDERS        het bedoelde veld levert bijna niets op, maar er komt wel
                   iets uit: een ANDER veld verbetert. Dat is de uitkomst waar
                   het om gaat -- een onderzoek kan nuttig blijken voor een
                   andere KPI dan de speler dacht, en dan heb je iets in handen
                   waar je je plan op moet aanpassen.

   De kansen liggen vast per knoop, en een ONZEKERE knoop (conceptinnovatie,
   revenue management) loopt veel vaker anders. De trekking komt uit dezelfde
   hash als de rest, dus dezelfde partij geeft dezelfde uitkomst -- de klok
   rekent bij en mag niet van je pollgedrag afhangen. */
const KANS = { zeker: { volledig: 0.55, gedeeltelijk: 0.30 }, onzeker: { volledig: 0.30, gedeeltelijk: 0.25 } };
const ANDERS_REST = 0.25;   // wat het bedoelde veld nog doet als het anders liep
const DEEL = 0.5;           // wat een gedeeltelijke uitkomst van elke stap overhoudt

/* Een stap naar 1 toe schalen. Werkt in beide richtingen, en dat is de reden dat
   het zo staat: 1.35 wordt 1.175 en 0.72 wordt 0.86 bij hetzelfde deel. */
const schaal = (f, deel) => 1 + (f - 1) * deel;

function uitkomst(partijId, sleutel) {
  const kans = BOOM[sleutel].onzeker ? KANS.onzeker : KANS.zeker;
  const t = trek(partijId + '|uit|' + sleutel);
  if (t < kans.volledig) return 'volledig';
  if (t < kans.volledig + kans.gedeeltelijk) return 'gedeeltelijk';
  return 'anders';
}

/* De PLUS van een knoop: het veld waar hij voor bedoeld was. De stam heeft geen
   pad en valt terug op zijn grootste stap. */
const plusVeld = (sleutel) => (PAD[BOOM[sleutel].pad] || {}).plus
  || Object.keys(BOOM[sleutel].effect)[0];

/* WELKE RICHTING HET DAN WEL WERD. Een ANDER pad uit dezelfde boom, en nooit je
   eigen -- anders is "anders" hetzelfde als "gedeeltelijk". */
function anderPad(partijId, sleutel) {
  const kandidaten = PADEN.filter(p => p !== BOOM[sleutel].pad);
  const i = Math.floor(trek(partijId + '|veld|' + sleutel) * kandidaten.length);
  return kandidaten[Math.min(i, kandidaten.length - 1)];
}
const anderVeld = (partijId, sleutel) => PAD[anderPad(partijId, sleutel)].plus;

/* HOE STERK DIE ANDERE RICHTING DAN UITPAKT, en dit is een correctie op een
   eerdere versie die het fout deed. Die nam het GETAL van je eigen pad en zette
   het op het andere veld -- en 1,35 op `perMedewerker` werd zo 1,35 op `markt`,
   een vraagsprong van vijfendertig procent waar de sterkste bedoelde knoop
   zestien geeft. De velden staan niet op dezelfde schaal, dus een getal
   verhuizen is geen vertaling.

   Wat er nu gebeurt: je krijgt het WERKELIJKE effect van dat andere pad in
   dezelfde sector, verzwakt met ANDERS_KRACHT. Een toevalstreffer is een echte
   uitvinding uit je eigen boom, maar hij is minder waard dan hem gericht doen --
   en hij ligt per definitie binnen de band waarop die boom geijkt is.

   Bij de STAM is er geen sector, dus wordt er over de sectoren heen gemiddeld;
   die knoop is sectorloos en zijn toevalstreffer hoort dat ook te zijn. */
const ANDERS_KRACHT = 0.7;
const schuif = (f, deel) => 1 + (f - 1) * deel;
function vervangEffect(sleutel, pad) {
  const sector = BOOM[sleutel].sector;
  const veld = PAD[pad].plus;
  const uit = {};
  if (sector) {
    const e = (BOOM[sector + '.' + pad] || {}).effect || {};
    for (const [v2, f] of Object.entries(e)) uit[v2] = schuif(f, ANDERS_KRACHT);
    return uit;
  }
  const alle = SECTORLIJST.map(s => ((BOOM[s + '.' + pad] || {}).effect || {})[veld])
    .filter(x => typeof x === 'number');
  uit[veld] = schuif(alle.reduce((n, x) => n + x, 0) / Math.max(1, alle.length), ANDERS_KRACHT);
  return uit;
}

/* HET WERKELIJKE EFFECT van dit onderzoek voor deze speler. Dit is wat er op de
   vestiging landt, en niet wat er in de tabel stond. */
function effectVan(partijId, sleutel, soort) {
  const k = BOOM[sleutel];
  const uit = soort || uitkomst(partijId, sleutel);
  if (uit === 'volledig') return Object.assign({}, k.effect);
  const e = {};
  const deel = uit === 'gedeeltelijk' ? DEEL : ANDERS_REST;
  for (const [veld, f] of Object.entries(k.effect)) e[veld] = schaal(f, deel);
  if (uit === 'anders') {
    for (const [veld, f] of Object.entries(vervangEffect(sleutel, anderPad(partijId, sleutel))))
      e[veld] = (e[veld] || 1) * f;
  }
  return e;
}

module.exports = { KANS, DEEL, ANDERS_REST, ANDERS_KRACHT,
  uitkomst, plusVeld, anderPad, anderVeld, vervangEffect, effectVan };
