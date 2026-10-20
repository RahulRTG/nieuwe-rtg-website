/* Sociaal (deelmodule): snaps (een keer bekijken), 24-uurs verhalen,
   en de dag-opdracht. zijnVrienden komt via de context
   binnen nadat kern/sociaal.js de vriendenlaag heeft gemount. */
module.exports = (ctx) => {
const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media,
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate } = ctx;
const S = ctx.opslag || require('./opslag')({ db: ctx.db }); // de vijf sociale lijsten
const { zijnVrienden } = ctx;
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
  const voor = S.lijst('snaps').length + S.lijst('stories').length;
  const dodeSnaps = S.lijst('snaps').filter(s => s.bekeken || (nu - new Date(s.at).getTime()) >= SNAP_TTL);
  const dodeStories = S.lijst('stories').filter(s => (nu - new Date(s.at).getTime()) >= STORY_TTL);
  dodeSnaps.forEach(wisFoto); dodeStories.forEach(wisFoto);   // ook de bestanden opruimen
  S.zet('snaps', S.lijst('snaps').filter(s => !s.bekeken && (nu - new Date(s.at).getTime()) < SNAP_TTL));
  S.zet('stories', S.lijst('stories').filter(s => (nu - new Date(s.at).getTime()) < STORY_TTL));
  if (voor !== S.lijst('snaps').length + S.lijst('stories').length) save();
}
// De daguitnodiging leest geen sociale gegevens en bewaart geen reeks.
const { dagOpdracht } = require('./dagopdracht');

/* EEN HERHAALSLEUTEL PER SNAP (19 oktober 2026): na een crash stuurde dezelfde
   tik de snap twee keer, en twee gelijktijdige tikken kwamen allebei langs de
   controle omdat het bewaren van de foto wacht. `idem` is optioneel (de
   gezinsroute geeft hem nog niet mee); hij staat gehasht op de snap. */
const onderweg = new Map();
function snapSturen(van, naar, foto, tekst, idem) {
  const sl = typeof idem === 'string' && idem.trim() ? idem.trim().slice(0, 80) : null;
  if (!sl) return snapSturenNu(van, naar, foto, tekst, null);
  const merk = crypto.createHash('sha256').update(van + '|' + naar + '|' + sl).digest('hex').slice(0, 32);
  const al = S.lijst('snaps').find(s => s.idem === merk);
  if (al) return al.tekst === String(tekst || '').replace(/[<>]/g, '').slice(0, 120)
    ? { status: 200, ok: true, herhaald: true } : { status: 409, error: 'Deze snap is al met een andere tekst verstuurd.' };
  if (onderweg.has(merk)) return onderweg.get(merk);
  const taak = snapSturenNu(van, naar, foto, tekst, merk).finally(() => onderweg.delete(merk));
  onderweg.set(merk, taak);
  return taak;
}
async function snapSturenNu(van, naar, foto, tekst, merk) {
  if (isGeblokkeerd(van, naar)) return { status: 403, error: 'Dit contact is niet beschikbaar.' };
  if (!zijnVrienden(van, naar)) return { status: 403, error: 'Je kunt alleen snappen naar een vriend.' };
  if (!sociaalRate(van, 'snap', 40, 5 * 60 * 1000)) return { status: 429, error: 'Rustig aan met snaps sturen.' };
  if (!geldigeFoto(foto)) return { status: 400, error: 'Kies een foto (max ~900 kB).' };
  // De foto naar de mediastore; in db.data komt alleen de verwijzing.
  const ref = await media.bewaar(foto, 900 * 1024);
  if (!ref) return { status: 400, error: 'De foto kon niet worden opgeslagen.' };
  const snap = { id: crypto.randomBytes(5).toString('hex'), van, naar, foto: ref, tekst: String(tekst || '').replace(/[<>]/g, '').slice(0, 120), at: new Date().toISOString(), bekeken: false };
  if (merk) snap.idem = merk;
  S.lijst('snaps').push(snap);
  // de bovengrens (en het opruimen van de bestanden eronder) staat in
  // kern/kappen.js en draait in de onderhoudsronde, buiten dit verzoek
  save();
  sseToCustomer(naar, 'social', { kind: 'snap', from: codenaamVan(van) });
  return { status: 200, ok: true };
}
// binnengekomen snaps voor 'mij' (alleen dat er een is, nog niet de foto)
function snapsVoor(mij) {
  opschonenSnaps();
  return S.lijst('snaps').filter(s => s.naar === mij && !s.bekeken)
    .map(s => ({ id: s.id, van: codenaamVan(s.van), at: s.at, tekst: s.tekst }));
}
// een snap openen: lees het bestand, geef de foto eenmalig terug als data-URL en
// gooi zowel de snap als het bestand meteen weg (kijk-een-keer).
async function snapOpenen(mij, id) {
  const s = S.lijst('snaps').find(x => x.id === id && x.naar === mij && !x.bekeken);
  if (!s) return { status: 404, error: 'Deze snap is er niet meer.' };
  const foto = await media.leesDataUrl(s.foto), tekst = s.tekst, van = codenaamVan(s.van);
  wisFoto(s); // het bestand meteen weg: na bekijken bewaren we de foto niet
  S.zet('snaps', S.lijst('snaps').filter(x => x.id !== id));
  save();
  return { status: 200, foto, tekst, van };
}
async function verhaalPlaatsen(van, foto, tekst, metOpdracht) {
  if (!geldigeFoto(foto)) return { status: 400, error: 'Kies een foto (max ~900 kB).' };
  const ref = await media.bewaar(foto, 900 * 1024);
  if (!ref) return { status: 400, error: 'De foto kon niet worden opgeslagen.' };
  S.lijst('stories').filter(s => s.van === van).forEach(wisFoto);   // oud verhaal-bestand weg
  S.zet('stories', S.lijst('stories').filter(s => !(s.van === van))); // een verhaal per persoon tegelijk (het nieuwste)
  // meedoen met de dag-opdracht: het verhaal draagt de opdracht van vandaag als badge
  const opdracht = metOpdracht === true ? dagOpdracht() : null;
  S.lijst('stories').push({ id: crypto.randomBytes(5).toString('hex'), van, foto: ref, tekst: String(tekst || '').slice(0, 120), at: new Date().toISOString(), kijkers: [], opdracht: opdracht ? opdracht.emoji + ' ' + opdracht.tekst : null });
  // bovengrens: zie kern/kappen.js (onderhoudsronde)
  save();
  return { status: 200, ok: true };
}
// de verhalen van mijn vrienden (en die van mezelf)
function verhalenVoor(mij) {
  opschonenSnaps();
  return S.lijst('stories').filter(s => s.van === mij || zijnVrienden(mij, s.van))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map(s => ({ id: s.id, van: codenaamVan(s.van), vanMij: s.van === mij, at: s.at, gezien: s.kijkers.includes(mij), opdracht: s.opdracht || null }));
}
async function verhaalBekijken(mij, id) {
  opschonenSnaps();
  const s = S.lijst('stories').find(x => x.id === id);
  if (!s || (s.van !== mij && !zijnVrienden(mij, s.van))) return { status: 404, error: 'Dit verhaal is er niet meer.' };
  if (!s.kijkers.includes(mij)) { s.kijkers.push(mij); save(); }
  return { status: 200, foto: await media.leesDataUrl(s.foto), tekst: s.tekst, van: codenaamVan(s.van), at: s.at, opdracht: s.opdracht || null };
}

return { geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht };
};
