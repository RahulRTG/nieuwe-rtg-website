/* RTFoundation-app: gratis, open onderwijs voor gezinnen met weinig geld.
   Een live digitaal schoolbord voor de docent/begeleider en een eigen "schrift"
   voor elke leerling (schrijven, tekenen, typen, bordfoto's, opgaven, agenda) met
   een AI-bijleshulp. Geen lidmaatschap of betaling nodig: je doet mee met een
   lescode. Draait als aparte Express-router mee op de RTG-server, met dezelfde
   database en failover.

   Alles staat onder db.data.foundation, zodat het meelift op het atomische
   wegschrijven en de dagelijkse back-up van de hoofdserver. */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db, save, DATA_DIR } = require('./db');

/* ---------- versleuteling van gevoelige gezinsdata ----------
   Locatie van kinderen, gezondheidsinfo (allergieen/medisch) en berichten liggen
   versleuteld op schijf (AES-256-GCM), zodat ze niet leesbaar zijn als het
   databasebestand ooit in verkeerde handen valt. De sleutel staat apart, buiten
   de database. Waarden krijgen een "enc:"-prefix; oude platte waarden blijven
   leesbaar (zachte migratie). */
function laadSleutel() {
  const f = path.join(DATA_DIR, 'foundation.key');
  try { if (fs.existsSync(f)) return fs.readFileSync(f); } catch (e) {}
  const k = crypto.randomBytes(32);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, k, { mode: 0o600 }); } catch (e) {}
  return k;
}
const SLEUTEL = laadSleutel();
function encS(text) {
  if (text == null || text === '') return text;
  try {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', SLEUTEL, iv);
    const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
    return 'enc:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
  } catch (e) { return text; }
}
function decS(blob) {
  if (typeof blob !== 'string' || !blob.startsWith('enc:')) return blob; // oude/onversleutelde waarde
  try {
    const buf = Buffer.from(blob.slice(4), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', SLEUTEL, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return ''; }
}

/* ---------- rate-limiting: bescherming tegen het raden van gezinscodes en pincodes ---------- */
const pogingen = new Map(); // bucket -> { n, until }
const GEEN_LIMIET = process.env.NODE_ENV === 'test'; // in de testsuite delen alle gezinnen een IP; daar geen limiet
function teVaak(res, bucket) {
  if (GEEN_LIMIET) return false;
  const f = pogingen.get(bucket);
  if (f && f.until > Date.now()) { res.status(429).json({ error: 'Te veel pogingen. Wacht een paar minuten en probeer het opnieuw.' }); return true; }
  return false;
}
function misluktePoging(bucket, max = 10, minuten = 5) {
  if (GEEN_LIMIET) return;
  const f = pogingen.get(bucket) || { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= max) { f.until = Date.now() + minuten * 60000; f.n = 0; }
  pogingen.set(bucket, f);
}
function goedePoging(bucket) { pogingen.delete(bucket); }
const ipVan = req => String((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'onbekend');

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  try { anthropic = new (require('@anthropic-ai/sdk'))({ apiKey: process.env.ANTHROPIC_API_KEY }); }
  catch (e) { /* zonder SDK: demo-antwoorden */ }
}

const router = express.Router();
router.use(express.json({ limit: '4mb' }));

function F() {
  if (!db.data.foundation) db.data.foundation = { lessen: {} };
  if (!db.data.foundation.lessen) db.data.foundation.lessen = {};
  return db.data.foundation;
}

/* ---------- helpers ---------- */
const nu = () => new Date().toISOString();
const rid = (n = 3) => crypto.randomBytes(n).toString('hex');
const schoon = (v, n = 200) => String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, n).trim();
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function nieuweCode() {
  let c; do { c = Array.from({ length: 6 }, () => LETTERS[crypto.randomInt(LETTERS.length)]).join(''); } while (F().lessen[c]);
  return c;
}

/* ---------- live (SSE) ---------- */
const sse = new Map(); // code -> Set van { res, role, studentId }
function stuur(code, event, data, filter) {
  const set = sse.get(code); if (!set) return;
  const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
  for (const c of set) if (!filter || filter(c)) { try { c.res.write(payload); } catch (e) {} }
}
function online(code) {
  const set = sse.get(code); const leerlingen = new Set(); let docent = false;
  if (set) for (const c of set) { if (c.role === 'docent') docent = true; else if (c.studentId) leerlingen.add(c.studentId); }
  return { docent, leerlingen: [...leerlingen] };
}
function presentie(code) {
  const les = F().lessen[code]; if (!les) return;
  const on = online(code);
  const lijst = Object.values(les.leerlingen).map(l => ({
    studentId: l.studentId, naam: l.naam, online: on.leerlingen.includes(l.studentId),
    ingeleverd: (les.opgaven || []).filter(o => (o.inzendingen || {})[l.studentId]).length
  }));
  stuur(code, 'presentie', { leerlingen: lijst }, c => c.role === 'docent');
}

/* ---------- les + rechten ---------- */
function lesVan(req, res) {
  const code = String((req.body && req.body.code) || req.params.code || '').toUpperCase();
  const les = F().lessen[code];
  if (!les) { res.status(404).json({ error: 'Deze lescode kennen we niet. Klopt hij?' }); return null; }
  return les;
}
function docentCheck(les, req, res) {
  const t = (req.body && req.body.token) || req.query.token;
  if (!t || t !== les.teacherToken) { res.status(403).json({ error: 'Alleen de begeleider kan dit doen.' }); return false; }
  return true;
}
function leerlingVan(les, req, res) {
  const t = (req.body && req.body.token) || req.query.token;
  const l = Object.values(les.leerlingen).find(x => x.token === t);
  if (!l) { res.status(403).json({ error: 'Doe eerst mee met de les.' }); return null; }
  return l;
}
function lesPubliek(les) {
  return { code: les.code, vak: les.vak, docentNaam: les.docentNaam,
    opgaven: (les.opgaven || []).map(o => ({ id: o.id, tekst: o.tekst, at: o.at })), agenda: les.agenda || [] };
}

/* ---------- les maken / meedoen ---------- */
router.post('/les/maak', (req, res) => {
  const code = nieuweCode();
  const les = { code, vak: schoon(req.body.vak, 40) || 'Les', docentNaam: schoon(req.body.naam, 40) || 'Begeleider',
    teacherToken: rid(24), bord: { strokes: [] }, leerlingen: {}, opgaven: [], agenda: [], at: nu() };
  F().lessen[code] = les; save();
  res.json({ code, token: les.teacherToken, les: lesPubliek(les) });
});
router.post('/les/join', (req, res) => {
  const les = lesVan(req, res); if (!les) return;
  const naam = schoon(req.body.naam, 40);
  if (!naam) return res.status(400).json({ error: 'Vul je naam in.' });
  let l = Object.values(les.leerlingen).find(x => x.naam.toLowerCase() === naam.toLowerCase());
  if (!l) { const sid = rid(4); l = { studentId: sid, naam, token: rid(24), schrift: { pages: [] }, at: nu() }; les.leerlingen[sid] = l; save(); }
  res.json({ token: l.token, studentId: l.studentId, naam: l.naam, les: lesPubliek(les), bord: les.bord.strokes, schrift: l.schrift });
  presentie(les.code);
});
router.get('/les/:code', (req, res) => {
  const les = F().lessen[String(req.params.code).toUpperCase()];
  if (!les) return res.status(404).json({ error: 'Onbekende les.' });
  res.json({ les: lesPubliek(les) });
});

/* ---------- live meekijken ---------- */
router.get('/les/:code/stream', (req, res) => {
  const les = F().lessen[String(req.params.code).toUpperCase()];
  if (!les) return res.status(404).end();
  const role = req.query.role === 'docent' ? 'docent' : 'leerling';
  if (role === 'docent' && req.query.token !== les.teacherToken) return res.status(403).end();
  let studentId = null;
  if (role === 'leerling') {
    const l = Object.values(les.leerlingen).find(x => x.token === req.query.token);
    if (!l) return res.status(403).end();
    studentId = l.studentId;
  }
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  const client = { res, role, studentId };
  let set = sse.get(les.code); if (!set) { set = new Set(); sse.set(les.code, set); }
  set.add(client);
  presentie(les.code);
  const hart = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
  req.on('close', () => { clearInterval(hart); set.delete(client); presentie(les.code); });
});

/* ---------- het bord ---------- */
router.post('/bord/stroke', (req, res) => {
  const les = lesVan(req, res); if (!les) return;
  if (!docentCheck(les, req, res)) return;
  const s = req.body.stroke;
  if (!s || !Array.isArray(s.points)) return res.status(400).json({ error: 'Geen geldige streek.' });
  const stroke = { id: rid(3),
    tool: ['pen', 'marker', 'gum'].includes(s.tool) ? s.tool : 'pen',
    kleur: /^#[0-9a-fA-F]{6}$/.test(s.kleur || '') ? s.kleur : '#ffffff',
    dikte: Math.min(60, Math.max(1, Number(s.dikte) || 3)),
    points: s.points.slice(0, 1500).map(p => [Math.round(Number(p[0]) || 0), Math.round(Number(p[1]) || 0)]) };
  les.bord.strokes.push(stroke);
  if (les.bord.strokes.length > 8000) les.bord.strokes.splice(0, les.bord.strokes.length - 8000);
  save();
  stuur(les.code, 'stroke', stroke, c => c.role === 'leerling');
  res.json({ ok: true, id: stroke.id });
});
router.post('/bord/wis', (req, res) => {
  const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
  les.bord.strokes = []; save(); stuur(les.code, 'wis', {}, c => c.role === 'leerling'); res.json({ ok: true });
});
router.post('/bord/undo', (req, res) => {
  const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
  les.bord.strokes.pop(); save(); stuur(les.code, 'bord', { strokes: les.bord.strokes }, c => c.role === 'leerling'); res.json({ ok: true });
});
router.get('/bord/:code', (req, res) => {
  const les = F().lessen[String(req.params.code).toUpperCase()];
  if (!les) return res.status(404).json({ error: 'Onbekende les.' });
  res.json({ strokes: les.bord.strokes });
});

/* ---------- het schrift ---------- */
router.post('/schrift/opslaan', (req, res) => {
  const les = lesVan(req, res); if (!les) return;
  const l = leerlingVan(les, req, res); if (!l) return;
  const pages = Array.isArray(req.body.pages) ? req.body.pages.slice(0, 60) : [];
  l.schrift.pages = pages.map(p => {
    if (p && p.type === 'tekst') return { type: 'tekst', titel: schoon(p.titel, 80), inhoud: schoon(p.inhoud, 20000) };
    if (p && p.type === 'foto' && typeof p.data === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(p.data) && p.data.length < 3e6)
      return { type: 'foto', titel: schoon(p.titel, 80), data: p.data };
    return { type: 'tekening', titel: schoon((p && p.titel) || '', 80), strokes: Array.isArray(p && p.strokes) ? p.strokes.slice(0, 6000) : [] };
  });
  l.schrift.updatedAt = nu(); save();
  res.json({ ok: true }); presentie(les.code);
});
router.get('/schrift/:code', (req, res) => {
  const les = F().lessen[String(req.params.code).toUpperCase()];
  if (!les) return res.status(404).json({ error: 'Onbekende les.' });
  const l = leerlingVan(les, req, res); if (!l) return;
  res.json({ schrift: l.schrift });
});
router.get('/schrift/:code/:studentId', (req, res) => {
  const les = F().lessen[String(req.params.code).toUpperCase()];
  if (!les) return res.status(404).json({ error: 'Onbekende les.' });
  if (!docentCheck(les, req, res)) return;
  const l = les.leerlingen[req.params.studentId];
  if (!l) return res.status(404).json({ error: 'Leerling niet gevonden.' });
  res.json({ naam: l.naam, schrift: l.schrift });
});

/* ---------- opgaven ---------- */
router.post('/opgave', (req, res) => {
  const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
  const tekst = schoon(req.body.tekst, 600);
  if (!tekst) return res.status(400).json({ error: 'Schrijf de opgave.' });
  const o = { id: rid(3), tekst, at: nu(), inzendingen: {} };
  les.opgaven.push(o); save();
  stuur(les.code, 'opgave', { id: o.id, tekst: o.tekst, at: o.at }, c => c.role === 'leerling');
  res.json({ ok: true, opgave: { id: o.id, tekst: o.tekst, at: o.at } });
});
router.post('/opgave/inleveren', (req, res) => {
  const les = lesVan(req, res); if (!les) return;
  const l = leerlingVan(les, req, res); if (!l) return;
  const o = (les.opgaven || []).find(x => x.id === req.body.opgaveId);
  if (!o) return res.status(404).json({ error: 'Opgave niet gevonden.' });
  o.inzendingen[l.studentId] = { naam: l.naam, antwoord: schoon(req.body.antwoord, 20000), at: nu() }; save();
  stuur(les.code, 'inzending', { opgaveId: o.id, studentId: l.studentId, naam: l.naam }, c => c.role === 'docent');
  presentie(les.code); res.json({ ok: true });
});
router.get('/opgaven/:code', (req, res) => {
  const les = F().lessen[String(req.params.code).toUpperCase()];
  if (!les) return res.status(404).json({ error: 'Onbekende les.' });
  if (!docentCheck(les, req, res)) return;
  res.json({ opgaven: les.opgaven });
});

/* ---------- agenda ---------- */
router.post('/agenda', (req, res) => {
  const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
  const item = { id: rid(3), tekst: schoon(req.body.tekst, 200), datum: schoon(req.body.datum, 20), at: nu() };
  if (!item.tekst) return res.status(400).json({ error: 'Vul het agendapunt in.' });
  les.agenda.unshift(item); les.agenda = les.agenda.slice(0, 60); save();
  stuur(les.code, 'agenda', { agenda: les.agenda }, c => c.role === 'leerling');
  res.json({ ok: true, agenda: les.agenda });
});
router.post('/agenda/verwijder', (req, res) => {
  const les = lesVan(req, res); if (!les) return; if (!docentCheck(les, req, res)) return;
  les.agenda = (les.agenda || []).filter(a => a.id !== req.body.itemId); save();
  stuur(les.code, 'agenda', { agenda: les.agenda }, c => c.role === 'leerling');
  res.json({ ok: true, agenda: les.agenda });
});

/* ---------- AI-bijles "Bram" + tips ---------- */
const SYSTEM = 'Je bent "Bram", een warme, geduldige bijleshulp voor kinderen en jongeren (10-16 jaar) in de gratis onderwijs-app van de RTFoundation. ' +
  'Veel van hen hebben thuis geen bijles of hulp; jij bent er wel. Help met begrijpen, niet met spieken: leg stap voor stap uit, geef een hint en een klein voorbeeld, ' +
  'en laat de leerling de laatste stap zelf zetten. Schrijf kort, bemoedigend en in eenvoudig Nederlands (max ~110 woorden). Nooit betuttelend, altijd hoopvol.';
const DEMO = [
  'Goeie vraag! Zet eerst op een rij wat je al weet. Welke stap snap je nog niet? Dan pakken we die er samen uit. Knip het probleem in kleine stukjes, dat maakt het makkelijker.',
  'Denk eerst: wat wordt gevraagd, en wat heb je nodig? Schrijf de gegevens op. Probeer daarna een voorbeeld met kleine getallen; werkt je aanpak daar, dan werkt hij meestal ook groot.',
  'Lees de vraag rustig nog een keer en streep de belangrijke woorden aan. Leg in je eigen woorden uit wat je moet doen. Lukt dat, dan is de helft al klaar. Je kunt dit!'
];
const TIPS = [
  'Neem elk uur 2 minuten pauze: opstaan, water drinken, even uit het raam kijken. Je onthoudt daarna beter.',
  'Leer in blokjes van 20 minuten. Eén blokje starten is veel makkelijker dan "alles" in één keer.',
  'Slaap is je geheime studietruc: uitgerust leer je sneller en beter.',
  'Fouten maken hoort erbij. Een fout laat precies zien wat je nog kunt leren, dat is goud waard.',
  'Vraag om hulp als je vastloopt. Dat is niet zwak, dat is slim. Bram staat altijd voor je klaar.',
  'Beweeg elke dag even, al is het maar een rondje lopen. Je hersenen werken beter na wat beweging.',
  'Zet je telefoon tijdens het leren in een andere kamer. Je concentreert je zo veel makkelijker.',
  'Vier je kleine successen. Een som af? Een bladzijde klaar? Dat mag je best even goed voelen.',
  'Adem rustig in door je neus en langzaam uit als je zenuwachtig bent. Drie keer helpt echt.',
  'Geld of spullen zeggen niets over hoe knap je bent. Doorzetten en oefenen brengen je verder dan wat dan ook.'
];
router.post('/ai', async (req, res) => {
  const les = lesVan(req, res); if (!les) return;
  const t = req.body.token;
  const magen = t === les.teacherToken || Object.values(les.leerlingen).some(x => x.token === t);
  if (!magen) return res.status(403).json({ error: 'Doe eerst mee met de les.' });
  const clean = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) })).slice(-10);
  while (clean.length && clean[0].role !== 'user') clean.shift();
  if (!clean.length) return res.json({ text: 'Stel je vraag maar, dan denk ik met je mee.' });
  if (!anthropic) return res.json({ text: DEMO[Math.floor(Math.random() * DEMO.length)], demo: true });
  try {
    const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 400, system: SYSTEM, messages: clean });
    res.json({ text: (r.content || []).map(b => b.text || '').join('').trim() || DEMO[0] });
  } catch (e) { res.json({ text: DEMO[Math.floor(Math.random() * DEMO.length)], demo: true }); }
});
router.get('/tip', (req, res) => {
  const dag = Math.floor(Date.now() / 86400000);
  res.json({ tip: TIPS[dag % TIPS.length], nog: TIPS[Math.floor(Math.random() * TIPS.length)] });
});

/* ---------- op reis met de foundation: aanvraag of voordracht ---------- */
router.post('/reis/aanvraag', (req, res) => {
  const a = {
    id: rid(4),
    soort: req.body.soort === 'voordracht' ? 'voordracht' : 'aanvraag',
    naam: schoon(req.body.naam, 60),
    contact: schoon(req.body.contact, 90),
    gezin: schoon(req.body.gezin, 300),
    waarom: schoon(req.body.waarom, 1500),
    at: nu(), status: 'nieuw'
  };
  if (!a.naam || !a.contact) return res.status(400).json({ error: 'Vul je naam in en hoe we contact kunnen opnemen (telefoon of e-mail).' });
  if (!a.waarom) return res.status(400).json({ error: 'Vertel kort waarom; dat helpt de foundation echt.' });
  if (!F().reisAanvragen) F().reisAanvragen = [];
  F().reisAanvragen.unshift(a);
  F().reisAanvragen = F().reisAanvragen.slice(0, 1000);
  save();
  res.json({ ok: true });
});

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
// een gast (oppas, opa/oma of familielid) helpt mee, maar mag niet bij de
// privezaken van het gezin (geld, mentale steun, dromen, cv, reisaanvraag).
const isGast = p => p && p.rol === 'gast';
const KLEUREN = ['#C9A24B', '#5FA56A', '#6AA6C9', '#B4574E', '#B07AC0', '#D08A3E'];
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(String(pin), salt, 32).toString('hex') };
}
function checkPin(rec, pin) {
  if (!rec || !rec.hash) return false;
  let h; try { h = crypto.scryptSync(String(pin), rec.salt, 32); } catch (e) { return false; }
  const b = Buffer.from(rec.hash, 'hex');
  return h.length === b.length && crypto.timingSafeEqual(h, b);
}
const geldigePin = p => /^\d{4,6}$/.test(String(p || ''));
function schoonAvatar(v) { const s = String(v == null ? '' : v).replace(/[<>]/g, '').trim(); return s ? Array.from(s).slice(0, 2).join('') : '🙂'; }
function schoonKleur(v) { return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : KLEUREN[0]; }

function pubProfiel(p) { return { id: p.id, naam: p.naam, rol: p.rol, avatar: p.avatar, kleur: p.kleur, heeftPin: !!(p.pin && p.pin.hash), beheerder: p.rol === 'beheerder', gast: p.rol === 'gast', gekoppeld: !!p.koppel }; }
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

router.post('/gezin/maak', (req, res) => {
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
    kleur: schoonKleur(req.body.kleur), pin: hashPin(req.body.pin), token: rid(24), at: nu() };
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

router.post('/gezin/profiel/kies', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = g.profielen[String(req.body.profielId || '')];
  if (!p) return res.status(404).json({ error: 'Dit profiel bestaat niet meer.' });
  const bucket = 'pin:' + g.code + ':' + p.id;
  if (p.pin && p.pin.hash) {
    if (teVaak(res, bucket)) return;
    if (!checkPin(p.pin, req.body.pin)) { misluktePoging(bucket, 6, 5); return res.status(403).json({ error: 'De pincode klopt niet.' }); }
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

router.post('/gezin/profiel/maak', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!beheerderVan(g, req, res)) return;
  const naam = schoon(req.body.naam, 40);
  if (!naam) return res.status(400).json({ error: 'Vul een naam in voor het nieuwe profiel.' });
  if (Object.keys(g.profielen).length >= 12) return res.status(400).json({ error: 'Een gezin kan tot 12 profielen hebben.' });
  const rol = ROLLEN.includes(req.body.rol) ? req.body.rol : 'kind';
  const p = { id: rid(4), naam, rol, avatar: schoonAvatar(req.body.avatar), kleur: schoonKleur(req.body.kleur), token: rid(24), at: nu() };
  if (req.body.pin) { if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Een pincode heeft 4 tot 6 cijfers, of laat hem leeg.' }); p.pin = hashPin(req.body.pin); }
  g.profielen[p.id] = p; save();
  res.json({ profiel: pubProfiel(p) });
});

router.post('/gezin/profiel/wijzig', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!beheerderVan(g, req, res)) return;
  const p = g.profielen[String(req.body.profielId || '')];
  if (!p) return res.status(404).json({ error: 'Profiel niet gevonden.' });
  if (typeof req.body.naam === 'string' && schoon(req.body.naam, 40)) p.naam = schoon(req.body.naam, 40);
  if (req.body.avatar != null) p.avatar = schoonAvatar(req.body.avatar);
  if (req.body.kleur != null) p.kleur = schoonKleur(req.body.kleur);
  if (ROLLEN.includes(req.body.rol)) {
    if (p.rol === 'beheerder' && req.body.rol !== 'beheerder' && Object.values(g.profielen).filter(x => x.rol === 'beheerder').length <= 1)
      return res.status(400).json({ error: 'Er moet altijd minstens een beheerder blijven.' });
    p.rol = req.body.rol;
  }
  if (req.body.pin === '') { delete p.pin; }
  else if (req.body.pin != null) { if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Een pincode heeft 4 tot 6 cijfers.' }); p.pin = hashPin(req.body.pin); }
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
  geld: 'Je bent "Meike", een warme, praktische geldmaatje in de gratis app van de RTFoundation, voor gezinnen in Nederland met weinig geld. ' +
    'Geef concrete, haalbare tips om rond te komen, te besparen en te sparen: goedkoop en gezond koken, energie besparen, tweedehands, en welke regelingen er zijn ' +
    '(zorgtoeslag, huurtoeslag, kindgebonden budget, energietoeslag, bijzondere bijstand via de gemeente, kwijtschelding gemeentebelasting, Stichting Leergeld, Jeugdfonds Sport & Cultuur). ' +
    'Zeg er altijd bij dat aanvragen gratis is en dat de gemeente of Belastingdienst helpt. Nooit oordelen, altijd bemoedigen. Kort, eenvoudig Nederlands, max ~120 woorden.',
  hulp: 'Je bent "Meike", een warme wegwijzer in de gratis app van de RTFoundation, voor gezinnen in Nederland die hulp zoeken. ' +
    'Wijs mensen vriendelijk de weg naar gratis hulp: eten (Voedselbank), kleding en spullen (Kledingbank, Stichting Leergeld voor schoolspullen en fiets), ' +
    'geld en schulden (gemeente, Schuldhulpmaatje, sociaal raadslieden), kinderen (Jeugdfonds Sport & Cultuur, Nationaal Fonds Kinderhulp, Leergeld), ' +
    'gezondheid en steun (huisarts, 113 Zelfmoordpreventie bij nood, MIND Korrelatie), leren en werk (Bibliotheek, gemeente, UWV). ' +
    'Vraag kort door wat iemand nodig heeft en noem 1 tot 3 concrete plekken. Nooit oordelen. Kort, eenvoudig Nederlands, max ~120 woorden.',
  opvoeden: 'Je bent "Nora", een warme, ervaren opvoedcoach in de gratis app van de RTFoundation, voor ouders en verzorgers, vaak met weinig geld en veel op hun bord. ' +
    'Help met alledaagse opvoedvragen: driftbuien, grenzen stellen, schermtijd, huiswerk en motivatie, ruzie tussen kinderen, slapen, en praten over gevoelens of pesten. ' +
    'Geef 1 tot 3 concrete, liefdevolle stappen die vandaag te doen zijn. Oordeel nooit over de ouder; benoem dat het zwaar kan zijn en dat om hulp vragen sterk is. ' +
    'Bij zorgen over veiligheid of geweld: wijs vriendelijk naar het Centrum voor Jeugd en Gezin, de huisarts of Veilig Thuis (0800-2000). Kort, eenvoudig Nederlands, max ~130 woorden.',
  steun: 'Je bent "Nora", een warm en rustig luisterend oor in de gratis app van de RTFoundation, voor ouders en verzorgers die het zwaar hebben. ' +
    'Je bent geen therapeut en stelt geen diagnose. Luister, erken het gevoel, en geef een of twee kleine, haalbare dingen die kunnen helpen (even ademen, iets voor jezelf, iemand bellen). ' +
    'Moedig aan om steun te zoeken bij de huisarts, MIND Korrelatie, of het eigen netwerk. Bij tekenen van crisis of gedachten aan zelfmoord: verwijs rustig en direct naar 113 (0800-0113, gratis, dag en nacht) of 112. ' +
    'Warm, zonder oordeel, max ~120 woorden.',
  studie: 'Je bent "Nora", een bemoedigende loopbaan- en studiecoach in de gratis app van de RTFoundation, voor volwassenen die verder willen leren, vaak met weinig geld. ' +
    'Denk mee over gratis en goedkope wegen: het Taalhuis en de Bibliotheek (taal, rekenen, digitale vaardigheden), gratis online cursussen, mbo in deeltijd, inburgering, een rijbewijs of vakdiploma via de gemeente of UWV, en omscholing. ' +
    'Koppel het aan hun droom en de cv-maker in deze app. Geef 1 tot 3 concrete stappen. Nooit oordelen, altijd hoopvol. Kort, eenvoudig Nederlands, max ~130 woorden.',
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
  pesten: 'Hoi, fijn dat je het durft te zeggen. Wat er ook gebeurt: het is niet jouw schuld. Vertel me maar wat er is, ik luister. En het is heel dapper en slim om het ook aan een volwassene te vertellen die je vertrouwt, zoals je vader, moeder, juf of meester. Je kunt ook gratis bellen met de Kindertelefoon: 0800-0432.'
};
const AI_KINDS = Object.keys(HULP_SYS);
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
    const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 420, system: HULP_SYS[kind], messages: clean });
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
function adultCheck(g, req, res) {
  const p = profielVan(g, req.body && req.body.token);
  if (!p || !['beheerder', 'ouder'].includes(p.rol)) { res.status(403).json({ error: 'Alleen een ouder of de beheerder kan dit doen.' }); return null; }
  if (p.pin && p.pin.hash && !checkPin(p.pin, req.body.pin)) { res.status(403).json({ error: 'De pincode klopt niet.' }); return null; }
  return p;
}
router.post('/gezin/wissen', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = adultCheck(g, req, res); if (!p) return;
  if (volwassenen(g).length <= 1) { delete G()[g.code]; save(); return res.json({ ok: true, verwijderd: true }); }
  g.wisVerzoek = { door: p.id, doorNaam: p.naam, at: nu() }; save();
  res.json({ ok: true, wachtOpToestemming: true });
});
router.post('/gezin/wissen/bevestig', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!g.wisVerzoek) return res.status(400).json({ error: 'Er is geen verzoek om te verwijderen.' });
  const p = adultCheck(g, req, res); if (!p) return;
  if (g.wisVerzoek.door === p.id) return res.status(403).json({ error: 'De tweede volwassene moet toestemming geven, niet degene die het verzoek deed.' });
  delete G()[g.code]; save();
  res.json({ ok: true, verwijderd: true });
});
router.post('/gezin/wissen/intrekken', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = adultCheck(g, req, res); if (!p) return;
  delete g.wisVerzoek; save();
  res.json({ ok: true });
});

/* Een oppas, opa/oma of familielid (gastprofiel) met een RTG-, Lifestyle- of
   Business Pass kan dit gezin in zijn eigen RTG-app koppelen. Vanaf dan komen de
   meldingen voor dat gastprofiel ook binnen in de RTG-app, zodat hij deze app
   niet hoeft te installeren. Het koppelen zelf gebeurt in de RTG-app (die de
   eigenaar via zijn account bewijst); deze functies worden daarvandaan gebruikt.
   We bewaren alleen het account-id, het pasniveau en de codenaam. */
const TIERNAAM = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };
function gastProfielen(code) {
  const g = G()[String(code || '').toUpperCase()];
  if (!g) return null;
  return { gezinNaam: g.naam, profielen: Object.values(g.profielen).filter(p => p.rol === 'gast').map(p => ({ id: p.id, naam: p.naam, avatar: p.avatar, kleur: p.kleur, gekoppeld: !!p.koppel })) };
}
function linkGast({ code, profielId, userId, tier, codenaam }) {
  const g = G()[String(code || '').toUpperCase()];
  if (!g) return { error: 'Dit gezin kennen we niet. Klopt de gezinscode?', status: 404 };
  const p = g.profielen[String(profielId || '')];
  if (!p) return { error: 'Dit profiel bestaat niet meer.', status: 404 };
  if (p.rol !== 'gast') return { error: 'Alleen een oppas- of familieprofiel kan aan een RTG-pas gekoppeld worden.', status: 403 };
  p.koppel = { userId, tier, tierNaam: TIERNAAM[tier] || 'RTG Pass', codenaam: codenaam || 'lid', at: nu() };
  save();
  return { ok: true, gezinNaam: g.naam, profielNaam: p.naam, tierNaam: p.koppel.tierNaam };
}
function unlinkGast({ userId, code, profielId }) {
  let n = 0;
  for (const g of Object.values(G())) for (const p of Object.values(g.profielen || {})) {
    if (p.koppel && p.koppel.userId === userId && (!code || g.code === String(code).toUpperCase()) && (!profielId || p.id === profielId)) { delete p.koppel; n++; }
  }
  if (n) save();
  return { ok: true, verwijderd: n };
}
function gekoppeldeGezinnen(userId) {
  const uit = [];
  for (const g of Object.values(G())) for (const p of Object.values(g.profielen || {})) {
    if (p.koppel && p.koppel.userId === userId) uit.push({ code: g.code, gezinNaam: g.naam, profielId: p.id, profielNaam: p.naam });
  }
  return uit;
}
// bezorg een gezinsmelding ook in de RTG-app van gekoppelde gasten
function bezorgAanGasten(g, bericht) {
  let accounts; try { accounts = require('./accounts'); } catch (e) { return; }
  const ontvangers = Object.values(g.profielen).filter(p => p.rol === 'gast' && p.koppel && p.koppel.userId && (bericht.naar === 'allen' || bericht.naar === p.id));
  for (const p of ontvangers) {
    try {
      const md = accounts.getMemberState(p.koppel.userId) || {};
      if (!Array.isArray(md.foundationMeldingen)) md.foundationMeldingen = [];
      md.foundationMeldingen.unshift({ id: rid(4), at: nu(), gezin: g.naam, profielNaam: p.naam, van: bericht.vanNaam, tekst: decS(bericht.tekst), soort: bericht.soort, gelezen: false });
      md.foundationMeldingen = md.foundationMeldingen.slice(0, 40);
      accounts.saveMemberState(p.koppel.userId, md);
    } catch (e) { /* een gekoppelde gast minder bereikt: niet fataal */ }
  }
}

/* gezinsagenda: samen plannen. Het gezin voegt toe; iedereen (ook de oppas) mag
   de planning zien, zodat een oppas weet wat er die dag speelt. */
router.post('/gezin/agenda', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const titel = schoon(req.body.titel, 80);
  if (!titel) return res.status(400).json({ error: 'Waar gaat het agendapunt over?' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.datum || '')) return res.status(400).json({ error: 'Kies een datum.' });
  const tijd = /^\d{2}:\d{2}$/.test(req.body.tijd || '') ? req.body.tijd : '';
  const wie = req.body.wie && s.g.profielen[req.body.wie] ? req.body.wie : '';
  if (!s.g.agenda) s.g.agenda = [];
  if (s.g.agenda.length >= 200) return res.status(400).json({ error: 'De agenda is vol. Haal eerst iets weg.' });
  const item = { id: rid(3), titel, datum: req.body.datum, tijd, wie, door: s.p.id, at: nu() };
  s.g.agenda.push(item); save();
  res.json({ ok: true, item });
});
router.post('/gezin/agenda/verwijder', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  s.g.agenda = (s.g.agenda || []).filter(a => a.id !== req.body.itemId); save();
  res.json({ ok: true });
});
router.get('/gezin/:code/agenda', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  const vandaag = new Date().toISOString().slice(0, 10);
  const items = (s.g.agenda || [])
    .map(a => ({ id: a.id, titel: a.titel, datum: a.datum, tijd: a.tijd, wie: a.wie, wieNaam: a.wie && s.g.profielen[a.wie] ? s.g.profielen[a.wie].naam : '', voorbij: a.datum < vandaag, vandaag: a.datum === vandaag }))
    .sort((a, b) => (a.datum + (a.tijd || '99:99')).localeCompare(b.datum + (b.tijd || '99:99')));
  res.json({ agenda: items, magBewerken: !isGast(s.p) });
});

/* klusjes en sterren: kinderen verdienen sterren met klusjes. Een ouder zet ze
   klaar en keurt ze goed; zo leren kinderen verantwoordelijkheid en groeit hun
   sterrensaldo (dat mooi aansluit op het spaarpotje). */
function magKlus(s) { return ['beheerder', 'ouder'].includes(s.p.rol); }
router.post('/gezin/klus', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan klusjes klaarzetten.' });
  const titel = schoon(req.body.titel, 80);
  if (!titel) return res.status(400).json({ error: 'Wat is het klusje?' });
  const sterren = Math.max(1, Math.min(20, Math.round(Number(req.body.sterren) || 1)));
  const voor = req.body.voor && s.g.profielen[req.body.voor] ? req.body.voor : 'iedereen';
  if (!s.g.klussen) s.g.klussen = [];
  if (s.g.klussen.length >= 100) return res.status(400).json({ error: 'Er staan al veel klusjes. Rond er eerst een paar af.' });
  const k = { id: rid(3), titel, sterren, voor, status: 'open', doorPid: '', at: nu() };
  s.g.klussen.unshift(k); save();
  res.json({ ok: true, klus: k });
});
router.post('/gezin/klus/gedaan', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  if (isGast(s.p)) return res.status(403).json({ error: 'Een oppas kan geen klusjes afvinken.' });
  const k = (s.g.klussen || []).find(x => x.id === req.body.klusId);
  if (!k) return res.status(404).json({ error: 'Klusje niet gevonden.' });
  if (k.voor !== 'iedereen' && k.voor !== s.p.id) return res.status(403).json({ error: 'Dit klusje is voor iemand anders.' });
  if (k.status === 'goedgekeurd') return res.status(400).json({ error: 'Dit klusje is al afgerond.' });
  k.status = 'gedaan'; k.doorPid = s.p.id; save();
  res.json({ ok: true });
});
router.post('/gezin/klus/keur', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan een klusje goedkeuren.' });
  const k = (s.g.klussen || []).find(x => x.id === req.body.klusId);
  if (!k) return res.status(404).json({ error: 'Klusje niet gevonden.' });
  if (k.status !== 'gedaan') return res.status(400).json({ error: 'Dit klusje is nog niet gedaan.' });
  if (req.body.goed === false) { k.status = 'open'; k.doorPid = ''; }
  else { k.status = 'goedgekeurd'; if (!s.g.sterren) s.g.sterren = {}; s.g.sterren[k.doorPid] = (s.g.sterren[k.doorPid] || 0) + k.sterren; }
  save();
  res.json({ ok: true });
});
router.post('/gezin/klus/verwijder', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan dit.' });
  s.g.klussen = (s.g.klussen || []).filter(x => x.id !== req.body.klusId); save();
  res.json({ ok: true });
});
router.get('/gezin/:code/klussen', (req, res) => {
  const s = familieVan(req, res); if (!s) return;
  const naamVan = pid => (s.g.profielen[pid] ? s.g.profielen[pid].naam : '');
  const klussen = (s.g.klussen || []).map(k => ({ id: k.id, titel: k.titel, sterren: k.sterren, voor: k.voor, voorNaam: k.voor === 'iedereen' ? 'iedereen' : naamVan(k.voor), status: k.status, door: k.doorPid ? naamVan(k.doorPid) : '', vanMij: k.doorPid === s.p.id }));
  const sterren = Object.entries(s.g.sterren || {}).filter(([pid]) => s.g.profielen[pid])
    .map(([pid, n]) => ({ pid, naam: s.g.profielen[pid].naam, avatar: s.g.profielen[pid].avatar, kleur: s.g.profielen[pid].kleur, sterren: n }))
    .sort((a, b) => b.sterren - a.sterren);
  res.json({ klussen, sterren, magBeheren: magKlus(s), mijnId: s.p.id });
});

router.get('/health', (req, res) => res.json({ ok: true, lessen: Object.keys(F().lessen).length, gezinnen: Object.keys(G()).length, aanvragen: (F().reisAanvragen || []).length, ai: anthropic ? 'claude' : 'demo' }));

module.exports = { router, gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen };
