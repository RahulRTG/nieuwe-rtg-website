/* DE LEIDINGSPLEK VAN EEN ZAAKPOSTVAK: beperkte systeempost (werving,
   kern/leverancier/beschermdesoorten.js) staat NIET in de berichtenlijst van
   RTMail maar in een eigen lijst ernaast (db.data.rtmail.leiding).

   Een plek en geen adres (tegenlezing PR #584): een adres kan iemand aanmaken,
   ernaar sturen, er een team van maken of er met een zaakcode mee botsen. Een
   lijst waar geen enkele adresroute bij komt, kan dat niet. Daarom ziet geen
   enkele lezer van het gedeelde postvak -- vak, zoek, draad, gesprekken, hulp,
   export, IMAP, teams, dossiers, regels -- deze post: niet doordat elk van hen
   filtert, maar doordat hij er niet staat. Alleen de inbox, de telling en het
   lezen van een MANAGER (routes/rtmail.js) vragen hem hier op.

   MIGRATIE EN VANGNET: beperkte post die in het gedeelde postvak staat -- van
   voor deze plek, van een oude instantie tijdens een rolling deploy, of van
   welke schrijver ook -- verhuist hierheen (schoon). Dat gebeurt ZONDER vlag,
   telkens als een lezer van RTMail zijn opslag pakt: de check is een goedkope
   doorloop, en een vlag die eenmaal staat zou elke latere schrijver doorlaten.
   Post uit de tussenversie met een adres "<code>-leiding" krijgt zijn
   zaakadres terug. Elke lezer (rtmail, vak, draad, bewaar, dossier, sla,
   rtgone, postbrug, mailpost) roept dezelfde schoon() aan. De
   regels na bezorging (doorsturen, afwezigheid) draaien voor deze post met
   opzet niet: doorsturen zou de beperking opheffen. */
'use strict';

const { postBeperking } = require('./leverancier/beschermdesoorten');

const SYSTEEM = 'rtg@rtmail';
const isBeperkt = (m) => !!postBeperking(m, SYSTEEM);
const zonderLeiding = (a) => String(a || '').replace(/-leiding@/, '@');

/* Het vangnet, op een plek: haal beperkte post uit `data.berichten` (in place,
   want andere lezers houden de lijst vast) en zet hem op `data.leiding`. */
function schoon(data, bewaar) {
  if (!data || !Array.isArray(data.berichten) || !data.berichten.some(isBeperkt)) return 0;
  if (!Array.isArray(data.leiding)) data.leiding = [];
  const weg = [];
  for (let i = data.berichten.length - 1; i >= 0; i--) {
    if (!isBeperkt(data.berichten[i])) continue;
    const [m] = data.berichten.splice(i, 1);
    m.naar = zonderLeiding(m.naar);
    weg.unshift(m);
  }
  data.leiding.unshift(...weg);
  if (typeof bewaar === 'function') try { bewaar(); } catch (e) { /* de verhuizing staat; opslaan volgt bij de volgende schrijf */ }
  return weg.length;
}

// `ruw` geeft db.data.rtmail (of maakt hem); de datadeur blijft in ./rtmail.js
module.exports = ({ ruw, heeft, save, crypto, klokDatum, normAdres, zelfdeBus, zegel, scanLinks, pub, kap, MAX }) => {
  const beperking = (soort) => postBeperking({ van: SYSTEEM, soort: soort || 'systeem' }, SYSTEEM);
  const bewaar = () => typeof save.sleutels === 'function' ? save.sleutels(['rtmail']) : save();
  function plek() {
    const r = ruw();
    if (!Array.isArray(r.leiding)) r.leiding = [];
    return r.leiding;
  }

  const migreer = () => (heeft() ? schoon(ruw(), bewaar) : 0);

  function leg({ naar, onderwerp, tekst, soort, beperkt }) {
    const naarA = normAdres(naar);
    if (!naarA) return { error: 'Geen geldig ontvang-adres.' };
    const t = kap(tekst, 8000);
    const msg = { id: crypto.randomBytes(6).toString('hex'), van: SYSTEEM, naar: naarA,
      onderwerp: kap(onderwerp, 160) || '(geen onderwerp)', tekst: t, soort: kap(soort, 24) || 'bericht',
      bron: 'systeem', vertrouwd: true, links: scanLinks(t), bijlagen: [], at: klokDatum().toISOString(),
      gelezen: false, beperkt };
    msg.draad = msg.id;
    zegel(msg);
    const l = plek();
    l.unshift(msg);
    if (l.length > MAX) l.length = MAX;
    bewaar();
    return msg;
  }

  const van = (adres) => { migreer(); const a = normAdres(adres); return plek().filter(m => zelfdeBus(m.naar, a)); };
  // het archief van de leidingsplek: niet meer in de inbox, wel onder de bewaartermijn en in de export
  const open = (adres) => van(adres).filter(m => !m.gearchiveerd);
  const post = (adres, { limit = 60 } = {}) => open(adres).slice(0, Math.max(1, Math.min(200, limit))).map(pub);
  const ongelezen = (adres) => open(adres).filter(m => !m.gelezen).length;
  function archiveer(adres, id) {
    const m = open(adres).find(x => x.id === id);
    if (!m) return { error: 'Dit bericht staat niet in dit postvak.' };
    m.gearchiveerd = true; m.gelezen = true; bewaar();
    return { ok: true, id: m.id };
  }
  function lees(adres, id) {
    const m = van(adres).find(x => x.id === id);
    if (!m) return { error: 'Dit bericht staat niet in dit postvak.' };
    if (!m.gelezen) { m.gelezen = true; bewaar(); }
    return pub(m);
  }
  return { beperking, migreer, leg, post, ongelezen, lees, archiveer };
};
module.exports.schoon = schoon;
module.exports.isBeperkt = isBeperkt;
