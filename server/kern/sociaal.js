/* Kern-module "sociaal": de gedeelde vriendenlaag over RTG en RTFoundation,
   plus de veiligheidslaag (blokkeren, melden, snelheidslimiet, ouder-meekijk) en
   de snaps/verhalen. Losgetrokken uit server.js zodat dit cohesieve stuk apart
   te lezen en te testen is. Krijgt de gedeelde kern-onderdelen mee en praat
   nergens rechtstreeks met de buitenwereld. */
module.exports = (core) => {
  const { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsHaalWacht, gidsZoekCodenaam, media, commDm, dyncodeGeef } = core;

function dmSleutel(a, b) { return [a, b].sort().join('|'); }
function connectieTussen(a, b) {
  return db.data.connections.find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
}

const isRtf = h => typeof h === 'string' && h.startsWith('rtf:');
function codeExists(handle) { return isRtf(handle) ? !!rtf.profielInfoVanHandle(handle) : !!gidsHaal(handle); }
/* De wachtende variant, voor plekken waar "bestaat niet" een BESLUIT draagt
   (een 404 op verbinden). codeExists leest de synchrone gids, en die geeft in
   Postgres-stand bij een koude cache null terwijl het lid gewoon bestaat --
   onder last kreeg een NET gevonden codenaam zo "kennen we niet" bij het
   verbinden. Zelfde patroon als bestaatLid in RTG Pay: bij twijfel echt vragen. */
async function codeBestaat(handle) { return isRtf(handle) ? !!rtf.profielInfoVanHandle(handle) : !!(await gidsHaalWacht(handle)); }
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
const ctx = { db, save, sseToCustomer, rtf, crypto, gidsHaal, gidsZoekCodenaam, media, commDm, dyncodeGeef,
  dmSleutel, connectieTussen, isRtf, codeExists, codeBestaat, codenaamVan, soortVan, isKindHandle,
  isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate };
const deelVrienden = require('./sociaal/vrienden')(ctx);
Object.assign(ctx, deelVrienden);
const deelSnaps = require('./sociaal/snaps')(ctx);
Object.assign(ctx, deelSnaps);
/* De contactpin in drie lagen, in deze volgorde en niet anders: het BEZIT
   (pin.js) weet van niemand af, de DEUR (pin-deur.js) leunt op dat bezit en op
   socialVerbind, en de LEVENDE code (pin-live.js) leunt op de deur voor het ene
   ding dat ze delen: wat je van een gevonden mens te zien krijgt. Alle
   controles blijven bij socialVerbind; deze lagen zoeken alleen de handle op.
   Alle drie staan NA de vriendenlaag, want die levert statusVan en
   socialVerbind aan. */
/* Voor de pin zelf komen eerst de twee veiligheidsranden: de duurzame staat
   (intrekken, noodslot, gebruikersjournaal) en de vluchtige bevestiging die de
   tweede menselijke stap server-side afdwingt. Ze blijven intern; routes mogen
   nooit zelf tombstones of intenties schrijven. */
const deelPinBeveiliging = require('./sociaal/pin-beveiliging')(ctx);
Object.assign(ctx, deelPinBeveiliging);
const deelPinIntent = require('./sociaal/pin-intent')(ctx);
Object.assign(ctx, deelPinIntent);
const deelPin = require('./sociaal/pin')(ctx);
Object.assign(ctx, deelPin);
const deelPinDeur = require('./sociaal/pin-deur')(ctx);
Object.assign(ctx, deelPinDeur);
const deelPinLive = require('./sociaal/pin-live')(ctx);
Object.assign(ctx, deelPinLive);
const { kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialIntrek, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur } = deelVrienden;
const { geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht } = deelSnaps;
const { pinVan, pinKaart, pinVernieuw, pinUit, handleVanPin, pinHuidig, pinNormaliseer, pinToonbaar } = deelPin;
const { pinZoek, pinVerbind, pinNaarHandle, pinKijk, pinDeurReset, MIS_PER_MINUUT } = deelPinDeur;
const { liveMaak, liveKijk, liveVerbind, liveTrekIn, liveSluit, liveOpen } = deelPinLive;

  return { dmSleutel, connectieTussen, isRtf, codeExists, codenaamVan, soortVan, isKindHandle, isBeschermdHandle, verbActief, isGeblokkeerd, blokkeer, deblokkeer, meldMisbruik, sociaalRate, kindContacten, kindVerwijder, statusVan, socialZoek, socialVerbind, ouderVerbind, socialAntwoord, socialIntrek, socialConnecties, socialDm, socialDmSend, zijnVrienden, socialTeKeuren, socialGoedkeur, geldigeFoto, opschonenSnaps, snapSturen, snapsVoor, snapOpenen, verhaalPlaatsen, verhalenVoor, verhaalBekijken, dagOpdracht,
    pinVan, pinKaart, pinVernieuw, pinUit, handleVanPin, pinHuidig, pinNormaliseer, pinToonbaar,
    pinZoek, pinVerbind, pinNaarHandle, pinKijk, pinDeurReset, MIS_PER_MINUUT,
    liveMaak, liveKijk, liveVerbind, liveTrekIn, liveSluit, liveOpen };
};
