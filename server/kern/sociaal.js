/* Kern-module "sociaal": de gedeelde vriendenlaag over RTG en RTFoundation,
   plus de veiligheidslaag (blokkeren, melden, snelheidslimiet, ouder-meekijk) en
   de snaps/verhalen. Losgetrokken uit server.js zodat dit cohesieve stuk apart
   te lezen en te testen is. Krijgt de gedeelde kern-onderdelen mee en praat
   nergens rechtstreeks met de buitenwereld. */
module.exports = (core) => {
  const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media } = core;

function dmSleutel(a, b) { return [a, b].sort().join('|'); }
function connectieTussen(a, b) {
  return db.data.connections.find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
}

const isRtf = h => typeof h === 'string' && h.startsWith('rtf:');
function codeExists(handle) { return isRtf(handle) ? !!rtf.profielInfoVanHandle(handle) : !!gidsHaal(handle); }
function codenaamVan(handle) {
  if (isRtf(handle)) { const i = rtf.profielInfoVanHandle(handle); return i ? i.codenaam : handle; }
  return (gidsHaal(handle) || {}).codename || handle;
}
function soortVan(handle) { return isRtf(handle) ? 'rtf' : ((gidsHaal(handle) || {}).tier || 'rtg'); }
function isKindHandle(handle) { if (isRtf(handle)) { const i = rtf.profielInfoVanHandle(handle); return !!(i && i.kind); } return false; }
/* Beschermd (15 of jonger, of rol kind): de open vriendenlaag is dicht. Zo'n
   profiel is onvindbaar in het zoeken, kan zelf geen verzoeken sturen en kan
   door vreemden niet benaderd worden; alleen een ouder/verzorger voegt
   contacten toe (ouderVerbind). RTG-leden zijn 15+, dus dit raakt alleen RTF. */
function isBeschermdHandle(handle) { if (isRtf(handle)) { const i = rtf.profielInfoVanHandle(handle); return !!(i && i.beschermd); } return false; }
function verbActief(c) { return !!(c && c.status === 'accepted' && (!c.voogdWacht || c.voogdWacht.length === 0)); }

/* ---------- sociale veiligheid: blokkeren, melden, snelheidslimiet ----------
   Blokkeren werkt beide kanten op: geen verzoek, chat, snap of belsignaal meer.
   De snelheidslimiet remt spam en pesten (te veel verzoeken/berichten/snaps).
   Een melding komt in db.data.reports terecht voor de backoffice. */
const isGeblokkeerd = (a, b) => db.data.blocks.some(x => (x.door === a && x.doel === b) || (x.door === b && x.doel === a));
function blokkeer(mij, doel) {
  if (!mij || !doel || mij === doel) return { status: 400, error: 'Ongeldig.' };
  if (!db.data.blocks.some(x => x.door === mij && x.doel === doel)) db.data.blocks.push({ door: mij, doel, at: new Date().toISOString() });
  // bestaande vriendschap of openstaand verzoek meteen weg
  db.data.connections = db.data.connections.filter(c => !((c.a === mij && c.b === doel) || (c.a === doel && c.b === mij)));
  save();
  return { status: 200, ok: true };
}
function deblokkeer(mij, doel) { db.data.blocks = db.data.blocks.filter(x => !(x.door === mij && x.doel === doel)); save(); return { status: 200, ok: true }; }
function meldMisbruik(mij, doel, reden) {
  if (!doel) return { status: 400, error: 'Wie wil je melden?' };
  db.data.reports.push({ door: mij, doel, codenaamDoel: codenaamVan(doel), reden: String(reden || '').replace(/[<>]/g, '').slice(0, 300), at: new Date().toISOString() });
  db.data.reports = db.data.reports.slice(-5000);
  save();
  return { status: 200, ok: true };
}
const sociaalTellers = new Map(); // actie:handle -> { n, reset }
function sociaalRate(mij, actie, max, perMs) {
  const k = actie + ':' + mij, nu = Date.now();
  // begrens de geheugengroei: ruim af en toe verlopen tellers op
  if (sociaalTellers.size > 5000) for (const [kk, tt] of sociaalTellers) if (tt.reset < nu) sociaalTellers.delete(kk);
  let t = sociaalTellers.get(k);
  if (!t || t.reset < nu) { t = { n: 0, reset: nu + perMs }; sociaalTellers.set(k, t); }
  t.n++;
  return t.n <= max;
}
// ouder-meekijk: de contacten van een kind, en het recht om er een te verwijderen
function kindContacten(gezinCode, kidHandle) {
  const okKid = rtf.socialProfielen().some(sp => sp.handle === kidHandle && sp.gezinCode === gezinCode && sp.beschermd);
  if (!okKid) return { status: 403, error: 'Dit is geen kind van jouw gezin.' };
  const contacten = db.data.connections.filter(c => c.a === kidHandle || c.b === kidHandle).map(c => {
    const ander = c.a === kidHandle ? c.b : c.a;
    return { key: ander, codename: codenaamVan(ander), soort: soortVan(ander), volwassene: !isKindHandle(ander), status: verbActief(c) ? 'vriend' : (c.voogdWacht && c.voogdWacht.length ? 'wacht-op-ouder' : 'aangevraagd') };
  });
  return { status: 200, contacten };
}
function kindVerwijder(gezinCode, kidHandle, anderHandle) {
  const okKid = rtf.socialProfielen().some(sp => sp.handle === kidHandle && sp.gezinCode === gezinCode && sp.beschermd);
  if (!okKid) return { status: 403, error: 'Dit is geen kind van jouw gezin.' };
  db.data.connections = db.data.connections.filter(c => !((c.a === kidHandle && c.b === anderHandle) || (c.a === anderHandle && c.b === kidHandle)));
  save();
  return { status: 200, ok: true };
}
function statusVan(mij, c) {
  if (!c) return 'geen';
  if (verbActief(c)) return 'verbonden';
  if (c.voogdWacht && c.voogdWacht.length) return 'wacht-op-ouder';
  return c.requestedBy === mij ? 'aangevraagd' : 'wacht-op-u';
}
// zoek op codenaam over beide werelden
async function socialZoek(mij, q) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const seen = new Set([mij]);
  const uit = [];
  // leden op codenaam: geindexeerd via de ledengids (met Postgres), anders een
  // scan. We nemen codenaam en pas rechtstreeks uit de treffer (geen tweede
  // opzoeking, dus geen cache-miss die de sleutel als codenaam zou tonen).
  for (const m of await gidsZoekCodenaam(q, false)) {
    if (seen.has(m.key)) continue; seen.add(m.key);
    uit.push({ key: m.key, codename: m.codename, tier: m.tier, status: statusVan(mij, connectieTussen(mij, m.key)) });
  }
  // beschermde profielen (15 of jonger) zijn onvindbaar: niemand kan ze opzoeken
  for (const sp of rtf.socialProfielen()) {
    if (!sp.beschermd && !seen.has(sp.handle) && sp.codenaam.toLowerCase().includes(q)) {
      seen.add(sp.handle);
      uit.push({ key: sp.handle, codename: codenaamVan(sp.handle), tier: soortVan(sp.handle), status: statusVan(mij, connectieTussen(mij, sp.handle)) });
    }
  }
  return uit.slice(0, 10);
}
/* vriendschapsverzoek van 'mij' naar 'naar'. doorOuder=true betekent: een
   ouder/verzorger doet dit namens zijn beschermde kind (via ouderVerbind); dan
   geldt de ouder-goedkeuring voor de kant van dit kind als al gegeven. */
function socialVerbind(mij, naar, doorOuder) {
  if (naar === mij) return { status: 400, error: 'Dat ben je zelf.' };
  if (!codeExists(naar)) return { status: 404, error: 'Deze codenaam kennen we niet.' };
  // beschermd profiel (15 of jonger): kan zelf geen verzoeken sturen...
  if (!doorOuder && isBeschermdHandle(mij)) return { status: 403, error: 'Je ouder of verzorger voegt vrienden voor je toe.' };
  // ...en is voor anderen onbenaderbaar (404: we verklappen niet dat het bestaat)
  if (!doorOuder && isBeschermdHandle(naar)) return { status: 404, error: 'Deze codenaam kennen we niet.' };
  if (isGeblokkeerd(mij, naar)) return { status: 403, error: 'Verbinden met deze codenaam kan niet.' };
  if (!sociaalRate(mij, 'verbind', 30, 60 * 60 * 1000)) return { status: 429, error: 'Te veel vriendschapsverzoeken. Probeer het later opnieuw.' };
  let c = connectieTussen(mij, naar);
  if (c && verbActief(c)) return { status: 200, ok: true, st: 'verbonden' };
  if (c) return { status: 200, ok: true, st: statusVan(mij, c) };
  const voogdWacht = [];
  // de ouder-goedkeuring van de eigen kant is bij doorOuder al gegeven
  if (!doorOuder && isBeschermdHandle(mij)) voogdWacht.push(mij);
  // is de ANDER ook een beschermd kind (kan alleen via doorOuder), dan moet
  // diens eigen ouder nog akkoord geven
  if (isBeschermdHandle(naar)) voogdWacht.push(naar);
  c = { a: mij, b: naar, requestedBy: mij, status: 'pending', at: new Date().toISOString(), voogdWacht };
  db.data.connections.push(c); save();
  sseToCustomer(naar, 'social', { kind: 'request', from: codenaamVan(mij) });
  return { status: 200, ok: true, st: voogdWacht.length ? 'wacht-op-ouder' : 'aangevraagd' };
}
/* Een ouder/verzorger voegt een contact toe voor zijn beschermde kind: het enige
   kanaal waarlangs een beschermd profiel nieuwe vrienden krijgt. De andere kant
   moet nog wel zelf accepteren (of, als die ook beschermd is, diens ouder). */
async function ouderVerbind(gezinCode, kidHandle, doel) {
  const sp = rtf.socialProfielen().find(x => x.handle === kidHandle && x.gezinCode === gezinCode);
  if (!sp) return { status: 403, error: 'Dit is geen profiel van jouw gezin.' };
  // doel mag een handle zijn of een exacte codenaam (zo typt een ouder gewoon de codenaam over)
  let naar = String(doel || '').trim();
  if (!codeExists(naar)) {
    const q = naar.toLowerCase();
    const kandidaten = [];
    for (const m of await gidsZoekCodenaam(q, true)) kandidaten.push(m.key);
    // exacte codenaam mag ook een beschermd profiel zijn: twee gezinnen kunnen zo
    // hun kinderen verbinden (codenaam offline uitgewisseld), en de ouder van het
    // andere kind moet daarna alsnog akkoord geven (voogdWacht).
    for (const p of rtf.socialProfielen()) if (p.codenaam.toLowerCase() === q) kandidaten.push(p.handle);
    if (kandidaten.length !== 1) return { status: 404, error: 'Geen (eenduidige) codenaam gevonden. Typ de volledige codenaam over.' };
    naar = kandidaten[0];
  }
  // ook een ouder kan zijn kind niet met een ander beschermd kind verbinden
  // zonder dat DIENS ouder akkoord geeft; dat regelt voogdWacht hieronder.
  return socialVerbind(kidHandle, naar, true);
}
// verzoek beantwoorden (accepteren/afwijzen); een kind kan niet zelf accepteren
function socialAntwoord(mij, ander, action) {
  const c = connectieTussen(mij, ander);
  if (!c || c.status !== 'pending' || c.requestedBy === mij) return { status: 404, error: 'Geen openstaand verzoek van deze codenaam.' };
  if (isBeschermdHandle(mij)) return { status: 403, error: 'Een ouder moet dit verzoek eerst goedkeuren.' };
  if (action === 'accept') {
    c.status = 'accepted'; c.acceptedAt = new Date().toISOString(); save();
    sseToCustomer(ander, 'social', { kind: 'accepted', by: codenaamVan(mij) });
    return { status: 200, ok: true, st: verbActief(c) ? 'verbonden' : 'wacht-op-ouder' };
  }
  db.data.connections = db.data.connections.filter(x => x !== c); save();
  return { status: 200, ok: true, st: 'geen' };
}
// mijn vrienden + openstaande verzoeken
function socialConnecties(mij) {
  const conns = db.data.connections.filter(c => (c.a === mij || c.b === mij) && verbActief(c)).map(c => {
    const ander = c.a === mij ? c.b : c.a;
    const chat = db.data.memberChats[dmSleutel(mij, ander)];
    const laatst = chat && chat.messages.length ? chat.messages[chat.messages.length - 1] : null;
    const gelezen = chat && chat.read && chat.read[mij] ? chat.read[mij] : '';
    const unread = chat ? chat.messages.filter(m => m.from !== mij && m.at > gelezen).length : 0;
    return { key: ander, codename: codenaamVan(ander), tier: soortVan(ander), unread, last: laatst ? (laatst.post ? '↗ post' : String(laatst.text || '').slice(0, 48)) : null, lastAt: laatst ? laatst.at : c.acceptedAt, vuurtje: streakVan(mij, ander) };
  }).sort((x, y) => String(y.lastAt).localeCompare(String(x.lastAt)));
  const requests = db.data.connections.filter(c => (c.a === mij || c.b === mij) && c.status === 'pending' && c.requestedBy !== mij && !isBeschermdHandle(mij)).map(c => ({ key: c.requestedBy, codename: codenaamVan(c.requestedBy), at: c.at }));
  return { connections: conns, requests };
}
// DM lezen/sturen (werkt over beide werelden zolang de vriendschap actief is)
function socialDm(mij, ander) {
  if (!verbActief(connectieTussen(mij, ander))) return { status: 403, error: 'Je bent nog niet verbonden met deze codenaam.' };
  const k = dmSleutel(mij, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  chat.read[mij] = new Date().toISOString(); save();
  return { status: 200, messages: chat.messages.slice(-80), codename: codenaamVan(ander) };
}
function socialDmSend(mij, ander, text) {
  if (isGeblokkeerd(mij, ander)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
  if (!verbActief(connectieTussen(mij, ander))) return { status: 403, error: 'Je bent nog niet verbonden met deze codenaam.' };
  if (!sociaalRate(mij, 'dm', 60, 60 * 1000)) return { status: 429, error: 'Rustig aan met berichten sturen.' };
  text = String(text || '').replace(/[<>]/g, '').slice(0, 500).trim();
  if (!text) return { status: 400, error: 'Leeg bericht.' };
  const k = dmSleutel(mij, ander);
  const chat = db.data.memberChats[k] = db.data.memberChats[k] || { messages: [], read: {} };
  chat.messages.push({ from: mij, text, at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-200); save();
  sseToCustomer(ander, 'social', { kind: 'dm', from: mij, codename: codenaamVan(mij), text });
  return { status: 200, ok: true, messages: chat.messages.slice(-80) };
}
const zijnVrienden = (a, b) => verbActief(connectieTussen(a, b));
// vriendschapsverzoeken van kinderen van dit gezin die op ouderakkoord wachten
function socialTeKeuren(gezinCode) {
  const kids = new Set(rtf.socialProfielen().filter(sp => sp.gezinCode === gezinCode && sp.beschermd).map(sp => sp.handle));
  return db.data.connections.filter(c => c.status === 'pending' && c.voogdWacht && c.voogdWacht.some(h => kids.has(h))).map(c => {
    const kid = c.voogdWacht.find(h => kids.has(h));
    const ander = c.a === kid ? c.b : c.a;
    return { kindHandle: kid, kind: codenaamVan(kid), anderKey: ander, ander: codenaamVan(ander), anderSoort: soortVan(ander), volwassene: !isKindHandle(ander), richting: c.requestedBy === kid ? 'uit' : 'in', at: c.at };
  });
}
function socialGoedkeur(gezinCode, kidHandle, anderHandle, akkoord) {
  const okKid = rtf.socialProfielen().some(sp => sp.handle === kidHandle && sp.gezinCode === gezinCode && sp.beschermd);
  if (!okKid) return { status: 403, error: 'Dit is geen kind van jouw gezin.' };
  const c = connectieTussen(kidHandle, anderHandle);
  if (!c || c.status !== 'pending') return { status: 404, error: 'Verzoek niet gevonden.' };
  if (!akkoord) { db.data.connections = db.data.connections.filter(x => x !== c); save(); return { status: 200, ok: true, st: 'afgewezen' }; }
  c.voogdWacht = (c.voogdWacht || []).filter(h => h !== kidHandle);
  // als het kind de ontvanger is, geldt het ouderakkoord ook als accepteren
  if (c.requestedBy !== kidHandle && c.status === 'pending') { c.status = 'accepted'; c.acceptedAt = new Date().toISOString(); }
  save();
  return { status: 200, ok: true, st: verbActief(c) ? 'verbonden' : 'wacht' };
}

/* ---------- snaps en 24-uurs verhalen (Snapchat-achtig) ----------
   Een snap is een foto die je naar een vriend stuurt; die kan hem een keer
   bekijken en dan is hij weg. Een verhaal (story) is 24 uur zichtbaar voor al je
   vrienden. De foto's staan NIET als base64 in db.data maar als (versleutelde)
   bestanden in de mediastore; in db.data blijft alleen een verwijzing (s.foto).
   Zo groeit het werkgeheugen en elke db-snapshot niet mee met de foto's, en blijft
   de kijk-een-keer-belofte hard: bij het openen leest de server het bestand,
   geeft het eenmalig terug en gooit het weg. */
const SNAP_TTL = 24 * 60 * 60 * 1000;   // een niet-bekeken snap verloopt na 24 uur
const STORY_TTL = 24 * 60 * 60 * 1000;
function geldigeFoto(s) { return typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length <= 900 * 1024; }
// De foto-verwijzing van een snap/verhaal wissen (het bestand op schijf weg).
function wisFoto(item) { if (item && item.foto && media) media.verwijder(item.foto); }
function opschonenSnaps() {
  const nu = Date.now();
  const voor = db.data.snaps.length + db.data.stories.length;
  const dodeSnaps = db.data.snaps.filter(s => s.bekeken || (nu - new Date(s.at).getTime()) >= SNAP_TTL);
  const dodeStories = db.data.stories.filter(s => (nu - new Date(s.at).getTime()) >= STORY_TTL);
  dodeSnaps.forEach(wisFoto); dodeStories.forEach(wisFoto);   // ook de bestanden opruimen
  db.data.snaps = db.data.snaps.filter(s => !s.bekeken && (nu - new Date(s.at).getTime()) < SNAP_TTL);
  db.data.stories = db.data.stories.filter(s => (nu - new Date(s.at).getTime()) < STORY_TTL);
  if (voor !== db.data.snaps.length + db.data.stories.length) save();
}
/* ---------- vuurtjes: de snap-streak per vriendenpaar ----------
   Snappen jullie allebei op dezelfde dag, dan telt die dag; elke
   aaneengesloten dag groeit het vuurtje. Een dag missen dooft het. */
function streaks() { if (!db.data.streaks) db.data.streaks = {}; return db.data.streaks; }
const streakSleutel = (a, b) => [a, b].sort().join('|');
const dagVan = (t) => new Date(t || Date.now()).toISOString().slice(0, 10);
function streakBijwerken(van, naar) {
  const st = streaks();
  const s = st[streakSleutel(van, naar)] || (st[streakSleutel(van, naar)] = { count: 0, laatste: null, dag: null, kanten: [] });
  const vandaag = dagVan();
  if (s.dag !== vandaag) { s.dag = vandaag; s.kanten = []; }
  if (!s.kanten.includes(van)) s.kanten.push(van);
  if (s.kanten.length === 2 && s.laatste !== vandaag) {
    s.count = (s.laatste === dagVan(Date.now() - 86400000)) ? s.count + 1 : 1;
    s.laatste = vandaag;
  }
}
function streakVan(a, b) {
  const s = streaks()[streakSleutel(a, b)];
  if (!s || !s.laatste) return 0;
  // na een gemiste dag is het vuurtje gedoofd
  return (s.laatste === dagVan() || s.laatste === dagVan(Date.now() - 86400000)) ? s.count : 0;
}

/* ---------- de dag-opdracht: elke dag een snap-uitdaging voor iedereen ---------- */
const OPDRACHTEN = [
  { emoji: '💛', tekst: 'iets geels' }, { emoji: '🌅', tekst: 'je uitzicht van nu' },
  { emoji: '🍳', tekst: 'je ontbijt of lunch' }, { emoji: '👟', tekst: 'je schoenen van vandaag' },
  { emoji: '🌿', tekst: 'iets dat groeit' }, { emoji: '📚', tekst: 'wat je aan het leren bent' },
  { emoji: '😄', tekst: 'iets dat je aan het lachen maakte' }, { emoji: '🎨', tekst: 'de mooiste kleur om je heen' },
  { emoji: '💧', tekst: 'iets met water' }, { emoji: '🐾', tekst: 'een dier (of iets dat erop lijkt)' },
  { emoji: '🔺', tekst: 'een driehoek in het wild' }, { emoji: '☁️', tekst: 'de lucht van dit moment' },
  { emoji: '🤝', tekst: 'iets dat je samen doet' }, { emoji: '🏠', tekst: 'je favoriete plek thuis' },
  { emoji: '🎵', tekst: 'waar jij muziek van krijgt' }, { emoji: '🧦', tekst: 'de gekste sok die je vindt' },
  { emoji: '🌳', tekst: 'de oudste boom die je ziet' }, { emoji: '✍️', tekst: 'je eigen handschrift' },
  { emoji: '🪞', tekst: 'een spiegelbeeld (niet van jezelf)' }, { emoji: '🍎', tekst: 'iets gezonds' },
  { emoji: '🔤', tekst: 'de eerste letter van je naam, ergens gevonden' }, { emoji: '🌙', tekst: 'iets dat bij de avond hoort' },
  { emoji: '🧩', tekst: 'iets dat precies past' }, { emoji: '🚲', tekst: 'iets met wielen' },
  { emoji: '🌈', tekst: 'drie kleuren in een beeld' }, { emoji: '⏰', tekst: 'hoe laat het is, zonder klok' },
  { emoji: '🫶', tekst: 'iets waar je dankbaar voor bent' }, { emoji: '🔍', tekst: 'iets heel kleins, heel dichtbij' }
];
function dagOpdracht() {
  const dag = dagVan();
  let h = 0; for (const c of dag) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  return Object.assign({ dag }, OPDRACHTEN[h % OPDRACHTEN.length]);
}

async function snapSturen(van, naar, foto, tekst) {
  if (isGeblokkeerd(van, naar)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
  if (!zijnVrienden(van, naar)) return { status: 403, error: 'Je kunt alleen snappen naar een vriend.' };
  if (!sociaalRate(van, 'snap', 40, 5 * 60 * 1000)) return { status: 429, error: 'Rustig aan met snaps sturen.' };
  if (!geldigeFoto(foto)) return { status: 400, error: 'Kies een foto (max ~900 kB).' };
  // De foto naar de mediastore; in db.data komt alleen de verwijzing.
  const ref = await media.bewaar(foto, 900 * 1024);
  if (!ref) return { status: 400, error: 'De foto kon niet worden opgeslagen.' };
  const snap = { id: crypto.randomBytes(5).toString('hex'), van, naar, foto: ref, tekst: String(tekst || '').replace(/[<>]/g, '').slice(0, 120), at: new Date().toISOString(), bekeken: false };
  db.data.snaps.push(snap);
  // over de bovengrens? de oudste (weggeknipte) snaps ook van schijf halen
  if (db.data.snaps.length > 2000) { db.data.snaps.slice(0, db.data.snaps.length - 2000).forEach(wisFoto); db.data.snaps = db.data.snaps.slice(-2000); }
  streakBijwerken(van, naar); // het vuurtje groeit als jullie allebei vandaag snappen
  save();
  sseToCustomer(naar, 'social', { kind: 'snap', from: codenaamVan(van) });
  return { status: 200, ok: true, vuurtje: streakVan(van, naar) };
}
// binnengekomen snaps voor 'mij' (alleen dat er een is, nog niet de foto)
function snapsVoor(mij) {
  opschonenSnaps();
  return db.data.snaps.filter(s => s.naar === mij && !s.bekeken)
    .map(s => ({ id: s.id, van: codenaamVan(s.van), at: s.at, tekst: s.tekst }));
}
// een snap openen: lees het bestand, geef de foto eenmalig terug als data-URL en
// gooi zowel de snap als het bestand meteen weg (kijk-een-keer).
async function snapOpenen(mij, id) {
  const s = db.data.snaps.find(x => x.id === id && x.naar === mij && !x.bekeken);
  if (!s) return { status: 404, error: 'Deze snap is er niet meer.' };
  const foto = await media.leesDataUrl(s.foto), tekst = s.tekst, van = codenaamVan(s.van);
  wisFoto(s); // het bestand meteen weg: na bekijken bewaren we de foto niet
  db.data.snaps = db.data.snaps.filter(x => x.id !== id);
  save();
  return { status: 200, foto, tekst, van };
}
async function verhaalPlaatsen(van, foto, tekst, metOpdracht) {
  if (!geldigeFoto(foto)) return { status: 400, error: 'Kies een foto (max ~900 kB).' };
  const ref = await media.bewaar(foto, 900 * 1024);
  if (!ref) return { status: 400, error: 'De foto kon niet worden opgeslagen.' };
  db.data.stories.filter(s => s.van === van).forEach(wisFoto);   // oud verhaal-bestand weg
  db.data.stories = db.data.stories.filter(s => !(s.van === van)); // een verhaal per persoon tegelijk (het nieuwste)
  // meedoen met de dag-opdracht: het verhaal draagt de opdracht van vandaag als badge
  const opdracht = metOpdracht === true ? dagOpdracht() : null;
  db.data.stories.push({ id: crypto.randomBytes(5).toString('hex'), van, foto: ref, tekst: String(tekst || '').slice(0, 120), at: new Date().toISOString(), kijkers: [], opdracht: opdracht ? opdracht.emoji + ' ' + opdracht.tekst : null });
  if (db.data.stories.length > 1000) { db.data.stories.slice(0, db.data.stories.length - 1000).forEach(wisFoto); db.data.stories = db.data.stories.slice(-1000); }
  save();
  return { status: 200, ok: true };
}
// de verhalen van mijn vrienden (en die van mezelf)
function verhalenVoor(mij) {
  opschonenSnaps();
  return db.data.stories.filter(s => s.van === mij || zijnVrienden(mij, s.van))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map(s => ({ id: s.id, van: codenaamVan(s.van), vanMij: s.van === mij, at: s.at, gezien: s.kijkers.includes(mij), opdracht: s.opdracht || null }));
}
async function verhaalBekijken(mij, id) {
  opschonenSnaps();
  const s = db.data.stories.find(x => x.id === id);
  if (!s || (s.van !== mij && !zijnVrienden(mij, s.van))) return { status: 404, error: 'Dit verhaal is er niet meer.' };
  if (!s.kijkers.includes(mij)) { s.kijkers.push(mij); save(); }
  return { status: 200, foto: await media.leesDataUrl(s.foto), tekst: s.tekst, van: codenaamVan(s.van), at: s.at, opdracht: s.opdracht || null };
}

  return { dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle, isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur, geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht, streakVan };
};
