/* ============================================================================
   DE SCHRIJVER -- een regel is pas vastgelegd als PostgreSQL de COMMIT bevestigt.

   Eén transactie per regel: slot nemen, de kop lezen, de regel bouwen, invoegen,
   committen, en ALLEEN DAN terugkeren. Er is geen write-behind en geen
   "later": een aanroeper die een uitkomst krijgt, kan erop rekenen dat de regel
   op schijf staat (synchronous_commit staat expliciet aan voor deze transactie).

   FAALT HET, DAN GOOIT HET. `AUDIT_NIET_VASTGELEGD` is geen waarschuwing maar de
   uitkomst: een aanroeper die dat wegvangt en doorgaat, meldt succes over niets
   (dezelfde faalvorm als `schrijf-verloren` in lib/verraad.js). Een kritieke
   handeling of een releasestap gaat dus NIET door zonder regel.

   TIJD EN VOLGNUMMER zijn van de schrijver. De aanroeper kan geen tijdstip
   meegeven (alleen een test via `opties.nu`), en volgnummers zijn aaneengesloten:
   een gat is een verwijderde regel en wordt zo gezien.
   ========================================================================== */
'use strict';
const os = require('os');
const { maakRegel } = require('./regel');
const { SLOT } = require('./schema');

const instantie = () => String(process.env.RTG_INSTANCE_ID || os.hostname() || 'onbekend').replace(/[^A-Za-z0-9_.:-]/g, '-').slice(0, 64) || 'onbekend';

function nietVastgelegd(oorzaak) {
  const fout = new Error('Auditregel is niet vastgelegd: ' + (oorzaak && oorzaak.message || 'onbekend'));
  fout.code = 'AUDIT_NIET_VASTGELEGD'; fout.oorzaak = oorzaak;
  return fout;
}

/* De kern, binnen een bestaande transactie die het slot al heeft. Ook de
   bewaringstaak gebruikt dit, zodat verwijderen en het vastleggen ervan in EEN
   transactie gebeuren. */
async function voegIn(client, inv, opties = {}) {
  const invoer = { ...inv, bron: inv.bron || { dienst: opties.dienst || 'app', instantie: instantie() } };
  const kop = (await client.query('SELECT nr, hash FROM auditboek ORDER BY nr DESC LIMIT 1')).rows[0]
    || (await client.query('SELECT nr, hash FROM auditboek_checkpoint ORDER BY nr DESC LIMIT 1')).rows[0] || null;
  const tijd = new Date(Number.isFinite(opties.nu) ? opties.nu : Date.now()).toISOString();
  const regel = maakRegel(invoer, { nr: kop ? Number(kop.nr) + 1 : 1, vorige: kop ? kop.hash : null, tijd });
  await client.query(
    'INSERT INTO auditboek(nr, tijd, type, categorie, actor, regel, vorige, hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [regel.nr, tijd, regel.type, regel.categorie, regel.actor.soort + ':' + regel.actor.ref, JSON.stringify(regel), regel.vorige, regel.hash]);
  return { nr: regel.nr, hash: regel.hash, tijd };
}

async function noteer(pool, inv, opties = {}) {
  let client;
  try { client = await pool.connect(); } catch (e) { throw nietVastgelegd(e); }
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL synchronous_commit = on');
    await client.query('SELECT pg_advisory_xact_lock($1)', [SLOT]);
    const uit = await voegIn(client, inv, opties);
    await client.query('COMMIT');
    return uit;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    if (e && e.code === 'AUDIT_ONGELDIG') throw e;
    throw nietVastgelegd(e);
  } finally { client.release(); }
}

module.exports = { noteer, voegIn, nietVastgelegd, instantie };
