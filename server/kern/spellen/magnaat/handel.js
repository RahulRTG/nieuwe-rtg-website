/* Magnaat: DE CONTRACTEN -- het model, en wat een maand ermee doet.

   Fase B (GAMEHALL.md 12.9) begint hier, en hij begint met contracten omdat de
   strateeg in fase A precies een ding meldde dat niet opgelost was: een duel
   van twee op 144 kavels kent GEEN SCHAARSTE. De spelers lopen elkaar nooit
   tegen het lijf, dus wie zich op een sector stort wint van wie spreidt. Een
   contract is de eerste plek waar twee spelers elkaar WEL raken, ook als ze in
   andere buurten zitten -- en het is meteen de plek waar zich op een sector
   storten je afhankelijk maakt in plaats van sterk.

   EEN CONTRACT IS EEN VERPLICHTING EN GEEN AFSPRAAK, en dat verschil is de hele
   mechaniek. De vijf velden waar een speler over onderhandelt:

     eenheden   hoeveel er per spelmaand geleverd wordt
     bedrag     wat de afnemer per spelmaand betaalt
     looptijd   hoeveel spelmaanden het loopt
     eis        de kwaliteit die de leverancier minstens moet halen (0-100)
     boete      wat een maand onder de eis kost, en wat afkopen kost

   WAT HET DUUR MAAKT VOOR DE LEVERANCIER IS CAPACITEIT, niet geld. Een levering
   gaat VOOR de vrije verkoop: je hebt getekend. Wie zich vol tekent en daarna
   een goede maand heeft, ziet die klanten aan de deur staan en kan ze niet
   helpen. Zonder die volgorde is een contract gratis geld, en dan tekent
   iedereen alles.

   WAT HET RISICOVOL MAAKT VOOR DE AFNEMER IS DAT HET BEDRAG VASTSTAAT. Zijn
   inkoopbehoefte beweegt met zijn omzet mee; het contract niet. Een goed jaar
   maakt een contract goedkoop, een slecht jaar maakt hem een steen. Dat is
   precies waarom `looptijd` een keuze is en geen formaliteit.

   NIETS HIERIN IS TOEVAL. Zie de reden in ./stap.js: de klok rekent bij, dus
   tien maanden in een keer moeten hetzelfde geven als tien maanden los. Een
   boete die soms wel en soms niet valt zou dat breken.

   WAT HIER NIET STAAT: het onderhandelen zelf (./handel-acties.js -- dat is een
   ander onderwerp: wie mag wat voorstellen, en hoe vaak). Dit bestand kent
   alleen het CONTRACT en de maand. */
const { SECTOREN } = require('./sectoren');
const { MARKTPRIJS, HANDELSSOORTEN, LEVERANCIERS, behoefte, koopt, levert } = require('./handelsgoed');

const rond = (n) => Math.round(n);

/* ---------- het contract ---------- */

/* De grenzen waarbinnen een voorstel mag liggen. Ze zijn er niet om te sturen
   maar om onzin buiten te houden: een contract van duizend maanden loopt langer
   dan de campagne, en een boete van nul is geen eis maar een wens. */
const GRENZEN = {
  eenheden: [1, 100000], bedrag: [1, 5000000], looptijd: [3, 120],
  eis: [0, 95], boete: [0, 500000], vooraf: [0, 5000000]
};

/* DE PRIJSBAND, en dit is de belangrijkste grens van deze hele laag.

   Een contract is een PRIJS en geen cadeau. Zonder band konden twee spelers
   elkaar willekeurige bedragen factureren, en dat was geen theorie: de
   geldpomp-keuring (scripts/magnaat-pomp.js) mat er bij zijn eerste ronde
   193 miljoen mee, op een tafel waar 62 miljoen stond. De oorzaak zit niet in
   de kas -- die klopte tot op de euro -- maar in de WAARDERING: een bedrijf is
   een veelvoud van zijn winst waard, dus wie zich laat overbetalen ziet zijn
   zaak in waarde exploderen terwijl de betaler alleen kas verliest. Een
   vervoerder met een bouwsom van 368.000 stond op 191 miljoen.

   Binnen de band blijft ALLES te onderhandelen wat een onderhandeling nodig
   heeft: veertig procent onder de markt (een scherpe deal voor volume) tot het
   dubbele (betalen voor zekerheid). Daarbuiten is het geen prijs meer. */
const PRIJSBAND = [0.4, 2.0];

function keurVoorstel(x) {
  for (const [veld, [laag, hoog]] of Object.entries(GRENZEN)) {
    const n = Number(x[veld]);
    if (!Number.isFinite(n) || n < laag || n > hoog)
      return `${veld} moet een getal tussen ${laag} en ${hoog} zijn.`;
  }
  if (!HANDELSSOORTEN.includes(x.soort)) return 'Die handelssoort bestaat niet.';
  const perEenheid = x.bedrag / Math.max(1, x.eenheden);
  const markt = MARKTPRIJS[x.soort];
  if (perEenheid < markt * PRIJSBAND[0] || perEenheid > markt * PRIJSBAND[1])
    return 'Dat is per eenheid ' + Math.round(perEenheid) + '; de markt zit op ' + markt +
      ' en een contract mag tussen ' + Math.round(markt * PRIJSBAND[0]) + ' en ' +
      Math.round(markt * PRIJSBAND[1]) + ' liggen.';
  return null;
}

/* Een voorstel schoonvegen tot precies de velden die een contract kent. Wat er
   verder in het verzoek zat gaat niet mee -- een tegenvoorstel dat stiekem de
   afnemer verandert is geen tegenvoorstel. */
function voorwaarden(x) {
  const uit = { soort: String(x.soort || '') };
  for (const veld of Object.keys(GRENZEN)) uit[veld] = Math.round(Number(x[veld]) || 0);
  uit.exclusief = !!x.exclusief;
  return uit;
}

/* Kan deze leverancier deze soort uberhaupt leveren, en koopt deze afnemer hem?
   Twee kanten, want een winkel die vervoer belooft is geen onderhandeling maar
   een fout. */
function pastBij(leverancier, afnemer, soort) {
  if (levert(leverancier.sector) !== soort) return `Een ${SECTOREN[leverancier.sector].naam.toLowerCase()} levert geen ${soort}.`;
  if (!((SECTOREN[afnemer.sector].koopt || {})[soort])) return `Een ${SECTOREN[afnemer.sector].naam.toLowerCase()} koopt geen ${soort} in.`;
  return null;
}

/* EXCLUSIVITEIT bindt de LEVERANCIER, en dat is de kant die er iets voor
   terugkrijgt (de `vooraf`). Wie exclusiviteit verkoopt mag deze soort niet ook
   aan een concurrent van zijn afnemer leveren: dezelfde sector, dezelfde zone.
   Buiten die zone mag het wel -- anders koopt een afnemer met een tientje de
   hele stad dicht. */
function exclusiviteitsbotsing(lopend, kaart, nieuweAfnemer, soort) {
  const zone = (v) => kaart.kavel.get(v.kavel).zone;
  for (const c of lopend) {
    if (c.soort !== soort || !c.exclusief) continue;
    if (c.afnemerV.sector === nieuweAfnemer.sector && zone(c.afnemerV) === zone(nieuweAfnemer))
      return `Er ligt een exclusiviteit op ${soort} voor ${SECTOREN[nieuweAfnemer.sector].naam.toLowerCase()}s in ${zone(nieuweAfnemer)}.`;
  }
  return null;
}

/* ---------- de maand ---------- */

/* Wat een leverancier deze maand MOET leveren, opgeteld over zijn contracten.
   Wordt VOOR de maandberekening bepaald, want die capaciteit is dan al vergeven
   en de vrije verkoop krijgt wat overblijft. */
function verplichting(contracten, vestigingId) {
  let eenheden = 0;
  for (const c of contracten) if (c.status === 'loopt' && c.leverancierId === vestigingId) eenheden += c.eenheden;
  return eenheden;
}

/* De afwikkeling van EEN contract in EEN maand, gegeven wat de leverancier
   werkelijk kon leveren en welke kwaliteit hij haalde.

   DRIE UITKOMSTEN, en ze zijn alle drie een echte:
     - vol geleverd en de eis gehaald  -> de afnemer betaalt het hele bedrag
     - vol geleverd, eis niet gehaald  -> hele bedrag EN een boete
     - te weinig geleverd              -> pro rata betalen EN een boete

   Pro rata en niet "niets": een leverancier die 90% haalt heeft 90% geleverd,
   en de afnemer heeft dat gebruikt. Alleen niet betalen zou een afnemer belonen
   voor het uitknijpen van zijn leverancier. */
function afwikkelen(c, { geleverd, kwaliteit }) {
  const deel = c.eenheden > 0 ? Math.min(1, geleverd / c.eenheden) : 1;
  const betaling = c.bedrag * deel;
  const tekort = deel < 0.999;
  const onderMaat = kwaliteit < c.eis;
  const boete = (tekort || onderMaat) ? c.boete : 0;
  return { deel, betaling, boete, tekort, onderMaat, geleverd };
}

/* Wat een afnemer aan MARKTINKOOP bespaart doordat een contract een deel van
   zijn behoefte dekt. Dit is de post die het contract vervangt; het bedrag zelf
   wordt apart geboekt. Nooit meer dan de hele post: wie zich overtekent koopt
   meer dan hij nodig heeft en betaalt dat gewoon. */
function dekking(v, omzet, soort, geleverd) {
  const nodig = behoefte(v, omzet, soort);
  if (nodig <= 0) return { deel: 0, bedrag: 0, nodig: 0 };
  const deel = Math.min(1, geleverd / nodig);
  const s = SECTOREN[v.sector];
  return { deel, bedrag: omzet * s.inkoop * (s.koopt[soort] || 0) * deel, nodig };
}

/* Wat een contract nog waard is als je hem AFKOOPT. Niet de hele resterende
   looptijd -- dan is een contract van tien jaar een gijzeling en tekent niemand
   er ooit een -- maar drie maanden boete, met de resterende looptijd als plafond
   zodat afkopen in de laatste maand niet duurder is dan uitzitten. */
const AFKOOP_MAANDEN = 3;
function afkoopsom(c, maand) {
  const rest = Math.max(0, c.eindMaand - maand);
  return rond(c.boete * Math.min(AFKOOP_MAANDEN, rest));
}

module.exports = {
  behoefte, koopt, levert, keurVoorstel, voorwaarden, pastBij, exclusiviteitsbotsing,
  verplichting, afwikkelen, dekking, afkoopsom, GRENZEN, AFKOOP_MAANDEN, PRIJSBAND,
  MARKTPRIJS, HANDELSSOORTEN, LEVERANCIERS
};
