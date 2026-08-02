/* De bewaarveger: de twee wisregels die de eigenaar op 2 augustus 2026 in het
   papierwerkregister heeft gekozen, als draaiende code in plaats van beleid op
   papier.

     1. LOCATIE, 7 DAGEN. Een live-positie (db.data.live) die zeven dagen niet
        meer is bijgewerkt, wordt gewist. Wie echt onderweg is, werkt zijn
        positie voortdurend bij; een spoor dat een week stilstaat is geen reis
        maar een restant. Begin- en eindpunt van een rit blijven in de
        ritadministratie staan (factuur) -- dat is het besluit, en die velden
        raakt deze veger dus bewust niet aan.
     2. ID-BEWIJS, 1 JAAR NA GOEDKEURING. De paspoortscan en de selfie gaan een
        jaar na de geslaagde verificatie de kluis uit; alleen de uitkomst
        (geverifieerd, nationaliteit, leeftijd, geslacht) blijft. De klok start
        bij de goedkeuring (md.geverifieerdOp, gezet in office/werk.js). Wie
        VOOR deze regel is goedgekeurd heeft die datum niet; de veger zet hem
        dan bij de eerste ronde op vandaag -- de klok start dan nu, want met
        terugwerkende kracht een datum VERZINNEN zou scans wissen op een
        moment dat niemand gekozen heeft. Een AFGEWEZEN verificatie wordt niet
        hier maar direct bij het besluit gewist (office/werk.js); deze veger
        veegt afgewezen restanten alsnog mee als vangnet.

   Zelfde bouwvorm als de storingswachter: injecteerbare klok (geen toets die
   echt slaapt), een start() met een uurinterval, en elke greep telbaar in het
   resultaat. De veger meldt zich in het logboek maar vraagt niemand om
   bevestiging: dit zijn de regels die de eigenaar al bevestigd HEEFT. */
const DAG = 86400000;

function maakBewaarveger({ db, save, accounts, identiteitsmap, laatsteVerlenging, log, nu, instel }) {
  const I = Object.assign({ locatieDagen: 7, idDagen: 365 }, instel || {});
  const klok = nu || (() => Date.now());
  const verlengd = laatsteVerlenging || (() => 0);

  function wisDossier(u, md) {
    try { identiteitsmap.wisAllesVan(u.id); } catch (e) { /* map al leeg: prima */ }
    if (u.id_doc) accounts.setVerification(u.id, u.verified, null);
    if (md && md.selfie) { delete md.selfie; accounts.saveMemberState(u.id, md); }
  }

  function veeg() {
    const t = klok();
    let posities = 0, dossiers = 0, klokGestart = 0;

    // 1. locatiesporen ouder dan de termijn
    const live = db.data.live || {};
    for (const key of Object.keys(live)) {
      const L = live[key] || {};
      const laatst = Date.parse(L.updatedAt || L.startedAt || '') || 0;
      if (t - laatst > I.locatieDagen * DAG) { delete live[key]; posities++; }
    }

    // 2. identiteitsbewijzen: een jaar na goedkeuring weg, afgewezen als vangnet
    for (const u of accounts.listByVerification('verified')) {
      const md = accounts.getMemberState(u.id) || {};
      if (!md.geverifieerdOp) {
        md.geverifieerdOp = new Date(t).toISOString();
        accounts.saveMemberState(u.id, md);
        klokGestart++;
        continue;
      }
      /* DE KLOK VOLGT HET LIDMAATSCHAP. Een pas is een jaarcontract; wie
         verlengt, blijft lid, en zolang iemand lid is blijft het bewijs in de
         kluis (besluit van de eigenaar, 2 augustus 2026: "als ze hun pas
         verlengen met een jaar, dan weer een jaar"). Het anker is daarom het
         JONGSTE van de goedkeuringsdatum en de laatst voldane
         lidmaatschapstermijn -- pas een jaar nadat er voor het laatst is
         verlengd (of goedgekeurd, als er nooit een termijn was) gaat het
         bewijs de kluis uit. */
      const anker = Math.max(Date.parse(md.geverifieerdOp) || 0, verlengd(u.id) || 0);
      if (t - anker > I.idDagen * DAG && (u.id_doc || md.selfie)) {
        wisDossier(u, md);
        dossiers++;
      }
    }
    for (const u of accounts.listByVerification('rejected')) {
      const md = accounts.getMemberState(u.id) || {};
      if (u.id_doc || md.selfie) { wisDossier(u, md); dossiers++; }
    }

    if (posities || dossiers) {
      save();
      if (log && log.schrijf) {
        try { log.schrijf('info', 'bewaarveger', { posities, dossiers }); } catch (e) {}
      }
    }
    return { posities, dossiers, klokGestart };
  }

  function start() {
    const t = setInterval(veeg, 3600000);
    if (t.unref) t.unref();
    return t;
  }

  return { veeg, start, instel: I };
}

module.exports = { maakBewaarveger };
