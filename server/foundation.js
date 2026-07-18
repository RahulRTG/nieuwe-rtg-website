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

router.post('/gezin/maak', async (req, res) => {
  const bucket = 'maak:' + ipVan(req);
  if (teVaak(res, bucket)) return;
  misluktePoging(bucket, 8, 30); // hooguit 8 nieuwe gezinnen per adres per half uur
  const naam = schoon(req.body.gezinsnaam, 40);
  const beheerder = schoon(req.body.naam, 40);
  if (!naam) return res.status(400).json({ error: 'Geef je gezin een naam.' });
  if (!beheerder) return res.status(400).json({ error: 'Vul je eigen naam in.' });
  if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Kies een pincode van 4 tot 6 cijfers. Die beschermt de beheerder.' });
  const code = nieuweGezinscode();
  const pid = rid(4);
  const profiel = { id: pid, naam: beheerder, rol: 'beheerder', avatar: schoonAvatar(req.body.avatar) || '👑',
    kleur: schoonKleur(req.body.kleur), pin: await hashPin(req.body.pin), groep: schoonGroep(req.body.groep) || 'volw', token: rid(24), at: nu() };
  const g = { id: rid(4), code, naam, at: nu(), profielen: { [pid]: profiel }, berichten: [] };
  G()[code] = g; save();
  res.json({ code, token: profiel.token, profiel: pubProfiel(profiel), gezin: pubGezin(g) });
});

router.post('/gezin/inloggen', (req, res) => {
  const bucket = 'inlog:' + ipVan(req);
  if (teVaak(res, bucket)) return;
  const g = gezinVan(req, res); if (!g) { misluktePoging(bucket, 12, 5); return; } // raden van gezinscodes afremmen
  goedePoging(bucket);
  res.json({ gezin: pubGezin(g), profielen: Object.values(g.profielen).map(pubProfiel) });
});

router.post('/gezin/profiel/kies', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = eigenVeld(g.profielen, req.body.profielId);
  if (!p) return res.status(404).json({ error: 'Dit profiel bestaat niet meer.' });
  const bucket = 'pin:' + g.code + ':' + p.id;
  if (p.pin && p.pin.hash) {
    if (teVaak(res, bucket)) return;
    if (!await checkPin(p.pin, req.body.pin)) { misluktePoging(bucket, 6, 5); return res.status(403).json({ error: 'De pincode klopt niet.' }); }
    goedePoging(bucket);
  }
  res.json({ token: p.token, profiel: pubProfiel(p), gezin: pubGezin(g) });
});

router.get('/gezin/:code/mij', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, req.query.token);
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const ongelezen = (g.berichten || []).filter(b => berichtVoorMij(b, p.id) && b.van !== p.id && !(b.gelezenDoor || []).includes(p.id)).length;
  const adult = ['beheerder', 'ouder'].includes(p.rol);
  const wisVerzoek = (g.wisVerzoek && adult) ? { doorNaam: g.wisVerzoek.doorNaam, vanMij: g.wisVerzoek.door === p.id, at: g.wisVerzoek.at } : null;
  res.json({ gezin: pubGezin(g), profiel: pubProfiel(p), profielen: Object.values(g.profielen).map(pubProfiel), ongelezen, wisVerzoek });
});

router.post('/gezin/profiel/maak', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!beheerderVan(g, req, res)) return;
  const naam = schoon(req.body.naam, 40);
  if (!naam) return res.status(400).json({ error: 'Vul een naam in voor het nieuwe profiel.' });
  if (Object.keys(g.profielen).length >= 12) return res.status(400).json({ error: 'Een gezin kan tot 12 profielen hebben.' });
  const rol = ROLLEN.includes(req.body.rol) ? req.body.rol : 'kind';
  const p = { id: rid(4), naam, rol, avatar: schoonAvatar(req.body.avatar), kleur: schoonKleur(req.body.kleur), token: rid(24), at: nu() };
  const g0 = schoonGroep(req.body.groep); if (g0) p.groep = g0;
  if (req.body.pin) { if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Een pincode heeft 4 tot 6 cijfers, of laat hem leeg.' }); p.pin = await hashPin(req.body.pin); }
  g.profielen[p.id] = p; save();
  res.json({ profiel: pubProfiel(p) });
});

router.post('/gezin/profiel/wijzig', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!beheerderVan(g, req, res)) return;
  const p = eigenVeld(g.profielen, req.body.profielId);
  if (!p) return res.status(404).json({ error: 'Profiel niet gevonden.' });
  if (typeof req.body.naam === 'string' && schoon(req.body.naam, 40)) p.naam = schoon(req.body.naam, 40);
  if (req.body.avatar != null) p.avatar = schoonAvatar(req.body.avatar);
  if (req.body.kleur != null) p.kleur = schoonKleur(req.body.kleur);
  if (req.body.groep != null) { const gg = schoonGroep(req.body.groep); if (gg) p.groep = gg; else delete p.groep; }
  if (ROLLEN.includes(req.body.rol)) {
    if (p.rol === 'beheerder' && req.body.rol !== 'beheerder' && Object.values(g.profielen).filter(x => x.rol === 'beheerder').length <= 1)
      return res.status(400).json({ error: 'Er moet altijd minstens een beheerder blijven.' });
    p.rol = req.body.rol;
  }
  if (req.body.pin === '') { delete p.pin; }
  else if (req.body.pin != null) { if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Een pincode heeft 4 tot 6 cijfers.' }); p.pin = await hashPin(req.body.pin); }
  save();
  res.json({ profiel: pubProfiel(p) });
});

router.post('/gezin/profiel/verwijder', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const beheerder = beheerderVan(g, req, res); if (!beheerder) return;
  const id = String(req.body.profielId || '');
  const p = g.profielen[id];
  if (!p) return res.status(404).json({ error: 'Profiel niet gevonden.' });
  if (p.rol === 'beheerder' && Object.values(g.profielen).filter(x => x.rol === 'beheerder').length <= 1)
    return res.status(400).json({ error: 'De laatste beheerder kan niet worden verwijderd.' });
  delete g.profielen[id]; save();
  res.json({ ok: true });
});

router.post('/gezin/bericht', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, (req.body && req.body.token));
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const tekst = schoon(req.body.tekst, 800);
  if (!tekst) return res.status(400).json({ error: 'Schrijf een bericht.' });
  const naar = req.body.naar && g.profielen[req.body.naar] ? req.body.naar : 'allen';
  const soort = ['reis', 'hulp'].includes(req.body.soort) ? req.body.soort : 'bericht';
  const b = { id: rid(3), van: p.id, vanNaam: p.naam, vanAvatar: p.avatar, naar, soort, tekst: encS(tekst), at: nu(), gelezenDoor: [p.id] };
  if (!g.berichten) g.berichten = [];
  g.berichten.unshift(b); g.berichten = g.berichten.slice(0, 200); save();
  bezorgAanGasten(g, b); // gekoppelde oppas/familie krijgt dit ook in de RTG-app
  res.json({ ok: true, bericht: Object.assign({}, b, { tekst }) });
});

router.get('/gezin/:code/berichten', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, req.query.token);
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const mijn = (g.berichten || []).filter(b => berichtVoorMij(b, p.id)).map(b => ({
    id: b.id, van: b.van, vanNaam: b.vanNaam, vanAvatar: b.vanAvatar, naar: b.naar,
    naarNaam: b.naar === 'allen' ? 'iedereen' : (g.profielen[b.naar] ? g.profielen[b.naar].naam : ''),
    soort: b.soort, tekst: decS(b.tekst), at: b.at, vanMij: b.van === p.id,
    gelezen: (b.gelezenDoor || []).includes(p.id)
  }));
  res.json({ berichten: mijn });
});

router.post('/gezin/bericht/gelezen', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, (req.body && req.body.token));
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  for (const b of (g.berichten || [])) if (berichtVoorMij(b, p.id) && !(b.gelezenDoor || []).includes(p.id)) { (b.gelezenDoor = b.gelezenDoor || []).push(p.id); }
  save();
  res.json({ ok: true });
});

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
