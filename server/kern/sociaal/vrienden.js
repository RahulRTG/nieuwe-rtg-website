/* Sociaal (deelmodule): de vriendenlaag over beide werelden heen: zoeken,
   verbinden (met voogd-goedkeuring voor kinderen), DM en ouder-meekijk.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/sociaal.js. */
module.exports = (ctx) => {
const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media,
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate } = ctx;
// late binding: de snapslaag (met streakVan) wordt NA deze laag gemount en
// komt dan de context in; tegen het eerste verzoek is hij er altijd.
const streakVan = (a, b) => ctx.streakVan(a, b);
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
return { kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur };
};
