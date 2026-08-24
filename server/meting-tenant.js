/* WELKE ORGANISATIES RAAKTE DIT -- de vraag die drie lagen tot vandaag als
   onbeantwoordbaar opschreven.

   HET PROBLEEM, EN WAAROM HET GEEN LUIHEID WAS. server/meting.js telt op het
   ROUTEPATROON en nooit op het pad, en dat is daar keuze 1 met een reden: een
   tijdreeks per lid of per klant is een miljoen tijdreeksen en dan valt de
   monitoring om voordat de server dat doet. Keuze 3 is even hard: geen
   persoonsgegevens in de metrics, want dat eindpunt wordt gescrapet door een
   systeem dat doorgaans minder streng bewaakt is dan de database. Een
   `tenant`-label aan rtg_verzoeken_totaal hangen breekt allebei die regels.

   Dus staat het hier NAAST de metrics en niet erin. Dit register:

   1. GAAT NOOIT MEE NAAR PROMETHEUS. Er is geen tekst()-functie, geen HELP en
      geen TYPE. Wie hem daar toch wil hebben, moet dat bewust bouwen en komt
      dan langs deze regel.
   2. TELT ORGANISATIES, GEEN VERZOEKEN PER ORGANISATIE. Per FUNCTIE staat er
      een verzameling org-codes en een verzameling org-codes MET een serverfout.
      Het antwoord is een AANTAL; de codes zelf verlaten deze module niet.
   3. STAAT OP DE FUNCTIE EN NIET OP HET ROUTEPATROON, en dat is dezelfde keuze
      die kern/command/vermogens.js maakt: een routepatroon verandert bij elke
      verbouwing, een functie-id is een productafspraak. Bovendien is het
      aantal daarmee begrensd door de functiecatalogus (191) in plaats van door
      hoeveel routes iemand ooit bijbouwt. Een vermogen kent zijn CATEGORIEEN,
      een functie kent zijn categorie -- zo sluit de vraag "welke organisaties
      raakte dit vermogen" aan op wat er geteld is.
   4. HEEFT EEN HARDE BOVENGRENS. Tweehonderd organisaties per functie.
      Daarboven staat `afgekapt: true` in het antwoord in plaats van een getal
      dat te laag is zonder het te zeggen.
   5. LEEFT IN EEN VENSTER. Na een uur begint hij opnieuw. Een storing van
      vanmorgen hoort niet mee te tellen in de impact van vanmiddag, en een
      register dat nooit vergeet groeit tot het geheugen op is.

   WAT DIT ANTWOORD WEL EN NIET IS, en dit is de belangrijkste alinea.

   Het is een ONDERGRENS. Er wordt geteld waar een verzoek al aan een
   organisatie is toegewezen: bij de twee deuren van de werkruimte
   (bedrijf/index.js, beheerVan en lidVan). Dat is de enige plek waar de
   toewijzing compleet is voor die laag -- de opmerking daar zegt het al voor
   het quotum -- maar het is niet het hele platform. Verkeer van leden, van
   zaken en van buiten draagt geen organisatie en wordt geteld als
   `nietToegewezen`. Wie hier "vijf organisaties" leest, weet dus: minstens
   vijf, en er is een deel waarvan we het niet weten. Dat deel staat erbij.

   EN HET IS NOG STEEDS GEEN BESCHIKBAARHEIDSCIJFER PER ORGANISATIE. BESTUUR.md
   par. 8 verbiedt dat zolang de meting geen tenant draagt, en dat blijft staan:
   voor een beschikbaarheidspercentage heb je ALLE verzoeken van een klant nodig
   over een hele periode, niet de organisaties die in een uur een fout zagen.
   Deze module beantwoordt "wie merkte dit", niet "hoe goed was het voor u". */
'use strict';

const functies = require('./functies');

const VENSTER_MS = 3600000;   // een uur
const MAX_ORGS = 200;

const staat = { sinds: Date.now(), functies: new Map(), nietToegewezen: 0, zonderFunctie: 0 };

function rol() {
  staat.sinds = Date.now();
  staat.functies = new Map();
  staat.nietToegewezen = 0;
  staat.zonderFunctie = 0;
}
function versGenoeg() {
  if (Date.now() - staat.sinds > VENSTER_MS) rol();
}

function vak(id) {
  versGenoeg();
  let v = staat.functies.get(id);
  if (v) return v;
  v = { orgs: new Set(), metFout: new Set(), afgekapt: false };
  staat.functies.set(id, v);
  return v;
}

/* De enige schrijfkant. `org` mag null zijn -- dan telt het verzoek als
   niet-toegewezen, en dat is een getal dat je wilt ZIEN en niet wegmoffelen:
   het zegt hoe ver de ondergrens hieronder van het geheel af staat. */
function raak(functieId, org, foutief) {
  if (!org) { versGenoeg(); staat.nietToegewezen++; return; }
  if (!functieId) { versGenoeg(); staat.zonderFunctie++; return; }
  const v = vak(String(functieId));
  const code = String(org);
  if (!v.orgs.has(code) && v.orgs.size >= MAX_ORGS) { v.afgekapt = true; return; }
  v.orgs.add(code);
  if (foutief) v.metFout.add(code);
}

/* De middleware-helper: hang hem op een verzoek waarvan de organisatie al
   bekend is. Hij wacht op het einde van het antwoord, want pas dan staat de
   status vast -- dezelfde reden als in meting.js. */
function volg(req, res, org) {
  if (!res || typeof res.on !== 'function') return;
  /* De functie wordt HIER opgezocht en niet door de aanroeper meegegeven: dan
     is er één plek waar het pad naar een functie wordt vertaald, en dat is
     dezelfde vertaling die de schakelkast gebruikt. */
  let f = null;
  try { f = functies.functieVoorPad(req.path || ''); } catch (e) { f = null; }
  let gedaan = false;
  const klaar = () => {
    if (gedaan) return;
    gedaan = true;
    raak(f ? f.id : null, org, (res.statusCode || 0) >= 500);
  };
  res.on('finish', klaar);
  res.on('close', klaar);
}

/* De leeskant. Geeft AANTALLEN, nooit codes -- ook niet als de aanroeper erom
   vraagt, want die functie bestaat hier niet. */
function geraakt(functieId) {
  versGenoeg();
  const v = staat.functies.get(String(functieId));
  if (!v) {
    return { organisaties: 0, metFout: 0, afgekapt: false, gemeten: false,
      waarom: 'op deze functie is in het huidige venster geen enkel verzoek aan een organisatie toegewezen' };
  }
  return { organisaties: v.orgs.size, metFout: v.metFout.size, afgekapt: v.afgekapt, gemeten: true };
}

/* De vraag zoals een vermogen hem stelt: over MEER functies tegelijk, en dan
   telt de UNIE en niet de som. Dezelfde organisatie die twee functies van
   hetzelfde vermogen raakte, is één organisatie -- optellen zou hem dubbel
   tellen en de "ondergrens" een bovengrens maken. */
function geraaktVan(functieIds) {
  versGenoeg();
  const orgs = new Set(), fout = new Set();
  let iets = false, afgekapt = false;
  for (const id of functieIds || []) {
    const v = staat.functies.get(String(id));
    if (!v) continue;
    iets = true;
    for (const c of v.orgs) orgs.add(c);
    for (const c of v.metFout) fout.add(c);
    if (v.afgekapt) afgekapt = true;
  }
  if (!iets) {
    return { gemeten: false, organisaties: 0, metFout: 0, afgekapt: false,
      waarom: 'op geen van deze functies is in het huidige venster een verzoek aan een organisatie toegewezen' };
  }
  return { gemeten: true, organisaties: orgs.size, metFout: fout.size, afgekapt };
}

function stand() {
  versGenoeg();
  let toewijzingen = 0, metFout = 0, afgekapt = false;
  const alle = new Set();
  for (const v of staat.functies.values()) {
    toewijzingen += v.orgs.size; metFout += v.metFout.size;
    if (v.afgekapt) afgekapt = true;
    for (const c of v.orgs) alle.add(c);
  }
  return {
    venster: { sinds: new Date(staat.sinds).toISOString(), minuten: Math.round(VENSTER_MS / 60000) },
    functies: staat.functies.size,
    organisaties: alle.size,
    toewijzingen,
    metFout,
    afgekapt,
    nietToegewezen: staat.nietToegewezen,
    zonderFunctie: staat.zonderFunctie,
    let: 'dit is een ONDERGRENS. Alleen verzoeken die langs een werkruimtedeur komen dragen een ' +
      'organisatie; ledenverkeer, zaakverkeer en verkeer van buiten staan onder nietToegewezen. ' +
      'En het blijft geen beschikbaarheidscijfer per organisatie: daarvoor heb je alle verzoeken ' +
      'van een klant over een hele periode nodig, niet de organisaties die in een uur een fout zagen.'
  };
}

module.exports = { raak, volg, geraakt, geraaktVan, stand, rol, VENSTER_MS, MAX_ORGS };
