/* Kern-module "ledenbalie-zaken": wat de balie zelf NOTEERT -- klachten en
   abonnementsvoorstellen.

   Los van ledenbalie.js langs een echte scheiding: dat bestand kijkt in de
   kluis (zoeken, dossier, herstel) en loopt daarom door het inzagejournaal;
   dit bestand raakt de identiteit niet en houdt gewoon een eigen administratie
   bij. Twee soorten werk, twee bestanden -- en zo blijven ze allebei
   onder de 10 KB van keuringsregel 13.

   De gedeelde hulpjes (reden, tijd, id, wie) komen mee uit ledenbalie.js in
   plaats van hier opnieuw te worden geschreven: een tweede redencontrole zou
   vroeg of laat een andere grens hanteren dan de eerste. */
'use strict';

const SOORTEN = ['reis', 'betaling', 'app', 'partner', 'anders'];
const STATUSSEN = ['open', 'in behandeling', 'opgelost', 'gesloten'];
const MENSELIJK = ['lifestyle', 'business']; // deze twee gaan nooit buiten een mens om

module.exports = ({ db, save, inzagelog, hulp, serviceEnvelop }) => {
  const { nu, rid, kort, inhoud, wie, redenOf, lidOf, pasVan, PASSEN, REDEN_MIN, geenReden, geenLid } = hulp;

  const eigen = require('./eigencollectie')({ db, domein: 'kern/ledenbalie-zaken', bezit: { balieKlachten: 'lijst', balieAboVoorstellen: 'lijst' } });
  const K = () => eigen.bak('balieKlachten');
  const V = () => eigen.bak('balieAboVoorstellen');

  /* Wat het dossier van een lid laat zien: de klachten die nog lopen, en de
     voorstellen die er over hem zijn gedaan. Kort gehouden -- het dossier is
     een werkscherm, geen archief. */
  function klachtenVan(lidId) {
    return K().filter(k => k.lidId === lidId && k.status !== 'gesloten' && k.status !== 'opgelost')
      .slice(0, 20).map(k => ({ id: k.id, soort: k.soort, tekst: k.tekst, status: k.status, at: k.at }));
  }
  function voorstellenVan(lidId) {
    return V().filter(v => v.lidId === lidId).slice(0, 10)
      .map(v => ({ id: v.id, naarPas: v.naarPas, status: v.status, at: v.at }));
  }

  function balieKlachtOpen(id, { door, tekst, soort } = {}) {
    const u = lidOf(id);
    if (!u) return geenLid;
    const t = kort(tekst, 1000);
    // dezelfde ondergrens als een reden: een regel van niks helpt het lid niet
    if (inhoud(t) < REDEN_MIN)
      return { status: 400, error: 'Schrijf op waar de klacht over gaat.' };
    const k = { id: rid(), lidId: u.id, codenaam: u.codename || null,
      soort: SOORTEN.includes(String(soort)) ? String(soort) : 'anders',
      tekst: t, status: 'open', door: wie(door), at: nu(),
      log: [{ status: 'open', door: wie(door), at: nu() }] };
    K().unshift(k);
    if (K().length > 5000) K().pop();
    save();

    /* DE ENVELOP ERBIJ, DE KLACHT BLIJFT VAN DIT BESTAND.

       RTG Service (kern/service/) weet wie eraan werkt, sinds wanneer en met
       welke bevoegdheid; het OORDEEL over wat er misging blijft hier. Dat is
       geen nette scheiding maar een noodzakelijke: een servicezaak kan opgelost
       worden terwijl de klacht nog onderzoek, oordeel en maatregel voor zich
       heeft. Zou de klacht met de zaak meesluiten, dan verdwijnt "de medewerker
       was onbeschoft" op het moment dat de bestelling alsnog wordt geleverd.

       Late gebonden en met een lege tak: de balie draaide er jaren zonder, en
       een klacht die niet meer kan worden vastgelegd omdat een LATERE laag
       ontbreekt, is een slechtere uitkomst dan een klacht zonder envelop. */
    let zaak = null;
    if (typeof serviceEnvelop === 'function') {
      try { zaak = serviceEnvelop(k) || null; } catch (e) { console.error('[ledenbalie] service-envelop', e && e.message); }
    }
    if (zaak) k.zaak = zaak;
    return { ok: true, klacht: k, zaak };
  }

  /* De stand verandert, de klacht blijft staan -- met wie hem verzette en
     wanneer. Zonder dat spoor is "opgelost" een bewering zonder afzender. */
  function balieKlachtStatus(klachtId, status, { door } = {}) {
    const st = String(status || '').trim().toLowerCase();
    if (!STATUSSEN.includes(st))
      return { status: 400, error: 'Kies een stand: ' + STATUSSEN.join(', ') + '.' };
    const k = K().find(x => x.id === String(klachtId || ''));
    if (!k) return { status: 404, error: 'Deze klacht kennen we niet.' };
    k.status = st;
    k.log.push({ status: st, door: wie(door), at: nu() });
    if (k.log.length > 50) k.log.shift();
    save();
    return { ok: true, klacht: k };
  }

  /* EEN VOORSTEL, NOOIT EEN TOEKENNING.

     Lifestyle en Business gaan uitsluitend na een MENSELIJK besluit
     (/api/aanmelding/beslis). Deze functie legt daarom alleen vast wat de balie
     voorstelt en waarom; ze raakt de pas van het lid niet aan -- er staat
     hieronder met opzet geen enkele schrijfactie op het account.

     Ook naar RTG of gratis blijft het een voorstel. Niet omdat dat gevaarlijk
     is, maar omdat een functie die soms wel en soms niet toekent de volgende
     lezer laat gokken welke van de twee hij voor zich heeft. */
  function balieAboVoorstel(id, { door, naarPas, reden } = {}) {
    const r = redenOf(reden);
    if (!r) return geenReden;
    const pas = String(naarPas || '').trim().toLowerCase();
    if (!PASSEN.includes(pas)) return { status: 400, error: 'Kies: ' + PASSEN.join(', ') + '.' };
    const u = lidOf(id);
    if (!u) return geenLid;
    const menselijk = MENSELIJK.includes(pas);
    const v = { id: rid(), lidId: u.id, codenaam: u.codename || null,
      vanPas: pasVan(u.tier), naarPas: pas, reden: r, door: wie(door),
      status: 'voorstel', besluit: null, viaMens: menselijk, at: nu() };
    V().unshift(v);
    if (V().length > 5000) V().pop();
    save();
    try {
      inzagelog.noteer({ door, over: { id: u.id, codenaam: u.codename }, waarom: r, bron: 'ledenbalie/abo' });
    } catch (e) {}
    return { ok: true, voorstel: v,
      let: menselijk
        ? 'Vastgelegd als voorstel. De ' + pas + '-pas wordt alleen toegekend na een menselijk besluit; de balie verleent niets.'
        : 'Vastgelegd als voorstel. De balie verleent zelf geen pas.' };
  }

  return { balieKlachtOpen, balieKlachtStatus, balieAboVoorstel, klachtenVan, voorstellenVan };
};
