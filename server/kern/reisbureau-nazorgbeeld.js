/* Het ledenbeeld van de interne reisgeschiedenis.
   De medewerkernaam blijft binnen het kantoor; het lid ziet alleen de rol. */
'use strict';

module.exports = function nazorgbeeld(a) {
  if (!a.geschiedenis) return a;
  return Object.assign({}, a, {
    geschiedenis: a.geschiedenis.map(r => {
      const uit = { wat: r.wat, at: r.at, door: r.door === 'lid' ? 'u' : 'het reisbureau' };
      for (const veld of ['reden', 'bericht', 'toelichting', 'gevraagd', 'was', 'werd']) {
        if (r[veld] != null) uit[veld] = r[veld];
      }
      return uit;
    })
  });
};
