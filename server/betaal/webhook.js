/* Betaalnaad (deelmodule): DE WEBHOOK van buiten.

   WAAROM DIT EEN EIGEN BESTAND IS. ../betaal.js liep over de 10 kB-grens van
   keuringsregel 13 toen de simulatiebank erbij kwam. De snede ligt op een
   familie: hier staat de kant die van BUITEN binnenkomt -- de bevestiging van de
   provider, en de handtekening die zegt dat hij het werkelijk is. De rest van
   betaal.js gaat over wat wij naar buiten sturen.

   De regel die dit bestand draagt, staat hieronder uitgeschreven en is de
   belangrijkste van de hele betaalkant: de client mag een betaling STARTEN, maar
   nooit zichzelf als betaald markeren. */
'use strict';

module.exports = function webhookLaag({ crypto, stripe, BETALEN_UIT, WEBHOOK_SECRET, env }) {
  /* Verifieer een inkomende provider-webhook en geef de gebeurtenis terug.
     - Stripe met secret: officiële handtekeningcontrole (gooit bij twijfel).
     - Demo met secret: HMAC-SHA256 over de ruwe body, constant-tijd vergeleken.
     - Zonder secret (lokaal): body wordt alleen geparsed; NB: zet in productie
       altijd een secret, anders is de webhook niet te vertrouwen. */
  function verifieerWebhook(ruweBody, handtekening) {
    if (BETALEN_UIT)
      throw new Error('Betaalwebhook geweigerd: betalen staat bewust uitgeschakeld.');
    const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
    if (stripe && WEBHOOK_SECRET) {
      return stripe.webhooks.constructEvent(buf, handtekening, WEBHOOK_SECRET);
    }
    /* ZONDER SECRET IN PRODUCTIE: WEIGEREN.

       Hier stond alleen een waarschuwing in het commentaar hierboven ("zet in
       productie altijd een secret"). Dat is precies het soort belofte waar niets
       van afhangt: zonder secret viel de code door naar JSON.parse en gaf de
       webhook een onondertekend bericht terug als geverifieerde waarheid. Wie het
       adres kent, kan dan zelf "betaald" roepen.

       De poortwacht-ronde vond dit doordat /api/betaal/webhook anoniem 200 gaf.
       Buiten productie blijft de doorval bestaan -- daar draait alles op
       demo-geld en zou een verplicht secret elke lokale start blokkeren. */
    if (!WEBHOOK_SECRET && env.NODE_ENV === 'production')
      throw new Error('Webhook geweigerd: er is geen webhook-secret ingesteld, dus dit bericht is niet te vertrouwen.');
    if (WEBHOOK_SECRET) {
      const verwacht = crypto.createHmac('sha256', WEBHOOK_SECRET).update(buf).digest('hex');
      const gegeven = Buffer.from(String(handtekening || ''), 'utf8');
      const goed = gegeven.length === verwacht.length &&
        crypto.timingSafeEqual(Buffer.from(verwacht, 'utf8'), gegeven);
      if (!goed) throw new Error('Ongeldige webhook-handtekening.');
    }
    return JSON.parse(buf.toString('utf8'));
  }

  // Hulp om zelf een geldige demo-handtekening te maken (tests, en de eigen
  // interne webhook-doorgifte in demo-stand).
  function tekenDemo(ruweBody) {
    const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(buf).digest('hex');
  }
  return { verifieerWebhook, tekenDemo };
};
