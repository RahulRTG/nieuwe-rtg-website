/* Magnaat: HET KAVELLOG -- wat er op een plek gebeurde, in de volgorde waarin het gebeurde.

   DIT IS DE EERSTE WERVEL VAN DE GESCHIEDENISLAAG, en hij zit met opzet op de
   plek waar de minste uitzonderingen wonen: een stuk grond.

   ================== DE TWEE REGELS ERBOVEN ==================

   1. WAT GEBEURD IS, BLIJFT WAAR. WAT HET TUSSEN MENSEN BETEKENT, KAN
      VERANDEREN. Een regel in dit log wordt nooit gewijzigd en nooit gewist --
      hij is een FEIT. Dat een pand in maand 38 afbrandde blijft waar, ook als
      het er in maand 44 mooier staat dan ooit. Wat een feit BETEKENT is geen
      eigenschap van het feit, en staat hier dus niet in: geen oordeel, geen
      score, geen "goed" of "fout".

   2. SYSTEMEN SCHRIJVEN FEITEN, MAGNAAT LEEST GESCHIEDENIS. Dit bestand kent
      geen enkel verhaal. `./acties.js` weet wat openen is, `./afscheid.js` wat
      sluiten is, `./foundation.js` wat bouwen is -- ze schrijven alle drie
      hetzelfde soort regel hierheen en verder niets. Wie er een verhaal van
      maakt (de stadskrant, de tijdlijn, het pandgeheugen) leest.

   ================== WAAROM ER GEEN PERSOON IN STAAT ==================

   En dat is geen voorzichtigheid maar een waarneming over wat een stad
   werkelijk onthoudt. Je loopt langs een pand en je ziet het BORD: "Bakkerij De
   Haven". Je ziet niet het handelsregister. Dus staat hier de naam van de ZAAK
   en de sector, en nooit een speler, een codenaam of een eigenaar.

   Dat heeft een gevolg dat de hele laag draagt: hierin staat geen persoon, dus
   valt hij -- net als ../stadsgeheugen.js en om woordelijk dezelfde reden --
   buiten de 18+-poort van ../grens.js. Een kind dat meespeelt laat wel degelijk
   een spoor na in de stad; het spoor draagt alleen zijn naam niet.

   WIE er zat is een andere vraag, aan een andere laag, met een strengere grens
   (../loopbaan.js, ../ondernemerskring.js). Twee lagen, dezelfde ruggengraat.

   ================== WAT ER IN EEN REGEL STAAT ==================

     maand   wanneer, op de klok van de partij
     kavel   waar
     wat     wat er gebeurde -- uit de gesloten lijst hieronder
     naam    het bord op de gevel, als er een was
     sector  wat voor zaak het was, als het er een was

   Meer niet. Geen bedrag: wat een pand kostte is een boeking en geen
   geschiedenis (VERHAAL.md paragraaf 1). */
'use strict';

/* DE SOORTEN, als gesloten lijst. Een vrij tekstveld zou betekenen dat elke
   aanroeper zijn eigen woorden kiest, en dan is "wat gebeurde er hier" niet meer
   te beantwoorden zonder alles te lezen. */
/* DRIE, EN NIET ZES. Hier stonden ook `afgebrand`, `hersteld` en `gebouwd`, en
   die schreef niemand -- een gesloten lijst met dode ingangen is een lijst die
   niet meer zegt wat er kan gebeuren. Ze horen er wel te komen, en dit is waar
   ze aanhaken:

     schade en herstel  ./risico.js kent Brand en Storm met `schade: 'pand'`,
                        maar die boeken vandaag een BEDRAG en raken het pand
                        niet als plek. Zodra ze dat wel doen, schrijven ze hier.
     foundation         ./foundation.js zet een project in een ZONE en niet op
                        een kavel, en heeft zijn eigen geheugen
                        (../stadsgeheugen.js). Landt hij ooit op een kavel, dan
                        komt `gebouwd` hier terug. */
const SOORTEN = ['geopend', 'gesloten', 'overgedragen'];

/* SCHRIJVEN. Hij geeft niets terug en hij faalt niet stil: een onbekende soort
   is een programmeerfout en geen invoerfout, dus die gooit. `undefined` in een
   geschiedenis is erger dan een lege geschiedenis. */
function schrijf(st, { kavel, wat, naam, sector }) {
  if (!SOORTEN.includes(wat))
    throw new Error('magnaat/kavellog: onbekende gebeurtenis "' + wat + '".');
  if (!kavel) return null;
  const log = (st.kavelLog = st.kavelLog || []);
  const regel = { maand: st.maand, kavel: String(kavel), wat };
  if (naam) regel.naam = String(naam).slice(0, 40);
  if (sector) regel.sector = String(sector);
  log.push(regel);
  return regel;
}

/* LEZEN. Op maand, en bij gelijke maand op de volgorde waarin het gebeurde --
   het log is append-only, dus die volgorde IS de waarheid en er valt niets te
   sorteren wat er niet al staat. */
const voorKavel = (st, kavel) => (st.kavelLog || []).filter(r => r.kavel === String(kavel));

/* DE PERIODEN die eruit volgen: wat stond hier van wanneer tot wanneer. Dit is
   de eerste LEZING van het log en met opzet een aparte functie -- het log is een
   feit, een periode is een interpretatie, en die twee horen niet door elkaar.

   Een periode zonder eind loopt nog. `tot` blijft dan null en de lezer vult in
   wat "nu" is; dit bestand kent geen nu. */
function perioden(st, kavel) {
  const uit = [];
  let lopend = null;
  for (const r of voorKavel(st, kavel)) {
    if (r.wat === 'geopend') {
      if (lopend) { lopend.tot = r.maand; uit.push(lopend); }
      lopend = { vanaf: r.maand, tot: null, naam: r.naam || null, sector: r.sector || null };
    } else if (r.wat === 'gesloten') {
      if (lopend) { lopend.tot = r.maand; uit.push(lopend); lopend = null; }
    }
    /* `overgedragen` STAAT WEL IN HET LOG EN DOET HIER NIETS, en dat is de
       bedoeling: een overdracht breekt de periode niet. Het bord blijft hangen
       en de zaak draait door; er staat alleen iemand anders achter, en die
       staat hier toch niet in. Dat is precies het verschil tussen wat een STAD
       ziet en wat een register ziet.

       Hier stond een regel die de naam bijwerkte. Die was dood: bij een
       overdracht verandert de naam niet. Wat er WEL kan gebeuren is dat een
       opvolger de zaak omdoopt (`beleid` met een naam), en dat is vandaag geen
       gebeurtenis. Zodra het er een wordt, haakt hij hier aan. */
  }
  if (lopend) uit.push(lopend);
  return uit;
}

module.exports = { SOORTEN, schrijf, voorKavel, perioden };
