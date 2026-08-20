/* ============================================================================
   WAAROM KAN DEZE ROUTE NIET WORDEN BEWEZEN? -- de indeling.

   WAAROM DIT ER IS. De staatproef beproeft 3364 routes en bewijst er 252. De
   overige 3112 dragen allemaal hetzelfde woord: ONGEMETEN. Dat is eerlijk maar
   onbruikbaar, want het zegt niet wat eraan ontbreekt, en zonder dat is er geen
   werk van te maken -- alleen een getal om je zorgen over te maken.

   Nagemeten op 507 member-routes die 404 gaven: 166 verschillende boodschappen,
   en ze zeggen alle 166 hetzelfde. "Deze zaak kennen we niet." "Object niet
   gevonden." "Deze X staat niet op uw naam." Dat is geen fout in de proef en
   geen fout in de route: het is een ONTBREKENDE VOORWAARDE. De route wil iets
   bedienen wat er niet is.

   DE INDELING IS DE OPBRENGST. Zeven soorten, elk met wat er nodig is om
   erlangs te komen. Daarmee wordt 3112 keer "ongemeten" een lijst van zeven
   werkzaamheden met een aantal erachter -- en dat is wel te plannen.

   WAT DIT NIET IS: een oordeel over de route. Een 404 op een verzonnen
   identiteit is precies wat een goede route hoort te doen. De uitspraak gaat
   over ONS meetwerk.

   EN LET OP DE VOLGORDE. De boodschap wint van de status, want de status is
   grof: 404 is zowel "die zaak bestaat niet" als "die is niet van jou", en dat
   zijn twee verschillende karweien. Waar de boodschap niets zegt, valt hij terug
   op de status; waar ook dat niets zegt, heet het `onbekend` en niet iets
   preciezers (LAT.md regel 3).
   ========================================================================== */
'use strict';

/* De zeven soorten. `nodig` is geen toelichting maar de opdracht: wie dit
   aantal wil zien dalen, doet DAT. */
const SOORTEN = [
  { id: 'bereikt', wat: 'de handler heeft gedraaid',
    nodig: 'niets -- deze route is te bewijzen; als de schakel toch ongemeten is, ligt het aan de meter en niet aan de voorwaarde' },
  { id: 'niet-van-jou', wat: 'het object bestaat mogelijk wel, maar niet voor deze rol',
    nodig: 'een object dat op naam van de proefrol staat; dit is tegelijk de plek waar een IDOR-proef zijn bewijs haalt' },
  { id: 'object-ontbreekt', wat: 'de route wil een bestaand object bedienen en dat is er niet',
    nodig: 'eerst aanmaken, dan bedienen -- een keten van twee stappen zoals scripts/lib/ketens die kent' },
  { id: 'veld-ontbreekt', wat: 'de validatie weigert het lijf voordat er iets gebeurt',
    nodig: 'de velden die DEZE route vraagt; plausibelLijf() is een grabbelton en geen contract' },
  { id: 'rol-te-laag', wat: 'de rol mag hier niet komen',
    nodig: 'de juiste rol, of de erkenning dat deze route voor de beproefde rollen niet bereikbaar is' },
  { id: 'geen-sessie', wat: 'er is geen geldige sessie voor deze rol',
    nodig: 'een token voor de rol die deze route bewaakt; vier eigenrollen hebben er nog geen' },
  { id: 'conflict', wat: 'de toestand staat de handeling nu niet toe',
    nodig: 'een beginstand waarin de handeling wel mag; vaak is dat de vorige stap van dezelfde keten' },
  { id: 'dienst-uit', wat: 'een onderdeel staat uit of is er niet',
    nodig: 'de dienst aanzetten in de proefopstelling, of vastleggen dat hij daar bewust ontbreekt' },
  { id: 'onbekend', wat: 'de route zegt niets waar wij iets van kunnen maken',
    nodig: 'met de hand nakijken -- dit is de bak die leeg hoort te blijven' }
];

const NAMEN = new Set(SOORTEN.map(s => s.id));

/* De boodschappen, gemeten en niet verzonnen: dit zijn de vormen die in dit
   huis werkelijk voorkomen (507 member-routes, 166 varianten). Wie een nieuwe
   formulering toevoegt aan een route, hoort hier langs te komen -- en zolang hij
   dat niet doet, valt het netjes terug op de status. */
const ZINNEN = [
  [/staat niet (op uw naam|op jouw naam)|niet van (u|jou)\b|geen toegang tot (dit|deze)|niet uw |niet jouw /i, 'niet-van-jou'],
  [/staat niet in (uw|jouw|je) /i, 'niet-van-jou'],
  [/(kennen we niet|bestaat niet|is er niet|niet gevonden|onbekend|niet bekend|niet meer)/i, 'object-ontbreekt'],
  [/(verplicht|ontbreekt|ongeldig|onjuist|te kort|te lang|geen geldige|vul |mag niet leeg)/i, 'veld-ontbreekt'],
  [/(geen (rechten|bevoegdheid|toegang)|niet bevoegd|alleen voor|mag dit niet)/i, 'rol-te-laag'],
  [/(niet ingelogd|sessie verlopen|log opnieuw|geen sessie)/i, 'geen-sessie'],
  /* "NOG NIET LIVE" IS EEN DIENST DIE UIT STAAT, GEEN TOESTANDSCONFLICT. De
     RTG Bank antwoordt op 32 routes met "De RTG Bank is nog niet live voor
     leden", en die kwamen in de eerste ronde in de bak `conflict` terecht: dan
     zou iemand gaan zoeken naar een beginstand waarin de handeling wel mag,
     terwijl er niets te bereiken valt zolang de dienst niet aan staat. Op de
     STATUS (403) zou hij nog verder mis zijn gegaan -- `rol-te-laag`, waarop je
     een andere rol gaat proberen die er ook niet in mag. Twee bakken diep fout
     op een boodschap die volkomen duidelijk is. */
  [/(staat uit|uitgeschakeld|niet beschikbaar|tijdelijk niet|onderhoud|nog niet live|nog niet open|komt binnenkort)/i, 'dienst-uit'],
  [/(bestaat al|al gedaan|al verwerkt|niet meer mogelijk|te laat|niet in deze stand)/i, 'conflict']
];

/* De status als terugval. Grover dan de boodschap en daarom pas daarna. */
const STATUSSEN = new Map([
  [400, 'veld-ontbreekt'], [422, 'veld-ontbreekt'],
  [401, 'geen-sessie'], [403, 'rol-te-laag'],
  [404, 'object-ontbreekt'], [409, 'conflict'],
  [503, 'dienst-uit'], [502, 'dienst-uit']
]);

/* De indeling zelf. Krijgt status en boodschap, geeft een soort en waarom die.
   Pure functie, en dat is met opzet: dit is het stuk dat een toets moet kunnen
   vastpakken zonder een server te starten. Precies wat er bij de OUTPUT-as
   misging -- daar zat het oordeel opgesloten in de meetlus en kon niemand het
   met een mutatie natrekken. */
function deel(status, boodschap) {
  const s = Number(status) || 0;
  if (s >= 200 && s < 300) return { soort: 'bereikt', door: 'status', omdat: 'status ' + s };
  const tekst = String(boodschap || '');
  for (const [re, soort] of ZINNEN) {
    if (re.test(tekst)) return { soort, door: 'boodschap', omdat: 'de route zegt: ' + kort(tekst) };
  }
  /* DE TERUGVAL, EN HIJ TELT ZICHZELF. `door` zegt of de BOODSCHAP de indeling
     bepaalde of alleen de STATUS. Dat verschil is het halve instrument waard:
     de status is grof (404 is zowel "bestaat niet" als "niet van jou", 403 was
     hierboven zelfs een dienst die uit staat), dus hoe vaker hij het laatste
     woord heeft, hoe grover deze indeling is. Zonder dit getal zou "1136 willen
     een bestaand object" even stellig klinken of het nu uit hun mond kwam of uit
     een statuscode. */
  const uitStatus = STATUSSEN.get(s);
  if (uitStatus) {
    return { soort: uitStatus, door: 'status', omdat: tekst
      ? 'status ' + s + ', en de boodschap ("' + kort(tekst) + '") valt in geen bekende vorm'
      : 'status ' + s + ' zonder boodschap' };
  }
  return { soort: 'onbekend', door: 'niets', omdat: 'status ' + s + (tekst ? ', boodschap: ' + kort(tekst) : ', geen boodschap') };
}

const kort = (t) => String(t).replace(/\s+/g, ' ').trim().slice(0, 90);

/* De boodschap uit een antwoord halen. Drie velden, want dit huis gebruikt ze
   alle drie; wat er niet in staat is geen boodschap en wordt niet verzonnen. */
function boodschapVan(data, tekst) {
  if (data && typeof data === 'object') {
    for (const veld of ['error', 'melding', 'fout', 'message', 'reden']) {
      if (typeof data[veld] === 'string' && data[veld]) return data[veld];
    }
  }
  return typeof tekst === 'string' ? tekst.slice(0, 200) : '';
}

/* Van losse indelingen naar een telling per soort, in de volgorde van SOORTEN
   zodat de uitslag altijd dezelfde vorm heeft -- ook de soorten met nul erin.
   Een telling die alleen toont wat voorkomt, verbergt wat is opgelost. */
function telling(indelingen) {
  const per = new Map(SOORTEN.map(s => [s.id, { ...s, aantal: 0, voorbeelden: [] }]));
  for (const i of indelingen) {
    const bak = per.get(i.soort);
    if (!bak) continue;
    bak.aantal++;
    if (bak.voorbeelden.length < 5) bak.voorbeelden.push(i.route + ' -- ' + i.omdat);
  }
  return [...per.values()];
}

const CONTROL = {
  control: 'waarom-ongemeten',
  eigenaar: 'Techniek',
  wat: 'deelt elke route die niet te bewijzen valt in naar de ONTBREKENDE VOORWAARDE, in de woorden van de route zelf',
  grens: 'Zegt niets over de kwaliteit van de route. Een 404 op een verzonnen identiteit is juist gedrag; ' +
    'dit gaat over wat ONS meetwerk mist. En de indeling leest boodschappen: verandert een route zijn ' +
    'formulering, dan valt hij terug op zijn statuscode en wordt hij grover ingedeeld, niet fout.',
  bewijsstuk: 'WAAROM.json -- per route de soort en de reden',
  dekking: { register: 'WAAROM.json', beproefd: 'gemeten.routes' }
};

module.exports = { SOORTEN, NAMEN, ZINNEN, deel, boodschapVan, telling, CONTROL };
