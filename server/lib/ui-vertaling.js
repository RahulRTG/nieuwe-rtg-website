/* De publieke UI-vertaalroute: begrensde invoer en expliciet voltooiingsbewijs.
   De route zelf behoudt beide kostenremmen in server.js. */
'use strict';
module.exports = ({ talen, i18n, uiBronnen }) => async (req, res) => {
  try {
    const naar = talen.taalVan(req.body && req.body.naar);
    let totaal = 0;
    const teksten = (Array.isArray(req.body && req.body.teksten) ? req.body.teksten : []).slice(0, 400)
      .map(t => String(t == null ? '' : t).slice(0, 300))
      .filter(t => { totaal += t.length; return totaal <= 24000; });
    const regels = await i18n.translateBatch(teksten, naar, undefined, { ai: uiBronnen.toegestaan, bewaar: true });
    const uit = regels.map(r => r.text);
    const vertaald = uit.reduce((n, tekst, i) => n + (tekst !== teksten[i] ? 1 : 0), 0);
    const voltooid = regels.map(r => r.resolved === true);
    /* De client gebruikt `volledig` om een kerntaalscherm atomair te wisselen.
       Een gedeeltelijk modelantwoord mag nooit opnieuw Nederlands, Duits en
       Engels op een scherm mengen. */
    res.json({ ok: true, naar, teksten: uit, voltooid, vertaald, totaal: teksten.length,
      volledig: voltooid.every(Boolean) });
  } catch (e) { res.status(500).json({ error: 'Vertalen lukte even niet. Probeer het opnieuw.' }); }
};
