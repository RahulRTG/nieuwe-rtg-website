'use strict';
/* IS ELKE MODULE DIE ROUTES REGISTREERT OOK ECHT INGELADEN?

   WAAR DIT UIT KOMT. Bij de samenvoeging van 24 takken (18-21 augustus 2026)
   viel de mountregel van server/routes/office/rendezvous.js weg. Het bestand
   stond er, de kern eronder ook, en alle drie zijn adressen gaven 404 --
   "Onbekend eindpunt". Vier toetsen zakten daarop, na twee uur suite.

   EN GEEN ENKELE METER KON HET ZIEN AANKOMEN, want dat kan principieel niet:
   een module die niemand inlaadt staat in geen enkele teller, dus hij kan er ook
   nergens uit verdwijnen. De dekking daalt niet, de routekaart wordt korter, en
   alles ziet er kleiner maar gezond uit. Dat is de stilste vorm van kapot die
   dit huis kent.

   DIT BESTAND STELT ALLEEN DE VRAAG; DE FEITEN KOMEN UIT DE INDEX.
   scripts/lib/werkelijkheid.js loopt de boom een keer af, leest elk bestand een
   keer en beantwoordt de commentaarvraag op een plek. Dat hoorde stap 1 te zijn
   en werd stap vijf: hier stonden eerst drie losse scanners met elk een eigen
   wandeling en een eigen commentaarfilter -- en drie van de vier meetfouten die
   bij het bouwen van deze poort zijn gemaakt, kwamen uit precies dat verschil.
   ========================================================================== */
const { index } = require('./werkelijkheid');

const ONDER_ROUTES = /(?:^|\/)server\/routes\//;

/* De ingangen worden door niemand ge-require'd, en dat hoort ook zo: server.js
   is het beginpunt, de rest wordt door een script of door de vloot gestart. */
const INGANGEN = ['server/server.js', 'server/poort.js', 'server/vloot.js',
  'server/trio.js', 'server/nood.js', 'server/foundation.js', 'server/school.js'];

function meet(mappen, klaarIndex) {
  const waar = mappen || ['server'];
  const ix = klaarIndex || index(waar);
  /* De index mag RUIMER zijn dan deze vraag -- keuringsregel 60 kijkt ook in
     public/, en dan wordt hij daar gebouwd. Filteren i.p.v. een tweede
     wandeling: dat is de hele winst van stap 1. */
  const binnen = (rel) => waar.some((m) => rel === m || rel.startsWith(m + '/'));

  const ingeladen = new Set(INGANGEN);
  let gekeken = 0;
  const kanten = { opgelost: 0, benaderd: [], onbekend: [] };
  const perGebied = {};

  for (const b of ix.bestanden.values()) {
    if (!binnen(b.pad)) continue;
    gekeken++;
    for (const d of b.kanten.opgelost) ingeladen.add(d);
    /* Een BENADERDE kant telt hier als ingeladen: we weten niet welke van de
       kandidaten het is, dus nemen we ze allemaal. Dat maakt de verzameling
       ruimer en het aantal wezen dus kleiner -- en die kant is hier de veilige.
       Een vals alarm op een module die wel degelijk draait maakt deze poort na
       twee keer waardeloos; een gemist geval kost een 404 die de suite vindt. */
    for (const ben of b.kanten.benaderd) for (const k of ben.kandidaten) ingeladen.add(k);

    kanten.opgelost += b.kanten.opgelost.length;
    kanten.benaderd.push(...b.kanten.benaderd);
    kanten.onbekend.push(...b.kanten.onbekend);

    const bak = perGebied[b.gebied] || (perGebied[b.gebied] = { opgelost: 0, benaderd: 0, onbekend: 0 });
    bak.opgelost += b.kanten.opgelost.length;
    bak.benaderd += b.kanten.benaderd.length;
    bak.onbekend += b.kanten.onbekend.length;
  }

  const wezen = [];
  for (const rel of ix.bestanden.keys()) {
    if (!binnen(rel) || ingeladen.has(rel)) continue;
    if (!ONDER_ROUTES.test('/' + rel)) continue;
    wezen.push(rel);
  }

  /* VERTROUWEN PER GEBIED: welk deel van de kanten daar EXACT is opgelost.
     Benaderd telt bewust niet als opgelost -- conservatief is niet hetzelfde als
     zeker, en dit getal moet juist dat verschil laten zien. Per gebied, zodat
     een obscure maplader in de spellenhoek niet het hele huis in "onzeker"
     hangt: identiteit, geld en beveiliging moeten op 100 staan, de rest niet. */
  const vertrouwen = {};
  for (const [g, b] of Object.entries(perGebied)) {
    const totaal = b.opgelost + b.benaderd + b.onbekend;
    vertrouwen[g] = { ...b, totaal, pct: totaal ? Math.round((b.opgelost / totaal) * 10000) / 100 : 100 };
  }

  return { gekeken, kanten, vertrouwen,
    graaf: ix.graaf, omgekeerd: ix.omgekeerd, index: ix, wezen: wezen.sort() };
}

module.exports = { meet, INGANGEN, ONDER_ROUTES };
