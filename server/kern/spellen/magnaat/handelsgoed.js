/* Magnaat: DE HANDELSGOEDEREN -- wat bedrijven van elkaar kopen.

   Afgesplitst van ./handel.js op een echte naad. Dit bestand zegt WAT er
   verhandeld wordt en wat het op de vrije markt kost; ./handel.js zegt wat een
   CONTRACT daarover is. Het eerste is een tabel die met de sectoren meebeweegt,
   het tweede zijn de regels van een verplichting -- en die twee veranderen om
   heel verschillende redenen. */
const { SECTOREN, SECTORLIJST } = require('./sectoren');

/* WAT BEDRIJVEN VAN ELKAAR KOPEN. `inkoop` in ./sectoren.js zei tot nu toe
   alleen HOEVEEL er naar inkoop ging; hij zei niet WAT er werd ingekocht en
   dus ook niet van wie. Zolang dat een percentage naar niemand was, kon een
   contract tussen twee spelers niets betekenen: er was geen post waar hij op
   landde.

   Vier soorten, elk met EEN leverende sector. Dat is met opzet krap: een soort
   die door drie sectoren geleverd wordt, geeft de afnemer geen keuze maar een
   lijst, en een keuze tussen twee spelers is het hele punt.

     goederen   -- de winkel/groothandel; de post van een restaurant
     productie  -- halffabricaat uit de fabriek; de post van een winkel
     vervoer    -- ritten; de post van wie iets moet verplaatsen
     diensten   -- advies, administratie, ICT; de post van een kantoor

   MARKTPRIJS is wat een handelseenheid op de vrije markt kost, en hij is de IJK
   WAARTEGEN ONDERHANDELD WORDT. Hij ligt dicht bij de middenprijs van de
   leverende sector: wie een contract sluit onder die prijs koopt goedkoper dan
   de markt, wie erboven tekent betaalt voor zekerheid. Allebei moeten kunnen,
   anders valt er niets te onderhandelen. */
const MARKTPRIJS = { goederen: 26, productie: 760, vervoer: 52, diensten: 3200 };
const HANDELSSOORTEN = Object.keys(MARKTPRIJS);
/* Wie levert wat -- AFGELEID uit `levert` en niet nog een keer opgeschreven.
   Twee lijsten die hetzelfde zeggen lopen uiteen. */
const LEVERANCIERS = Object.fromEntries(HANDELSSOORTEN.map(soort =>
  [soort, SECTORLIJST.filter(naam => SECTOREN[naam].levert === soort)]));

/* Hoeveel handelseenheden van een soort een vestiging per maand nodig heeft bij
   een gegeven omzet. Uit de BESTAANDE inkooppost -- er komt geen kostenpost
   bij, hij wordt alleen verdeeld. */
function behoefte(v, omzet, soort) {
  const s = SECTOREN[v.sector];
  const aandeel = (s.koopt || {})[soort] || 0;
  if (!aandeel) return 0;
  return (omzet * s.inkoop * aandeel) / MARKTPRIJS[soort];
}

/* Alle soorten die deze sector inkoopt, met hun aandeel. Voor het scherm en
   voor de keuring van een voorstel. */
const koopt = (sector) => Object.entries(SECTOREN[sector].koopt || {})
  .map(([soort, aandeel]) => ({ soort, aandeel }));
const levert = (sector) => SECTOREN[sector].levert || null;

module.exports = { MARKTPRIJS, HANDELSSOORTEN, LEVERANCIERS, behoefte, koopt, levert };
