/* DE REM OP HET RADEN -- gezinscodes en pincodes.

   Afgesplitst uit ./basis.js, dat door de uitleg hieronder over de 10 kB van
   keuringsregel 13 ging. De naad is echt: basis.js is de fabriek die de
   foundation-context samenstelt (opslag, sleutel, router, AI); dit is een
   beveiliging met een eigen vraag en een eigen geschiedenis.

   Een gezinscode is zes tekens en geeft toegang tot kinderprofielen met hun
   locatie en hun gezondheidsgegevens. Deze teller is het enige wat tussen een
   rader en die gegevens staat. */
'use strict';

const pogingen = new Map(); // bucket -> { n, until }

/* DE REM UITZETTEN IS EEN BESLUIT, GEEN BIJVERSCHIJNSEL VAN NODE_ENV.

   Hier stond `process.env.NODE_ENV === 'test'`. De reden erbij klopte -- in de
   toetsenreeks delen alle gezinnen een adres, dus zonder uitzondering zetten
   toetsen elkaars rem aan -- maar het middel was verkeerd, om twee redenen.

   1. GEEN ENKELE TOETS KON DEZE REM ZIEN. test/helper.js zet NODE_ENV=test bij
      elke serverstart, dus in precies de omgeving waar alles bewezen wordt,
      stond hij uit. Een grendel die per constructie nooit getoetst wordt is
      LAT.md regel 9 in zuivere vorm; en dit is niet zomaar een grendel, het is
      het enige wat tussen een rader en een gezinscode staat.
   2. HET IS EEN NOODSCHAKELAAR OP EEN BEVEILIGING, aan een variabele die voor
      iets heel anders bestaat. Belandt NODE_ENV=test ooit op een echte server
      -- een verkeerde regel in een deploy-script is genoeg -- dan staat het
      raden vrij, en niets zegt er iets over. Dit huis heeft die les al een keer
      geleerd bij de demo-inlog: een slot dat opengaat als iemand iets vergeet
      is geen slot (server/server.js bij DEMO).

   Nu staat de rem AAN, ook in de toetsenreeks, en zet een toets hem
   uitdrukkelijk uit als hij hem in de weg zit. Die vlag is in productie
   verboden (server/config/productie-lokaal.js), dus hij kan er niet stilletjes
   bij een uitrol in glippen. test/geld-rollen-gezin.test.js toets 4 kijkt of
   hij er nog is. */
const GEEN_LIMIET = process.env.RTG_GEZIN_REM_UIT === '1';

function teVaak(res, bucket) {
  if (GEEN_LIMIET) return false;
  const f = pogingen.get(bucket);
  if (f && f.until > Date.now()) {
    res.status(429).json({ error: 'Te veel pogingen. Wacht een paar minuten en probeer het opnieuw.' });
    return true;
  }
  return false;
}

function misluktePoging(bucket, max = 10, minuten = 5) {
  if (GEEN_LIMIET) return;
  const f = pogingen.get(bucket) || { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= max) { f.until = Date.now() + minuten * 60000; f.n = 0; }
  pogingen.set(bucket, f);
}

function goedePoging(bucket) { pogingen.delete(bucket); }

/* HET ADRES VAN DE AANROEPER -- EN NIET HET ADRES DAT HIJ ZELF OPGEEFT.

   Hier stond een eigen lezer die x-forwarded-for van LINKS pakte. Dat is precies
   de kant die de client zelf vult: wie bij elke poging een ander adres
   meestuurt, krijgt telkens een verse teller en raakt de grens nooit. De rem op
   het RADEN van een gezinscode was daarmee met een enkele kop uit te zetten.

   De server leidt het echte adres al zorgvuldig af in server/web/verrijk.js: van
   RECHTS, en alleen bij een vertrouwde proxy, juist om deze vervalsing tegen te
   houden. server/trio.js plakt het echte adres ook rechts aan. Er was dus al een
   goed antwoord; deze regel was een tweede, slechter antwoord op dezelfde vraag.
   Twee bronnen voor een waarheid betekent dat de zwakste wint zodra iemand hem
   gebruikt (LAT.md regel 4). */
const ipVan = req => String(req.ip || (req.socket && req.socket.remoteAddress) || 'onbekend');

module.exports = { teVaak, misluktePoging, goedePoging, ipVan, GEEN_LIMIET };
