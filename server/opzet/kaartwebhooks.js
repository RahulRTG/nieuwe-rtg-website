/* Stripe-, Mollie- en Adyen-terugmeldingen. Eerst verifiëren/ophalen, dan
   duurzaam vastleggen, dan pas 2xx: zo kan een provider veilig blijven
   herhalen zonder dat RTG een betaling kwijtraakt of dubbel verwerkt. */
'use strict';

module.exports = function hangKaartWebhooks({ app, express, db, save, log, betaal,
  betaalWaarheid, webhookRem, webhookPoort, settleFactuur, opdrachtenVan }) {

  async function settleWachtend(p, hoe) {
    if (!p || !p.id) return;
    const wacht = db.data.kaartWachtend && db.data.kaartWachtend[p.id];
    if (!wacht) return;
    const uit = await settleFactuur(wacht, { id: p.id, centen: Math.round(Number(p.bedrag) || 0), hoe });
    /* De settlementlaag geeft verwachte schrijf-/bedrijfsfouten als een
       resultaat terug. Alleen `await` gebruiken maakt zo'n fout ten onrechte
       tot webhook-succes en wist daarna zelfs de herstelcontext. */
    if (!uit || uit.ok !== true) {
      const fout = new Error((uit && uit.error) || 'De betaling kon nog niet veilig worden afgehandeld.');
      fout.code = 'SETTLEMENT_MISLUKT';
      throw fout;
    }
    /* Pas weg nadat de domeinafhandeling is gelukt. Bij een storing antwoordt
       de route 500, blijft deze context staan en probeert de provider opnieuw. */
    delete db.data.kaartWachtend[p.id];
    try { save(); }
    catch (e) {
      /* `save()` kan falen nadat het RAM-object al is gewijzigd. Herstel ook
         daar de wachtende context, anders krijgt dezelfde procesinstantie bij
         de providerretry niets meer te doen en antwoordt zij vals 200. */
      db.data.kaartWachtend[p.id] = wacht;
      throw e;
    }
  }

  async function payout(evt, object) {
    const soort = evt && evt.type;
    if (!['payout.paid', 'payout.failed', 'payout.canceled'].includes(soort)) return;
    const rij = opdrachtenVan && opdrachtenVan();
    if (!rij || !object || !object.id) return;
    const r = await rij.bevestig({ settlementRef: object.id, gelukt: soort === 'payout.paid',
      reden: object.failure_message || object.failure_code || soort });
    if (r && r.error) log.info('payout-webhook zonder bijbehorende betaalopdracht', { id: object.id, type: soort });
    else log.info('payout-webhook verwerkt', { id: object.id, type: soort, opdracht: r && r.id, status: r && r.status });
  }

  app.post('/api/betaal/webhook', webhookRem, webhookPoort,
    express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
      let evt;
      try {
        evt = betaal.verifieerWebhook(req.body,
          req.get('stripe-signature') || req.get('x-rtg-signature'));
      } catch (e) {
        log.warn('betaal-webhook geweigerd', { fout: e.message, id: req.id });
        return res.status(400).json({ error: 'Ongeldige handtekening.' });
      }
      try {
        const soort = evt && evt.type;
        const p = evt && evt.data && evt.data.object;
        if (p && p.id && String(soort || '').startsWith('payment_intent.')) {
          const bedrag = Math.round(Number(p.amount_received != null ? p.amount_received : p.amount) || 0);
          await betaalWaarheid.providerMelding({ eventId: evt.id, gebeurtenis: soort,
            aanbieder: 'stripe', providerId: p.id, status: p.status,
            referentie: p.metadata && p.metadata.referentie, bedrag, valuta: p.currency });
          if (soort === 'payment_intent.succeeded')
            await settleWachtend({ id: p.id, bedrag }, 'Betaald per kaart');
        } else if (p && p.id && String(soort || '').startsWith('checkout.session.')) {
          const betaald = p.payment_status === 'paid' || soort === 'checkout.session.async_payment_succeeded';
          const status = betaald ? 'succeeded' : soort === 'checkout.session.expired' ? 'canceled'
            : soort === 'checkout.session.async_payment_failed' ? 'requires_payment_method' : 'processing';
          const bedrag = Math.round(Number(p.amount_total) || 0);
          const betaalId = p.payment_intent && (typeof p.payment_intent === 'string'
            ? p.payment_intent : p.payment_intent.id);
          await betaalWaarheid.providerMelding({ eventId: evt.id, gebeurtenis: soort,
            aanbieder: 'stripe', providerId: p.id, betaalId, status,
            referentie: p.client_reference_id || (p.metadata && p.metadata.referentie),
            bedrag, valuta: p.currency });
          if (betaald) await settleWachtend({ id: p.id, bedrag }, 'Betaald via Stripe Checkout');
        } else if (p && p.id && String(soort || '').startsWith('refund.') &&
          ['succeeded', 'failed', 'canceled'].includes(String(p.status || '').toLowerCase())) {
          await betaalWaarheid.providerTerugbetaling({ eventId: evt.id, aanbieder: 'stripe',
            providerPaymentId: typeof p.payment_intent === 'string' ? p.payment_intent
              : p.payment_intent && p.payment_intent.id,
            providerRefundId: p.id, referentie: p.metadata && p.metadata.referentie,
            centen: Math.round(Number(p.amount) || 0), valuta: p.currency,
            gelukt: String(p.status).toLowerCase() === 'succeeded' });
        }
        await payout(evt, p);
        log.info('betaal-webhook', { type: soort || 'onbekend', id: evt && evt.id });
        return res.json({ ok: true });
      } catch (e) {
        log.uitzondering(e, { bron: 'betaal-webhook' });
        return res.status(500).json({ error: 'Terugmelding is niet volledig verwerkt; probeer opnieuw.' });
      }
    });

  /* Mollie's klassieke webhook bevat alleen het payment-id. Dat bericht zelf
     is dus geen bewijs. RTG haalt de betaling opnieuw bij api.mollie.com op met
     de eigen geheime sleutel en gebruikt uitsluitend dát antwoord. */
  app.post('/api/betaal/webhook/mollie', webhookRem, webhookPoort,
    express.raw({ type: '*/*', limit: '32kb' }), async (req, res) => {
      let id = '';
      try { id = new URLSearchParams(Buffer.from(req.body || '').toString('utf8')).get('id') || ''; }
      catch (e) {}
      if (!/^tr_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'Ongeldige Mollie-terugmelding.' });
      try {
        const p = await betaal.haalBetaling('mollie', id);
        await betaalWaarheid.providerMelding({ eventId: 'mollie:' + p.id + ':' + p.status,
          gebeurtenis: 'payment.' + p.status, aanbieder: 'mollie', providerId: p.id,
          status: p.status, referentie: p.referentie, bedrag: p.bedrag, valuta: p.valuta });
        if (p.status === 'paid') await settleWachtend(p, 'Betaald via Mollie');
        log.info('mollie-webhook verwerkt', { id: p.id, status: p.status });
        return res.json({ ok: true });
      } catch (e) {
        log.uitzondering(e, { bron: 'mollie-webhook', providerId: id });
        return res.status(500).json({ error: 'Terugmelding kon niet veilig worden opgehaald.' });
      }
    });

  /* Adyen Standard webhooks dragen per NotificationRequestItem een HMAC over
     de betaalvelden. Eerst ALLE items controleren, zodat een gemengd bericht
     nooit half wordt verwerkt. De klantbrowser komt hier nergens aan te pas. */
  app.post('/api/betaal/webhook/adyen', webhookRem, webhookPoort,
    express.json({ type: 'application/json', limit: '64kb' }), async (req, res) => {
      const omhulsels = req.body && Array.isArray(req.body.notificationItems)
        ? req.body.notificationItems.slice(0, 10) : [];
      const items = omhulsels.map(x => x && x.NotificationRequestItem).filter(Boolean);
      if (!items.length || items.length !== omhulsels.length)
        return res.status(400).json({ error: 'Ongeldige Adyen-terugmelding.' });
      for (const item of items) {
        if (!betaal.verifieerAdyenMelding(item) ||
          (betaal.adyenMerchantAccount && item.merchantAccountCode !== betaal.adyenMerchantAccount)) {
          log.warn('adyen-webhook geweigerd', { id: req.id, eventCode: item.eventCode });
          return res.status(401).json({ error: 'Ongeldige Adyen-handtekening.' });
        }
      }
      try {
        for (const item of items) {
          const soort = String(item.eventCode || '').toUpperCase();
          const gelukt = String(item.success).toLowerCase() === 'true';
          const extra = item.additionalData || {};
          const linkId = extra.paymentLinkId || null;
          const bedrag = item.amount && Math.round(Number(item.amount.value));
          const valuta = item.amount && String(item.amount.currency || '').toLowerCase();
          const eventId = ['adyen', item.pspReference, soort, item.success].join(':');
          if (soort === 'AUTHORISATION' || soort === 'CAPTURE') {
            const status = !gelukt ? 'refused'
              : soort === 'CAPTURE' || !betaal.adyenHandmatigeCapture ? 'captured' : 'authorised';
            await betaalWaarheid.providerMelding({ eventId, gebeurtenis: soort,
              aanbieder: 'adyen', providerId: linkId, betaalId: item.pspReference,
              status, referentie: item.merchantReference, bedrag, valuta });
            if (status === 'captured') await settleWachtend({ id: linkId || item.pspReference, bedrag }, 'Betaald via Adyen');
          } else if (['REFUND', 'REFUND_FAILED'].includes(soort)) {
            await betaalWaarheid.providerTerugbetaling({ eventId, aanbieder: 'adyen',
              providerPaymentId: item.originalReference, providerRefundId: item.pspReference,
              referentie: item.merchantReference, centen: bedrag, valuta,
              gelukt: soort === 'REFUND' && gelukt });
          }
          log.info('adyen-webhook verwerkt', { pspReference: item.pspReference,
            eventCode: soort, success: gelukt });
        }
        return res.status(200).type('text/plain').send('[accepted]');
      } catch (e) {
        log.uitzondering(e, { bron: 'adyen-webhook' });
        return res.status(500).json({ error: 'Adyen-terugmelding is nog niet volledig verwerkt.' });
      }
    });
};
