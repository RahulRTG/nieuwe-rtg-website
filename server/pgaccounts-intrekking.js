/* Gedeelde pending-outbox voor credentialintrekking. PostgreSQL bewaart alleen
   een SHA-256-tokenvinger of niet-geheime sid en verwijdert de rij pas nadat
   Redis de vervallende sleutel atomisch heeft gezet en gepubliceerd. */
'use strict';

module.exports = function maakIntrekkingen(pool) {
  async function schema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS intrekking_outbox (
      sleutel TEXT PRIMARY KEY,
      soort TEXT NOT NULL,
      waarde TEXT NOT NULL,
      verloopt BIGINT NOT NULL
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_intrekking_outbox_verloopt ON intrekking_outbox(verloopt)');
  }
  async function bewaar(rij) {
    await pool.query(`INSERT INTO intrekking_outbox (sleutel, soort, waarde, verloopt)
      VALUES ($1,$2,$3,$4) ON CONFLICT (sleutel) DO UPDATE SET
      soort=EXCLUDED.soort, waarde=EXCLUDED.waarde, verloopt=EXCLUDED.verloopt`,
    [rij.sleutel, rij.soort, rij.waarde, Number(rij.verloopt)]);
    return true;
  }
  async function lijst(nu) {
    await pool.query('DELETE FROM intrekking_outbox WHERE verloopt < $1', [Number(nu)]);
    const { rows } = await pool.query(
      'SELECT sleutel, soort, waarde, verloopt FROM intrekking_outbox WHERE verloopt >= $1 ORDER BY sleutel',
      [Number(nu)]);
    return rows.map(r => Object.assign({}, r, { verloopt: Number(r.verloopt) }));
  }
  async function voltooi(sleutels) {
    for (const sleutel of sleutels || [])
      await pool.query('DELETE FROM intrekking_outbox WHERE sleutel = $1', [sleutel]);
    return true;
  }
  return { schema, bewaar, lijst, voltooi };
};
