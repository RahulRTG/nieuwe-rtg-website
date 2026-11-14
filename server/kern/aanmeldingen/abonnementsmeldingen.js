/* Contractueel betaalherstel wordt beschikbaar in de eigen bestaande inbox
   EN in het contractdossier, in dezelfde commit. Geen mailbezorgclaim, geen
   afhankelijkheid van optionele marketing-/pushvoorkeuren. */
'use strict';
const policy = require('./abonnementsherstel');
const { valideOndertekening } = require('./abonnementsaanbod');

module.exports = ({ db, bewerkCollectie, nu }) => {
  function input(c, data = db.data) {
    const rij = (data.lidmaatschapBetalingen || []).find(r => r.contractId === c.id);
    return { contract: c, op: nu(), termijnen: (rij?.termijnen || []).filter(t => t.status !== 'vervallen')
      .map(t => ({ ...t, betaling: t.betaalWaarheidId ? db.data.betaalWaarheid?.[t.betaalWaarheidId] : null })) };
  }
  function beoordeel(c) {
    if (!valideOndertekening(c, db.data.onboarding)) return { stand: 'CONTROLE_NODIG',
      controleNodig: true, beperkNieuweBetaaldeDiensten: false, reden: 'De ondertekenontvangst vereist controle.' };
    return policy.beoordeel(input(c));
  }
  async function meld(contractId) {
    return bewerkCollectie({ contracten: 'lijst', onboarding: 'kaart',
      lidmaatschapBetalingen: 'lijst', notifications: 'kaart' }, data => {
      const c = data.contracten.find(c => c.id === contractId && c.automatischAbonnement);
      if (!c || !valideOndertekening(c, data.onboarding)) return { ok: false, controleNodig: true };
      const bron = input(c, data), oordeel = policy.beoordeel(bron);
      if (oordeel.stand !== 'AANKONDIGING_NODIG') return oordeel;
      const r = policy.aankondiging(bron);
      if (!r.ok) return r;
      const h = r.herstel, key = 'user-' + c.accountId, id = 'ABO-HERSTEL-' + h.inhoudHash;
      const bak = data.notifications[key] || (data.notifications[key] = []);
      if (!Array.isArray(bak)) throw Error('De eigen inbox is niet leesbaar.');
      let note = bak.find(n => n.id === id);
      if (!note) {
        note = { id, read: false, at: h.at, title: 'Herstel uw abonnementstermijn', body: h.tekst,
          contractId: c.id, inhoudHash: h.inhoudHash };
        bak.unshift(note);
      }
      if (note.body !== h.tekst || note.inhoudHash !== h.inhoudHash || note.contractId !== c.id)
        throw Error('De eigen inboxmelding is niet gelijk aan de aankondiging.');
      c.herstel = { ...h, aankondiging: { referentie: id, kanaal: 'rtg-inbox',
        beschikbaarAt: h.at, inhoudHash: h.inhoudHash } };
      // De commit bewaart beide bronnen samen. Het contract blijft beschikbaar
      // wanneer de gewone inbox later oude meldingen buiten haar venster schuift.
      return { ok: true, herstel: c.herstel };
    });
  }
  return { beoordeel, meld, magDienst: policy.magDienst };
};
