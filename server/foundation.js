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

/* Een health-check hoort te zeggen DAT het werkt, niet hoeveel gezinnen er in
   de hulpverlening zitten. Dat laatste stond hier onbeschermd: aantallen
   gezinnen en hulpaanvragen zijn bedrijfsinformatie over kwetsbare mensen, en
   een load balancer heeft er niets aan. De cijfers staan op het RTF-kantoor,
   achter een inlog; hier blijft alleen het leven-teken over. */
router.get('/health', (req, res) => {
  const s = require('./ai').beschikbaarheid(anthropic);
  res.json({ ok: true, ai: s.modus, verwerking: s.verwerking });
});

// RTF School (het schoolkanaal, "slimmer dan Magister"): aparte module op
// dezelfde router en dezelfde gezins-authenticatie. Zie server/school.js.
require('./school')({ router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto, anthropic,
  teVaak, misluktePoging, ipVan });

/* De vijf leeftijdsgroepen als alleen-lezen gegeven, voor kern/levenslijn.

   WAAROM DIT NAAR BUITEN MAG EN DE REST NIET. Sinds LEVEN.md par. 1.1 zijn
   mini/kind/tiener/jong/volw geen INDELING meer maar een WEERGAVEFILTER op de
   levenslijn: "laat me de lijn zien zoals een tiener hem ziet". Daarvoor heeft
   de levenslijn niets van een profiel nodig, alleen de vijf namen met hun
   bereik. Zou hij ze zelf overtikken, dan staat dezelfde lijst op twee plekken
   en lopen ze uiteen (LAT.md regel 4).

   `vanaf` (de ondergrens in jaren) gaat MET OPZET niet mee. Die hoort bij
   magSolliciteren/groepLeeftijd, waar een leeftijdsgrens een echte functie
   heeft. In de levenslijn zou hij precies een ding worden waarvoor hij daar
   niet bedoeld is: een getal waarmee je fasen kunt afsluiten voor iemand die
   er "nog niet aan toe" is. De lens mag de verzameling mogelijkheden nooit
   verkleinen (LEVEN.md par. 2.2), dus krijgt hij geen grens om op te
   vergelijken. */
function groepen() {
  return GROEPEN.map(id => ({ id, naam: GROEP_INFO[id].naam, bereik: GROEP_INFO[id].bereik }));
}

/* De drie leerlingpassen zijn afgeleide rechten, nooit vinkjes die een
   browser zelf mag zetten. Foundation is de geldige gezinssessie, Leeftijd
   komt uitsluitend uit de geboortedatum en School uitsluitend uit een echte
   klasinschrijving. Daardoor opent een gekopieerde URL geen leerlingenscherm. */
function leerlingPassen(sess) {
  if (!sess || !sess.p || !sess.g) return null;
  const geboorte = actualiseerGroep(sess.p);
  const sleutel = sess.g.code + ':' + sess.p.id;
  const f = F();
  const klassen = Object.values(f.klassen || {}).filter(k => (k.leerlingen || []).some(l => l.sleutel === sleutel));
  const scholen = f.scholen || {};
  const actieveKlassen = klassen.filter(k => !k.schoolCode || !scholen[k.schoolCode] || (scholen[k.schoolCode].status || 'actief') === 'actief');
  const leerling = sess.p.rol === 'kind' && !sess.gast;
  const passen = ['foundation'];
  if (geboorte) passen.push('leeftijd');
  if (geboorte && leerling) passen.push('leerling');
  if (geboorte && leerling && actieveKlassen.length) passen.push('school');
  return {
    groep: sess.p.groep || null, leeftijd: geboorte ? geboorte.leeftijd : null,
    leeftijdBevestigd: !!geboorte, leerling, passen,
    school: actieveKlassen.length ? { actief: true, aantalKlassen: actieveKlassen.length,
      klassen: actieveKlassen.map(k => ({ code: k.code, naam: k.naam, school: k.school })) } : { actief: false, aantalKlassen: 0, klassen: [] }
  };
}

// magSolliciteren/groepLeeftijd horen ook naar buiten: de sollicitatieroute moet
// de leeftijdsgrens uit het PROFIEL kunnen halen in plaats van uit het verzoek.
module.exports = { router, gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht, kanaalInfo, setPushHook, setMarkt, setAutomatisering, berichtVanGast, verifieerProfiel, bewaarSollicitatie, alGesolliciteerd, socialProfielen, profielInfoVanHandle, leeftijdInstr, magSolliciteren, groepLeeftijd, groepen, leerlingPassen };
