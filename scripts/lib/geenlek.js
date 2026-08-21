'use strict';
/* NIETS IN KLAARTEKST WAT EEN GEHEIM OF EEN MENS AANWIJST.

   WAAR DIT UIT KOMT. CodeQL meldde op 18 augustus 2026 drie keer hetzelfde:
   "This logs sensitive data returned by process environment as clear text",
   in scripts/golive.js, scripts/eigenaar-claim.js en scripts/docker/controle.js.
   Alle drie zijn het scripts die een mens zelf op een server draait, dus de
   eerste neiging is "dat valt wel mee". Bij het nalopen bleek dat maar deels
   waar, en de drie gevallen verschillen echt van elkaar:

     ECHT      twee plekken zetten een E-MAILADRES onversleuteld in de log. Dit
               huis draait op codenamen -- klantdata operationeel, echte namen in
               de gescheiden kluis (CLAUDE.md, privacy by design). Een adres in
               een terminalbuffer, een CI-log of een screenshot van een
               ondersteuningsgesprek is precies de terugweg van codenaam naar
               mens die dat ontwerp wil voorkomen.
     ECHT      golive.js bouwt zelf een DATABASE_URL met het postgres-wachtwoord
               erin (uit RTG_POSTGRES_PASSWORD_FILE) en drukt bij een storing de
               fout van de databasedriver af. Zo'n fout draagt de
               verbindingsreeks nogal eens mee. Dat is een wachtwoord in de log,
               op precies het moment dat iemand de log gaat delen om hulp te
               vragen.
     GEEN LEK  controle.js zet PADEN en een HOSTNAAM uit de omgeving in zijn
               meldingen. Dat zijn geen geheimen, en de melding is zonder die
               waarden onbruikbaar ("een map ontbreekt" -- welke?). Hier is de
               melder niet fout; de melder kan alleen niet bewijzen dat er nooit
               iets anders langskomt.

   DAAROM EEN FILTER EN GEEN ZWIJGPLICHT. Wat hier gebeurt is niet "log minder"
   maar "log hetzelfde, zonder de geheimen". Een keuring die niet meer zegt WELK
   pad ontbreekt, wordt niet gedraaid. De maskering laat dus zoveel staan als
   nodig is om het probleem te vinden, en haalt weg wat een sleutel is.

   EN HIJ STAAT OP EEN PLEK. Drie scripts die elk hun eigen maskering verzinnen,
   is drie kansen om het net iets anders te doen -- dat patroon heeft dit huis
   deze week al genoeg gekost.
   ========================================================================== */

/* Een e-mailadres blijft herkenbaar en wordt niet leesbaar: de eerste letter,
   de eerste letter van het domein en de extensie. Genoeg om in een gesprek te
   bevestigen "ja, dat is mijn adres", te weinig om er post naartoe te sturen of
   om een codenaam mee terug te voeren naar een mens. */
function maskerEmail(waarde) {
  const s = String(waarde == null ? '' : waarde).trim();
  const m = /^([^@\s])([^@\s]*)@([^@\s.])([^@\s.]*)\.([^@\s]+)$/.exec(s);
  if (!m) return s ? '(adres)' : '';
  return m[1] + '***@' + m[3] + '***.' + m[5];
}

/* WAT ER UIT EEN VRIJE TEKST WORDT GEHAALD. Elk patroon staat hier met wat het
   is, zodat het te betwisten valt -- en zodat zichtbaar is wat er NIET onder
   valt (paden, hostnamen, poortnummers, bestandsrechten). */
const PATRONEN = [
  /* Een verbindingsreeks met inloggegevens: postgres://gebruiker:wachtwoord@host.
     Dit is de reeks die golive.js zelf samenstelt uit het wachtwoordbestand. */
  [/\b([a-z][a-z0-9+.-]*:\/\/)([^\s:@/]+):([^\s@/]+)@/gi, '$1$2:***@'],
  /* Een e-mailadres, waar het ook staat.

     TWEE DINGEN DIE HIER ZIJN MISGEGAAN EN NU VASTLIGGEN. Er stond een optionele
     spatie in het patroon; die at de spatie vóór het adres op, zodat er
     "technische pagina:***@g***.com" uitkwam -- zonder spatie, en zonder de
     eerste letter. En de zeef loopt bewust TWEE keer over dezelfde tekst (bij de
     bron en bij het afdrukken), dus hij moet idempotent zijn: een al gemaskeerd
     adres moet er hetzelfde uitkomen. Daarom is de asterisk uitgesloten van de
     eerste letter en van de eerste letter van het domein. */
  [/\b([^\s@*])[^\s@]*@([^\s@.*])[^\s@.]*\.([a-z]{2,})\b/gi, '$1***@$2***.$3'],
  /* Sleutels en tokens: lange aaneengesloten hex- of base64-achtige reeksen.
     Twaalf tekens is de ondergrens; daaronder zitten te veel gewone woorden,
     hashes van commits en versienummers. */
  [/\b[A-Fa-f0-9]{32,}\b/g, '***'],
  [/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '***.***.***'],
  /* Een expliciet benoemd geheim in een sleutel=waarde-vorm. */
  [/\b((?:password|passwd|secret|token|key|sleutel|wachtwoord)\s*[=:]\s*)("?)([^\s"'&]+)\2/gi, '$1$2***$2']
];

function zonderGeheim(tekst) {
  let s = String(tekst == null ? '' : tekst);
  for (const [p, vervang] of PATRONEN) s = s.replace(p, vervang);
  return s;
}

module.exports = { maskerEmail, zonderGeheim, PATRONEN };
