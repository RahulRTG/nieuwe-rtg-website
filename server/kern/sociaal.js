/* Kern-module "sociaal": de gedeelde vriendenlaag over RTG en RTFoundation,
   plus de veiligheidslaag (blokkeren, melden, snelheidslimiet, ouder-meekijk) en
   de snaps/verhalen. Losgetrokken uit server.js zodat dit cohesieve stuk apart
   te lezen en te testen is. Krijgt de gedeelde kern-onderdelen mee en praat
   nergens rechtstreeks met de buitenwereld. */
module.exports = (core) => {
  const { db, save, sseToCustomer, rtf, crypto } = core;

function dmSleutel(a, b) { return [a, b].sort().join('|'); }
function connectieTussen(a, b) {
  return db.data.connections.find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
}

const isRtf = h => typeof h === 'string' && h.startsWith('rtf:');
function codeExists(handle) { return isRtf(handle) ? !!rtf.profielInfoVanHandle(handle) : !!db.data.memberDir[handle]; }
function codenaamVan(handle) {
  if (isRtf(handle)) { const i = rtf.profielInfoVanHandle(handle); return i ? i.codenaam : handle; }
  return (db.data.memberDir[handle] || {}).codename || handle;
}
function soortVan(handle) { return isRtf(handle) ? 'rtf' : ((db.data.memberDir[handle] || {}).tier || 'rtg'); }
function isKindHandle(handle) { if (isRtf(handle)) { const i = rtf.profielInfoVanHandle(handle); return !!(i && i.kind); } return false; }
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
  const okKid = rtf.socialProfielen().some(sp => sp.handle === kidHandle && sp.gezinCode === gezinCode && sp.kind);
  if (!okKid) return { status: 403, error: 'Dit is geen kind van jouw gezin.' };
  const contacten = db.data.connections.filter(c => c.a === kidHandle || c.b === kidHandle).map(c => {
    const ander = c.a === kidHandle ? c.b : c.a;
    return { key: ander, codename: codenaamVan(ander), soort: soortVan(ander), volwassene: !isKindHandle(ander), status: verbActief(c) ? 'vriend' : (c.voogdWacht && c.voogdWacht.length ? 'wacht-op-ouder' : 'aangevraagd') };
  });
  return { status: 200, contacten };
}
function kindVerwijder(gezinCode, kidHandle, anderHandle) {
  const okKid = rtf.socialProfielen().some(sp => sp.handle === kidHandle && sp.gezinCode === gezinCode && sp.kind);
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
function socialZoek(mij, q) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const seen = new Set([mij]);
  const handles = [];
  for (const [key, m] of Object.entries(db.data.memberDir)) { if (!seen.has(key) && m.codename && m.codename.toLowerCase().includes(q)) { seen.add(key); handles.push(key); } }
  for (const sp of rtf.socialProfielen()) { if (!seen.has(sp.handle) && sp.codenaam.toLowerCase().includes(q)) { seen.add(sp.handle); handles.push(sp.handle); } }
  return handles.slice(0, 10).map(h => ({ key: h, codename: codenaamVan(h), tier: soortVan(h), status: statusVan(mij, connectieTussen(mij, h)) }));
}
// vriendschapsverzoek van 'mij' naar 'naar'
function socialVerbind(mij, naar) {
  if (naar === mij) return { status: 400, error: 'Dat ben je zelf.' };
  if (!codeExists(naar)) return { status: 404, error: 'Deze codenaam kennen we niet.' };
  if (isGeblokkeerd(mij, naar)) return { status: 403, error: 'Verbinden met deze codenaam kan niet.' };
  if (!sociaalRate(mij, 'verbind', 30, 60 * 60 * 1000)) return { status: 429, error: 'Te veel vriendschapsverzoeken. Probeer het later opnieuw.' };
  let c = connectieTussen(mij, naar);
  if (c && verbActief(c)) return { status: 200, ok: true, st: 'verbonden' };
  if (c) return { status: 200, ok: true, st: statusVan(mij, c) };
  const voogdWacht = [];
  if (isKindHandle(mij)) voogdWacht.push(mij);
  if (isKindHandle(naar)) voogdWacht.push(naar);
  c = { a: mij, b: naar, requestedBy: mij, status: 'pending', at: new Date().toISOString(), voogdWacht };
  db.data.connections.push(c); save();
  sseToCustomer(naar, 'social', { kind: 'request', from: codenaamVan(mij) });
  return { status: 200, ok: true, st: voogdWacht.length ? 'wacht-op-ouder' : 'aangevraagd' };
}
// verzoek beantwoorden (accepteren/afwijzen); een kind kan niet zelf accepteren
function socialAntwoord(mij, ander, action) {
  const c = connectieTussen(mij, ander);
  if (!c || c.status !== 'pending' || c.requestedBy === mij) return { status: 404, error: 'Geen openstaand verzoek van deze codenaam.' };
  if (isKindHandle(mij)) return { status: 403, error: 'Een ouder moet dit verzoek eerst goedkeuren.' };
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
    return { key: ander, codename: codenaamVan(ander), tier: soortVan(ander), unread, last: laatst ? (laatst.post ? '↗ post' : String(laatst.text || '').slice(0, 48)) : null, lastAt: laatst ? laatst.at : c.acceptedAt };
  }).sort((x, y) => String(y.lastAt).localeCompare(String(x.lastAt)));
  const requests = db.data.connections.filter(c => (c.a === mij || c.b === mij) && c.status === 'pending' && c.requestedBy !== mij && !isKindHandle(mij)).map(c => ({ key: c.requestedBy, codename: codenaamVan(c.requestedBy), at: c.at }));
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
  const kids = new Set(rtf.socialProfielen().filter(sp => sp.gezinCode === gezinCode && sp.kind).map(sp => sp.handle));
  return db.data.connections.filter(c => c.status === 'pending' && c.voogdWacht && c.voogdWacht.some(h => kids.has(h))).map(c => {
    const kid = c.voogdWacht.find(h => kids.has(h));
    const ander = c.a === kid ? c.b : c.a;
    return { kindHandle: kid, kind: codenaamVan(kid), anderKey: ander, ander: codenaamVan(ander), anderSoort: soortVan(ander), volwassene: !isKindHandle(ander), richting: c.requestedBy === kid ? 'uit' : 'in', at: c.at };
  });
}
function socialGoedkeur(gezinCode, kidHandle, anderHandle, akkoord) {
  const okKid = rtf.socialProfielen().some(sp => sp.handle === kidHandle && sp.gezinCode === gezinCode && sp.kind);
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
   vrienden. Foto's zijn kleine data-URL's; alles verloopt vanzelf. */
const SNAP_TTL = 24 * 60 * 60 * 1000;   // een niet-bekeken snap verloopt na 24 uur
const STORY_TTL = 24 * 60 * 60 * 1000;
function geldigeFoto(s) { return typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s) && s.length <= 900 * 1024; }
function opschonenSnaps() {
  const nu = Date.now();
  const voor = db.data.snaps.length + db.data.stories.length;
  db.data.snaps = db.data.snaps.filter(s => !s.bekeken && (nu - new Date(s.at).getTime()) < SNAP_TTL);
  db.data.stories = db.data.stories.filter(s => (nu - new Date(s.at).getTime()) < STORY_TTL);
  if (voor !== db.data.snaps.length + db.data.stories.length) save();
}
function snapSturen(van, naar, foto, tekst) {
  if (isGeblokkeerd(van, naar)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
  if (!zijnVrienden(van, naar)) return { status: 403, error: 'Je kunt alleen snappen naar een vriend.' };
  if (!sociaalRate(van, 'snap', 40, 5 * 60 * 1000)) return { status: 429, error: 'Rustig aan met snaps sturen.' };
  if (!geldigeFoto(foto)) return { status: 400, error: 'Kies een foto (max ~900 kB).' };
  const snap = { id: crypto.randomBytes(5).toString('hex'), van, naar, foto, tekst: String(tekst || '').replace(/[<>]/g, '').slice(0, 120), at: new Date().toISOString(), bekeken: false };
  db.data.snaps.push(snap);
  db.data.snaps = db.data.snaps.slice(-2000);
  save();
  sseToCustomer(naar, 'social', { kind: 'snap', from: codenaamVan(van) });
  return { status: 200, ok: true };
}
// binnengekomen snaps voor 'mij' (alleen dat er een is, nog niet de foto)
function snapsVoor(mij) {
  opschonenSnaps();
  return db.data.snaps.filter(s => s.naar === mij && !s.bekeken)
    .map(s => ({ id: s.id, van: codenaamVan(s.van), at: s.at, tekst: s.tekst }));
}
// een snap openen: geef de foto terug en markeer als bekeken (verdwijnt daarna)
function snapOpenen(mij, id) {
  const s = db.data.snaps.find(x => x.id === id && x.naar === mij && !x.bekeken);
  if (!s) return { status: 404, error: 'Deze snap is er niet meer.' };
  s.bekeken = true; s.bekekenAt = new Date().toISOString();
  const foto = s.foto, tekst = s.tekst, van = codenaamVan(s.van);
  // meteen weg: na bekijken bewaren we de foto niet
  db.data.snaps = db.data.snaps.filter(x => x.id !== id);
  save();
  return { status: 200, foto, tekst, van };
}
function verhaalPlaatsen(van, foto, tekst) {
  if (!geldigeFoto(foto)) return { status: 400, error: 'Kies een foto (max ~900 kB).' };
  db.data.stories = db.data.stories.filter(s => !(s.van === van)); // een verhaal per persoon tegelijk (het nieuwste)
  db.data.stories.push({ id: crypto.randomBytes(5).toString('hex'), van, foto, tekst: String(tekst || '').slice(0, 120), at: new Date().toISOString(), kijkers: [] });
  db.data.stories = db.data.stories.slice(-1000);
  save();
  return { status: 200, ok: true };
}
// de verhalen van mijn vrienden (en die van mezelf)
function verhalenVoor(mij) {
  opschonenSnaps();
  return db.data.stories.filter(s => s.van === mij || zijnVrienden(mij, s.van))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map(s => ({ id: s.id, van: codenaamVan(s.van), vanMij: s.van === mij, at: s.at, gezien: s.kijkers.includes(mij) }));
}
function verhaalBekijken(mij, id) {
  opschonenSnaps();
  const s = db.data.stories.find(x => x.id === id);
  if (!s || (s.van !== mij && !zijnVrienden(mij, s.van))) return { status: 404, error: 'Dit verhaal is er niet meer.' };
  if (!s.kijkers.includes(mij)) { s.kijkers.push(mij); save(); }
  return { status: 200, foto: s.foto, tekst: s.tekst, van: codenaamVan(s.van), at: s.at };
}

  return { dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur, geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken };
};
