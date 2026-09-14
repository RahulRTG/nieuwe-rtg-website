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

   HOE LANG HET JOURNAAL BEWAART staat in ./inzagelog-bewaring.js, met de reden
   erbij. Kort: op TIJD en niet op aantal, want een bovengrens op aantal maakt
   een andere belofte waar dan die aan het lid. */

const { hangAan, verifieer, top } = require('./lib/keten');
const { verankerPunt, verifieerTegenAnker } = require('./lib/keten-anker');
const { nu, datum } = require('./lib/klok');
/* DE BEWARING, LOS. Een derde naad in het ONDERWERP naast ./inzagelog-lezen.js:
   hier wordt geschreven, daar gelezen, en in ./inzagelog-bewaring.js staat hoe
   lang het blijft staan. `snoei` krijgt de db-laag via een functie mee en niet
   als waarde, want zet() komt pas bij het opstarten langs. */
const { BEWAARDAGEN, MAX, maakSnoei } = require('./inzagelog-bewaring');
const snoei = maakSnoei(() => DB);

/* De db-laag komt via zet() binnen, zodat dit bestand niets circulair
   importeert en tests hem met een nepdatabase kunnen vullen.

   `VASTLEGGEN` is de derde en hij is optioneel: de duurzame vastlegger uit
   server/lib/duurzaam.js. Zonder hem blijft alles werken zoals het werkte --
   noteer() is dan write-behind, precies als hiervoor -- maar kan noteerVast()
   niets BEWIJZEN, en dat zegt hij dan ook met zoveel woorden in plaats van
   stilletjes op de gewone save() terug te vallen. */
let DB = null, SAVE = null, VASTLEGGEN = null, BEVESTIGBAAR = null;
function zet(db, save, vastleggen, bevestigbaar) {
  DB = db; SAVE = save; VASTLEGGEN = vastleggen || null; BEVESTIGBAAR = bevestigbaar || null;
}

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
function noteer(opdracht = {}) {
  if (zelf(opdracht.door, opdracht.over)) return null;
  const r = schrijfRegel(opdracht);
  if (SAVE) { try { SAVE(); } catch (e) {} }
  return r;
}

/* DE REGEL ZELF -- EEN BOUWER, TWEE BELOFTES.

   noteer() en noteerVast() verschillen in wat ze GARANDEREN en niet in wat ze
   SCHRIJVEN. Zou elk zijn eigen regel bouwen, dan lopen de twee vormen binnen
   een half jaar uiteen (LAT.md regel 4) -- en dan dekt de hashketen twee
   verschillende soorten regels, terwijl juist die keten zegt dat de rij
   ongemoeid is. Dus een bouwer, en het verschil zit in wie hem vastlegt. */
function schrijfRegel({ door, over, waarom, bron, extra } = {}) {
  const kaal = {
    at: datum().toISOString(),
    doorId: door && door.id != null ? String(door.id).slice(0, 40) : null,
    door: kort((door && door.naam) || (typeof door === 'string' ? door : '') || 'onbekend', 40),
    overId: over && over.id != null ? String(over.id).slice(0, 40) : null,
    // de codenaam mag wel: die is nu juist het pseudoniem, geen identiteit
    over: kort((over && over.codenaam) || (typeof over === 'string' ? over : ''), 60),
    waarom: kort(waarom, 120) || 'GEEN REDEN OPGEGEVEN',
    bron: kort(bron, 60),
    /* TWEE DINGEN DIE ER ALLEBEI IN MOETEN, EN DIE NIET HETZELFDE ZIJN.

       `stand` gaat over de INZAGE: er is toegang VERLEEND. Met opzet niet
       'ingezien' of 'geleverd' -- het journaal wordt geschreven voordat het
       dossier wordt samengesteld, en loopt dat daarna stuk, dan zou 'ingezien'
       een leugen zijn in het voordeel van het huis. Andersom is het veilig: een
       lid dat leest dat iemand toegang kreeg terwijl er niets op diens scherm
       verscheen, weet iets kloppends.

       `vast` gaat over deze REGEL: heeft de opslag hem bevestigd? noteer()
       schrijft write-behind en kan dat dus niet zeggen; noteerVast() zet hem op
       true zodra de duurzame commit terug is. Ze scheiden omdat een spoor dat
       niet kan zeggen hoe hard het zelf staat, geen bewijs is -- en omdat een
       lezer anders de hardheid van het ene voor het andere aanziet. */
    stand: 'toegestaan',
    vast: false,
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
  const r = hangAan(l, kaal);
  l.unshift(r);
  snoei(l);
  return r;
}

/* De MEERVOUDIGE kant staat in ./inzagelog-veel.js: een lijstscherm dat vijftig
   namen toont is een ander onderwerp dan de gerichte opzoeking van een mens, en
   het schrijft een andere regel. `noteer` gaat als functie mee, zodat beide
   vormen door dezelfde schrijver gaan. */
const { noteerVeel, veelOpdracht } = require('./inzagelog-veel')({ noteer });

/* De DUURZAME kant staat in ./inzagelog-vast.js: noteerVast() en
   noteerVeelVast() doen een andere belofte over dezelfde regel -- ze komen pas
   terug als de opslag heeft bevestigd, en ze kunnen zeggen dat hij dat niet
   kon. De regelbouwers gaan mee zodat er maar EEN vorm van een journaalregel
   bestaat; wat verschilt is wie hem vastlegt. */
const { noteerVast, noteerVeelVast } = require('./inzagelog-vast')({
  rij, zelf, schrijfRegel, veelOpdracht,
  heeftOpslag: () => !!(DB && DB.data),
  vastlegger: () => VASTLEGGEN,
  bevestigbaar: () => (typeof BEVESTIGBAAR === 'function' ? BEVESTIGBAAR() : true) });

/* De LEESKANT staat in ./inzagelog-lezen.js: lezen, verantwoorden en de keten
   nalopen zijn een ander onderwerp dan schrijven, met andere lezers. De rij
   gaat als FUNCTIE mee, zodat er maar een plek is die weet waar het journaal
   woont. */
const lezen = require('./inzagelog-lezen')({
  rij,
  /* De termijn en de noodremteller gaan MEE naar de leeskant in plaats van dat
     die ze zelf ophaalt: zo is er een plek die weet hoe lang dit huis bewaart,
     en kan een scherm niet iets anders beweren dan de opslag doet. */
  bewaardagen: BEWAARDAGEN,
  afgekapt: () => { try { return Number(DB && DB.data && DB.data.inzageLogAfgekapt) || 0; } catch (e) { return 0; } }
});
const { lijst, voorBetrokkene, samenvatting, controleer, ketenTop, anker, tegenAnker } = lezen;

module.exports = { zet, noteer, noteerVast, noteerVeel, noteerVeelVast, lijst, voorBetrokkene, samenvatting, controleer, ketenTop, anker, tegenAnker, MAX, BEWAARDAGEN };
