/* Sociaal-vrienden (deelmodule): verzoeken beantwoorden, de connectielijst
   (met vuurtjes), DM en de voogd-goedkeuring. Krijgt de gedeelde context
   een keer bij het opstarten vanuit kern/sociaal/vrienden.js. */
module.exports = (ctx) => {
const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media,
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate } = ctx;
// late binding: de snapslaag (met streakVan) wordt NA deze laag gemount en
// komt dan de context in; tegen het eerste verzoek is hij er altijd.
const streakVan = (a, b) => ctx.streakVan(a, b);
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
return { socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur };
};
