/* RTF School: het schoolkanaal van de RTFoundation ("slimmer dan Magister").

   Een leraar maakt een klas en krijgt een klascode (voor de ouders) en een
   leraar-token (zijn sleutel). Een ouder koppelt zijn kind met de klascode.
   Daarna: rooster, huiswerk (met afvinken en een brug naar de AI-bijles),
   cijfers, mededelingen, ziekmelden in één tik, en berichten met de leraar.

   Twee principes die dit veiliger maken dan de bekende school-apps:
   1. GEEN privékanaal leraar-kind: schoolberichten lopen per gezin, dus een
      ouder kijkt standaard mee. Dat sluit aan op de kinderbescherming elders
      in de app (t/m 15 geen open sociale laag).
   2. Cijfers zijn per kind afgeschermd: een gezin ziet alleen de cijfers van
      de eigen kinderen; de leraar ziet alleen zijn eigen klas.

   Krijgt de gedeelde foundation-helpers mee (ctx) en registreert zijn routes op
   dezelfde router; alles onder /api/foundation/school/... */
const { eigenVeld } = require('./kern/util'); // veilige objecttoegang (geen prototype-pollution)

const { maakPoorten } = require('./school/poorten');

module.exports = (ctx) => {
  const { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto, anthropic } = ctx;

  function K() {
    const f = F();
    if (!f.klassen) f.klassen = {};
    return f.klassen;
  }
  /* scholen: de wortel van alles. EERST meldt een school zich aan (directie
     krijgt een beheer-token), DAN melden leraren en overig personeel zich bij
     die school (en wachten op goedkeuring van de directie), en pas daarna
     kunnen goedgekeurde leraren klassen maken waar gezinnen hun kinderen aan
     koppelen. */
  function S() {
    const f = F();
    if (!f.scholen) f.scholen = {};
    return f.scholen;
  }
  const klasCode = () => { let c; do { c = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (K()[c]); return c; };
  const schoolCode = () => { let c; do { c = 'S' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (S()[c]); return c; };

  // directie-authenticatie: schoolcode + beheer-token
  /* De poorten (wie mag wat openen) staan in ./school/poorten.js: dat is een
     eigen begrip en het hoort niet verspreid te raken over de deelmodules. */
  const { schoolVan, personeelVan, klasVan, gezinSessie, leerlingVan, leerlingSleutel } =
    maakPoorten({ K, S, gezinVan, profielVan });

  // een school is pas bruikbaar als RTG hem heeft goedgekeurd. Oude scholen
  // (van voor deze stap) hebben geen status en blijven gewoon actief.
  const isActief = (sch) => (sch.status || 'actief') === 'actief';

  /* ---------- stap 1: de SCHOOL meldt zich aan ----------
     De aanmelder (directie/administratie) krijgt de schoolcode (om aan het
     personeel te geven) en het beheer-token (de sleutel van de school). De
     school staat eerst op 'wacht': RTG keurt hem in de Backoffice goed voordat
     er personeel toegelaten of klassen gemaakt kunnen worden. */

  /* De drie lagen (beheer, klas, gezin) draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; de klaslaag
     levert gemiddelde() aan de gezinslaag via die context. */
  const sctx = { router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto, anthropic, onderwijs: ctx.onderwijs, rtfHandle: ctx.rtfHandle, leerstof: ctx.leerstof,
    eigenVeld, K, S, schoolVan, personeelVan, klasVan, gezinSessie, leerlingVan, klasCode, schoolCode, leerlingSleutel, isActief };
  Object.assign(sctx, require('./school/beheer')(sctx));
  Object.assign(sctx, require('./school/klas')(sctx));
  require('./school/directie')(sctx); // golf 3: de directie-cockpit op kantoren-niveau
  require('./school/taal')(sctx); // thuistaal + tweetalige laag (zet sctx.tweetalig)
  require('./school/gezin')(sctx);
  require('./school/planner')(sctx);
  require('./school/toets')(sctx); // toetsen (SO/MO/proefwerk/examen) op de leerstof-motor
  require('./school/toetsbieb')(sctx); // de leerdoelen-bibliotheek voor het maakscherm, per schoolsoort
  require('./school/verbonden')(sctx); // lerarenteam, overname, online les, oefen-huiswerk
  require('./school/excursie')(sctx); // excursies: tijdelijke GPS met toestemming + kijklog
  require('./school/bijdrage')(sctx); // vrijwillige ouderbijdrage + telefoonboom
  require('./school/bijles')(sctx); // de eigen Rahul Bijles van elk kind
  require('./school/bellen')(sctx); // bellen binnen de app (klas-belkanaal, geen nummers nodig)
  require('./school/hulplijn')(sctx); // golf 4: de ene knop van het kind (toestemming bepaalt wie meeleest)
  require('./school/bewijs')(sctx); // Proof of Learning: observaties van de leraar in het leerpaspoort
  require('./school/denkfout')(sctx); // Misconception Graph: het klasbeeld, geteld zonder wie
  require('./school/dag')(sctx); // Daily Learning Guarantee: wat staat er vandaag klaar

  /* ---------- de enterprise-lagen ----------
     Rollen eerst: die levert poort() en het journaal waar alle lagen hieronder
     op staan. Daarna School Core (de leerling bestaat EEN keer), en pas
     daarna de lagen die naar een leerling verwijzen. De volgorde is dus geen
     smaak: dossier en organisatie halen leerlingLijst() uit de context die
     inschrijving.js daar neerzet. */
  Object.assign(sctx, require('./school/rollen')(sctx)); // rollen, rechten, inzagejournaal
  Object.assign(sctx, require('./school/webhook')(sctx)); // de bezorger; zet sctx.meld voor de lagen hieronder
  require('./school/inschrijving')(sctx); // aanmelding, wachtlijst, plaatsing, uitschrijving, overstap
  Object.assign(sctx, require('./school/dossier')(sctx)); // dossier, contact, documenten, zorg
  require('./school/organisatie')(sctx); // vestigingen, opleidingen, schooljaarovergang
  require('./school/inschrijving-mutatie')(sctx); // uitschrijven en overstappen
  Object.assign(sctx, require('./school/aanwezigheid')(sctx)); // presentie per les, te laat, verzuimbeeld
  require('./school/verlof')(sctx); // verlofaanvraag van het gezin, besluit van de school
  Object.assign(sctx, require('./school/veiligheid')(sctx)); // toegangspassen en bezoekers
  require('./school/veiligheid-incident')(sctx); // incidenten, ontruimingslijst, calamiteit
  Object.assign(sctx, require('./school/machtiging')(sctx)); // het machtigingenregister (geen incasso-run)
  Object.assign(sctx, require('./school/financien')(sctx)); // facturen, betalingen, debiteuren
  require('./school/financien-beheer')(sctx); // kantine, budgetten, subsidies, rapportage
  Object.assign(sctx, require('./school/hr')(sctx)); // personeelsdossier, contract, bevoegdheden
  require('./school/hr-verlof')(sctx); // verlof, ziekte, vervanging, uren, gesprekken
  require('./school/omroep')(sctx); // nieuwsbrief, automatische herinneringen, vakgroep
  Object.assign(sctx, require('./school/rapport')(sctx)); // rapporten, vastgesteld door een mens
  require('./school/rapport-tekst')(sctx); // conceptteksten (AI = advies) en studievoortgang
  Object.assign(sctx, require('./school/peiling')(sctx)); // de anonieme peiling (zet sctx.peilingBeeld)
  require('./school/peiling-antwoord')(sctx); // meedoen: gezin en personeel
  Object.assign(sctx, require('./school/analyse')(sctx)); // dashboard en waarschuwingen
  require('./school/analyse-signalen')(sctx); // de signalen rond een leerling
  require('./school/koppelingen')(sctx); // integraties, webhooks, export
  Object.assign(sctx, require('./school/ouderportaal')(sctx)); // toestemming en afspraken
  require('./school/ouderportaal-mijn')(sctx); // het ene overzicht van het gezin

  /* Teacher Flow. Deze twee staan met opzet ONDERAAN: ze kijken over de andere
     lagen heen (presentie, toetsen, huiswerk, rapporten, denkpatronen) en
     hebben dus nodig wat die lagen aan sctx hebben toegevoegd. */
  require('./school/aandacht')(sctx); // Attention OS: een lijst per dag, in drie bakken
  require('./school/les')(sctx); // de les afronden in een handeling, en het lesgeheugen
  require('./school/instap')(sctx); // de vervanger en de nieuwe docent: minimale context, vijf stappen
};
