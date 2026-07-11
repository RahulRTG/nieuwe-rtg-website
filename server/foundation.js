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
const { db, save } = require('./db');

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

router.get('/health', (req, res) => res.json({ ok: true, lessen: Object.keys(F().lessen).length, ai: anthropic ? 'claude' : 'demo' }));

module.exports = { router };
