/* Kern-module "gids": de ledengids (sleutel -> codenaam + pas), de enige
   plek waar leden elkaar op codenaam vinden zonder dat er ooit een echte
   naam over de lijn gaat. Met Postgres staan de leden als geindexeerde
   rijen buiten het geheugen (ledenGids* uit db.js); zonder Postgres draait
   alles op db.data.memberDir zoals voorheen. De lezers merken het verschil
   niet: gidsHaal/gidsZoekCodenaam/keyVanCodenaam blijven hetzelfde. */
module.exports = ({ db, save, liveCodename, ledenGidsActief, ledenGidsHaal, ledenGidsZet, ledenGidsExact, ledenGidsZoek, ledenGidsAantal }) => {
  // de demo-persona's die bij het opstarten in de gids komen; geen echte leden
  const GIDS_SEED_TIERS = ['rtg', 'lifestyle', 'business'];

  /* Wordt bijgehouden zodra een lid iets doet: echte accounts (ook de gratis
     laag) staan in de codenaam-gids; alleen een anonieme demo-gast zonder
     account niet. */
  function dirTouch(sess) {
    if (!sess) return;
    if (sess.tier === 'guest' && !sess.account) return;
    const cn = liveCodename(sess);
    // Met Postgres gaat het lid naar de geindexeerde ledengids (member_dir) en
    // NIET naar db.data.memberDir: zo groeit de gids buiten het geheugen en
    // staan er bij miljoenen leden geen miljoenen rijen in het proces.
    if (ledenGidsActief()) {
      const cur = ledenGidsHaal(sess.key);
      if (!cur || cur.codename !== cn || cur.tier !== sess.tier) ledenGidsZet(sess.key, cn, sess.tier).catch(() => {});
      return;
    }
    if (!db.data.memberDir) return;
    const cur = db.data.memberDir[sess.key];
    if (!cur || cur.codename !== cn || cur.tier !== sess.tier) {
      if (!cur && ledenAantalCache != null) ledenAantalCache++; // nieuw lid: teller ophogen
      db.data.memberDir[sess.key] = { codename: cn, tier: sess.tier };
      save();
    }
  }

  /* Goedkoop ledental voor de kantoor-totalen. Object.keys(memberDir).length
     is O(N) en materialiseert alle sleutels: bij miljoenen leden seconden per
     kantoorverzoek. We cachen het aantal, hogen het op bij een nieuw lid (zie
     dirTouch) en verversen alleen bij een externe datawijziging. */
  let ledenAantalCache = null;
  function ledenAantalVerversen() { ledenAantalCache = null; }
  function ledenAantal() {
    // Met Postgres komt het ledental uit de geindexeerde gids (O(1), telt ook
    // de leden buiten het geheugen). Zonder: de onderhouden lokale teller,
    // met de seed-persona's eraf.
    if (ledenGidsActief()) return ledenGidsAantal();
    if (ledenAantalCache == null) {
      const dir = db.data.memberDir || {};
      ledenAantalCache = Object.keys(dir).length - GIDS_SEED_TIERS.filter(k => dir[k]).length;
    }
    return ledenAantalCache;
  }

  // Eenpuntstoegang tot de gids: met Postgres uit de geindexeerde tabel
  // (cache + backfill), zonder Postgres uit db.data.memberDir.
  function gidsHaal(key) {
    if (ledenGidsActief()) return ledenGidsHaal(key) || null;
    return db.data.memberDir[key] || null;
  }
  // Zoeken op (deel van) een codenaam. Met Postgres geindexeerd; anders een
  // scan over het geheugen. exact=true eist een exacte codenaam.
  async function gidsZoekCodenaam(q, exact) {
    const ql = String(q || '').trim().toLowerCase();
    if (!ql) return [];
    if (ledenGidsActief()) {
      // Exact opzoeken (het hete pad: p2p-betalen, uitnodigen, bellen) loopt over
      // de btree-index (codename_lower = $1) plus de synchrone omgekeerde cache,
      // niet over de trigram-scan. O(log n) i.p.v. een deelzoek over 100M rijen.
      if (exact) {
        const hit = ledenGidsExact ? await ledenGidsExact(ql) : null;
        return hit ? [{ key: hit.key, codename: hit.codename, tier: hit.tier }] : [];
      }
      // Deelzoeken ("vind een vriend") vraagt minstens 3 tekens: de trigram-index
      // werkt op drietallen, dus onder de drie tekens zou Postgres alle rijen
      // scannen (bij 100M leden seconden per zoekopdracht, en een makkelijke
      // manier om de server te laten zwoegen). Kort/rommelig -> leeg, geen scan.
      if (ql.length < 3) return [];
      return await ledenGidsZoek(ql, 50);
    }
    const out = [];
    for (const [key, m] of Object.entries(db.data.memberDir || {})) {
      const cl = String(m.codename || '').toLowerCase();
      if (cl && (exact ? cl === ql : cl.includes(ql))) out.push({ key, codename: m.codename, tier: m.tier });
    }
    return out;
  }

  /* Een lid opzoeken op codenaam (voor contracten, uitnodigingen): de gids
     koppelt de sleutel aan de codenaam, nooit aan een echte naam. Async: met
     Postgres een geindexeerde opzoeking i.p.v. een scan door het geheugen. */
  async function keyVanCodenaam(codenaam) {
    const c = String(codenaam || '').trim();
    if (!c) return null;
    const treffers = await gidsZoekCodenaam(c, true);
    return treffers.length ? { key: treffers[0].key, tier: treffers[0].tier, codename: treffers[0].codename } : null;
  }

  return { GIDS_SEED_TIERS, dirTouch, ledenAantal, ledenAantalVerversen, gidsHaal, gidsZoekCodenaam, keyVanCodenaam };
};
