/* Magnaat: DE WAARDERING -- wat een bedrijf waard is.

   Afgesplitst van ./stap.js, en de naad is scherper dan hij lijkt. Dat bestand
   rekent een MAAND: wat er binnenkomt, wat het kost, wat er overblijft. Dit
   bestand beantwoordt een heel andere vraag -- wat zou iemand ervoor geven --
   en die vraag is de plek waar elke laag die geld VERPLAATST waarde uit het
   niets kan maken. Vandaar dat hij zijn eigen bestand verdient met zijn eigen
   plafond, en niet als staartje onder de maandberekening hangt. */
const rond = (n) => Math.round(n);

/* Wat een vestiging WAARD is. Niet "wat je erin hebt gestopt" maar wat hij
   opbrengt: een jaarwinst maal een factor die met reputatie meebeweegt, met de
   grond eronder als bodem. Zo is een verlieslatende zaak nog steeds iets waard
   en een goedlopende zaak meer dan zijn stenen. */
/* HET PLAFOND OP EEN WAARDERING, en het is een vangnet en geen balansknop.

   Een bedrijf is hier een veelvoud van zijn winst waard, en dat is precies de
   plek waar elke laag die geld VERPLAATST waarde uit het niets kan maken: wie
   overbetaald wordt, ziet die overbetaling met factor zes in zijn waardering
   terugkomen terwijl de betaler alleen kas kwijt is. Bij contracten is dat
   echt gebeurd (zie de prijsband in ./handel.js) en dezelfde klasse komt terug
   bij leningen, verzekeringsuitkeringen en straks R&D-subsidies.

   Vijftien keer de bouwsom is met opzet RUIM: een uitstekend geleide zaak op
   een topplek komt rond de zes tot zeven uit, dus goed spelen raakt dit
   plafond nooit. Wat het tegenhoudt is de orde van grootte waarin een pomp
   werkt -- die vervoerder stond op 518 keer zijn bouwsom. */
const WAARDEPLAFOND = 15;

function waarde(v) {
  const jaar = (v.resultaatTotaal || 0) / Math.max(1, v.maanden || 1) * 12;
  const factor = 3.5 + (v.reputatie / 100) * 3.5;
  const verdiend = Math.min(Math.max(0, jaar) * factor, v.gebouwdVoor * WAARDEPLAFOND);
  return Math.max(rond(v.gebouwdVoor * 0.55), rond(verdiend + v.gebouwdVoor * 0.35));
}

module.exports = { waarde, WAARDEPLAFOND };
