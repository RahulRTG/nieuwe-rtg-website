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

/* ---------- samen vooruit: spaardoelen, dromenbord en gezinshulp. Alles hangt
   aan het gezin en is gedeeld, zodat het gezin het samen beleeft en elkaar
   aanmoedigt. ---------- */
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
const getal = (v, max = 1e7) => { let n = Number(v); if (!isFinite(n)) n = 0; n = Math.round(n * 100) / 100; return Math.max(-max, Math.min(max, n)); };

/* spaardoelen: het gezin spaart samen naar iets moois */
router.post('/gezin/spaardoel/maak', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const naam = schoon(req.body.naam, 60);
  const doel = getal(req.body.doel);
  if (!naam) return res.status(400).json({ error: 'Geef je spaardoel een naam.' });
  if (doel <= 0) return res.status(400).json({ error: 'Vul een bedrag in om naartoe te sparen.' });
  if (!s.g.spaardoelen) s.g.spaardoelen = [];
  if (s.g.spaardoelen.length >= 30) return res.status(400).json({ error: 'Je hebt al veel doelen. Rond er eerst een af.' });
  const d = { id: rid(3), naam, doel, nu: 0, klaar: false, door: s.p.id, bijdragen: [], at: nu() };
  s.g.spaardoelen.unshift(d); save();
  res.json({ ok: true, doel: d });
});
router.post('/gezin/spaardoel/bijdrage', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const d = (s.g.spaardoelen || []).find(x => x.id === req.body.doelId);
  if (!d) return res.status(404).json({ error: 'Dit spaardoel bestaat niet meer.' });
  const bedrag = getal(req.body.bedrag);
  if (!bedrag) return res.status(400).json({ error: 'Vul een bedrag in.' });
  d.nu = Math.max(0, Math.round((d.nu + bedrag) * 100) / 100);
  d.bijdragen.unshift({ van: s.p.id, vanNaam: s.p.naam, bedrag, at: nu() });
  d.bijdragen = d.bijdragen.slice(0, 100);
  const netKlaar = !d.klaar && d.nu >= d.doel;
  d.klaar = d.nu >= d.doel;
  save();
  res.json({ ok: true, doel: d, gevierd: netKlaar });
});
router.post('/gezin/spaardoel/verwijder', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  if (s.p.rol !== 'beheerder') return res.status(403).json({ error: 'Alleen de beheerder kan een spaardoel verwijderen.' });
  s.g.spaardoelen = (s.g.spaardoelen || []).filter(x => x.id !== req.body.doelId); save();
  res.json({ ok: true });
});
router.get('/gezin/:code/spaardoelen', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  res.json({ spaardoelen: (s.g.spaardoelen || []) });
});

/* dromenbord: ieder een doel of droom, en we moedigen elkaar aan */
router.post('/gezin/droom/maak', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const tekst = schoon(req.body.tekst, 240);
  if (!tekst) return res.status(400).json({ error: 'Schrijf je droom of doel op.' });
  if (!s.g.dromen) s.g.dromen = [];
  if (s.g.dromen.length >= 200) s.g.dromen = s.g.dromen.slice(0, 199);
  const d = { id: rid(3), van: s.p.id, vanNaam: s.p.naam, vanAvatar: s.p.avatar, kleur: s.p.kleur, tekst, aanmoedigingen: [], behaald: false, at: nu() };
  s.g.dromen.unshift(d); save();
  res.json({ ok: true, droom: d });
});
router.post('/gezin/droom/moedig', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const d = (s.g.dromen || []).find(x => x.id === req.body.droomId);
  if (!d) return res.status(404).json({ error: 'Deze droom bestaat niet meer.' });
  d.aanmoedigingen = d.aanmoedigingen || [];
  const i = d.aanmoedigingen.indexOf(s.p.id);
  if (i >= 0) d.aanmoedigingen.splice(i, 1); else d.aanmoedigingen.push(s.p.id);
  save();
  res.json({ ok: true, aantal: d.aanmoedigingen.length, aangemoedigd: i < 0 });
});
router.post('/gezin/droom/behaald', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const d = (s.g.dromen || []).find(x => x.id === req.body.droomId);
  if (!d) return res.status(404).json({ error: 'Deze droom bestaat niet meer.' });
  if (d.van !== s.p.id && s.p.rol !== 'beheerder') return res.status(403).json({ error: 'Alleen wie de droom heeft, of de beheerder, kan dit afvinken.' });
  d.behaald = req.body.behaald === false ? false : true;
  d.behaaldAt = d.behaald ? nu() : null;
  save();
  res.json({ ok: true, droom: d });
});
router.post('/gezin/droom/verwijder', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const d = (s.g.dromen || []).find(x => x.id === req.body.droomId);
  if (!d) return res.status(404).json({ error: 'Deze droom bestaat niet meer.' });
  if (d.van !== s.p.id && s.p.rol !== 'beheerder') return res.status(403).json({ error: 'Alleen wie de droom heeft, of de beheerder, kan hem weghalen.' });
  s.g.dromen = s.g.dromen.filter(x => x.id !== req.body.droomId); save();
  res.json({ ok: true });
});
router.get('/gezin/:code/dromen', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  res.json({ dromen: (s.g.dromen || []).map(d => ({ id: d.id, van: d.van, vanNaam: d.vanNaam, vanAvatar: d.vanAvatar, kleur: d.kleur, tekst: d.tekst, aantal: (d.aanmoedigingen || []).length, aangemoedigd: (d.aanmoedigingen || []).includes(s.p.id), vanMij: d.van === s.p.id, behaald: !!d.behaald, at: d.at })) });
});

/* gezinshulp-AI: warme coaches, elk met een eigen rol. Voor ouders en voor kids. */
const HULP_SYS = {
  geld: 'Je bent "Meike", een warme, praktische geldmaatje in de gratis app van de RTFoundation, voor elk gezin in Nederland. ' +
    'Geef concrete, haalbare tips om rond te komen, te besparen en te sparen: goedkoop en gezond koken, energie besparen, tweedehands, en welke regelingen er zijn ' +
    '(zorgtoeslag, huurtoeslag, kindgebonden budget, energietoeslag, bijzondere bijstand via de gemeente, kwijtschelding gemeentebelasting, Stichting Leergeld, Jeugdfonds Sport & Cultuur). ' +
    'Zeg er altijd bij dat aanvragen gratis is en dat de gemeente of Belastingdienst helpt. Nooit oordelen, altijd bemoedigen. Kort, eenvoudig Nederlands, max ~120 woorden.',
  hulp: 'Je bent "Meike", een warme wegwijzer in de gratis app van de RTFoundation, voor gezinnen in Nederland die hulp zoeken. ' +
    'Wijs mensen vriendelijk de weg naar gratis hulp: eten (Voedselbank), kleding en spullen (Kledingbank, Stichting Leergeld voor schoolspullen en fiets), ' +
    'geld en schulden (gemeente, Schuldhulpmaatje, sociaal raadslieden), kinderen (Jeugdfonds Sport & Cultuur, Nationaal Fonds Kinderhulp, Leergeld), ' +
    'gezondheid en steun (huisarts, 113 Zelfmoordpreventie bij nood, MIND Korrelatie), leren en werk (Bibliotheek, gemeente, UWV). ' +
    'Vraag kort door wat iemand nodig heeft en noem 1 tot 3 concrete plekken. Nooit oordelen. Kort, eenvoudig Nederlands, max ~120 woorden.',
  opvoeden: 'Je bent "Nora", een warme, ervaren opvoedcoach in de gratis app van de RTFoundation, voor ouders en verzorgers, met soms veel op hun bord. ' +
    'Help met alledaagse opvoedvragen: driftbuien, grenzen stellen, schermtijd, huiswerk en motivatie, ruzie tussen kinderen, slapen, en praten over gevoelens of pesten. ' +
    'Geef 1 tot 3 concrete, liefdevolle stappen die vandaag te doen zijn. Oordeel nooit over de ouder; benoem dat het zwaar kan zijn en dat om hulp vragen sterk is. ' +
    'Bij zorgen over veiligheid of geweld: wijs vriendelijk naar het Centrum voor Jeugd en Gezin, de huisarts of Veilig Thuis (0800-2000). Kort, eenvoudig Nederlands, max ~130 woorden.',
  steun: 'Je bent "Nora", een warm en rustig luisterend oor in de gratis app van de RTFoundation, voor ouders en verzorgers die het zwaar hebben. ' +
    'Je bent geen therapeut en stelt geen diagnose. Luister, erken het gevoel, en geef een of twee kleine, haalbare dingen die kunnen helpen (even ademen, iets voor jezelf, iemand bellen). ' +
    'Moedig aan om steun te zoeken bij de huisarts, MIND Korrelatie, of het eigen netwerk. Bij tekenen van crisis of gedachten aan zelfmoord: verwijs rustig en direct naar 113 (0800-0113, gratis, dag en nacht) of 112. ' +
    'Warm, zonder oordeel, max ~120 woorden.',
  studie: 'Je bent "Nora", een bemoedigende loopbaan- en studiecoach in de gratis app van de RTFoundation, voor volwassenen die verder willen leren. ' +
    'Denk mee over gratis en goedkope wegen: het Taalhuis en de Bibliotheek (taal, rekenen, digitale vaardigheden), gratis online cursussen, mbo in deeltijd, inburgering, een rijbewijs of vakdiploma via de gemeente of UWV, en omscholing. ' +
    'Koppel het aan hun droom en de cv-maker in deze app. Geef 1 tot 3 concrete stappen. Nooit oordelen, altijd hoopvol. Kort, eenvoudig Nederlands, max ~130 woorden.',
  tiener: 'Je bent "Sam", een rustige, eerlijke coach in de gratis app van de RTFoundation, en je praat met een tiener van 12 tot 15 jaar. ' +
    'Je praat op ooghoogte, nooit betuttelend en nooit oordelend. Onderwerpen: groepsdruk en erbij horen, sociale media en schermtijd, stress om school en toetsen, ' +
    'ruzie thuis, verliefdheid en vriendschap, en je onzeker voelen over jezelf. Luister eerst, erken het gevoel, en geef dan 1 of 2 kleine, echte stappen. ' +
    'Bij online druk (foto’s delen, chantage, rare verzoeken): zeg helder dat het nooit hun schuld is, dat ze niets hoeven te sturen, en dat ze het aan een volwassene ' +
    'die ze vertrouwen moeten vertellen; noem Helpwanted.nl en de Kindertelefoon (0800-0432, gratis en anoniem, ook chat). Bij sombere of donkere gedachten: verwijs rustig naar 113 (0800-0113) of 112 bij nood. ' +
    'Kort, gewoon Nederlands zonder jeukwoorden, max ~110 woorden.',
  baby: 'Je bent "Nora", een warme kraam- en babycoach in de gratis app van de RTFoundation, voor ouders van een baby, peuter of kleuter. ' +
    'Je helpt met slapen, huilen, voeding, tandjes, driftbuien van de allerkleinsten, en vooral met de eigen rust van de ouder. Ontzorg en troost: ' +
    'erken dat het zwaar en mooi tegelijk is, zeg dat twijfelen bij goed ouderschap hoort, en geef 1 tot 3 kleine, haalbare stappen ' +
    '(om de beurt opstaan, hulp durven vragen aan familie of buren, even naar buiten met de kinderwagen, een momentje voor jezelf als het kindje slaapt). ' +
    'Bij vragen over gezondheid of ontwikkeling: wijs vriendelijk naar het consultatiebureau (de jeugdgezondheidszorg, gratis) of de huisarts; bij nood naar 112. ' +
    'Nooit oordelen, geen medische diagnoses. Kort, warm en eenvoudig Nederlands, max ~120 woorden.',
  pesten: 'Je bent "Sam", een lieve, rustige maatje in de gratis app van de RTFoundation, en je praat met een kind of tiener dat gepest wordt of zich rot voelt. ' +
    'Luister goed, zeg dat het niet zijn of haar schuld is, en dat het slim en dapper is om erover te praten. Geef een of twee kleine, concrete dingen: het tegen een volwassene die je vertrouwt zeggen (ouder, juf of meester), samen optrekken met een vriend, en het opschrijven. ' +
    'Moedig altijd aan om het aan een ouder of leerkracht te vertellen, en noem de Kindertelefoon (0800-0432, gratis en anoniem). Bij gevaar: zeg dat ze meteen een volwassene erbij halen of 112 bellen. ' +
    'Heel warm, simpel, kindvriendelijk, korte zinnen, max ~110 woorden. Geef nooit het advies om terug te pesten of geweld te gebruiken.'
};
const HULP_DEMO = {
  geld: 'Fijn dat je het vraagt. Kleine stappen helpen echt: kook een paar vaste, goedkope maaltijden, zet de verwarming een graadje lager en check of je recht hebt op zorgtoeslag of het kindgebonden budget. Aanvragen is gratis; de gemeente helpt je erbij. Wil je dat ik met een van deze meedenk?',
  hulp: 'Je staat er niet alleen voor. Vertel me kort wat je nodig hebt: eten, kleding, hulp voor de kinderen, of hulp met geld en post? Dan wijs ik je de juiste, gratis plek. Voor eten is er de Voedselbank; voor school en sport zijn er Stichting Leergeld en het Jeugdfonds.',
  opvoeden: 'Wat fijn dat je meedenkt over je kind; dat je het vraagt zegt al genoeg. Vertel me kort wat er speelt, bijvoorbeeld driftbuien, huiswerk of schermtijd, dan geef ik een paar liefdevolle stappen die vandaag te doen zijn. En weet: het zwaar hebben betekent niet dat je het verkeerd doet.',
  steun: 'Fijn dat je dit even deelt. Jij doet er ook toe, niet alleen als ouder. Vertel me hoe het echt met je gaat; ik luister. En als het te veel wordt, praat er dan over met je huisarts of bel MIND Korrelatie. Bij hele donkere gedachten: bel gratis 113, dag en nacht.',
  studie: 'Wat goed dat je verder wilt leren; daar word je sterker van en het geeft je kinderen een mooi voorbeeld. Vertel me wat je zou willen kunnen of worden, dan zoeken we samen een gratis of goedkope weg, via de Bibliotheek, het Taalhuis, een online cursus of de gemeente. Klein beginnen mag.',
  tiener: 'Hoi, goed dat je er bent. Hier hoef je niks mooier te maken dan het is: school, vrienden, thuis, sociale media, alles mag op tafel. Vertel maar wat er speelt, ik luister en denk in kleine stappen mee. En als het echt zwaar voelt: de Kindertelefoon is er ook, gratis en anoniem, 0800-0432.',
  baby: 'Wat fijn dat je even inlogt tussen alles door; met een kleintje thuis is dat al een prestatie. Vertel me wat er speelt: slapen, huilen, voeding, of gewoon even je hart luchten? Ik denk mee met kleine stappen. En weet: het consultatiebureau denkt gratis met je mee, en om hulp vragen is sterk, niet zwak.',
  pesten: 'Hoi, fijn dat je het durft te zeggen. Wat er ook gebeurt: het is niet jouw schuld. Vertel me maar wat er is, ik luister. En het is heel dapper en slim om het ook aan een volwassene te vertellen die je vertrouwt, zoals je vader, moeder, juf of meester. Je kunt ook gratis bellen met de Kindertelefoon: 0800-0432.'
};
const AI_KINDS = Object.keys(HULP_SYS);
/* De AI-buddy: iedereen kiest zelf hoe die klinkt (vrouw, man of non-binair)
   met een eigen naam. De buddy blijft dezelfde persoon door alle coaches heen;
   we vervangen alleen de vaste naam in de systeemprompt door de gekozen buddy. */
const BUDDY = {
  vrouw:     { naam: 'Amber', wie: 'een vrouw' },
  man:       { naam: 'Fayaz', wie: 'een man' },
  nonbinair: { naam: 'Robin', wie: 'non-binair' }
};
function kiesBuddy(g) { return BUDDY[g] || BUDDY.vrouw; }
function buddySys(kind, g) {
  const b = kiesBuddy(g);
  return HULP_SYS[kind].replace(/^Je bent "[^"]+"/, 'Je bent ' + b.naam + ' (' + b.wie + ')');
}
/* De leeftijdslaag: dezelfde tool voelt anders per leeftijdsgroep. Elke AI
   krijgt te horen met wie die praat, zodat taal, voorbeelden en niveau
   verschillen tussen een kind, een tiener, een jongvolwassene en een
   volwassene. Zo zijn de tools echt verschillend per groep. */
const LEEFTIJD = {
  mini:   { wie: 'een peuter of kleuter (0 tot 4 jaar), samen met een ouder', hoe: 'Richt je uitleg op de ouder: speels, heel eenvoudig, met een spelletje of liedje.' },
  kind:   { wie: 'een kind (5 tot 11 jaar)', hoe: 'Gebruik korte zinnen, simpele woorden en concrete voorbeelden uit hun wereld. Maak het speels en moedig aan.' },
  tiener: { wie: 'een tiener (12 tot 15 jaar)', hoe: 'Praat respectvol en op ooghoogte, iets uitdagender, en koppel het aan hun eigen wereld (school, vrienden, games).' },
  jong:   { wie: 'een jongvolwassene (16 tot 21 jaar)', hoe: 'Praat volwassen en direct, koppel aan studie, werk, geld en zelfstandig worden.' },
  volw:   { wie: 'een volwassene', hoe: 'Praat gelijkwaardig en praktisch, gericht op het echte leven en concrete stappen.' }
};
function leeftijdInstr(g) {
  const l = LEEFTIJD[g];
  return l ? ' Je praat met ' + l.wie + '. ' + l.hoe + ' Pas taal, voorbeelden en niveau daarop aan.' : '';
}
router.post('/hulp/ai', async (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const kind = AI_KINDS.includes(req.body.kind) ? req.body.kind : 'geld';
  const clean = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) })).slice(-10);
  while (clean.length && clean[0].role !== 'user') clean.shift();
  if (!clean.length) return res.json({ text: HULP_DEMO[kind] });
  if (!anthropic) return res.json({ text: HULP_DEMO[kind], demo: true });
  try {
    const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 420, system: buddySys(kind, req.body.buddy) + leeftijdInstr(req.body.groep), messages: clean });
    res.json({ text: (r.content || []).map(b => b.text || '').join('').trim() || HULP_DEMO[kind] });
  } catch (e) { res.json({ text: HULP_DEMO[kind], demo: true }); }
});

const BESPAARTIPS = [
  'Maak een boodschappenlijst en ga niet met honger naar de winkel: je koopt zo veel minder onnodige dingen.',
  'Kook een keer per week een grote pan (soep, stamppot, rijst met groente) en vries porties in. Goedkoop en klaar op drukke dagen.',
  'Check ieder jaar op toeslagen.nl of je recht hebt op zorgtoeslag, huurtoeslag of het kindgebonden budget. Aanvragen is gratis.',
  'Vraag bij je gemeente naar bijzondere bijstand en de energietoeslag. Veel mensen die er recht op hebben, vragen het niet aan.',
  'Zet de verwarming een graadje lager en doe een trui aan. Een dekentje op de bank scheelt echt op de energierekening.',
  'Huismerk in de supermarkt is vaak hetzelfde als het dure merk, maar veel goedkoper. Durf te ruilen.',
  'Kijk voor kleding, speelgoed en spullen eerst tweedehands: kringloop, Marktplaats of een weggeefgroep in de buurt.',
  'Heb je kinderen op school of sport? Stichting Leergeld en het Jeugdfonds Sport & Cultuur betalen mee. Vraag ernaar, het is gratis.',
  'Zeg abonnementen op die je niet gebruikt. Zet ze een maand stil en kijk of je ze mist.',
  'Betaal met contant of een aparte pas voor boodschappen. Als het op is, is het op; zo hou je grip.'
];
router.get('/bespaartip', (req, res) => {
  const dag = Math.floor(Date.now() / 86400000);
  res.json({ tip: BESPAARTIPS[dag % BESPAARTIPS.length], nog: BESPAARTIPS[Math.floor(Math.random() * BESPAARTIPS.length)] });
});

/* Wat de bijdragen dóén: een warme, geaggregeerde momentopname voor de gezinnen.
   Opgehaald = alles wat leden via hun abonnement aan de RTFoundation afdroegen
   (het grootboek uit kern/fonds.js), plus het aantal aangesloten scholen en
   gezinnen. Publiek en zonder namen; alleen totalen. */
router.get('/impact', (req, res) => {
  const f = F();
  const afdrachten = Array.isArray(db.data.fondsAfdrachten) ? db.data.fondsAfdrachten : [];
  const opgehaaldCenten = afdrachten.reduce((s, a) => s + (a.centen || 0), 0);
  const scholen = f.scholen ? Object.values(f.scholen).filter(s => (s.status || 'actief') !== 'wacht').length : 0;
  const gezinnen = f.gezinnen ? Object.keys(f.gezinnen).length : 0;
  res.json({
    opgehaald: Math.round(opgehaaldCenten) / 100,
    scholen, gezinnen,
    boodschap: 'Elke maand dat iemand RTG-lid is, groeit de RTFoundation mee. Zo blijft alles hier gratis, voor iedereen.'
  });
});

const GESPREKSKAARTEN = [
  'Wat was vandaag het fijnste moment van je dag?',
  'Waar ben je de laatste tijd trots op geworden?',
  'Als je een dag alles mocht doen wat je wilt, wat zou je dan doen?',
  'Wie heeft jou deze week geholpen, en hoe?',
  'Wat zou je later willen worden of doen? Waarom?',
  'Waar word jij blij van, ook al kost het niks?',
  'Wat wil je nog leren, en wie kan je daarbij helpen?',
  'Waar zijn we als gezin goed in samen?',
  'Wat is iets liefs dat iemand ooit tegen je heeft gezegd?',
  'Als we samen een klein feestje geven, wat doen we dan?',
  'Wat is een moeilijk moment geweest, en wat heeft je er doorheen geholpen?',
  'Voor wie zou je iets liefs willen doen, en wat?'
];
router.get('/gesprekskaart', (req, res) => res.json({ kaart: GESPREKSKAARTEN[Math.floor(Math.random() * GESPREKSKAARTEN.length)] }));

/* veilig thuis: een kind (of ieder gezinslid) deelt zijn status en, als het wil,
   zijn locatie met het gezin. Alleen de laatste plek wordt bewaard, en delen
   kan altijd worden gestopt. */
const STATUSSEN = ['veilig thuis', 'onderweg', 'op school', 'bij een vriend', 'naar huis'];
router.post('/gezin/locatie', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  const status = STATUSSEN.includes(req.body.status) ? req.body.status : schoon(req.body.status, 40) || 'onderweg';
  const rec = { pid: s.p.id, naam: s.p.naam, avatar: s.p.avatar, kleur: s.p.kleur, status, at: nu() };
  if (req.body.lat != null && req.body.lon != null) {
    const lat = Number(req.body.lat), lon = Number(req.body.lon);
    if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      // de precieze GPS-plek ligt versleuteld op schijf
      rec.plek = encS((Math.round(lat * 1e5) / 1e5) + ',' + (Math.round(lon * 1e5) / 1e5));
    }
  }
  if (!s.g.locaties) s.g.locaties = {};
  s.g.locaties[s.p.id] = rec; save();
  res.json({ ok: true });
});
function locatiePubliek(l, mij) {
  const out = { pid: l.pid, naam: l.naam, avatar: l.avatar, kleur: l.kleur, status: l.status, at: l.at, vanMij: l.pid === mij };
  if (l.plek) { const d = decS(l.plek); const komma = d.indexOf(','); if (komma > 0) { out.lat = Number(d.slice(0, komma)); out.lon = Number(d.slice(komma + 1)); } }
  else if (l.lat != null) { out.lat = l.lat; out.lon = l.lon; } // oude, onversleutelde data
  return out;
}
router.post('/gezin/locatie/stop', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  if (s.g.locaties) delete s.g.locaties[s.p.id]; save();
  res.json({ ok: true });
});
router.get('/gezin/:code/locaties', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  const alle = Object.values(s.g.locaties || {})
    .filter(l => s.g.profielen[l.pid]) // alleen bestaande profielen
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map(l => locatiePubliek(l, s.p.id));
  res.json({ locaties: alle, ikDeel: !!(s.g.locaties && s.g.locaties[s.p.id]) });
});

/* belangrijke gezinsinfo voor de oppas: noodnummers, allergieen, bedtijden en
   huisregels. Iedereen in het gezin (ook een gast) mag dit lezen; alleen een
   ouder of de beheerder mag het aanpassen. */
function oppasinfoPubliek(g) {
  const o = g.oppasinfo || {};
  // noodcontacten en gezondheidsinfo liggen versleuteld; hier weer leesbaar maken
  let contacten = [];
  if (Array.isArray(o.noodcontacten)) contacten = o.noodcontacten; // oude, onversleutelde data
  else if (o.noodcontacten) { try { contacten = JSON.parse(decS(o.noodcontacten)) || []; } catch (e) { contacten = []; } }
  return { noodcontacten: contacten, allergie: decS(o.allergie) || '', eten: decS(o.eten) || '', huisregels: decS(o.huisregels) || '', updatedAt: o.updatedAt || null, updatedBy: o.updatedBy || '' };
}
router.get('/gezin/:code/oppasinfo', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  res.json({ oppasinfo: oppasinfoPubliek(s.g), magBewerken: ['beheerder', 'ouder'].includes(s.p.rol) });
});
router.post('/gezin/oppasinfo', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  if (!['beheerder', 'ouder'].includes(s.p.rol)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan de gezinsinfo aanpassen.' });
  const noodcontacten = (Array.isArray(req.body.noodcontacten) ? req.body.noodcontacten : []).slice(0, 12)
    .map(c => ({ naam: schoon(c && c.naam, 40), telefoon: schoon(c && c.telefoon, 30), wie: schoon(c && c.wie, 40) }))
    .filter(c => c.naam || c.telefoon);
  s.g.oppasinfo = {
    noodcontacten: encS(JSON.stringify(noodcontacten)),
    allergie: encS(schoon(req.body.allergie, 1500)),
    eten: encS(schoon(req.body.eten, 1500)),
    huisregels: encS(schoon(req.body.huisregels, 1500)),
    updatedAt: nu(), updatedBy: s.p.naam
  };
  save();
  res.json({ ok: true, oppasinfo: oppasinfoPubliek(s.g) });
});

/* AVG: het recht om vergeten te worden. Zijn er twee volwassenen (ouder of
   beheerder), dan is verwijderen een verzoek dat de tweede volwassene moet
   goedkeuren. Is er maar een volwassene, dan wist die het meteen. */
function volwassenen(g) { return Object.values(g.profielen || {}).filter(p => ['beheerder', 'ouder'].includes(p.rol)); }
async function adultCheck(g, req, res) {
  const p = profielVan(g, req.body && req.body.token);
  if (!p || !['beheerder', 'ouder'].includes(p.rol)) { res.status(403).json({ error: 'Alleen een ouder of de beheerder kan dit doen.' }); return null; }
  if (p.pin && p.pin.hash && !await checkPin(p.pin, req.body.pin)) { res.status(403).json({ error: 'De pincode klopt niet.' }); return null; }
  return p;
}
router.post('/gezin/wissen', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = await adultCheck(g, req, res); if (!p) return;
  if (volwassenen(g).length <= 1) { delete G()[g.code]; save(); return res.json({ ok: true, verwijderd: true }); }
  g.wisVerzoek = { door: p.id, doorNaam: p.naam, at: nu() }; save();
  res.json({ ok: true, wachtOpToestemming: true });
});
router.post('/gezin/wissen/bevestig', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!g.wisVerzoek) return res.status(400).json({ error: 'Er is geen verzoek om te verwijderen.' });
  const p = await adultCheck(g, req, res); if (!p) return;
  if (g.wisVerzoek.door === p.id) return res.status(403).json({ error: 'De tweede volwassene moet toestemming geven, niet degene die het verzoek deed.' });
  delete G()[g.code]; save();
  res.json({ ok: true, verwijderd: true });
});
router.post('/gezin/wissen/intrekken', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = await adultCheck(g, req, res); if (!p) return;
  delete g.wisVerzoek; save();
  res.json({ ok: true });
});

/* ---------- gasten + berichten: eigen modules op de context ----------
   Een oppas, opa/oma of familielid (gastprofiel) met een RTG-pas koppelt dit
   gezin in zijn eigen RTG-app (foundation/gasten.js); het chatten en
   (beeld)bellen tussen gezinsleden woont in foundation/berichten.js. De
   gedeelde gezins-helpers gaan hier op de context. */
Object.assign(ctx, { G, gezinVan, profielVan, familieVan, sessieVan,
  isGast, locatiePubliek, oppasinfoPubliek });
const { gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht,
  kanaalInfo, setPushHook, bezorgAanGasten, berichtVanGast } = require('./foundation/gasten')(ctx);
require('./foundation/berichten')(ctx);
/* ---------- sollicitaties + marktplaats: eigen modules op de context ----------
   De gezins-helpers gaan op de context; de submodules registreren hun routes
   op dezelfde router en geven hun publieke functies terug. */
Object.assign(ctx, { G, gezinVan, profielVan, familieVan, sessieVan,
  isGast, ensureCodenaam, rtfHandle, isBeschermd });
const { verifieerProfiel, bewaarSollicitatie, alGesolliciteerd } = require('./foundation/sollicitaties')(ctx);
const { setMarkt } = require('./foundation/markt')(ctx);

router.get('/health', (req, res) => res.json({ ok: true, lessen: Object.keys(F().lessen).length, gezinnen: Object.keys(G()).length, aanvragen: (F().reisAanvragen || []).length, ai: anthropic ? 'claude' : 'demo' }));

// RTF School (het schoolkanaal, "slimmer dan Magister"): aparte module op
// dezelfde router en dezelfde gezins-authenticatie. Zie server/school.js.
require('./school')({ router, F, G, save, rid, nu, schoon, gezinVan, profielVan, crypto });

/* De les-AI (onderwijs.js) gebruikt de buddy-keuze en leeftijdsinstructie van
   de gezinslaag; via de context, met late binding (pas per aanvraag gelezen). */
ctx.kiesBuddy = kiesBuddy;
ctx.leeftijdInstr = leeftijdInstr;

module.exports = { router, gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht, kanaalInfo, setPushHook, setMarkt, berichtVanGast, verifieerProfiel, bewaarSollicitatie, alGesolliciteerd, socialProfielen, profielInfoVanHandle, leeftijdInstr };
