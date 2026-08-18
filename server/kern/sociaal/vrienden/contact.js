/* Sociaal-vrienden (deelmodule): verzoeken beantwoorden, de connectielijst,
   DM en de voogd-goedkeuring. Krijgt de gedeelde context een keer bij het
   opstarten vanuit kern/sociaal/vrienden.js. */
module.exports = (ctx) => {
const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media,
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, commDm } = ctx;
/* De priveberichten wonen sinds de verhuizing in de communicatiekern
   (kern/comm + kern/comm/dm). Deze laag houdt wat van haar is -- de
   vriendschapscontrole, de blokkade en de snelheidslimiet -- en laat het
   bewaren daar. Die kern wordt later opgebouwd dan deze laag, dus we halen
   hem op bij gebruik; is hij er onverhoopt niet, dan zegt dat het eerlijk
   in plaats van stilletjes in een tweede voorraad te schrijven. */
const DM = () => {
  const b = typeof commDm === 'function' ? commDm() : null;
  if (!b) throw new Error('De communicatiekern is niet beschikbaar.');
  return b;
};
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
    /* Teller en laatste regel komen uit de kern, niet meer uit een eigen
       voorraad: twee tellers voor hetzelfde aantal is hoe ze uit elkaar gaan
       lopen. Valt de kern weg, dan tonen we de vriend zonder teller -- een
       vriendenlijst hoort niet om te vallen omdat er geen bericht te tellen is. */
    let laatst = null, unread = 0;
    try { const b = DM(); laatst = b.laatste(mij, ander); unread = b.ongelezen(mij, ander); } catch (e) {}
    return { key: ander, codename: codenaamVan(ander), tier: soortVan(ander), unread, last: laatst ? (laatst.post ? '↗ post' : laatst.stuk ? '↗ stuk' : String(laatst.text || '').slice(0, 48)) : null, lastAt: laatst ? laatst.at : c.acceptedAt };
  }).sort((x, y) => String(y.lastAt).localeCompare(String(x.lastAt)));
  const requests = db.data.connections.filter(c => (c.a === mij || c.b === mij) && c.status === 'pending' && c.requestedBy !== mij && !isBeschermdHandle(mij)).map(c => ({ key: c.requestedBy, codename: codenaamVan(c.requestedBy), at: c.at, via: c.via || null }));
  return { connections: conns, requests };
}
// DM lezen/sturen (werkt over beide werelden zolang de vriendschap actief is)
function socialDm(mij, ander) {
  if (!verbActief(connectieTussen(mij, ander))) return { status: 403, error: 'Je bent nog niet verbonden met deze codenaam.' };
  const b = DM();
  b.markeerGelezen(mij, ander);
  return { status: 200, messages: b.berichten(mij, ander, 80), codename: codenaamVan(ander) };
}
function socialDmSend(mij, ander, text) {
  if (isGeblokkeerd(mij, ander)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
  if (!verbActief(connectieTussen(mij, ander))) return { status: 403, error: 'Je bent nog niet verbonden met deze codenaam.' };
  if (!sociaalRate(mij, 'dm', 60, 60 * 1000)) return { status: 429, error: 'Rustig aan met berichten sturen.' };
  text = String(text || '').replace(/[<>]/g, '').slice(0, 500).trim();
  if (!text) return { status: 400, error: 'Leeg bericht.' };
  const b = DM();
  b.stuur(mij, ander, { tekst: text });
  sseToCustomer(ander, 'social', { kind: 'dm', from: mij, codename: codenaamVan(mij), text });
  return { status: 200, ok: true, messages: b.berichten(mij, ander, 80) };
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
