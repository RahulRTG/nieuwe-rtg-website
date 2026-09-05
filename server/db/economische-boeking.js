'use strict';

/* Opslagkeuze voor de atomische economische boeking. Productie krijgt nooit
   de proceslokale fallback: zonder PostgreSQL/SQLite wordt vóór het werk
   geweigerd. De fallback houdt alleen losse ontwikkeltests compatibel. */
module.exports = ({ db, store, postgres, sqlite, bijeen, save }) => {
  const lokaal = new Map();
  return async function boekEenmaal(invoer, werk) {
    if (!db.writable) throw new Error('De opslag is niet schrijfbaar.');
    return bijeen(async () => {
      if (!/^payout-terug:[a-f0-9]{64}$/.test(String(invoer && invoer.sleutel || '')))
        throw new Error('Economische boeking vereist een vaste hash-sleutel.');
      if (store === 'postgres') return postgres.economischeBoekingPostgres(invoer, werk);
      if (store === 'sqlite') return sqlite.economischeBoekingSqlite(invoer, werk);
      if (process.env.NODE_ENV === 'production')
        throw new Error('Productie mist een duurzame backend voor economische boekingen.');
      const k = String(invoer && invoer.sleutel || ''), oud = lokaal.get(k);
      if (oud) return oud.afdruk === invoer.afdruk
        ? Object.assign({}, oud.antwoord, { herhaald: true })
        : { status: 409, error: 'Deze economische sleutel hoort al bij een andere boeking.' };
      const r = werk();
      if (r && typeof r.then === 'function') throw new Error('De economische bewerker mag niet asynchroon zijn.');
      if (r && r.ok) { lokaal.set(k, { afdruk: invoer.afdruk, antwoord: r }); save(); }
      return r;
    });
  };
};
