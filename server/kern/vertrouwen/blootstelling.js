/* ============================================================================
   DE BLOOTSTELLINGSMETER -- laag 1 van de Trust Fabric (VERTROUWEN.md par. 6).

   EEN VRAAG: hoeveel raakt deze handeling werkelijk? Niet "mag u dit" (dat is
   de rechtenlaag) en niet "wat blijft er open" (dat is bedrijf/gevolg.js), maar
   de omvang, uitgedrukt in een getal dat de handeling meedraagt.

   WAAROM DAT GETAL ER MOET ZIJN. Zonder omvang is elke bevestigingsvraag
   dezelfde vraag, en dan leest niemand hem meer. Twaalf personeelsrecords
   exporteren en er 18.400 exporteren zijn dezelfde knop met hetzelfde recht;
   alleen het aantal verschilt, en juist dat aantal is wat het gevaarlijk maakt.

   VIER REGELS

   1. GEMETEN TEGEN HET EIGEN NORMALE BEREIK, niet tegen een absoluut getal.
      Voor een salarisadministrateur is 400 personen dinsdag; voor een
      teamleider is het een inbraak. Een vaste drempel maakt de een blind en
      de ander gek.
   2. KOUDE START LIEGT NIET. Wie nog geen grondslag heeft (te weinig
      waarnemingen), wordt tegen de vaste grens van de soort gehouden EN krijgt
      dat te horen. De verleiding is om dan maar niets te vragen -- terwijl een
      gloednieuwe actor die meteen groot uithaalt precies het gevaarlijke geval
      is.
   3. ONGEWOGEN IS NIET LICHT. Een soort die niet in het register staat levert
      `gemeten: false` met de reden. Zie register.js.
   4. DEZE MODULE SCHRIJFT NIETS. Pure functies, buffer erin en oordeel eruit,
      zoals kern/antivirus/analyse.js. Meten mag nooit een bijwerking hebben,
      want deze meter draait vlak voor de handeling zelf.
   5. EN OMVANG IS NIET ALLES. Vijf keer een handeling die er een raakt, is vijf
      keer licht -- en samen een zuivering. Die tweede vraag wordt hier NIET
      beantwoord maar meegekregen: `tempo` komt uit kern/vertrouwen/tempo.js en
      kan de zwaarte optillen. Waarom dat naar `uitzonderlijk` gaat en niet naar
      `zwaar`, staat in de kop daar; het komt erop neer dat een zware handeling
      na een bevestiging een kwartier vrij spel heeft, en dat kwartier is
      precies waar een reeks in past.
   ========================================================================== */
'use strict';

const R = require('./register');

/* Hoeveel eerdere keren er nodig zijn voordat het eigen gedrag een grondslag
   is. Onder dit aantal is "normaal" een gemiddelde van bijna niets, en dan
   meet je de ruis van de eerste week. */
const WAARNEMINGEN_NODIG = 20;

/* De banden. Tot 1x de drempel is het gewoon werk; daarboven wordt het zwaar,
   en vanaf VEEL keer de drempel is het uitzonderlijk. Twee banden en niet vijf:
   een schaal die niemand uit zijn hoofd kent, stuurt geen enkel gedrag. */
const VEEL = 5;

const getal = (n) => (typeof n === 'number' && Number.isFinite(n) && n >= 0);
const eenheidVan = (s, n) => (n === 1 && s.eenheidEen ? s.eenheidEen : s.eenheid);

/* De grondslag: waar meten we tegen af, en waarom die en niet de andere. */
function grondslagVan(s, eigen) {
  if (eigen && getal(eigen.p95) && getal(eigen.n) && eigen.n >= WAARNEMINGEN_NODIG)
    return { soort: 'eigen', waarde: Math.max(1, eigen.p95), n: eigen.n };
  const gezien = (eigen && getal(eigen.n)) ? eigen.n : 0;
  return {
    soort: 'vast', waarde: Math.max(1, s.vast), n: gezien,
    reden: 'Er is nog geen eigen grondslag voor deze handeling (' + gezien + ' van de ' +
      WAARNEMINGEN_NODIG + ' waarnemingen). Gemeten tegen de vaste grens van deze soort.'
  };
}

/* De kern. `eigen` is de waargenomen gewoonte van DEZE actor voor DEZE soort,
   of null; hij komt uit gewoonte.js en niet uit dit bestand, zodat de meter
   zelf geen geheugen heeft en met verzonnen invoer te ijken is. */
function meet(handeling, eigen, tempo) {
  const h = handeling || {};
  const s = R.soort(h.soort);
  if (!s) return {
    gemeten: false,
    soort: String(h.soort || ''),
    reden: 'Deze soort handeling staat niet in het handelingenregister, dus de omvang is hier ongewogen. Ongewogen is niet hetzelfde als licht.',
    nietGerekend: R.NIET_GEREKEND
  };
  if (!getal(h.aantal)) return {
    gemeten: false,
    soort: s.id,
    reden: 'De aanroeper gaf geen telbaar aantal mee (' + JSON.stringify(h.aantal) +
      '). Een omvang die niemand heeft geteld, is geen omvang.',
    nietGerekend: R.NIET_GEREKEND
  };

  const g = grondslagVan(s, eigen);
  /* Gevoelige gegevens halveren de drempel: hetzelfde aantal weegt zwaarder
     omdat de schade per eenheid groter is. Dat staat in de redenen, want een
     drempel die stilletjes verschuift is niet uit te leggen. */
  const drempel = s.gevoelig ? Math.max(1, g.waarde / 2) : g.waarde;
  const factor = h.aantal / drempel;
  const gerekend = factor <= 1 ? 'licht' : (factor <= VEEL ? 'zwaar' : 'uitzonderlijk');
  /* EN DE ONDERGRENS VAN DE SOORT WINT ALS HIJ HOGER LIGT. Sommige handelingen
     zijn al bij het eerste exemplaar onherstelbaar; het aantal zegt daar niets
     over. Zie register.js bij `minstens`. */
  let zwaarte = R.BANDEN.indexOf(s.minstens) > R.BANDEN.indexOf(gerekend) ? s.minstens : gerekend;
  /* EN HET TEMPO TILT OOK OP. Boven het budget is de handeling uitzonderlijk,
     hoe klein hij op zichzelf ook is -- dat is het hele punt van een reeks. */
  const doorTempo = !!(tempo && tempo.over);
  if (doorTempo) zwaarte = 'uitzonderlijk';

  /* `redenen` legt een ONDERBREKING uit, en er is er geen als de handeling licht
     is. Zou hij ook dan vullen, dan krijgt een mens bij elke gewone handeling
     dezelfde drie zinnen te zien en leest hij ze bij de vierde niet meer
     (VERTROUWEN.md par. 3.7). Er verdwijnt niets: de grondslag, het aantal
     waarnemingen, de gevoeligheid en de omkeerbaarheid staan als VELD in het
     antwoord, dus een licht oordeel op een zwakke grondslag is nog steeds
     zichtbaar voor wie het narekent. Alleen het praatje blijft weg. */
  const redenen = [];
  if (zwaarte !== 'licht') {
    /* WIE HET OORDEEL VELDE, STAAT VOORAAN. Besliste het tempo, dan is "0,2x de
       vaste grens" de eerste zin die de lezer ziet -- en die leest als een
       geruststelling terwijl er net een poort dichtging. De omvang blijft er
       wel bij staan, want hij is waar; hij staat alleen niet meer bovenaan. */
    if (doorTempo) redenen.push(tempoZin(s, tempo));
    redenen.push('Deze handeling raakt ' + h.aantal + ' ' + eenheidVan(s, h.aantal) + ' -- ' +
      Math.round(factor * 10) / 10 + 'x ' +
      (g.soort === 'eigen' ? 'uw eigen normale bereik' : 'de vaste grens') + ' van ' +
      Math.round(drempel) + '.');
    if (g.reden) redenen.push(g.reden);
    if (s.gevoelig) redenen.push('Het gaat om bijzondere persoonsgegevens, dus de grens ligt op de helft.');
    if (!s.omkeerbaar) redenen.push('Deze handeling is niet terug te draaien. ' + (s.waaromNiet || ''));
    if (!doorTempo && zwaarte !== gerekend) redenen.push(s.waaromMinstens ||
      'Deze soort handeling telt altijd als ' + s.minstens + ', ongeacht het aantal.');
  }

  return {
    gemeten: true,
    soort: s.id,
    naam: s.naam,
    aantal: h.aantal,
    eenheid: s.eenheid,
    grondslag: g.soort,
    waarnemingen: g.n,
    drempel: Math.round(drempel),
    factor: Math.round(factor * 100) / 100,
    zwaarte,
    omkeerbaar: s.omkeerbaar,
    gevoelig: s.gevoelig,
    redenen,
    tempo: tempo || null,
    zin: doorTempo ? tempoZin(s, tempo) : zin(s, h.aantal, zwaarte, factor, g, zwaarte !== gerekend),
    nietGerekend: R.NIET_GEREKEND
  };
}

/* EEN zin, en niet een lijst. VERTROUWEN.md par. 3.7: kan een step-up niet in
   een zin worden uitgelegd, dan is het geen step-up maar ruis. Deze zin is wat
   een mens te zien krijgt; `redenen` is wat eronder staat als hij doorklikt. */
function zin(s, aantal, zwaarte, factor, g, doorGrens) {
  const wat = 'Deze handeling raakt ' + aantal + ' ' + eenheidVan(s, aantal);
  if (zwaarte === 'licht') return wat + ' en blijft binnen het gewone bereik.';

  /* WIE HET OORDEEL VELDE, ZEGT HET OOK. Besliste de ondergrens van de soort,
     dan is "zoveel keer meer dan uw normale bereik" onzin -- bij een aantal van
     een is dat getal een. Dan hoort er te staan waarom dit altijd al erg is. */
  if (doorGrens) return wat + '. ' + (s.waaromMinstens ||
    'Deze soort handeling telt altijd als ' + s.minstens + ', ongeacht het aantal.');

  const maat = g.soort === 'eigen' ? 'dan u normaal doet' : 'dan de grens voor deze handeling';
  return wat + (s.gevoelig ? ' en bevat bijzondere persoonsgegevens' : '') + '. Dat is ' +
    Math.round(factor) + 'x meer ' + maat +
    (s.omkeerbaar ? '.' : ', en het is niet terug te draaien.');
}

/* De zin bij een overschreden budget. Hij noemt het TOTAAL en niet deze ene
   handeling, want dat is precies wat de lezer niet zelf ziet: de handeling voor
   zich is klein, en dat is de reden dat hij hier voor stond. */
function tempoZin(s, t) {
  return 'Dit brengt uw totaal op ' + t.metDeze + ' ' + eenheidVan(s, t.metDeze) +
    ' in ' + t.vensterUren + ' uur; daarboven ' + (t.budget === 1 ? 'is er' : 'zijn er') + ' ' +
    t.budget + ' ' + eenheidVan(s, t.budget) + ' afgesproken. Een reeks kleine handelingen is ook een grote.';
}

module.exports = { meet, tempoZin, WAARNEMINGEN_NODIG, VEEL };
