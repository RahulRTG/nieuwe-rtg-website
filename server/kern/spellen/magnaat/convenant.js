/* Magnaat: DE CONVENANTEN -- wat een bank van je verwacht, en wat er gebeurt
   als je dat niet waarmaakt.

   Afgesplitst van ./bank.js: die tabel gaat over wat een bank je VERKOOPT (de
   vormen en de prijs), dit bestand over wat hij van je VERWACHT. Twee kanten
   van hetzelfde gesprek, maar ze veranderen om verschillende redenen -- een
   nieuwe kredietvorm raakt de normen niet, en een nieuwe norm raakt de prijs
   niet.

   DRIE TRAPPEN EN GEEN BESLAG, en dat is het besluit dat financiering
   strategisch maakt in plaats van eng. Een bank die bij de eerste misstap je
   zaak inneemt, is een bank waar niemand ooit heenloopt -- en dan is de hele
   laag decoratie. In het echt gaat het ook zo: eerst een brief, dan een prijs,
   dan pas de deur. */
const { VORMEN } = require('./bankvormen');

/*   1. GESIGNALEERD  je krijgt het te horen en verder niets.
     2. OPSLAG        de rente gaat omhoog zolang je eroverheen zit, en je mag
                      niet bijlenen.
     3. OPEISBAAR     na een half jaar aanhoudende breuk wordt de lening
                      opgeeist: het restant moet uit de kas, en lukt dat niet,
                      dan gaat het onderpand eraan. Heeft de lening geen
                      onderpand, dan blijft de schuld staan tegen de hoogste
                      opslag -- een ongedekte lening kan niemand afpakken. */
const NORMEN = {
  liquiditeit: { naam: 'liquiditeitsbuffer', grens: 0.15,
    uitleg: 'ten minste 15% van je jaarlasten in kas' },
  schuldlast: { naam: 'schuld ten opzichte van winst', grens: 4,
    uitleg: 'schuld onder vier keer de jaarwinst' }
};
const TRAP = { signaal: 1, opslag: 2, opeisbaar: 6 };   // in maanden aanhoudende breuk
const BREUK_OPSLAG = 0.006;

/* Welke normen breekt deze speler NU? Uit het profiel en niet uit een teller:
   een norm die je vandaag haalt, is vandaag gehaald. */
function breuken(lening, cijfers) {
  const v = VORMEN[lening.soort];
  const uit = [];
  for (const norm of v.covenanten) {
    if (norm === 'liquiditeit' && cijfers.buffer < NORMEN.liquiditeit.grens) uit.push('liquiditeit');
    if (norm === 'schuldlast' && cijfers.schuldlast > NORMEN.schuldlast.grens) uit.push('schuldlast');
  }
  return uit;
}

const trapVan = (maanden) => (maanden >= TRAP.opeisbaar ? 'opeisbaar'
  : maanden >= TRAP.opslag ? 'opslag' : maanden >= TRAP.signaal ? 'signaal' : null);

module.exports = { NORMEN, TRAP, BREUK_OPSLAG, breuken, trapVan };
