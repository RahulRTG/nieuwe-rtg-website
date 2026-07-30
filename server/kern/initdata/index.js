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
  require('./deel10-genres')(ctx);
  /* Nog een keer de Salon-profielen: deel8 en deel9 zetten hun zaken pas na
     deel7 neer, en zonder bio en foto is een zaak voor leden onzichtbaar. */
  if (typeof ctx.salonProfielen === 'function') ctx.salonProfielen();
};
