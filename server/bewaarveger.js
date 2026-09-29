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
/* De standaardtermijnen, gedeeld en niet overgeschreven. Het papierwerk toont
   bij de bewaartermijn-vragen wat het systeem VANDAAG doet; die tekst hoort uit
   deze getallen te komen en niet uit een tweede versie ervan, want dan gaat het
   register liegen zodra hier iets verandert (LAT-regel 4). */
const STANDAARD = { locatieDagen: 7, idDagen: 365 };

function maakBewaarveger({ db, save, accounts, identiteitsmap, lidmaatschapTot, log, nu, instel, accountWerk, radarVeeg, sosVeeg }) {
  const I = Object.assign({}, STANDAARD, instel || {});
  /* ACCOUNTMUTATIES LOPEN HIER BUITEN EEN HTTP-VERZOEK, en in productie mocht
     dat niet: de identiteitscache commit alleen als deelnemer aan een
     PostgreSQL-transactie (accounts/transactie.js). Tot 27 september 2026 faalde
     deze AVG-wisregel daar dus bij elke ronde. accounts/achtergrond.js geeft
     hem een eigen transactie; buiten productie voert hij direct uit. */
  const alsAccount = accountWerk || accounts.achtergrondWerk || (fn => fn());
  const account = (fn) => {
    try {
      const uit = alsAccount(fn);
      if (uit && typeof uit.catch === 'function') uit.catch(e => meldAccountFout(e));
    } catch (e) { meldAccountFout(e); }
  };
  function meldAccountFout(e) {
    if (log && log.schrijf) {
      try { log.schrijf('warn', 'bewaarveger-account', { fout: String((e && e.code) || (e && e.message) || e) }); } catch (x) {}
    }
  }
  const klok = nu || (() => Date.now());
  const lidTot = lidmaatschapTot || (() => 0);

  function wisDossier(u, md) {
    try { identiteitsmap.wisAllesVan(u.id); } catch (e) { /* map al leeg: prima */ }
    account(() => {
      if (u.id_doc) accounts.setVerification(u.id, u.verified, null);
      if (md && md.selfie) { delete md.selfie; accounts.saveMemberState(u.id, md); }
    });
  }

  function veeg() {
    const t = klok();
    let posities = 0, dossiers = 0, klokGestart = 0, sosPosities = 0;

    // 1. locatiesporen ouder dan de termijn
    const live = db.data.live || {};
    for (const key of Object.keys(live)) {
      const L = live[key] || {};
      const laatst = Date.parse(L.updatedAt || L.startedAt || '') || 0;
      if (t - laatst > I.locatieDagen * DAG) { delete live[key]; posities++; }
    }

    /* 1b. RADARPOSITIES DIE NIET MEER VERS ZIJN (NAVIGATIE.md N14). De radar
       wist ze zelf bij elke positie en bij elke stand; dit is het vangnet voor
       wie de functie aanliet en daarna niets meer deed. De regel -- en de grens
       van wat "vers" is -- blijft van de radar: de veger krijgt zijn wisfunctie
       mee (opzet/start.js) en leest het domein niet zelf. */
    if (typeof radarVeeg === 'function') posities += Number(radarVeeg()) || 0;

    /* 1c. POSITIES DIE BIJ EEN MELDING OF VENSTER HOREN (NAVIGATIE.md N18, N19).
       Een SOS houdt zijn plek zolang hij open is en 90 dagen erna; de laatste
       plek van de veiligheidskring en de GPS van een patrouille bestaan buiten
       hun venster niet. Elke regel blijft van zijn domein -- de veger krijgt een
       lijst wisfuncties mee (opzet/start.js) en laadt zelf geen domein, net als
       bij de radar. Een domein dat faalt houdt de andere niet tegen, en het
       falen wordt gemeld en niet opgegeten. */
    for (const f of Array.isArray(sosVeeg) ? sosVeeg : []) {
      // de veger is de deur naar de opslag: een domein krijgt de data mee en grijpt er niet zelf naar
      try { sosPosities += Number(f(t, db.data)) || 0; }
      catch (e) {
        if (log && log.schrijf) {
          try { log.schrijf('warn', 'bewaarveger-sos', { fout: String((e && e.message) || e) }); } catch (x) { /* de logger zelf faalt: niets meer te melden */ }
        }
      }
    }

    // 2. identiteitsbewijzen: een jaar na goedkeuring weg, afgewezen als vangnet
    for (const u of accounts.listByVerification('verified')) {
      const md = accounts.getMemberState(u.id) || {};
      if (!md.geverifieerdOp) {
        md.geverifieerdOp = new Date(t).toISOString();
        account(() => accounts.saveMemberState(u.id, md));
        klokGestart++;
        continue;
      }
      /* HET BEWIJS BLIJFT ZOLANG DE RELATIE LOOPT, EN GAAT DAARNA METEEN WEG.

         Twee besluiten van de eigenaar op 2 augustus 2026, in deze volgorde:
         "als ze hun pas verlengen met een jaar, dan weer een jaar" en daarna
         "op verzoek een jaar behouden, anders direct wissen".

         EINDE is het moment waarop de klantrelatie afloopt:
           - is er betaald, dan tot wanneer die betaling dekt (de laatste
             voldane termijn plus zijn maand; lidmaatschapTot rekent dat uit,
             en verlengen schuift het dus vanzelf op);
           - is er nooit betaald (de gratis app), dan valt het terug op de
             oorspronkelijke jaartermijn na de goedkeuring -- er is dan geen
             betaalde periode om te volgen.

         Loopt de relatie nog, dan blijft het bewijs staan. Is hij voorbij,
         dan is de kluis er klaar mee: DIRECT wissen. Alleen als er een
         vastgelegd bewaarverzoek ligt (md.bewaarVerzoek, met wie het vroeg en
         waarom) mag het nog een jaar na dat einde blijven. Zo is bewaren na
         afloop altijd een besluit met een naam eronder, en nooit de
         standaard. */
      const betaaldTot = lidTot(u.id) || 0;
      const einde = betaaldTot || ((Date.parse(md.geverifieerdOp) || 0) + I.idDagen * DAG);
      const grens = md.bewaarVerzoek ? einde + I.idDagen * DAG : einde;
      if (t >= grens && (u.id_doc || md.selfie)) {
        wisDossier(u, md);
        dossiers++;
      }
    }
    for (const u of accounts.listByVerification('rejected')) {
      const md = accounts.getMemberState(u.id) || {};
      if (u.id_doc || md.selfie) { wisDossier(u, md); dossiers++; }
    }

    if (posities || dossiers || sosPosities) {
      save();
      if (log && log.schrijf) {
        try { log.schrijf('info', 'bewaarveger', { posities, dossiers, sosPosities }); } catch (e) {}
      }
    }
    return { posities, dossiers, klokGestart, sosPosities };
  }

  function start() {
    const t = setInterval(() => require('./kern/dienstidentiteit').alsDienst('bewaarveger', veeg), 3600000);
    if (t.unref) t.unref();
    return t;
  }

  return { veeg, start, instel: I };
}

module.exports = { maakBewaarveger, STANDAARD };
