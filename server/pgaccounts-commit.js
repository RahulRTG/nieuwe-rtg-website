/* PostgreSQL-kant van de voorbereide accountparticipant.

   De aanroeper levert de al geopende client. Per account nemen we een vaste
   advisory lock en vergelijken we de requestbasis na FOR UPDATE, zodat een
   verouderde SQLite-werkkopie nooit een nieuwere accountstand overschrijft.
   Alleen deze helft maakt de participant nog niet actief; duurzaamheid.js
   houdt de productiepoort dicht totdat ook de centrale commit hem draagt. */
'use strict';

const GETAL_USER = new Set(['id', 'reset_expires', 'email_verified', 'actief', 'sessies_vanaf']);
const GETAL_STAFF = new Set(['id', 'active', 'member_id']);

module.exports = function maakPgAccountCommit(o) {
  const normaliseer = (rij, cols, getallen) => {
    if (!rij) return null;
    return cols.map(c => {
      const v = o.waarde(rij, c);
      if (v == null) return null;
      return getallen.has(c) ? Number(v) : String(v);
    });
  };
  const gelijk = (a, b, cols, getallen) =>
    JSON.stringify(normaliseer(a, cols, getallen)) ===
      JSON.stringify(normaliseer(b, cols, getallen));
  const conflict = tekst => Object.assign(new Error(tekst), { code: 'PG_REQUEST_CONFLICT' });

  return async function pasAccountWijzigingenToe(client, wijzigingen) {
    if (!client || typeof client.query !== 'function')
      throw new Error('Accountcommit vereist de client van de PostgreSQL-requesttransactie.');
    const lijst = (wijzigingen || []).slice().sort((a, b) =>
      String(a.tabel).localeCompare(String(b.tabel)) || Number(a.id) - Number(b.id));
    let geschreven = 0;
    for (const wijziging of lijst) {
      const staff = wijziging.tabel === 'supplier_staff';
      if (!staff && wijziging.tabel !== 'users')
        throw new Error('Onbekende accounttabel: ' + wijziging.tabel);
      const cols = staff ? o.staffCols : o.userCols;
      const getallen = staff ? GETAL_STAFF : GETAL_USER;
      const tabel = staff ? 'supplier_staff' : 'users';
      const id = Number(wijziging.id);
      if (!Number.isSafeInteger(id) || id < 1)
        throw new Error('Ongeldig account-id in requestcommit.');

      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
        ['account:' + tabel + ':' + id]);
      const huidig = await client.query(
        `SELECT ${cols.join(', ')} FROM ${tabel} WHERE id=$1 FOR UPDATE`, [id]);
      const rij = huidig.rows[0] || null;
      if (!gelijk(rij, wijziging.basis, cols, getallen))
        throw conflict('De account- of personeelsrij is tijdens dit verzoek gewijzigd.');

      try {
        if (!wijziging.na) {
          if (rij) {
            await client.query(`DELETE FROM ${tabel} WHERE id=$1`, [id]);
            geschreven++;
          }
        } else if (!rij) {
          const plekken = cols.map((_, i) => '$' + (i + 1)).join(', ');
          await client.query(`INSERT INTO ${tabel} (${cols.join(', ')}) VALUES (${plekken})`,
            cols.map(c => o.waarde(wijziging.na, c)));
          geschreven++;
        } else {
          const zet = cols.filter(c => c !== 'id');
          await client.query(`UPDATE ${tabel} SET ${zet.map((c, i) => c + '=$' + (i + 1)).join(', ')}
            WHERE id=$${zet.length + 1}`,
          zet.map(c => o.waarde(wijziging.na, c)).concat(id));
          geschreven++;
        }
      } catch (e) {
        if (String(e && e.code) === '23505' || /unique|duplicate/i.test(String(e && e.message || e)))
          throw conflict('De gekozen account- of personeelskoppeling is intussen in gebruik.');
        throw e;
      }
      await client.query('SELECT pg_notify($1, $2)', [o.kanaal,
        (staff ? 'staff:' : 'user:') + id + ':' + o.bron]);
    }
    return { geschreven, rijen: lijst.map(x => x.tabel + ':' + x.id) };
  };
};
