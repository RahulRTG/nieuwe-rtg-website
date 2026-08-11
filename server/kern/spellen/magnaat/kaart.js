/* Magnaat: DE KAART -- van stadsdata naar speelbare kavels.

   Een stad is zones, een zone is straten, een straat draagt kavels. Wat een
   kavel economisch WAARD is wordt hier AFGELEID en staat niet in de data:
   passanten, toerisme, zakelijke vraag, huur, geluid, parkeren, bereikbaarheid
   en geschiktheid per sector komen uit de zone plus de plek van het kavel in
   zijn straat.

   WAAROM AFGELEID EN NIET GESCHREVEN. Duizend kavels met de hand van
   eigenschappen voorzien is duizend losse beweringen, en niemand die er later
   naar kijkt kan zien welke klopt. Een formule is te lezen, te toetsen en
   verschuift mee als een stad verandert. Wat er met de hand in staat is het
   KARAKTER van een zone -- dat een haven zakelijke vraag heeft en geen
   passanten -- en dat is precies het soort bewering dat een mens wel kan doen.

   TWEE BRONNEN, EEN VORM. Een stadsbestand zegt zelf of het uit open data komt
   (`bron: 'open-data'`, met echte adressen na de zeef op woonfunctie) of met de
   hand is (`bron: 'handmatig'`, met echte straatnamen en GEEN huisnummers). Deze
   laag maakt daar dezelfde kavels van; alleen de NAAM verschilt: "Halkade 12"
   tegen "Halkade, kavel 7". Zo hoeft geen enkele regel spelcode te weten waar
   de kaart vandaan kwam, en kan een echte import morgen dezelfde partij dragen.

   ER STAAT HIER GEEN WILLEKEUR. Dezelfde stad geeft dezelfde kavels, elke keer.
   Dat is geen netheid maar een eis: een campagne moet na een herstart nog
   hetzelfde bord hebben, en een toets moet een kavel bij naam kunnen noemen. */

const STEDEN = { ijmuiden: require('./kaart-data/ijmuiden') };

/* Een kleine, stabiele hash: dezelfde tekst geeft altijd hetzelfde getal in
   [0,1). Geen crypto -- dit is geen geheim, het is een SPREIDING, en hij moet
   juist herhaalbaar zijn. */
function spreiding(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/* De hoekwaarde van een kavel binnen zijn straat: de eerste plekken liggen aan
   de kop van de straat (meer passanten, hogere huur), de laatste aan de rand.
   Dat is het enige verschil tussen kavels in dezelfde straat, en het is er
   omdat een straat zonder verschil geen keuze is. */
const kopFactor = (i, n) => 1.25 - 0.5 * (i / Math.max(1, n - 1));

/* De eigenschappen van EEN kavel. Alles is een index rond 100, want de
   simulatie rekent met verhoudingen: een absoluut aantal passanten zou een
   precisie suggereren die deze data niet heeft. */
function eigenschappen(zone, i, aantal, ruis) {
  const kop = kopFactor(i, aantal);
  const w = (basis, mee) => Math.round(basis * (1 + (mee ? (kop - 1) : 0)) * (0.9 + ruis * 0.2));
  return {
    passanten: w(zone.passanten, true),
    toerisme: w(zone.toerisme, true),
    zakelijk: w(zone.zakelijk, false),
    huur: w(zone.huur, true),
    geluid: w(zone.geluid, false),
    parkeren: w(zone.parkeren, false),
    ov: w(zone.ov, false),
    centrum: w(zone.centrum, false)
  };
}

/* Hoe goed past een sector op dit kavel? Een getal rond 1: onder de 1 werkt het
   tegen, erboven mee. De zone noemt zijn eigen sectoren, en de rest krijgt geen
   nul maar een straf -- een restaurant op een bedrijventerrein is een slecht
   idee en geen verboden idee. */
function geschiktheid(zone, sector) {
  const plek = zone.sectoren.indexOf(sector);
  return plek < 0 ? 0.6 : 1.25 - plek * 0.07;
}

function kavelsVan(stadsleutel) {
  const stad = STEDEN[stadsleutel];
  if (!stad) return null;
  const echt = stad.bron === 'open-data';
  const uit = [];
  if (echt) {
    /* Uit open data: elk kavel IS een pand met een adres. De zone komt van de
       straat waar het in ligt; een straat die in geen enkele zone staat valt
       weg -- liever een kleinere kaart dan een kavel zonder karakter. */
    const zoneVanStraat = new Map();
    for (const z of stad.zones) for (const s of z.straten) zoneVanStraat.set(s.toLowerCase(), z);
    const perStraat = new Map();
    for (const k of stad.kavels) {
      const z = zoneVanStraat.get(String(k.straat).toLowerCase());
      if (!z) continue;
      const rij = perStraat.get(k.straat) || [];
      rij.push(k); perStraat.set(k.straat, rij);
    }
    for (const [straat, rij] of perStraat) {
      const z = zoneVanStraat.get(straat.toLowerCase());
      rij.forEach((k, i) => uit.push({
        id: stadsleutel + ':' + straat + ':' + k.nr, naam: straat + ' ' + k.nr, straat, zone: z.id,
        eigenschappen: eigenschappen(z, i, rij.length, spreiding(straat + k.nr))
      }));
    }
  } else {
    /* Met de hand: echte straatnamen, genummerde KAVELS. Er wordt met opzet
       geen huisnummer verzonnen -- zie de kop van het stadsbestand. */
    for (const z of stad.zones) for (const straat of z.straten) {
      for (let i = 0; i < stad.kavelsPerStraat; i++) {
        const nr = i + 1;
        uit.push({ id: stadsleutel + ':' + straat + ':k' + nr, naam: straat + ', kavel ' + nr, straat, zone: z.id,
          eigenschappen: eigenschappen(z, i, stad.kavelsPerStraat, spreiding(straat + ':' + nr)) });
      }
    }
  }
  return uit;
}

/* De hele kaart van een stad, in de vorm waarin de rest van het spel hem leest.
   EEN keer gebouwd en daarna gedeeld: hij verandert niet tijdens een partij, en
   hem per potje opnieuw uitrekenen zou bij zes spelers zes keer hetzelfde
   werk zijn. */
const gebouwd = new Map();
function kaart(stadsleutel) {
  const sleutel = String(stadsleutel || '').toLowerCase();
  if (gebouwd.has(sleutel)) return gebouwd.get(sleutel);
  const stad = STEDEN[sleutel];
  if (!stad) return null;
  const kavels = kavelsVan(sleutel);
  const uit = {
    sleutel, naam: stad.naam || stad.stad, bron: stad.bron, bronTekst: stad.bronTekst,
    zones: stad.zones.map(z => ({ id: z.id, naam: z.naam, sectoren: z.sectoren.slice() })),
    bevolking: stad.bevolking, seizoen: stad.seizoen, stadsomzet: stad.stadsomzet || 0,
    kavels,
    kavel: new Map(kavels.map(k => [k.id, k])),
    zone: new Map(stad.zones.map(z => [z.id, z]))
  };
  gebouwd.set(sleutel, uit);
  return uit;
}

const STEDENLIJST = Object.keys(STEDEN);
const stadNaam = (sleutel) => (STEDEN[sleutel] || {}).stad || sleutel;
/* De keuzelijst in de descriptor draagt de NAAM ('IJmuiden') en niet de sleutel
   ('ijmuiden'), om dezelfde reden als bij de schoolstof van het Quizduel: de
   waarde is meteen de tekst die de speler leest, en dan hoeft geen enkele
   client een sleutel te vertalen. Hier staat de weg terug. */
const stadSleutel = (naam) => STEDENLIJST.find(s => stadNaam(s) === naam) ||
  (STEDEN[String(naam || '').toLowerCase()] ? String(naam).toLowerCase() : null);

module.exports = { kaart, STEDENLIJST, stadNaam, stadSleutel, geschiktheid, spreiding, kopFactor, eigenschappen };
