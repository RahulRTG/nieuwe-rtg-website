/* Magnaat: HET CONCERN -- wat het kost om een bedrijf te zijn in plaats van een zaak.

   DIT IS DE LAAG DIE EEN OPEN DRAAD DICHTTREKT. Het toernooi meldde het al
   rondes lang: zolang er goede kavels vrij zijn, verslaat uitbreiden ELKE
   investering die alleen kosten verlaagt. Onderzoek, beheer, financiering --
   alles verloor van `handwerk`, dezelfde stijl die gewoon doorbouwt. De reden
   was niet dat die lagen te duur waren maar dat GROEI NERGENS EEN NADEEL HAD:
   de tiende vestiging kostte precies zoveel te runnen als de eerste.

   Zo werkt geen enkel concern. Twintig zaken vragen een hoofdkantoor: planning,
   administratie, inkoopcoordinatie, iemand die de sleutels bijhoudt. Die kosten
   groeien HARDER dan lineair, want elke zaak erbij moet met alle andere worden
   afgestemd.

   DRIE BESLUITEN, en ze hangen alle drie aan dezelfde vraag -- wanneer is groot
   nog goed?

   1. DE OVERHEAD GROEIT SNELLER DAN HET AANTAL. Niet lineair (dan is het een
      vaste kost per zaak en verandert er niets aan de afweging) en niet
      kwadratisch (dan is de vierde zaak al onbetaalbaar). De wortelvorm
      hieronder zit ertussen: de eerste zaken zijn bijna gratis, de vijftiende
      kost merkbaar, en er is geen punt waarop groeien onmogelijk wordt.

   2. FOCUS IS GOEDKOPER DAN SPREIDING. Tien restaurants in twee straten runnen
      is eenvoudiger dan tien bedrijven in zeven sectoren over de hele stad.
      Dat is de strategische keuze die deze laag toevoegt: een specialist
      betaalt minder hoofdkantoor dan een conglomeraat, en een conglomeraat
      koopt daarvoor iets terug wat de specialist niet heeft -- spreiding over
      de conjunctuur, het nieuws en de sectorrisico's.

   3. HET IS EEN KOSTENPOST EN GEEN STRAF. Hij staat op het maandoverzicht met
      zijn opbouw erbij, hij is vooraf uit te rekenen, en hij verlaat de wereld
      zoals rente en premie dat doen. Een verborgen aftrek zou hetzelfde effect
      hebben en niet te bespelen zijn, en dat is het verschil tussen een
      mechaniek en een handicap. */
const rond = (n) => Math.round(n);

/* De basis per vestiging bij een concern van EEN. Bewust laag: een ondernemer
   met een zaak heeft geen hoofdkantoor, hij heeft een keukentafel. */
const BASIS = 500;
/* Hoe hard de coordinatie meegroeit. `n^MACHT` met MACHT boven 1 maakt de
   totale post superlineair: de tiende zaak kost bijna twee keer zoveel te
   besturen als de eerste, de twintigste ruim twee en een half.

   DEZE TWEE GETALLEN ZIJN GEIJKT OP DE KAART EN NIET GEKOZEN. Bij 900 en 1,35
   werd er nog maar 24% van de kavels bebouwd tegen 48% ervoor: dan is de rem
   geen afweging meer maar een verbod op groeien, en dat is dezelfde fout in
   spiegelbeeld. Bij 500 en 1,25 blijft de kaart voor ruim een derde bezet,
   winnen er drie verschillende stijlen aan een volle tafel, en staat een
   onderzoeksstijl voor het eerst gelijk aan doorbouwen. */
const MACHT = 1.25;
/* Wat spreiding extra kost, per EXTRA sector en per EXTRA zone boven de eerste.
   Een concern in een sector en een straat betaalt niets extra. */
const PER_SECTOR = 0.16;
const PER_ZONE = 0.09;
/* Het plafond op die opslag: een conglomeraat betaalt hoogstens het dubbele van
   een specialist met evenveel zaken. Zonder plafond is spreiden op een gegeven
   moment onmogelijk in plaats van duur, en dat is een verbod en geen afweging. */
const MAX_SPREIDING = 2.0;

/* DE SPREIDING VAN EEN PORTEFEUILLE, in het aantal sectoren en zones waarin hij
   zit. Twee getallen en geen index: een samengestelde "diversiteitsscore" zou
   niet uit te leggen zijn op het scherm, en dit moet juist uit te leggen zijn. */
function spreiding(rij, zoneVan) {
  const sectoren = new Set(rij.map(v => v.sector));
  const zones = new Set(rij.map(v => zoneVan(v)).filter(Boolean));
  return { sectoren: sectoren.size, zones: zones.size,
    opslag: Math.min(MAX_SPREIDING,
      1 + Math.max(0, sectoren.size - 1) * PER_SECTOR + Math.max(0, zones.size - 1) * PER_ZONE) };
}

/* WAT HET HOOFDKANTOOR DEZE MAAND KOST. Opgebouwd uit drie stukken die elk apart
   op het scherm staan, want een bedrag zonder opbouw is een aftrek. */
function kosten(rij, zoneVan) {
  const n = (rij || []).length;
  if (n <= 1) return { aantal: n, basis: n * BASIS, schaal: 1, spreiding: null, totaal: rond(n * BASIS) };
  const sp = spreiding(rij, zoneVan);
  const schaal = Math.pow(n, MACHT) / n;      // wat een zaak extra kost door het aantal
  const totaal = n * BASIS * schaal * sp.opslag;
  return { aantal: n, basis: n * BASIS, schaal: Math.round(schaal * 100) / 100,
    spreiding: sp, totaal: rond(totaal), perZaak: rond(totaal / n) };
}

/* WAT DE VOLGENDE ZAAK EXTRA KOST. Dit is het getal waarop een speler zijn
   groeibesluit neemt, en zonder dat getal is de laag een verrassing achteraf. */
function volgende(rij, zoneVan, sector, zone) {
  const nu = kosten(rij, zoneVan);
  const straks = kosten(rij.concat([{ sector, __zone: zone }]),
    (v) => (v.__zone !== undefined ? v.__zone : zoneVan(v)));
  return { nu: nu.totaal, straks: straks.totaal, erbij: straks.totaal - nu.totaal };
}

/* WAT EEN SPELER ZIET: zijn portefeuille op een rij, met wat hij kost en wat een
   zaak erbij zou kosten. Van een ander niets -- hoeveel hoofdkantoor een
   concurrent draagt, staat in zijn boeken. */
function beeld(rij, zoneVan) {
  const k = kosten(rij, zoneVan);
  const perSector = {}, perZone = {};
  for (const v of rij || []) {
    perSector[v.sector] = (perSector[v.sector] || 0) + 1;
    const z = zoneVan(v);
    if (z) perZone[z] = (perZone[z] || 0) + 1;
  }
  return Object.assign({}, k, { perSector, perZone,
    uitleg: 'Elke zaak erbij moet met alle andere worden afgestemd; spreiding over '
      + 'sectoren en buurten kost extra.' });
}

module.exports = { BASIS, MACHT, PER_SECTOR, PER_ZONE, MAX_SPREIDING,
  spreiding, kosten, volgende, beeld };
