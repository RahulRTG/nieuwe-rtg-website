/* Boot-datalaag, deel 5/7 (nieuwe): een aaneengesloten blok
   db.data-standaarden/demo-seed uit initRealtime. Afgesplitst uit server.js; de
   context levert db, save en de seed-helpers. Draait in vaste volgorde via ./index. */
module.exports = (ctx) => {
  const { db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS } = ctx;
  /* ---- de negen nieuwe sectoren: elke sector een eigen app-ingang op
     dezelfde motor. De types wijzen naar bestaande vermogens (caps), zodat
     kassa, personeel, facturen, contracten, borden en AI overal meteen
     werken; per sector een demopartner om mee te spelen. ---- */
  // De genres van dit deel staan in server/seed/genres.js (het genre-register).
  const NIEUWE_PARTNERS = require('./deel5-partners');
  for (const p of NIEUWE_PARTNERS) {
    const bestaand = db.data.suppliers.find(s => s.code === p.code);
    if (!bestaand) { p.geseed = true; db.data.suppliers.push(p); ensureSupplierDefaults(p); }
    else bestaand.geseed = true;  // ook op een database van voor het merkteken
  }
};
