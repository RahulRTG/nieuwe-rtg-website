/* Domein "zaakcommand": de commandolaag van EEN zaak, voor de zaak-app en de
   PDA's van diezelfde zaak.

   ALLES ACHTER supplierAuth, en de zaakcode komt daar UITSLUITEND uit de sessie
   (server.js:1123-1128 zet req.supplier uit sess.code). Er is in dit hele
   domein geen enkele route die een code uit de body leest -- dat is niet
   netheid maar de hele veiligheid: de laag wordt gebouwd OP req.supplier, en
   een laag voor een andere zaak is langs deze weg niet aan te vragen.

   WIE ER HANDELT komt uit req.actor, dat supplierAuth uit dezelfde sessie zet.
   Het journaal van de zaak schrijft die naam; de beller kan hem niet kiezen.

   WAT ER NIET BIJ ZIT: iets van RTG. Geen platformpuls, geen RTG-beleid, geen
   RTG-journaal, geen andere zaak. Dat is geen filter maar bouw: kern/zaakcommand
   levert een laag met een register dat alleen de soorten van deze zaak kent.

   DE MANAGERGRENS. Kijken mag iedereen die in de zaak-app zit; herstellen,
   beleid zetten en uitzonderingen besluiten is voor het management. Dat is
   dezelfde grens die de rest van de app al trekt (managerOnly), en hij staat
   hier expliciet per route in plaats van in een middleware -- zo is aan de
   route te zien wat hij vraagt. */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, zaakcommand } = kern;

  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  /* De rol komt uit req.actor, dat supplierAuth uit de sessie zet -- niet uit de
     aanvraag. Een medewerker krijgt daardoor een register waarin verlof en
     sollicitaties NIET voorkomen; die zijn niet gefilterd maar afwezig. */
  const laag = (req) => zaakcommand.voor(req.supplier, { leiding: !!(req.actor && req.actor.manager) });
  const wie = (req) => (req.actor && req.actor.name) ? String(req.actor.name) : 'Beheer';
  /* NIETS TERUG BETEKENT: ER IS AL GEANTWOORD. managerOnly(req,res) stuurt zelf
     een 403 en geeft dan false; wie daarna nog res.json() zou aanroepen, krijgt
     een tweede antwoord op hetzelfde verzoek en een fout in het log die niets
     met de zaak te maken heeft. Vandaar deze afspraak, en niet een tweede
     controle op res.headersSent -- die verbergt de fout in plaats van hem te
     voorkomen. */
  const veilig = (res, werk) => {
    try { const r = werk(); if (r === undefined || r === null) return; stuur(res, r); }
    catch (e) { console.error('[zaakcommand]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  /* Het beginscherm in één verzoek: de stand van de zaak, wat er op een mens
     wacht, wat er recht te zetten valt en hoeveel handwerk er nog in zit. */
  app.post('/api/supplier/command/start', supplierAuth, (req, res) => veilig(res, () => laag(req).start()));
  app.post('/api/supplier/command/puls', supplierAuth, (req, res) => veilig(res, () => laag(req).puls()));

  /* De zoekbalk van de zaak: alles wat van deze zaak is, en niets anders. */
  app.post('/api/supplier/command/zoek', supplierAuth, (req, res) => veilig(res, () => {
    const c = laag(req);
    return Object.assign(c.zoek(req.body.q, { type: req.body.type }), { bereik: c.bereik() });
  }));

  app.post('/api/supplier/command/object', supplierAuth, (req, res) => veilig(res, () =>
    laag(req).dossier(String(req.body.type || ''), String(req.body.id || ''))));

  /* De operator. Async omdat de AI de zin mag verwoorden; wat hij zegt is
     gerekend, en zonder sleutel is de zin door ons geschreven. */
  app.post('/api/supplier/command/operator/plan', supplierAuth, async (req, res) => {
    try {
      const c = laag(req);
      const p = c.operator.plan(req.body.q, wie(req));
      p.tekst = await c.operator.verwoord(p);
      res.json({ plan: p });
    } catch (e) {
      console.error('[zaakcommand/operator]', e);
      res.status(500).json({ error: 'De assistent kon dit plan niet maken.' });
    }
  });

  app.post('/api/supplier/command/operator/uitvoeren', supplierAuth, (req, res) => veilig(res, () => {
    if (!managerOnly(req, res)) return null;
    return laag(req).operator.voerVeilig(String(req.body.plan || ''), wie(req), req.body.reden);
  }));

  require('./herstel')({ app, supplierAuth, managerOnly, veilig, laag, wie });
  require('./bestuur')({ app, supplierAuth, managerOnly, veilig, laag, wie });
};
