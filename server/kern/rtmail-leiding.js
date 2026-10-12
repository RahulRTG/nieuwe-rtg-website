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

   MIGRATIE: post die vóór deze plek in het gedeelde postvak landde, wordt hier
   naartoe verhuisd (migreer), bij het opstarten en bij het eerste gebruik. De
   regels na bezorging (doorsturen, afwezigheid) draaien voor deze post met
   opzet niet: doorsturen zou de beperking opheffen. */
'use strict';

const { postBeperking } = require('./leverancier/beschermdesoorten');

module.exports = ({ db, save, crypto, klokDatum, SYSTEEM, normAdres, zelfdeBus, zegel, scanLinks, pub, kap, MAX }) => {
  const isBeperkt = (m) => !!postBeperking(m, SYSTEEM);
  const beperking = (soort) => postBeperking({ van: SYSTEEM, soort: soort || 'systeem' }, SYSTEEM);
  const bewaar = () => typeof save.sleutels === 'function' ? save.sleutels(['rtmail']) : save();
  function plek() {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    if (!Array.isArray(db.data.rtmail.leiding)) db.data.rtmail.leiding = [];
    return db.data.rtmail.leiding;
  }

  // oude beperkte post uit het gedeelde postvak halen; in place, want andere lezers houden de lijst vast
  // eenmalig per opslag (leidingVersie): nieuwe beperkte post komt nooit meer in het gedeelde postvak
  function migreer() {
    const r = db.data.rtmail;
    if (!r || !Array.isArray(r.berichten) || r.leidingVersie === 1) return 0;
    r.leidingVersie = 1;
    if (!r.berichten.some(isBeperkt)) return 0;
    const l = plek(), weg = [];
    for (let i = r.berichten.length - 1; i >= 0; i--) if (isBeperkt(r.berichten[i])) weg.unshift(...r.berichten.splice(i, 1));
    l.unshift(...weg);
    bewaar();
    return weg.length;
  }

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
  const post = (adres, { limit = 60 } = {}) => van(adres).slice(0, Math.max(1, Math.min(200, limit))).map(pub);
  const ongelezen = (adres) => van(adres).filter(m => !m.gelezen).length;
  function lees(adres, id) {
    const m = van(adres).find(x => x.id === id);
    if (!m) return { error: 'Dit bericht staat niet in dit postvak.' };
    if (!m.gelezen) { m.gelezen = true; bewaar(); }
    return pub(m);
  }
  return { beperking, migreer, leg, post, ongelezen, lees };
};
