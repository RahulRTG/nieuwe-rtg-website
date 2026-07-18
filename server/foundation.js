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


/* ---------- het gezin: een account, meerdere profielen (net als bij een
   streamingdienst). De beheerder (ouder of verzorger) maakt het gezin aan en
   kan profielen toevoegen, en berichten of een reis-oproep sturen naar iedereen
   of naar een profiel. Iedereen logt in op hetzelfde gezin met de gezinscode en
   kiest daarna zijn eigen profiel. ---------- */
function G() { const f = F(); if (!f.gezinnen) f.gezinnen = {}; return f.gezinnen; }
function nieuweGezinscode() {
  let c; do { c = Array.from({ length: 6 }, () => LETTERS[crypto.randomInt(LETTERS.length)]).join(''); } while (G()[c]);
  return c;
}
const ROLLEN = ['beheerder', 'ouder', 'kind', 'gezinslid', 'gast'];
// vijf leeftijdsgroepen, zodat de hele onder- en middenlaag zich thuis voelt in
// de app: van de allerkleinsten tot de volwassenen. De groep stuurt welke tips
// en tegels iemand ziet, en of iemand mag solliciteren op vacatures (vanaf 16).
const GROEPEN = ['mini', 'kind', 'tiener', 'jong', 'volw'];
const GROEP_INFO = {
  mini:   { naam: 'Allerkleinsten', bereik: '0 t/m 4 jaar',   emoji: '🧸', vanaf: 0 },
  kind:   { naam: 'Kind',           bereik: '5 t/m 11 jaar',  emoji: '🎒', vanaf: 5 },
  tiener: { naam: 'Tiener',         bereik: '12 t/m 15 jaar', emoji: '🛹', vanaf: 12 },
  jong:   { naam: 'Jongvolwassen',  bereik: '16 t/m 21+ jaar', emoji: '🚀', vanaf: 16 },
  volw:   { naam: 'Volwassen',      bereik: 'volwassen',      emoji: '🧑', vanaf: 22 }
};
const magSolliciteren = groep => groep === 'jong' || groep === 'volw';
const groepLeeftijd = groep => (GROEP_INFO[groep] || {}).vanaf; // ondergrens voor de vacature-filter
/* Beschermd profiel (15 jaar of jonger, of rol kind): de open vriendenlaag is
   voor hen gesloten. Ze zijn onvindbaar en onbenaderbaar; alleen een ouder of
   verzorger voegt contacten voor hen toe. Chatten en bellen binnen het gezin
   blijft altijd werken (dat is de aparte gezinslaag). We kennen alleen de
   leeftijdsgroep, niet de exacte leeftijd, dus de hele tienergroep (12 t/m 15)
   valt eronder: liever een 15-jarige te streng dan een 12-jarige te los. */
const isBeschermd = p => !!p && (p.rol === 'kind' || ['mini', 'kind', 'tiener'].includes(p.groep));
function schoonGroep(v) { return GROEPEN.includes(v) ? v : null; }
// een gast (oppas, opa/oma of familielid) helpt mee, maar mag niet bij de
// privezaken van het gezin (geld, mentale steun, dromen, cv, reisaanvraag).
const isGast = p => p && p.rol === 'gast';
const KLEUREN = ['#C9A24B', '#5FA56A', '#6AA6C9', '#B4574E', '#B07AC0', '#D08A3E'];
const scryptAsync = (pin, salt, len) => new Promise((resolve, reject) =>
  crypto.scrypt(String(pin), salt, len, (err, key) => err ? reject(err) : resolve(key)));
async function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: (await scryptAsync(pin, salt, 32)).toString('hex') };
}
async function checkPin(rec, pin) {
  if (!rec || !rec.hash) return false;
  let h; try { h = await scryptAsync(pin, rec.salt, 32); } catch (e) { return false; }
  const b = Buffer.from(rec.hash, 'hex');
  return h.length === b.length && crypto.timingSafeEqual(h, b);
}
const geldigePin = p => /^\d{4,6}$/.test(String(p || ''));
function schoonAvatar(v) { const s = String(v == null ? '' : v).replace(/[<>]/g, '').trim(); return s ? Array.from(s).slice(0, 2).join('') : '🙂'; }
function schoonKleur(v) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : KLEUREN[0]; }

/* Elk gezinslid krijgt een codenaam, net als een RTG-lid, zodat RTF- en
   RTG-mensen elkaar op codenaam kunnen vinden en toevoegen zonder ooit een
   echte naam of adres te delen. */
const CNAAM_KLEUR = ['Gouden', 'Zilveren', 'Koperen', 'Blauwe', 'Groene', 'Rode', 'Witte', 'Zwarte', 'Paarse', 'Oranje'];
const CNAAM_DIER = ['Vos', 'Havik', 'Lynx', 'Otter', 'Das', 'Reiger', 'Hert', 'Uil', 'Merel', 'Wolf', 'Bever', 'Zwaan', 'Valk', 'Egel'];
function nieuweCodenaam() {
  const k = CNAAM_KLEUR[crypto.randomInt(CNAAM_KLEUR.length)];
  const d = CNAAM_DIER[crypto.randomInt(CNAAM_DIER.length)];
  const s = crypto.randomBytes(2).toString('hex').toUpperCase();
  return k + ' ' + d + ' ' + s;
}
function ensureCodenaam(p) { if (!p.codenaam) p.codenaam = nieuweCodenaam(); return p.codenaam; }
const rtfHandle = (code, pid) => 'rtf:' + String(code).toUpperCase() + ':' + pid;
// alle gezinsleden (geen gasten) voor de gedeelde codenaam-gids
function socialProfielen() {
  const uit = []; let veranderd = false;
  for (const g of Object.values(G())) {
    for (const p of Object.values(g.profielen || {})) {
      if (isGast(p)) continue;
      if (!p.codenaam) { ensureCodenaam(p); veranderd = true; }
      uit.push({ handle: rtfHandle(g.code, p.id), codenaam: p.codenaam, rol: p.rol, kind: p.rol === 'kind', beschermd: isBeschermd(p), gezinCode: g.code });
    }
  }
  if (veranderd) save();
  return uit;
}
function profielInfoVanHandle(handle) {
  const m = /^rtf:([A-Z0-9]+):(.+)$/.exec(String(handle || ''));
  if (!m) return null;
  const g = G()[m[1]]; if (!g) return null;
  const p = eigenVeld(g.profielen, m[2]); if (!p || isGast(p)) return null;
  return { handle, codenaam: ensureCodenaam(p), naam: p.naam, avatar: p.avatar, kleur: p.kleur, rol: p.rol, kind: p.rol === 'kind', beschermd: isBeschermd(p), gezinCode: g.code };
}
function pubProfiel(p) {
  const groep = p.groep && GROEP_INFO[p.groep] ? p.groep : null;
  if (!isGast(p)) ensureCodenaam(p);
  return {
    id: p.id, naam: p.naam, rol: p.rol, avatar: p.avatar, kleur: p.kleur,
    heeftPin: !!(p.pin && p.pin.hash), beheerder: p.rol === 'beheerder',
    gast: p.rol === 'gast', gekoppeld: !!p.koppel, codenaam: p.codenaam || null,
    groep, groepNaam: groep ? GROEP_INFO[groep].naam : null, groepBereik: groep ? GROEP_INFO[groep].bereik : null,
    magSolliciteren: magSolliciteren(groep)
  };
}
function pubGezin(g) { return { code: g.code, naam: g.naam }; }
function gezinVan(req, res) {
  const code = String((req.body && req.body.code) || req.params.code || '').toUpperCase();
  const g = G()[code];
  if (!g) { res.status(404).json({ error: 'Dit gezin kennen we niet. Klopt de gezinscode?' }); return null; }
  return g;
}
function profielVan(g, token) { return Object.values(g.profielen || {}).find(p => p.token === token); }
function beheerderVan(g, req, res) {
  const t = (req.body && req.body.token) || req.query.token;
  const p = profielVan(g, t);
  if (!p || p.rol !== 'beheerder') { res.status(403).json({ error: 'Alleen de beheerder van het gezin kan dit doen.' }); return null; }
  return p;
}
function berichtVoorMij(b, pid) { return b.naar === 'allen' || b.naar === pid || b.van === pid; }

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
