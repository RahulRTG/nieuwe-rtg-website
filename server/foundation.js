/* RTFoundation: gratis, open onderwijs en leven-tools voor elk gezin. Draait
   als aparte Express-router mee op de RTG-server, met dezelfde database en
   failover. Dit bestand bevat de gezinslaag (profielen, samen vooruit, buddy,
   zorg, gasten, berichten, sollicitaties, marktplaats); de gedeelde
   primitieven staan in foundation/basis.js en de onderwijslaag (lessen, bord,
   schrift, opgaven, AI-bijles) in foundation/onderwijs.js.

   Alles staat onder db.data.foundation, zodat het meelift op het atomische
   wegschrijven en de dagelijkse back-up van de hoofdserver. */
const ctx = require('./foundation/basis')();
const { db, save, eigenVeld, crypto,
  encS, decS, teVaak, misluktePoging, goedePoging, ipVan, anthropic, tokenUit,
  router, F, nu, rid, schoon, LETTERS, DEMO, TIPS } = ctx;
/* Foundation start vóór de hoofd-postlaag. Dit levende brugobject wordt na de
   bouw van RTMAIL gevuld; de schoolroutes houden dezelfde verwijzing. */
const schoolMailBrug = { dienst:null };
// de onderwijslaag registreert zijn routes op dezelfde router
require('./foundation/onderwijs')(ctx);

/* De gezins-helpers (gezinnen, profielen, PIN, codenamen, sessiehulpen)
   staan als deelmodule in foundation/gezinshulp.js; hier komen ze terug in
   scope voor de wiring hieronder. */
const { G, nieuweGezinscode, ROLLEN, GROEPEN, GROEP_INFO, geboorteInfo, groepVanLeeftijd, actualiseerGroep,
  magSolliciteren, groepLeeftijd, isBeschermd, schoonGroep, isGast, KLEUREN, hashPin, checkPin, geldigePin,
  schoonAvatar, schoonKleur, nieuweCodenaam, ensureCodenaam, rtfHandle, socialProfielen, profielInfoVanHandle,
  pubProfiel, pubGezin, gezinVan, profielVan, beheerderVan, berichtVoorMij } = require('./foundation/gezinshulp')(ctx);

/* De gezinsroutes (gezin maken/inloggen, profielen, berichten) draaien als
   submodule op een gedeelde context, een keer opgebouwd bij het opstarten. */
const gctx = { router, F, G, save, nu, rid, schoon, crypto, eigenVeld, encS, decS, teVaak, misluktePoging, goedePoging, ipVan, tokenUit,
  nieuweGezinscode, ROLLEN, GROEPEN, GROEP_INFO, geboorteInfo, groepVanLeeftijd, actualiseerGroep,
  schoonGroep, isBeschermd, isGast, KLEUREN,
  hashPin, checkPin, geldigePin, schoonAvatar, schoonKleur, nieuweCodenaam, ensureCodenaam, rtfHandle,
  socialProfielen, profielInfoVanHandle, pubProfiel, pubGezin, gezinVan, profielVan, beheerderVan, berichtVoorMij };
require('./foundation/gezin')(gctx);
require('./foundation/gezinstoegang')(gctx);

/* Wat dit gezin kost, en wie het betaalt (foundation/kosten.js). Een eigen
   bestandje, want het antwoord draagt een belofte en geen bedrag: de
   RTFoundation betaalt, en er komt nooit een rekening. */
const { setKostenHook } = require('./foundation/kosten')({ router, gezinVan, beheerderVan });

/* ---------- de gezinssessie: wie ben je, en mag je bij de privezaken ---------- */
function sessieVan(req, res) {
  const g = gezinVan(req, res); if (!g) return null;
  const p = profielVan(g, tokenUit(req));
  if (!p) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
  return { g, p };
}
// voor privezaken van het gezin: een gast (oppas/opa/oma/familie) wordt geweigerd.
function familieVan(req, res) {
  const s = sessieVan(req, res); if (!s) return null;
  if (isGast(s.p)) { res.status(403).json({ error: 'Dit hoort bij de privezaken van het gezin. Als oppas of familie heb je hier geen toegang toe.' }); return null; }
  return s;
}

/* ---------- vooruit + buddy + zorg: eigen modules op de context ----------
   De gezins-helpers gaan een keer op de context; de submodules registreren hun
   routes op dezelfde router. De buddy-module zet kiesBuddy/leeftijdInstr op de
   context (voor de les-AI), de zorg-module locatiePubliek/oppasinfoPubliek
   (voor het gastoverzicht). */
Object.assign(ctx, { G, gezinVan, profielVan, familieVan, sessieVan,
  isGast, isBeschermd, ensureCodenaam, rtfHandle, checkPin });
require('./foundation/vooruit')(ctx);
const { leeftijdInstr } = require('./foundation/buddy')(ctx);
require('./foundation/zorg')(ctx);
/* ---------- gasten + berichten: eigen modules op de context ----------
   Een oppas, opa/oma of familielid (gastprofiel) met een RTG-pas koppelt dit
   gezin in zijn eigen RTG-app (foundation/gasten.js); het chatten en
   (beeld)bellen tussen gezinsleden woont in foundation/berichten.js. De
   gedeelde gezins-helpers gaan hier op de context. */
const { gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht,
  kanaalInfo, setPushHook, bezorgAanGasten, berichtVanGast } = require('./foundation/gasten')(ctx);
require('./foundation/berichten')(ctx);
gctx.bezorgAanGasten = bezorgAanGasten; // late binding voor de gezinsberichten
gctx.welkomRtf = () => {}; // late binding: het welkom-draaiboek (RTMAIL) komt via setAutomatisering
/* Volwassen gezinsleden en gasten komen niet binnen op alleen de gedeelde
   gezinscode. De beheerder maakt een persoonlijke, eenmalige uitnodiging en
   de ontvanger accepteert die zelf. */
const { accepteerGast } = require('./foundation/gezinsuitnodiging')(gctx);
/* De server bindt hier het welkom-draaiboek in: elk nieuw RTF-profiel krijgt
   een welkom in zijn eigen RTMAIL-postvak (op codenaam). Los te laten (blijft
   de lege functie hierboven) als de automatisering niet meedraait. */
function setAutomatisering(a) {
  gctx.welkomRtf = (codenaam) => { try { if (a && codenaam) a.welkomLid({ codename: codenaam, wereld: 'RTF' }); } catch (e) {} };
}
/* ---------- sollicitaties + marktplaats: eigen modules op de context ----------
   De gezins-helpers gaan op de context; de submodules registreren hun routes
   op dezelfde router en geven hun publieke functies terug. */
const { verifieerProfiel, bewaarSollicitatie, alGesolliciteerd } = require('./foundation/sollicitaties')(ctx);
const { setMarkt } = require('./foundation/markt')(ctx);

/* ALLEEN HET LEVEN-TEKEN, en niets meer dan dat. De hele geschiedenis van deze
   route staat op een plek in scripts/lib/publiekeroutes.js. */
router.get('/health', (req, res) => res.json({ ok: true }));

/* De onderwijskern (het leerpaspoort) komt LAAT binnen: hij wordt in
   server.js gemaakt, na deze module. School heeft hem nodig om bewijs van
   beheersing in het paspoort van een leerling te schrijven -- een toets die
   een leraar becijfert, is bewijs dat die leerling iets kan.

   Daarom een getter en geen waarde: bij het opstarten is hij er nog niet, en
   een school die dan al draait, hoort niet om te vallen maar het bewijs
   gewoon over te slaan. */
let onderwijsKern = null;
let leerstofKern = null;
function setOnderwijs(o, l) { onderwijsKern = o; if (l) leerstofKern = l; }

// RTF School (het schoolkanaal, "slimmer dan Magister"): aparte module op
// dezelfde router en dezelfde gezins-authenticatie. Zie server/school.js.
/* DE PARAMETERS VAN BEIDE KANTEN. De laatste drie van de verzameling
   (onderwijs, leerstof, rtfHandle) stonden er niet, en daardoor gaf
   /school/bewijs/leerling altijd 503 en landde een becijferde toets nooit in het
   leerpaspoort -- als GETTER, om de reden die bij setOnderwijs hierboven staat.
   De tak voegt encS/decS, goedePoging en de schoolmailbrug toe. Een van de twee
   kanten kiezen betekent hier: of het leerpaspoort weer stuk, of de schoolmail
   niet aangesloten. */
const schoolMail = require('./school')({ router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto, anthropic,
  encS, decS, teVaak, misluktePoging, goedePoging, ipVan, schoolMailBrug,
  onderwijs: () => onderwijsKern, leerstof: () => leerstofKern, rtfHandle });
const foundationMail = require('./foundation/leden-mail')({ router, G, save, sessieVan, isGast, schoolMailBrug });
function setSchoolMail(dienst) { schoolMailBrug.dienst=dienst || null; }

/* De leeftijdsgroepen en wat eruit volgt, wonen in ./foundation/leeftijdsgroepen.js
   -- zie de kop daar. Hier doorgegeven zodat niets buiten dit bestand iets
   van de opsplitsing merkt. */
const { groepen, leerlingPassen } = require('./foundation/leeftijdsgroepen')({ GROEPEN, GROEP_INFO, F, actualiseerGroep });

// magSolliciteren/groepLeeftijd horen ook naar buiten: de sollicitatieroute moet
// de leeftijdsgrens uit het PROFIEL kunnen halen in plaats van uit het verzoek.
// setKostenHook: de kostenpoort van de RTFoundation (foundation/kostenpoort.js).
module.exports = { setOnderwijs, router, setKostenHook, gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht, kanaalInfo, setPushHook, setMarkt, setAutomatisering, berichtVanGast, verifieerProfiel, bewaarSollicitatie, alGesolliciteerd, socialProfielen, profielInfoVanHandle, leeftijdInstr, magSolliciteren, groepLeeftijd, groepen, leerlingPassen, setSchoolMail, schoolMailAdresActief:schoolMail && schoolMail.schoolMailAdresActief, foundationMailAdresActief:foundationMail && foundationMail.foundationMailAdresActief, accepteerGast };
