/* De Stripe Connect-webhook: meldingen over transfers en payouts van
   partnerafrekeningen (server/betaal/connect/).

   EEN EIGEN ADRES EN EEN EIGEN GEHEIM. Stripe stuurt gebeurtenissen van
   verbonden accounts naar een Connect-endpoint met een ander ondertekengeheim
   dan het platformendpoint (/api/betaal/webhook). Ze door elkaar laten lopen zou
   betekenen dat een geheim dat voor het een gelekt is, ook het ander opent.

   DE VOLGORDE, en hij is dezelfde als bij de gewone betaalwebhook:
     1. de handtekening, over de ONBEWERKTE bytes, met dezelfde `constructEvent`
        (server/stripe.js) -- inclusief de tijdtolerantie tegen replay;
     2. verwerken (dubbele, te late en onbekende meldingen worden daar een
        bevinding of een herhaling, nooit een tweede effect);
     3. pas daarna 200. Gaat stap 2 mis, dan 500 en probeert Stripe het opnieuw.

   GEEN VRIJGAVEPOORT HIER, en dat is een keuze. Deze route meldt wat AL is
   gebeurd. Een noodstop op partnerafrekeningen houdt nieuwe afrekeningen
   tegen; het bijhouden van wat al onderweg was, hoort juist door te gaan.
   Zonder geheim weigert de route wel: een onondertekende melding is geen
   melding. */
'use strict';

module.exports = function hangConnectWebhook({ app, express, db, save, log, webhookRem, webhookPoort, env = process.env }) {
  app.post('/api/betaal/webhook/connect', webhookRem, webhookPoort,
    express.raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
      const geheim = env.STRIPE_CONNECT_WEBHOOK_SECRET || '';
      if (!geheim) return res.status(503).json({ error: 'Deze terugmelding is niet ingericht.' });
      let evt;
      try {
        /* De verificatie heeft geen sleutel nodig; alleen het geheim. */
        evt = require('../stripe')('').webhooks.constructEvent(req.body, req.get('stripe-signature'), geheim);
      } catch (e) {
        log.warn('connect-webhook geweigerd', { fout: e.message, id: req.id });
        return res.status(400).json({ error: 'Ongeldige handtekening.' });
      }
      try {
        const connect = require('../betaal/connect').standaard({ db, save });
        /* Wachten tot de stand EN zijn boeking duurzaam staan
           (server/betaal/connect/melding.js); pas daarna 200. */
        const uit = await connect.verwerk(evt);
        log.info('connect-webhook', { type: evt.type, id: evt.id, herhaald: !!uit.herhaald });
        return res.json({ ok: true });
      } catch (e) {
        log.uitzondering(e, { bron: 'connect-webhook' });
        return res.status(500).json({ error: 'Terugmelding is niet volledig verwerkt; probeer opnieuw.' });
      }
    });
};
