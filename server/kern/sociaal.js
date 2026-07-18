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

/* De vriendenlaag en de snaps/verhalen-laag draaien als submodules op een
   gedeelde context, een keer opgebouwd bij het opstarten; de vriendenlaag
   levert zijnVrienden aan de snapslaag via die context. */
const ctx = { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media,
  dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate };
const deelVrienden = require('./sociaal/vrienden')(ctx);
Object.assign(ctx, deelVrienden);
const deelSnaps = require('./sociaal/snaps')(ctx);
Object.assign(ctx, deelSnaps); // o.a. streakVan, dat de vriendenlaag laat-gebonden gebruikt
const { kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur } = deelVrienden;
const { geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht, streakVan } = deelSnaps;

  return { dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle, isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur, geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht, streakVan };
};
