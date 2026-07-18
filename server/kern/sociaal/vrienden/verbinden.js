/* Sociaal-vrienden (deelmodule): ouder-meekijk op kindcontacten, zoeken
   over beide werelden en verbinden (met voogd-goedkeuring voor kinderen).
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/sociaal/vrienden.js. */
module.exports = (ctx) => {
const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media,
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate } = ctx;
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
return { kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, ouderVerbind };
};
