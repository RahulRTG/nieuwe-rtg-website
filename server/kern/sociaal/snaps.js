/* Sociaal (deelmodule): snaps (een keer bekijken), 24-uurs verhalen,
   en de dag-opdracht. zijnVrienden komt via de context
   binnen nadat kern/sociaal.js de vriendenlaag heeft gemount. */
module.exports = (ctx) => {
const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media,
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate } = ctx;
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
  const voor = db.data.snaps.length + db.data.stories.length;
  const dodeSnaps = db.data.snaps.filter(s => s.bekeken || (nu - new Date(s.at).getTime()) >= SNAP_TTL);
  const dodeStories = db.data.stories.filter(s => (nu - new Date(s.at).getTime()) >= STORY_TTL);
  dodeSnaps.forEach(wisFoto); dodeStories.forEach(wisFoto);   // ook de bestanden opruimen
  db.data.snaps = db.data.snaps.filter(s => !s.bekeken && (nu - new Date(s.at).getTime()) < SNAP_TTL);
  db.data.stories = db.data.stories.filter(s => (nu - new Date(s.at).getTime()) < STORY_TTL);
  if (voor !== db.data.snaps.length + db.data.stories.length) save();
}
/* ---------- de vuurtjes zijn eruit, en dat is een besluit ----------
   Hier stond een snap-streak per vriendenpaar: snapten jullie allebei op
   dezelfde dag, dan groeide het vuurtje, en een dag missen doofde het. Precies
   het patroon dat de huisregels van dit huis verbieden -- een teller die alleen
   omhoog gaat als je elke dag komt, maakt van contact een verplichting. Dat het
   in de RTFoundation-app stond, bij kinderen, maakte het niet beter.

   Wat blijft is de dag-opdracht hieronder: een uitnodiging ("iets geels"). Die
   kost je niets als je hem overslaat, en dat is het verschil.

   Oude installaties houden nog een dode db.data.streaks; er wordt niets meer
   in geschreven en niets meer uit gelezen. */
const dagVan = (t) => new Date(t || Date.now()).toISOString().slice(0, 10);

/* ---------- de dag-opdracht: elke dag een snap-uitdaging voor iedereen ---------- */
const OPDRACHTEN = [
  { emoji: 'emo-hart', tekst: 'iets geels' }, { emoji: 'balans', tekst: 'je uitzicht van nu' },
  { emoji: 'horeca', tekst: 'je ontbijt of lunch' }, { emoji: 'sport', tekst: 'je schoenen van vandaag' },
  { emoji: 'oogst', tekst: 'iets dat groeit' }, { emoji: 'reisboek', tekst: 'wat je aan het leren bent' },
  { emoji: 'emo-lol', tekst: 'iets dat je aan het lachen maakte' }, { emoji: 'ontwerp', tekst: 'de mooiste kleur om je heen' },
  { emoji: 'balans', tekst: 'iets met water' }, { emoji: 'emo-bloem', tekst: 'een dier (of iets dat erop lijkt)' },
  { emoji: 'help', tekst: 'een driehoek in het wild' }, { emoji: 'balans', tekst: 'de lucht van dit moment' },
  { emoji: 'entourage', tekst: 'iets dat je samen doet' }, { emoji: 'wonen', tekst: 'je favoriete plek thuis' },
  { emoji: 'muziek', tekst: 'waar jij muziek van krijgt' }, { emoji: 'mode', tekst: 'de gekste sok die je vindt' },
  { emoji: 'oogst', tekst: 'de oudste boom die je ziet' }, { emoji: 'sneltekst', tekst: 'je eigen handschrift' },
  { emoji: 'wonen', tekst: 'een spiegelbeeld (niet van jezelf)' }, { emoji: 'horeca', tekst: 'iets gezonds' },
  { emoji: 'taal', tekst: 'de eerste letter van je naam, ergens gevonden' }, { emoji: 'balans', tekst: 'iets dat bij de avond hoort' },
  { emoji: 'spelen', tekst: 'iets dat precies past' }, { emoji: 'auto', tekst: 'iets met wielen' },
  { emoji: 'balans', tekst: 'drie kleuren in een beeld' }, { emoji: 'agenda', tekst: 'hoe laat het is, zonder klok' },
  { emoji: 'emo-hart', tekst: 'iets waar je dankbaar voor bent' }, { emoji: 'ontdek', tekst: 'iets heel kleins, heel dichtbij' }
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
  // de bovengrens (en het opruimen van de bestanden eronder) staat in
  // kern/kappen.js en draait in de onderhoudsronde, buiten dit verzoek
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
  // bovengrens: zie kern/kappen.js (onderhoudsronde)
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

return { geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht };
};
