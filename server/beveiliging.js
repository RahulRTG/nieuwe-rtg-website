/* Beveiligingsmeldingen ("inbraakdetectie") voor het technische Backoffice-bord.

   Vangt de hoog-signaal-gebeurtenissen op die op "we worden aangevallen" wijzen
   en zet ze op het beveiligde bord van de eigenaar:
   - brute force: te veel mislukte inlogpogingen (de rate-limit sloeg aan);
   - iemand die aan de eigenaar-deur morrelt: mislukte login op de technische
     pagina, of een geldig account dat toegang tot de technische pagina probeert
     zonder recht (mogelijke rechten-escalatie);
   - massale noodschakelingen (bijv. "alles uit") en andere verdachte patronen.

   Meldingen worden samengevoegd (dezelfde soort + bron binnen twee minuten telt
   op i.p.v. een nieuwe regel), begrensd bewaard als audit-spoor, en bij ernst
   'kritiek' krijgt de eigenaar meteen een melding (push + e-mail), met een
   ingebouwde rem zodat één aanval geen honderd meldingen stuurt.

   Zuiver en testbaar: alle afhankelijkheden komen via ctx binnen. */
const crypto = require('crypto');

const ERNST = { info: 0, waarschuwing: 1, kritiek: 2 };
const MAX = 200;                 // audit-staart: hoeveel regels we bewaren
const SAMENVOEG_MS = 2 * 60000;  // zelfde soort+bron hierbinnen -> tellen
const ESCALATIE_MS = 5 * 60000;  // niet vaker dan 1x per 5 min per soort escaleren

module.exports = (ctx) => {
  const { db, save, notifyOwner } = ctx;
  const laatstGemeld = new Map(); // sleutel -> ts van laatste escalatie (in geheugen)

  function lijst() {
    if (!db.data.techniek) db.data.techniek = {};
    if (!Array.isArray(db.data.techniek.beveiliging)) db.data.techniek.beveiliging = [];
    return db.data.techniek.beveiliging;
  }
  const score = e => ERNST[e] == null ? 0 : ERNST[e];

  /* Meld een gebeurtenis. ernst: 'info' | 'waarschuwing' | 'kritiek'.
     meta.bron identificeert de bron (bijv. IP of bucket) voor het samenvoegen. */
  function meld(type, ernst, tekst, meta) {
    ernst = ERNST[ernst] == null ? 'waarschuwing' : ernst;
    const arr = lijst();
    const nu = Date.now();
    const bron = (meta && meta.bron) || '';
    const sleutel = type + '|' + bron;
    const kop = arr[0];
    if (kop && kop.sleutel === sleutel && !kop.afgehandeld && (nu - kop.atMs) < SAMENVOEG_MS) {
      kop.aantal = (kop.aantal || 1) + 1;
      kop.atMs = nu; kop.at = new Date(nu).toISOString();
      kop.tekst = tekst;
      if (score(ernst) > score(kop.ernst)) kop.ernst = ernst;
    } else {
      arr.unshift({ id: crypto.randomBytes(4).toString('hex'), sleutel, type, ernst,
        tekst, meta: meta || {}, aantal: 1, afgehandeld: false, at: new Date(nu).toISOString(), atMs: nu });
      if (arr.length > MAX) arr.length = MAX;
    }
    save();
    if (ernst === 'kritiek') escaleer(sleutel, tekst);
    return arr[0];
  }

  // Bij een kritieke gebeurtenis de eigenaar waarschuwen, met een rem per soort.
  function escaleer(sleutel, tekst) {
    const nu = Date.now();
    if ((nu - (laatstGemeld.get(sleutel) || 0)) < ESCALATIE_MS) return;
    laatstGemeld.set(sleutel, nu);
    if (typeof notifyOwner === 'function') {
      try { notifyOwner({ title: '🛡️ Beveiligingsalarm', body: tekst }); } catch (e) {}
    }
  }

  // Overzicht voor het bord: open (onafgehandelde) meldingen, tellers per ernst.
  function samenvatting(limiet = 40) {
    const arr = lijst();
    const open = arr.filter(m => !m.afgehandeld);
    return {
      open: open.length,
      kritiek: open.filter(m => m.ernst === 'kritiek').length,
      waarschuwing: open.filter(m => m.ernst === 'waarschuwing').length,
      recent: arr.slice(0, limiet).map(m => ({ id: m.id, type: m.type, ernst: m.ernst,
        tekst: m.tekst, aantal: m.aantal, at: m.at, afgehandeld: m.afgehandeld }))
    };
  }

  // Aantal open kritieke meldingen (voor het actiecentrum van de Backoffice).
  function openKritiek() { return lijst().filter(m => !m.afgehandeld && m.ernst === 'kritiek').length; }
  function openTotaal() { return lijst().filter(m => !m.afgehandeld).length; }

  // De eigenaar handelt een melding af (of alles ineens).
  function handelAf(id) {
    const arr = lijst();
    let n = 0;
    for (const m of arr) if ((!id || m.id === id) && !m.afgehandeld) { m.afgehandeld = true; m.afgehandeldAt = new Date().toISOString(); n++; }
    if (n) save();
    return n;
  }

  return { meld, samenvatting, handelAf, openKritiek, openTotaal };
};
