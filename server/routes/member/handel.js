/* Domein "member", deelmodule handel & wonen: veilig laten bezorgen door
   een modewinkel, boodschappen bij de groothandel, digitale contracten
   en het vastgoed van het lid. Alleen routes; de logica woont in de
   kern-modules. */
module.exports = (kern) => {
  const { liveCodename, zorgContact } = kern;

  // Alleen aangeroepen na een geslaagde bestel-/bezorgaanvraag. Ook een gratis
  // account krijgt nazorg bij die eigen transactie; een anonieme gast niet.
  const openLijn = (s, req) => {
    if (!s || (req.session.tier === 'guest' && !req.session.account)) return;
    try { zorgContact(s, req.session.key, liveCodename(req.session), req.session.tier); } catch (e) {}
  };

  /* De drie domeindelen draaien als submodules op de gedeelde kern plus
     openLijn, een keer gemount bij het opstarten. */
  const hctx = { kern, openLijn };
  require('./handel/winkel')(hctx);
  require('./handel/vastgoed')(hctx);
  require('./handel/uitjes')(hctx);
};
