/* RTG Werk OS (deellaag): een goedgekeurde uitgave BETALEN vanaf de RTG-rekening
   van de gekoppelde entiteit (../kern/bank/entiteit.js). Besluit van de
   eigenaar, 24 september 2026.

   Dit is de enige weg waarlangs geld van de rekening van een entiteit gaat, en
   hij hangt aan alles wat al staat: de uitgave is ROND (de goedkeuringen, de
   tekengrens en samen tekenen uit ./regelpoort.js en ./samentekenen.js), de
   betaler is een ANDER dan de indiener (functiescheiding, net als bij betaald
   noteren), en een mens DRUKT -- er is geen ronde die uit zichzelf betaalt
   (GELD.md). De uitgave is de idempotentiesleutel: een tweede druk, of twee
   mensen tegelijk, betaalt niet twee keer. */
'use strict';

module.exports = (sctx) => {
  const { app, save, nu, werkPoort, log, eigenVeld, kern } = sctx;
  const euro = (c) => (Number(c || 0) / 100).toFixed(2);

  app.post('/api/bedrijf/uitgave/betaal', async (req, res) => {
    const g = werkPoort(req, res, 'geld'); if (!g) return;
    if (g.directie || !g.l.id) return res.status(403).json({ error: 'Betalen doet een lid met een eigen sleutel, niet het beheer-token.' });
    const u = eigenVeld(sctx.UITGAVEN(g.w), String(req.body.id || ''));
    if (!u) return res.status(404).json({ error: 'Die uitgave kennen we niet.' });
    if (u.betaald) return res.status(409).json({ error: 'Deze uitgave is al betaald, sinds ' + u.betaald.at + '.' });
    if (u.door.lidId === g.l.id) return res.status(409).json({
      error: 'U diende deze uitgave in, dus u betaalt hem niet. Wie een betaling maakt en hem ook uitvoert, heeft de hele keten alleen in handen.' });
    const s = sctx.regelStand(g.w, 'uitgave', u);
    if (!s.mag) return res.status(409).json({ error: 'Deze uitgave is nog niet goedgekeurd. Nog nodig: ' + s.ontbreekt.join(' en ') + '.' });
    const bw = sctx.betaalwijze(g.w);
    if (bw.wijze !== 'entiteit') return res.status(409).json({
      error: 'Deze werkruimte betaalt niet vanaf een entiteit.' + (bw.reden ? ' ' + bw.reden : ''), betaalwijze: bw.wijze });
    if (!u.iban) return res.status(409).json({ error: 'Deze uitgave heeft geen IBAN van de begunstigde; er valt niets over te maken.' });
    const r = await kern.entiteitBetaal({ entiteitId: g.w.entiteitId, naarIban: u.iban, begunstigde: u.begunstigde,
      centen: Number(u.waardeCenten), oms: 'Uitgave ' + u.id + ': ' + u.omschrijving, sleutel: g.w.code + ':' + u.id });
    if (!r || r.error) return res.status((r && r.status) || 502).json({ error: (r && r.error) || 'De bank gaf geen antwoord.' });
    /* Wie tegelijk drukte, kreeg van de bank hetzelfde antwoord (idempotent); de
       notitie staat er dan al, en die blijft zoals hij was. */
    if (!u.betaald) {
      const kenmerk = r.opdrachtId || (r.boeking && r.boeking.id) || 'geboekt';
      u.betaald = { door: g.l.naam, lidId: g.l.id, kenmerk, via: 'entiteit', at: nu() };
      log(g.w, g.l, 'uitgave-betaald-entiteit', u.id, euro(u.waardeCenten) + ' ' + kenmerk);
      save();
    }
    res.json({ ok: true, uitgave: { id: u.id, betaald: u.betaald },
      let: 'Betaald vanaf de rekening van de entiteit' + (r.opdrachtId ? ' (SEPA-opdracht ' + r.opdrachtId + ', status ' + r.opdrachtStatus + ')' : '') + '.' });
  });

  return {};
};
