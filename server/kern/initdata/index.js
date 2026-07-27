/* Boot-datalaag (initRealtime): schrijft alle db.data-standaarden en de demo-seed.
   Draait EENMALIG na load() en bij een failover-promotie. De inhoud is opgesplitst
   in opeenvolgende blokken (deel1..deel8); index roept ze in vaste volgorde aan,
   zodat de db.data-vorm precies gelijk blijft aan de oude, ene functie. */
module.exports = function initRealtime(ctx) {
  require('./deel1-basis')(ctx);
  require('./deel2-kern')(ctx);
  require('./deel3-sectoren')(ctx);
  require('./deel4-genres')(ctx);
  require('./deel5-nieuwe')(ctx);
  require('./deel6-diensten')(ctx);
  require('./deel7-salon')(ctx);
  require('./deel8-bouw')(ctx);
  require('./deel9-vakken')(ctx);
};
