/* Kantoren, deel "bank-passkey": DE PASSKEY AAN DE KANTOORDEUR, VOOR GELD.

   Besluit van de eigenaar (25 september 2026): een geldhandeling op kantoor gaat
   niet meer door op de terugval zonder passkey, en de TWEEDE ondertekenaar -- wiens
   klik het geld werkelijk beweegt -- bevestigt met dezelfde ceremonie. Dat is
   strenger dan de schaduw-eerst-volgorde van AUTHORITY.md, en met opzet: de
   eigenaar koos voor geld direct dicht.

   Twee loketten die de ceremonie openen, elk met de binding van zijn handeling:
   - de incassoronde, gebonden aan zijn grens ('incasso:' + tot). Zonder dit loket
     kon een medewerker MET passkey de ronde nooit starten, terwijl een medewerker
     zonder passkey er op de terugval door kwam (gevonden 25 september 2026);
   - de tweede handtekening, gebonden aan de aanvraag ('handtekening:' + id), en
     alleen voor een handeling die zich bij kern/kantoor/tweedehandtekening.js als
     `geld` heeft aangemeld. Een rood-limiet zetten beweegt geen geld en blijft zo.

   Dezelfde deur als de handeling zelf (kluisAuth: een naam, nooit de gedeelde
   code). `geldPasskey` is de controle die de bevestig-route voor zich zet.

   Gemount vanuit ./bank-tweedehand.js, dat de controle voor zijn bevestig-route
   nodig heeft; zo komt er geen nieuwe naam in de gedeelde kern-context bij. */
'use strict';

module.exports = (ctx) => {
  const { app, kluisAuth, zwaar, boardroomUser, tweedeHand } = ctx;

  /* Twee routes met hun pad LETTERLIJK in de aanroep: de schakelkast leest paden
     uit de bron, en een pad dat een helper opbouwt ziet hij niet. */
  async function loket(req, res, actie, binding) {
    if (!binding) return res.status(400).json({ error: 'Voor welke handeling? Die ontbreekt of klopt niet.' });
    const r = await zwaar.opties(boardroomUser(req), actie, binding, req);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  }

  app.post('/api/office/bank/incasso/opties', kluisAuth, (req, res) => {
    const tot = (req.body || {}).tot != null ? Number(req.body.tot) : NaN;
    return loket(req, res, 'bank.incasso', Number.isFinite(tot) ? 'incasso:' + tot : null);
  });
  app.post('/api/office/bank/handtekening/opties', kluisAuth, (req, res) => {
    const id = String((req.body || {}).id || '');
    return loket(req, res, 'bank.bevestig', id && tweedeHand.raaktGeld(id) ? 'handtekening:' + id : null);
  });

  /* Voor de bevestig-route: raakt de aanvraag geld, dan eerst de passkey van de
     tweede mens, zonder terugval. Anders ongemoeid (een onbekende aanvraag geeft
     de route zelf zijn 404). */
  async function geldPasskey(req, res, next) {
    const id = String((req.body || {}).id || '');
    if (!tweedeHand.raaktGeld(id)) return next();
    const zw = await zwaar.eis(boardroomUser(req), 'bank.bevestig', 'handtekening:' + id, req,
      'De tweede handtekening onder een geldhandeling', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);
    next();
  }

  return { geldPasskey };
};
