/* Domein "eigenaarherstel": de weg terug naar het eigenaarsaccount als er geen
   toestel meer is. De ceremonie staat in kern/eigenaarherstel.js; hier staat
   alleen wie er aan welk loket mag komen.

   TWEE SOORTEN LOKETTEN, en het verschil is de hele reden dat dit bestand
   bestaat. De drie loketten op /api/techniek/* zijn van de eigenaar met zijn
   toestel erbij: inrichten en afbreken vragen de zware poort. De drie op
   /api/herstel/* zijn PUBLIEK, want een mens zonder toestel heeft geen sessie
   -- dat is precies de situatie die deze weg bedient. Wat ze beschermt is niet
   een deur maar het quorum zelf, plus de wachttijd en de rem.

   WAAROM PUBLIEK GEEN GAT IS. Zonder ingericht quorum antwoorden ze dat er geen
   herstelweg is. Met quorum kost een fout paar een poging (vijf, dan een uur
   dicht), levert een goed paar alleen een WACHTTIJD op, en gaat er onmiddellijk
   een kritieke melding en een mail naar de eigenaar. En de hele tijd kan elke
   nog werkende passkey het afbreken. */
'use strict';
const { log } = require('../log');

/* Gemount vanuit routes/techniek.js op de gedeelde technische context: die
   draagt techAuth en eigenaarAlleen, en die twee horen bij een pagina en niet
   op de kern. De publieke helft heeft alleen `app` nodig en reist mee. */
module.exports = (tctx) => {
  const { app, accounts, appUrl, techAuth, eigenaarAlleen, zwaar, sessieSleutel } = tctx;
  const { eigenaarherstel, webauthn, tooManyTries, noteFailedTry } = tctx.kern;
  const eigenaar = require('../eigenaar');
  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const oorsprong = req => { try { return new URL(appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };
  const eigenaarUser = () => accounts.findByLogin(eigenaar.eigenaarEmail());
  const delen = req => [String((req.body && req.body.deelA) || ''), String((req.body && req.body.deelB) || '')];

  /* De rem op de publieke kant. Per BRON, want een doel is er maar een: het
     eigenaarsaccount. De kern telt daarnaast zijn eigen pogingen (vijf, dan een
     uur), en die twee doen verschillend werk -- deze remt het verkeer, die
     andere remt het raden. */
  const remBucket = req => 'eigenaarherstel:' + req.ip;

  /* ---- de kant met een toestel: de technische pagina ---- */

  app.post('/api/techniek/herstel/stand', techAuth, eigenaarAlleen, (req, res) => {
    res.json(eigenaarherstel.stand());
  });

  /* INRICHTEN is zelf een zware handeling, en dat is niet overdreven: wie hier
     komt maakt een nieuwe weg naar het account en maakt de oude ongeldig. De
     drie delen komen EEN keer terug en worden nergens bewaard. */
  app.post('/api/techniek/herstel/inrichten', techAuth, eigenaarAlleen, async (req, res) => {
    const bewijs = await zwaar.eis(req.techUser, 'eigenaar-herstel-in',
      sessieSleutel(req), req, 'Het inrichten van het herstelquorum');
    if (bewijs.error) return zwaar.stuur(res, bewijs);
    const r = eigenaarherstel.richtIn();
    log.warn('eigenaarherstel-ingericht-route', { door: req.techUser.id });
    res.json({ ...r, uitleg:
      'Bewaar deze drie delen op drie plekken en nooit twee op dezelfde plek. Twee volstaan om te ' +
      'herstellen; een enkel deel zegt niets. Ze worden hierna nooit meer getoond.' });
  });

  /* AFBREKEN met een passkey. Dit is de eigenschap waar het ontwerp op rust: zo
     lang de wachttijd loopt, is een gestolen delenpaar niets waard zolang de
     eigenaar nog een werkend toestel heeft. */
  app.post('/api/techniek/herstel/afbreken', techAuth, eigenaarAlleen, async (req, res) => {
    const bewijs = await zwaar.eis(req.techUser, 'eigenaar-herstel-af',
      sessieSleutel(req), req, 'Het afbreken van een lopend herstel');
    if (bewijs.error) return zwaar.stuur(res, bewijs);
    stuur(res, eigenaarherstel.breekAf());
  });

  /* ---- de publieke kant: geen sessie, want die is er niet meer ---- */

  app.post('/api/herstel/eigenaar/start', (req, res) => {
    if (tooManyTries(res, remBucket(req))) return;
    const [a, b] = delen(req);
    const r = eigenaarherstel.start(a, b);
    if (r.error) noteFailedTry(remBucket(req), req.ip);
    stuur(res, r);
  });

  app.post('/api/herstel/eigenaar/voltooien', (req, res) => {
    if (tooManyTries(res, remBucket(req))) return;
    const [a, b] = delen(req);
    const r = eigenaarherstel.voltooi(a, b);
    if (r.error) { noteFailedTry(remBucket(req), req.ip); return stuur(res, r); }
    /* DE SESSIES DOORSNIJDEN, en hier en niet in de kern: dit is de plek die de
       accounts-laag kent. Een herstel dat de sessie van een indringer laat
       staan, herstelt niets. */
    const u = eigenaarUser();
    if (u) { try { accounts.zetSessiegrens(u.id); } catch (e) {} }
    stuur(res, r);
  });

  /* HET VENSTER: een nieuwe passkey zetten, en verder niets. Geen sessie, geen
     token, geen inzage -- de aanvrager moet daarna gewoon inloggen met de
     sleutel die hij zojuist heeft gezet. */
  app.post('/api/herstel/eigenaar/passkey/opties', async (req, res) => {
    if (tooManyTries(res, remBucket(req))) return;
    if (!eigenaarherstel.herstelvensterOpen()) return res.status(403).json({ error: 'Er staat geen herstelvenster open.' });
    const u = eigenaarUser();
    if (!u) return res.status(404).json({ error: 'Er is geen eigenaarsaccount.' });
    stuur(res, await webauthn.registratie.opties(u, gastheer(req)));
  });

  app.post('/api/herstel/eigenaar/passkey', async (req, res) => {
    if (tooManyTries(res, remBucket(req))) return;
    if (!eigenaarherstel.herstelvensterOpen()) return res.status(403).json({ error: 'Er staat geen herstelvenster open.' });
    const u = eigenaarUser();
    if (!u) return res.status(404).json({ error: 'Er is geen eigenaarsaccount.' });
    const r = await webauthn.registratie.maak(u, req.body.antwoord,
      String((req.body && req.body.naam) || 'Hersteld toestel'), oorsprong(req), gastheer(req));
    if (r.error) { noteFailedTry(remBucket(req), req.ip); return stuur(res, r); }
    /* HET VENSTER GAAT EEN KEER OP. Wie hem gebruikt, sluit hem -- anders is een
       geslaagd herstel vijftien minuten lang een open deur voor iedereen die
       toevallig meekijkt. */
    eigenaarherstel.herstelvensterGebruikt();
    log.warn('eigenaarherstel-passkey-gezet', {});
    res.json({ ok: true, klaar: true });
  });
};
