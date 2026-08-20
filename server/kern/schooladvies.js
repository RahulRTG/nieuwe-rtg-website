/* RTG School: de adviesgrens -- wat dit systeem over een kind mag zeggen.

   DE GRENS. Over overgaan, doubleren, toelating, niveau en uitstroom beslist
   een mens. Dit systeem kijkt, telt en zegt wat het ziet; daarna houdt het op.
   Die regel stond al in vijf modules, vijf keer als een zin in een antwoord.
   Vijf kopieen van een grens is geen grens: er hoeft er maar een te sneuvelen
   en niemand ziet het. Daarom staat hij nu hier, op een plek, en hangen de
   uitspraken eraan -- zoals progressieMag in kern/spellen/grens.js.

   WAT EEN SCHOOLADVIES-UITSPRAAK IS. Een uitspraak over het PAD van een kind:
   welk niveau, overgaan of blijven, toelaten of afwijzen, wat er in het
   rapport komt, en welke waarneming om een gesprek vraagt. Dat is iets anders
   dan de aanmoediging halverwege een oefensessie ("bijna, lees de uitleg nog
   eens"); die gaat over de volgende vijf minuten en niet over een schoolloopbaan.
   Het verschil staat in test/schooladvies.test.js met beide lijsten bij naam,
   zodat een nieuwe uitspraak een keuze afdwingt in plaats van stil te passeren.

   TWEE DINGEN DIE DEZE MODULE GARANDEERT.

   1. ER IS GEEN MANIER OM EEN BESLUIT TE MAKEN. `uitspraak()` heeft geen
      parameter die `besluitDoorMens` uit zet. Wie hier een besluit uit wil
      halen, moet de module veranderen -- en dan zakt de toets.
   2. ER STAAT ALTIJD BIJ WIE BESLIST, MET NAAM. Niet "een mens" maar de school,
      het gezin, de instelling. Een advies zonder adres laat de lezer denken dat
      het systeem het al geregeld heeft.

   WAT DEZE MODULE NIET DOET. Zij herschrijft geen tekst. Klinkt een zin als een
   besluit, dan meldt `keur()` dat en gaat de melding mee naar boven; stil
   bijschaven zou de enige plek weghalen waar iemand het nog kan zien. */

/* De vijf uitspraken over het pad van een kind, met wie erover beslist. In
   geen enkele regel staat RTG, het systeem of de AI -- dat is de grens zelf,
   en test/schooladvies.test.js rekent hem na. */
const SOORTEN = {
  niveau: {
    wat: 'welk niveau of welke fase bij een leerling past',
    beslist: 'de school samen met de leerling en het gezin, en bij een officieel schooladvies de school zelf' },
  overgang: {
    wat: 'overgaan, blijven zitten of versnellen',
    beslist: 'de rapportvergadering van de school' },
  toelating: {
    wat: 'toelaten, op de wachtlijst zetten of afwijzen',
    beslist: 'de directie van de school' },
  rapporttekst: {
    wat: 'de tekst die met een rapport meegaat naar het gezin',
    beslist: 'de mentor of leraar die het rapport vaststelt' },
  signaal: {
    wat: 'een waarneming die om een gesprek vraagt',
    beslist: 'de mentor of zorgcoordinator, in een gesprek en niet in het systeem' }
};

/* Zinsdelen die een uitspraak tot een BESLUIT maken: ze stellen een uitkomst
   vast in plaats van hem voor te leggen. De lijst is met opzet klein en gaat
   over stellige uitkomsten, niet over woorden die toevallig zwaar klinken --
   een te grote lijst maakt van deze keuring een spelfoutenjager en dan zet
   iemand hem uit. */
const BESLUITEND = [
  'is toegelaten', 'wordt toegelaten', 'is afgewezen', 'wordt afgewezen',
  'is geplaatst', 'wordt geplaatst', 'gaat over', 'gaat niet over',
  'blijft zitten', 'moet doubleren', 'doubleert', 'is bevorderd',
  'krijgt het advies', 'het advies is vastgesteld', 'wij besluiten',
  'is besloten', 'staat vast'
];

/* Klinkt deze tekst als een besluit? Meldt wat er is gevonden en oordeelt
   verder niet: de melding reist mee naar boven, waar een mens hem ziet. */
function keur(tekst) {
  const t = String(tekst == null ? '' : tekst).toLowerCase();
  const gevonden = BESLUITEND.filter(z => t.includes(z));
  return { besluitend: gevonden.length > 0, zinsdelen: gevonden,
    waarschuwing: gevonden.length
      ? 'Deze tekst stelt iets vast in plaats van voor te leggen (' + gevonden.join(', ') + '). Een advies legt voor.'
      : null };
}

/* Een uitspraak over het pad van een kind. Er is geen parameter die er een
   besluit van maakt: besluitDoorMens staat er als letterlijke waarde. */
function uitspraak(soort, tekst) {
  const s = SOORTEN[String(soort || '')];
  if (!s) return { status: 400, error: 'Dit is geen bekende adviessoort. Bekend: ' + Object.keys(SOORTEN).join(', ') + '.' };
  const schoon = String(tekst == null ? '' : tekst).trim();
  if (!schoon) return { status: 400, error: 'Een advies zonder tekst is geen advies.' };
  const k = keur(schoon);
  return { ok: true, soort, tekst: schoon,
    besluitDoorMens: true,
    beslist: s.beslist,
    bijschrift: 'Dit is een advies en geen besluit: over ' + s.wat + ' beslist ' + s.beslist + '.',
    besluitend: k.besluitend, waarschuwing: k.waarschuwing };
}

/* De hele uitspraak als een leesbare tekst, met het bijschrift eraan vast. Wie
   alleen `tekst` doorgeeft, laat de grens achter -- daarom staat deze hier. */
function volledig(u) {
  return u && u.ok ? u.tekst + ' ' + u.bijschrift : '';
}

module.exports = { SOORTEN, BESLUITEND, keur, uitspraak, volledig };
