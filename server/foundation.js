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
  encS, decS, teVaak, misluktePoging, goedePoging, ipVan, anthropic,
  router, F, nu, rid, schoon, LETTERS, DEMO, TIPS } = ctx;
// de onderwijslaag registreert zijn routes op dezelfde router
require('./foundation/onderwijs')(ctx);

/* De gezins-helpers (gezinnen, profielen, PIN, codenamen, sessiehulpen)
   staan als deelmodule in foundation/gezinshulp.js; hier komen ze terug in
   scope voor de wiring hieronder. */
const { G, nieuweGezinscode, ROLLEN, GROEPEN, GROEP_INFO, magSolliciteren, groepLeeftijd, isBeschermd, schoonGroep, isGast, KLEUREN, hashPin, checkPin, geldigePin, schoonAvatar, schoonKleur, nieuweCodenaam, ensureCodenaam, rtfHandle, socialProfielen, profielInfoVanHandle, pubProfiel, pubGezin, gezinVan, profielVan, beheerderVan, berichtVoorMij } = require('./foundation/gezinshulp')(ctx);

/* De gezinsroutes (gezin maken/inloggen, profielen, berichten) draaien als
   submodule op een gedeelde context, een keer opgebouwd bij het opstarten. */
const gctx = { router, F, G, save, nu, rid, schoon, crypto, eigenVeld, encS, decS, teVaak, misluktePoging, goedePoging, ipVan,
  nieuweGezinscode, ROLLEN, GROEPEN, GROEP_INFO, schoonGroep, isBeschermd, isGast, KLEUREN,
  hashPin, checkPin, geldigePin, schoonAvatar, schoonKleur, nieuweCodenaam, ensureCodenaam, rtfHandle,
  socialProfielen, profielInfoVanHandle, pubProfiel, pubGezin, gezinVan, profielVan, beheerderVan, berichtVoorMij };
require('./foundation/gezin')(gctx);

/* ---------- de gezinssessie: wie ben je, en mag je bij de privezaken ---------- */
function sessieVan(req, res) {
  const g = gezinVan(req, res); if (!g) return null;
  const p = profielVan(g, (req.body && req.body.token) || req.query.token);
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
/* ---------- sollicitaties + marktplaats: eigen modules op de context ----------
   De gezins-helpers gaan op de context; de submodules registreren hun routes
   op dezelfde router en geven hun publieke functies terug. */
const { verifieerProfiel, bewaarSollicitatie, alGesolliciteerd } = require('./foundation/sollicitaties')(ctx);
const { setMarkt } = require('./foundation/markt')(ctx);

router.get('/health', (req, res) => res.json({ ok: true, lessen: Object.keys(F().lessen).length, gezinnen: Object.keys(G()).length, aanvragen: (F().reisAanvragen || []).length, ai: anthropic ? 'claude' : 'demo' }));

// RTF School (het schoolkanaal, "slimmer dan Magister"): aparte module op
// dezelfde router en dezelfde gezins-authenticatie. Zie server/school.js.
require('./school')({ router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto });

module.exports = { router, gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht, kanaalInfo, setPushHook, setMarkt, berichtVanGast, verifieerProfiel, bewaarSollicitatie, alGesolliciteerd, socialProfielen, profielInfoVanHandle, leeftijdInstr };
