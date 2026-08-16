/* ============================================================================
   DE TWEE BETAAL-WEBHOOKS.

   Ze stonden in server/server.js, en dat was geen slordigheid maar noodzaak:
   een webhook-handtekening wordt over de RAUWE body berekend, dus deze routes
   moeten VOOR app.use(express.json()) gemount worden. Daarom worden ze ook
   vanaf daar aangeroepen en niet vanuit de gewone routebedrading -- de
   volgorde is hier gedrag.

   Wat blijft staan is de uitleg hieronder over welke poortwachters ze wel en
   niet krijgen, en waarom de hoofdzekering er bewust niet bij zit. Dat is de
   scherpste regel van dit bestand: een webhook vertelt ons over iets dat AL is
   gebeurd, en dat gebeurde niet minder omdat wij dicht staan.
   ========================================================================== */
'use strict';

module.exports = function hangWebhooksOp(deps) {
  const { app, express, db, save, log, betaal, betaalWaarheid, muntbetaal, opslagKlaar, opdrachtenVan } = deps;
  /* munten en settleFactuur bestaan in server.js PAS verderop, terwijl deze twee
     routes hierboven al gemount moeten zijn (voor express.json). Dat werkte daar
     omdat de handlers de bindingen pas bij een verzoek lezen. Diezelfde afspraak
     staat hier expliciet: ze komen als functie binnen, en worden pas in de
     handler uitgelezen. Zo kan de volgorde niet stilzwijgend omvallen. */
  const munten = { bevestig: (a) => deps.muntenVan().bevestig(a) };
  const settleFactuur = (...a) => deps.settleFactuurVan()(...a);
  const verwerkPayout = require('./webhook-payout');
  /* DE TWEE WEBHOOKS STAAN HIER, EN NIET ACHTER DE POORTWACHTERS.

     Ze MOETEN vóór de JSON-parser komen: de handtekening wordt over de ONBEWERKTE
     bytes berekend, dus zodra express de body heeft geparsed en weer geserialiseerd
     klopt hij niet meer. Die volgorde is dus geen slordigheid.

     Het gevolg was wel dat ze ook voor de opslagpoort en de hoofdzekering stonden.
     Ze krijgen daarom hier hun eigen twee poortwachters:

       de rem        een webhook-provider stuurt bursts bij een retry-storm, maar
                     nooit honderden per minuut; wie dat wel doet is geen provider.

                     LET OP WAT HIER EERST STOND. De doorlichting meldde dat er
                     "vierhonderd verzoeken per minuut ongeremd doorheen kwamen",
                     en dat KLOPTE NIET: het schild (kern/schild.js, gemount op
                     regel 398 en dus wel degelijk voor deze routes) staat op 400
                     per 10 seconden per IP, en de globale rem op 300 per minuut.
                     De meting was een artefact -- het schild laat 127.0.0.1
                     bewust door (schild.js:35,46), en de doorlichting klopte van
                     binnenuit aan. Deze eigen rem is strenger dan beide en dus
                     een verbetering, maar hij repareert geen gat: hij begrenst
                     een route die al begrensd was.
       de opslagpoort laadt de server zijn gegevens nog, dan kunnen we een betaling
                     niet vastleggen. Dan is 503 het juiste antwoord: elke serieuze
                     provider probeert het opnieuw. Accepteren wat we niet kunnen
                     opslaan is de enige manier om een betaling echt kwijt te raken.

     De HOOFDZEKERING bewust NIET. Die zet het platform uit; een webhook vertelt
     ons over iets dat AL is gebeurd, en dat gebeurde niet minder omdat wij dicht
     staan. Hem weigeren betekent de gebeurtenis verliezen. */
  const webhookRem = require('../rem')({ windowMs: 60000, limit: 120 });
  /* De opslagpoort staat verderop pas als app.use gemount; hier hebben we hem al
     nodig. Hij komt uit dezelfde module, dus er is maar een gedrag. */
  const webhookPoort = require('../middleware/remmen').opslagPoort(() => opslagKlaar());

  require('./kaartwebhooks')({ app, express, db, save, log, betaal, betaalWaarheid,
    webhookRem, webhookPoort, settleFactuur, opdrachtenVan });

  /* Munt-webhook: de munt-aanbieder bevestigt hier dat de munten binnen zijn en
     omgezet naar euro. Net als de betaal-webhook: ruwe body, handtekening over de
     onbewerkte bytes. Een bevestigde ontvangst settelt de bijbehorende factuur. */
  app.post('/api/munt/webhook', webhookRem, webhookPoort, express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    let evt;
    try {
      evt = muntbetaal.verifieerWebhook(req.body, req.get('x-munt-signature'));
    } catch (e) {
      log.warn('munt-webhook geweigerd', { fout: e.message, id: req.id });
      return res.status(400).json({ error: 'Ongeldige handtekening.' });
    }
    try {
      if (evt && (evt.status === 'ontvangen' || evt.type === 'ontvangst.voltooid') && evt.id) {
        const entry = munten.bevestig({ id: evt.id, euroCenten: evt.euroCenten });
        /* Ook een providerretry opnieuw langs settlement. munten.bevestig is
           idempotent en factuur/direct/opladen zijn dat eveneens. Voorheen
           sloeg `herhaald` deze stap over: na één mislukte boeking antwoordde
           elke retry 200 zonder het geld ooit nog te verwerken. */
        if (entry) {
          const uit = await settleFactuur(entry.context, {
            id: entry.id, centen: entry.settledEuroCenten || entry.euroCenten,
            hoe: 'Betaald met ' + String(entry.munt || '').toUpperCase()
          });
          if (!uit || !uit.ok) {
            const fout = new Error((uit && uit.error) || 'munt-settlement mislukt'); fout.code = 'SETTLEMENT_MISLUKT'; throw fout;
          }
        }
      }
      log.info('munt-webhook', { id: evt && evt.id, status: evt && evt.status });
    } catch (e) {
      log.uitzondering(e, { bron: 'munt-webhook' });
      return res.status(500).json({ error: 'De ontvangst is nog niet verwerkt; probeer de webhook opnieuw.' });
    }
    res.json({ ok: true });
  });
};
