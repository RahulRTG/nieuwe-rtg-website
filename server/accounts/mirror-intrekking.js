/* Accounts, deel "mirror-intrekking": de GEDEELDE intrekkingsoutbox in
   PostgreSQL. Een ingetrokken sessie of token moet op ELKE instance dicht zijn,
   niet alleen op de instance die hem introk; daarom staat de intrekking in een
   outbox die alle instances lezen en afvinken. Afgesplitst uit ./mirror.js: de
   spiegel houdt rijen gelijk, dit houdt een belofte over toegang.

   Fail-closed: in Postgres-stand zonder gereede outbox is dat een fout
   (INTREKOPSLAG_ONZEKER) en nooit een stille "gelukt". Zonder DATABASE_URL is
   er niets te delen en is dit inert. `laag()` geeft de live outbox of null. */
'use strict';

module.exports = ({ PGMODE, laag }) => {
  function eisIntrekkingen() {
    if (!PGMODE) return null;
    const l = laag();
    if (!l) {
      const e = new Error('de gedeelde PostgreSQL-intrekkingsoutbox is niet gereed');
      e.code = 'INTREKOPSLAG_ONZEKER'; throw e;
    }
    return l;
  }
  async function bewaarIntrekking(rij) {
    const l = eisIntrekkingen();
    return l ? l.bewaar(rij) : true;
  }
  async function gedeeldeIntrekkingen(sleutels) {
    const l = eisIntrekkingen();
    return l ? l.lijst(Date.now(), sleutels) : [];
  }
  async function voltooiIntrekkingen(sleutels) {
    const l = eisIntrekkingen();
    return l ? l.voltooi(sleutels) : true;
  }
  return { bewaarIntrekking, gedeeldeIntrekkingen, voltooiIntrekkingen };
};
