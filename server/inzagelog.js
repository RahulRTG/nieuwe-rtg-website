/* HET INZAGEJOURNAAL -- wie heeft wiens identiteit opgevraagd, wanneer, waarom.

   Het hele privacy-ontwerp draait op codenamen: de operationele data kent geen
   namen, de echte naam ligt versleuteld in de kluis. Maar een kluis die je
   ongemerkt kunt openen is geen kluis. Zonder spoor kan niemand achteraf een
   vraag beantwoorden die er echt toe doet: "wie heeft mijn naam opgezocht, en
   waarvoor?" Dat is precies de vraag die de AVG een betrokkene toestaat te
   stellen, en het is ook de eerste vraag na een incident.

   Twee regels die de rest van dit bestand verklaren:

   1. HET JOURNAAL BEWAART DE NAAM NIET. Er staat WIE keek, NAAR WELK
      ACCOUNT-ID, WAAROM en WANNEER. Zou de opgevraagde naam hier ook in staan,
      dan hadden we een tweede, onversleutelde kopie van de kluis gebouwd --
      een auditlog dat zelf een datalek is. Het id is genoeg: wie het spoor
      leest en de naam erbij wil, moet daarvoor zelf weer inzage nemen, en dat
      komt dan opnieuw in het journaal.

   2. EEN LEGE "WAAROM" IS EEN FOUT, GEEN DETAIL. Elke aanroeper geeft de
      aanleiding mee ("KYC-controle", "overdracht eigenaarschap"). Een spoor
      zonder reden vertelt je alleen dat er iemand in de kluis is geweest.

   Zelf-inzage (een lid dat zijn eigen naam ziet) hoort er NIET in: dat is geen
   inzage in andermans gegevens, en die miljoenen regels zouden het journaal
   onleesbaar maken. Zie mag() hieronder.

   Bewust zonder eigen opslaglaag: het journaal leeft in db.data.inzageLog en
   gaat dus mee in dezelfde duurzame opslag (JSON/SQLite/Postgres) als de rest.
   Begrensd op MAX regels; loopt hij vol, dan valt de oudste eraf. Wie langer
   moet bewaren, exporteert periodiek (zie lijst()). */
const MAX = 5000;

const { schakel, verifieer, top } = require('./lib/keten');
const { nu, datum } = require('./lib/klok');

/* De db-laag komt via zet() binnen, zodat dit bestand niets circulair
   importeert en tests hem met een nepdatabase kunnen vullen. */
let DB = null, SAVE = null;
function zet(db, save) { DB = db; SAVE = save; }

function rij() {
  if (!DB || !DB.data) return [];
  if (!Array.isArray(DB.data.inzageLog)) DB.data.inzageLog = [];
  return DB.data.inzageLog;
}

const kort = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

/* Kijkt iemand naar zijn eigen dossier? Dan is het geen inzage maar gewoon
   "je eigen gegevens zien", en dat loggen we niet. Beide kanten moeten een
   herkenbaar account-id hebben, anders is het per definitie geen zelf-inzage. */
function zelf(door, over) {
  const a = door && door.id, b = over && over.id;
  return a != null && b != null && String(a) === String(b);
}

/* Noteer één inzage.
     door   {id, naam} of een tekst -- wie keek. Een id is beter dan een naam:
            namen veranderen, en de naam van de kijker is zelf ook persoonsdata.
     over   {id, codenaam} -- naar wie werd gekeken.
     waarom korte, echte aanleiding. Verplicht.
     bron   waar vandaan (route, kamer, scherm).
   Geeft de weggeschreven regel terug, of null als er niets te noteren viel. */
function noteer({ door, over, waarom, bron, extra } = {}) {
  if (zelf(door, over)) return null;
  const kaal = {
    at: datum().toISOString(),
    doorId: door && door.id != null ? String(door.id).slice(0, 40) : null,
    door: kort((door && door.naam) || (typeof door === 'string' ? door : '') || 'onbekend', 40),
    overId: over && over.id != null ? String(over.id).slice(0, 40) : null,
    // de codenaam mag wel: die is nu juist het pseudoniem, geen identiteit
    over: kort((over && over.codenaam) || (typeof over === 'string' ? over : ''), 60),
    waarom: kort(waarom, 120) || 'GEEN REDEN OPGEGEVEN',
    bron: kort(bron, 60),
    ...(extra || {})
  };
  /* DE KETEN SLUIT ALS LAATSTE, en `extra` bestaat precies daarom.

     Hier stond eerst dat noteerVeel() de teruggegeven regel NA afloop nog
     bijstelde (overId op null, aantal en overIds erbij). Met een hash eronder is
     dat geen slordigheid meer maar een stille breuk: de hash dekt dan een regel
     die nooit heeft bestaan, en verifieer() wijst een vervalsing aan op de enige
     plek waar niemand heeft gesjoemeld. Wie iets aan de regel wil toevoegen,
     doet dat dus VOOR het hashen -- via extra. */
  const l = rij();
  const r = schakel(kaal, top(l));
  l.unshift(r);
  if (l.length > MAX) l.length = MAX;
  if (SAVE) { try { SAVE(); } catch (e) {} }
  return r;
}

/* Meerdere accounts in één handeling (een lijstscherm dat namen toont) horen
   als ÉÉN regel in het journaal, niet als vijftig. Anders verdrinkt het echte
   signaal -- de gerichte opzoeking van één persoon -- in de ruis van elke
   pagina die iemand opent. Het aantal en de id's blijven wel staan. */
function noteerVeel({ door, overIds, waarom, bron } = {}) {
  const ids = (Array.isArray(overIds) ? overIds : []).map(String);
  if (!ids.length) return null;
  /* De drie extra velden gaan MEE naar noteer() in plaats van er achteraf op te
     worden gezet: sinds de keten eronder ligt, dekt de hash de regel zoals hij
     wordt weggeschreven. Zie de uitleg bij noteer(). */
  return noteer({ door, over: { id: ids[0] }, waarom, bron, extra: {
    overId: null,                       // het is geen enkele persoon
    aantal: ids.length,
    overIds: ids.slice(0, 200)          // begrensd: een dump van 65M id's helpt niemand
  } });
}

/* Lezen. Alleen voor de eigenaar/toezicht (de aanroepende route bewaakt dat),
   en voor een betrokkene die vraagt wie in zijn dossier heeft gekeken. */
function lijst({ overId, doorId, max } = {}) {
  let l = rij();
  if (overId != null) {
    const s = String(overId);
    l = l.filter(r => String(r.overId) === s || (Array.isArray(r.overIds) && r.overIds.indexOf(s) >= 0));
  }
  if (doorId != null) l = l.filter(r => String(r.doorId) === String(doorId));
  return l.slice(0, Math.min(Number(max) || 200, 1000));
}

/* Wat een betrokkene zelf mag zien over inzage in ZIJN dossier (AVG art. 15).
   Zonder de kijker bij naam te noemen: dat is de persoonsdata van een ander,
   en die staat niet automatisch open voor de een omdat de ander vraagt. Wel
   de functie, de reden en het moment -- dat is waar de vraag over gaat. */
function voorBetrokkene(overId) {
  return lijst({ overId, max: 200 }).map(r => ({ at: r.at, waarom: r.waarom, bron: r.bron }));
}

/* IS HET SPOOR ONGEMOEID? De keten nalopen, zodat een beheerder die een regel
   heeft weggehaald of bijgesteld op een aanwijsbaar punt opvalt. Zie
   server/lib/keten.js voor wat dit wel en niet tegenhoudt -- kort: stille
   wijziging wel, een vastberaden beheerder pas als de top naar buiten gaat. */
function controleer() { return verifieer(rij()); }

/* De top van de keten: het ene getal dat periodiek naar een gescheiden systeem
   moet om het verleden echt vast te zetten. */
function ketenTop() { return top(rij()); }

function samenvatting() {
  const l = rij();
  const grens = nu() - 7 * 24 * 3600 * 1000;
  const week = l.filter(r => Date.parse(r.at) >= grens);
  return {
    totaal: l.length,
    week: week.length,
    zonderReden: l.filter(r => r.waarom === 'GEEN REDEN OPGEGEVEN').length,
    keten: controleer(),
    recent: l.slice(0, 10)
  };
}

module.exports = { zet, noteer, noteerVeel, lijst, voorBetrokkene, samenvatting, controleer, ketenTop, MAX };
