'use strict';
/* DE TWEE AFNEMERS VAN verbindCode die geen route zijn: de wervingscode bij het
   registreren (routes/auth/account.js) en de aanname vanuit een sollicitatie.
   Afgesplitst uit ./uitnodiging-claim.js, dat over de claim zelf gaat en
   anders over de omvanggrens van keuringsregel 13 ging (N36). Allebei geven
   ze alleen een uitslag door en nooit het hele antwoord van verbindCode. */
const { idVanKey } = require('../../../lib/lidsleutel');

module.exports = (ctx, verbindCode) => {
  const { accounts } = ctx;

  async function wisselCodeIn(lid, kassacode) {
    if (!lid || !kassacode) return null;
    try {
      const v = await verbindCode(lid, kassacode, {}, null);
      return v && v.ok
        ? { code: v.s.code, bedrijf: v.s.name, staffId: v.staff.id,
          role: v.invite.role, ...(v.pin ? { pin: v.pin } : {}) }
        : null;
    } catch (e) { return null; }
  }

  async function neemAan(supplier, uitgegeven, sollicitatieKey) {
    const id = idVanKey(sollicitatieKey);
    if (id == null) return null;
    const lid = accounts.getUserById(id);
    if (!lid) return null;
    const v = await verbindCode(lid, uitgegeven.kassacode, {}, supplier.code);
    return v && v.ok ? { staffId: v.staff.id, naam: v.naam, dienstverband: v.dienstverband || null } : null;
  }

  return { wisselCodeIn, neemAan };
};
