/* ============================================================================
   HET TEMPO: niet hoe groot is deze handeling, maar hoeveel heeft u er al gedaan.

   HET GAT DAT DIT DICHT, en het stond met naam in het register. De meter van
   laag 1 weegt de OMVANG VAN EEN HANDELING. Daar komt een zuivering niet
   doorheen: vijf mensen op een dag uit dienst zetten is vijf keer een handeling
   die er een raakt, en elk van die vijf is licht. Dezelfde blinde vlek stond in
   NIET_GEREKEND onder "samenloop" -- twee handelingen die elk binnen de grens
   blijven maar samen niet.

   DIT IS DUS EEN TWEEDE VRAAG EN GEEN TWEEDE ANTWOORD OP DE EERSTE. De omvang
   blijft doen wat hij deed; hier komt er een grens naast die over een REEKS
   gaat: hoeveel heeft deze actor in het afgelopen venster al gedaan, en past
   deze handeling daar nog bij.

   DRIE KEUZES DIE HET VERSCHIL MAKEN MET DE GEWOONTEMETER ERNAAST:

   1. HET BUDGET WORDT VERKLAARD, NIET GELEERD. gewoonte.js leert het normale
      bereik van een mens. Voor tempo mag dat juist NIET, want daar is de reeks
      zelf de aanval: wie langzaam opvoert, leert een lerende meter dat opvoeren
      normaal is, en dan staat de drempel precies zo hoog als de aanvaller hem
      wil hebben. Een verklaard budget is een uitspraak van het huis ("meer dan
      dit op een dag is geen gewoon werk meer") en die kan een aanvaller niet
      verzetten. Hij staat dan ook in de soortentabel en niet in de opslag.

   2. OVER HET BUDGET IS UITZONDERLIJK EN NIET ZWAAR, en dat is geen strengheid
      maar de enige stand die werkt. Een ZWARE handeling gaat na een bevestiging
      een kwartier lang vanzelf door (stapop.js). Precies in dat kwartier maakt
      iemand zijn reeks af. Wie hier "zwaar" zou invullen, bouwt een poort die
      een keer vraagt en daarna de deur openhoudt voor de handeling waar hij
      voor bedoeld is. Boven het budget vraagt dus ELKE volgende opnieuw.

   3. HET VENSTER ROLT, HET IS GEEN KALENDERDAG. Een dag die om middernacht
      terugspringt is een cadeau: dan wacht een aanvaller tot 23:59, doet zijn
      helft, en om 00:01 de andere helft. Een rollend venster kent dat moment
      niet.

   EN NET ALS BIJ DE GEWOONTE TELT ALLEEN WAT IS UITGEVOERD. Een geweigerde
   poging laat hier geen spoor -- anders vult een aanvaller andermans budget
   door het te proberen, en dat is een blokkade die je op een collega kunt
   aanrichten.

   WAT ER BEWAARD WORDT, en het is meer dan de gewoonte hiernaast: dit heeft
   TIJDSTIPPEN nodig, en die zijn gevoeliger dan een reeks kale getallen. Daarom
   wordt er bij elke aanraking geknipt tot het venster: wat ouder is dan het
   venster bestaat hier niet meer. Er staat geen inhoud in, geen doel en geen
   naam -- een actor-id, een aantal en een moment, en niet langer dan nodig.
   Deze reeks mag nooit als gedrag of prestatie van een mens worden getoond.
   ========================================================================== */
'use strict';

const { nu: klokNu } = require('../../lib/klok');

const NIET_GEDEKT = [
  { wat: 'twee actoren die samenwerken', reden: 'Dit budget is per actor. Twee accounts die elk de helft doen, blijven allebei binnen hun venster. Wat dat wel zou zien is een budget per werkruimte, en dat bestaat hier niet.' },
  { wat: 'de reeks over soorten heen', reden: 'Rollen geven en mensen uit dienst zetten hebben elk hun eigen venster; iemand die beide doet, telt in geen van beide op. Optellen zou een gedeelde eenheid vragen (een "rol" is geen "persoon") en die is er niet.' },
  { wat: 'wat door een andere deur gaat', reden: 'Geteld wordt wat door de poort van deze laag komt. Een handeling die elders in dit huis hetzelfde gevolg heeft zonder langs deze poort te gaan, staat hier niet in.' },
  { wat: 'het net verlopen venster', reden: 'Een rollend venster geeft vanzelf weer ruimte: wie aan zijn budget zit en een uur wacht, kan weer verder. Dat is de aard van een venster en geen omissie -- wat het opvangt is een reeks in korte tijd, niet een langzame uitstroom.' }
];

const sleutel = (actor, soort) => String(actor || '') + '|' + String(soort || '');
const getal = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/* Knippen tot het venster. Gebeurt bij ELKE aanraking, lezen zowel als
   schrijven: een reeks die alleen bij het schrijven wordt opgeruimd, blijft
   staan zodra iemand stopt met werken -- en dan bewaart dit huis het tijdstip
   van iemands laatste handeling voor onbepaalde tijd. */
function knip(rij, vensterMs, nu) {
  rij.reeks = (rij.reeks || []).filter(x => x && getal(x.at) && x.at > nu - vensterMs);
  return rij;
}

const vensterMsVan = (regel) => Math.max(1, Number(regel && regel.vensterUren) || 24) * 3600000;

/* Wat is er in het venster al gedaan. `regel` is de tempo-afspraak van de soort
   ({ budget, vensterUren }) en komt uit de soortentabel; zonder regel is er
   geen budget en levert dit null -- geen nul, want "geen afspraak" is iets
   anders dan "nul gebruikt". */
function meet(bak, actor, soort, aantalNu, regel) {
  if (!regel || !getal(regel.budget)) return null;
  const nu = klokNu();
  const vensterMs = vensterMsVan(regel);
  const rij = knip((bak && bak.tempo && bak.tempo[sleutel(actor, soort)]) || { reeks: [] }, vensterMs, nu);
  const ervoor = rij.reeks.reduce((t, x) => t + (Number(x.n) || 0), 0);
  const metDeze = ervoor + (getal(aantalNu) ? aantalNu : 0);
  return {
    budget: regel.budget, vensterUren: vensterMs / 3600000,
    ervoor, metDeze, over: metDeze > regel.budget,
    handelingen: rij.reeks.length
  };
}

/* Alleen aanroepen NADAT de handeling is uitgevoerd. Zie de kop. */
function noteer(bak, actor, soort, aantal, regel) {
  if (!bak || !regel || !getal(regel.budget) || !getal(aantal)) return null;
  const nu = klokNu();
  bak.tempo = bak.tempo || {};
  const k = sleutel(actor, soort);
  const rij = knip(bak.tempo[k] || (bak.tempo[k] = { reeks: [] }), vensterMsVan(regel), nu);
  rij.reeks.push({ at: nu, n: aantal });
  /* Een lege reeks laat geen sleutel achter. Anders groeit deze tabel met een
     regel per actor die ooit iets deed, en dan is de bewaartermijn alsnog
     oneindig -- alleen met lege rijen. */
  if (!rij.reeks.length) delete bak.tempo[k];
  return rij.reeks.length;
}

/* Het vergeetrecht, en de opruiming die er los van staat. De eerste wist een
   mens op verzoek; de tweede knipt iedereen tot het venster, ook wie nooit iets
   vraagt. Zonder die tweede blijft een tijdstip van een vertrokken actor staan
   tot iemand toevallig zijn naam nog eens opzoekt. */
function vergeetActor(bak, actor) {
  if (!bak || !bak.tempo) return 0;
  const voor = String(actor || '') + '|';
  let weg = 0;
  for (const k of Object.keys(bak.tempo))
    if (k.startsWith(voor)) { delete bak.tempo[k]; weg += 1; }
  return weg;
}

function ruimOp(bak, vensterUren) {
  if (!bak || !bak.tempo) return 0;
  const nu = klokNu();
  const ms = Math.max(1, Number(vensterUren) || 24) * 3600000;
  let weg = 0;
  for (const k of Object.keys(bak.tempo)) {
    const rij = knip(bak.tempo[k], ms, nu);
    if (!rij.reeks.length) { delete bak.tempo[k]; weg += 1; }
  }
  return weg;
}

module.exports = { meet, noteer, vergeetActor, ruimOp, NIET_GEDEKT };
