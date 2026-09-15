/* ============================================================================
   FOUNDATION CONNECT -- de routes. Wat de laag WEL en NIET aanbiedt als deur.

   De motor staat in kern/connect/; hier staan alleen de deuren. Twee soorten,
   en de tweede is een besluit en geen vanzelfsprekendheid:

     /api/connect/*       een ingelogd LID
     /api/rtf/connect/*   een GEZINSPROFIEL van de RTFoundation

   DE GEZINSDEUR VOLGT DE VORM VAN /api/rtf/knelpunt en niet die van een eigen
   motor: dezelfde functies erachter, een deur ervoor. Zou er een tweede motor
   komen "voor gezinnen", dan kan een kind een ander antwoord krijgen dan een
   lid zonder dat iemand dat heeft besloten. Wat wel verschilt is de SLEUTEL
   waaraan het dossier hangt: `rtf:CODE:profiel` (foundation/gezinshulp.js) kan
   per constructie niet botsen met een ledensleutel.

   EN DE BESCHERMD-VLAG REIST MEE, want dat is de enige plek waar hij vandaan
   kan komen. kern/connect/kring.js weigert een minderjarig profiel voorbij
   `team`; die vlag zit in de gezinssessie en nergens anders. Een route die hem
   vergeet, opent stilletjes de publicatieknop voor een kind -- en de kern kan
   dat niet zien, want die krijgt de mens niet.

   ELK PAD STAAT ER LETTERLIJK. Niet opgebouwd met een hulpje: scripts/check.js
   (regel 28: heeft elke route een poort), de routekaart en de schakelbaarheid
   lezen de BRON met een regex op de registratie-aanroep met een letterlijk pad,
   en een opgebouwd pad maakt een route onzichtbaar voor alle drie tegelijk. De
   kop van routes/rtfos/index.js schrijft uit wat dat een keer heeft gekost:
   vijfenveertig routes die op groen stonden omdat er niets te zien was.

   EN DIE REGEX LEEST OOK DIT COMMENTAAR. Hier stond de aanroep als voorbeeld
   voluit tussen aanhalingstekens, en prompt telde de diff-controle een
   drieentwintigste route met het pad `...` mee die nergens bestaat. Een
   fantoomroute in een register is erger dan een ontbrekende: hij vult een regel
   waar niemand ooit doorheen komt. Noem de vorm dus, schrijf hem niet uit.

   WAT HIER MET OPZET GEEN DEUR HEEFT:
   - publiceren naar de kring `publiek`. Dat werkwoord (`deel`) bereikt een
     tweede mens, en kern/connect/lus.js geeft dat terug in `bevestigtEenMens`.
     De bevestigingsstroom eromheen is nog niet gebouwd, en een route die alvast
     publiceert zou die belofte breken voordat hij bestaat.
   - een lijst mensen, in welke vorm dan ook. Er is geen route die twee dossiers
     naast elkaar legt, geen zoekweg op makers en geen volgerslijst.
   ========================================================================== */
'use strict';

module.exports = (kern) => {
  const { app, auth, rtf } = kern;

  const stuur = (res, r) => r && (r.error || r.ok === false)
    ? res.status(r.status || 400).json({ error: r.error || r.reden }) : res.json(r);
  const veilig = async (res, werk) => {
    try { stuur(res, await werk()); }
    catch (e) { console.error('[connect]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  /* De poort en de twee mens-uitlezers staan in ./connect-gezinsdeur.js -- zie
     de kop daar voor de reden van de knip, en waarom de ROUTES hier blijven. */
  const { gezinsPoort, lid, gezin } = require('./connect-gezinsdeur')({ rtf });

  /* ------------------------------------------------------------------ ONTDEK */
  const ontdek = (wie) => (req, res) => veilig(res, () => {
    const b = req.body || {};
    return kern.connectOntdek(wie(req).sleutel, {
      plaats: b.plaats, verras: !!b.verras, gezien: b.gezien, vandaag: b.vandaag });
  });
  app.post('/api/connect/ontdek', auth, ontdek(lid));
  app.post('/api/rtf/connect/ontdek', gezinsPoort, ontdek(gezin));

  /* IETS OPENEN -- de enige plek waar de trede `gezien` ontstaat. Niet bij het
     tonen: zie de kop van kern/connect/index.js. */
  const open = (wie) => (req, res) => veilig(res, () => {
    const b = req.body || {};
    return kern.connectOpen(wie(req).sleutel, { id: b.id, onderwerp: b.onderwerp, herkomst: b.herkomst });
  });
  app.post('/api/connect/open', auth, open(lid));
  app.post('/api/rtf/connect/open', gezinsPoort, open(gezin));

  /* ----------------------------------------------------------------- NAKLANK */
  /* ER GAAT ALLEEN EEN `id` EN EEN `soort` NAAR BINNEN. Hier stonden ook
     `maker` en `onderwerp` uit het lijf, en daarmee kon iedereen een regel
     `onderwezen` in het dossier van een willekeurig ander schrijven -- de enige
     trede die bewijskracht heeft. De kern zoekt de maker nu zelf op en weigert
     de haak als hij het ding niet thuis kan brengen (kern/connect/naklank.js). */
  const naklank = (wie) => (req, res) => veilig(res, () => {
    const b = req.body || {};
    return kern.connectNaklank(b.id, wie(req).sleutel, b.soort);
  });
  app.post('/api/connect/naklank', auth, naklank(lid));
  app.post('/api/rtf/connect/naklank', gezinsPoort, naklank(gezin));

  app.post('/api/connect/naklank/weg', auth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return kern.connectNaklankWeg(b.id, lid(req).sleutel, b.soort);
  }));
  app.post('/api/connect/naklank/tel', auth, (req, res) => veilig(res, () =>
    kern.connectNaklankTel((req.body || {}).id, lid(req).sleutel)));

  /* -------------------------------------------------------------- LEERDOSSIER */
  /* Alleen het EIGEN dossier. Er is geen parameter waarmee je een ander opgeeft,
     en dat is geen vergeten functie maar HDI.md par. 5.1: geen route die "alles
     over deze mens" teruggeeft zonder dat de mens zelf die aanroep doet. */
  const dossier = (wie) => (req, res) => veilig(res, () =>
    kern.connectDossier(wie(req).sleutel, { onderwerp: (req.body || {}).onderwerp }));
  app.post('/api/connect/dossier', auth, dossier(lid));
  app.post('/api/rtf/connect/dossier', gezinsPoort, dossier(gezin));

  /* Zelf een trede zetten. De grendel bepaalt welke dat mogen zijn: `begrepen`
     en `toegepast` zeggen mensen over zichzelf, `onderwezen` nooit. Die
     weigering komt uit de kern en wordt hier niet nagebouwd. */
  const noteer = (wie) => (req, res) => veilig(res, () => {
    const b = req.body || {};
    return kern.connectDossierNoteer(wie(req).sleutel, {
      trede: b.trede, onderwerp: b.onderwerp, bron: b.bron, door: 'zelf', herkomst: 'connect' });
  });
  app.post('/api/connect/noteer', auth, noteer(lid));
  app.post('/api/rtf/connect/noteer', gezinsPoort, noteer(gezin));

  /* ----------------------------------------------------------------- HORIZON */
  const horizon = (wie) => (req, res) => veilig(res, () => kern.connectHorizon(wie(req).sleutel));
  app.post('/api/connect/horizon', auth, horizon(lid));
  app.post('/api/rtf/connect/horizon', gezinsPoort, horizon(gezin));

  app.post('/api/connect/schuif', auth, (req, res) => veilig(res, () =>
    kern.connectSchuif(lid(req).sleutel, (req.body || {}).schuif)));

  const signaal = (wie) => (req, res) => veilig(res, () => {
    const b = req.body || {};
    return kern.connectSignaal(wie(req).sleutel, b.onderwerp, b.signaal);
  });
  app.post('/api/connect/signaal', auth, signaal(lid));
  app.post('/api/rtf/connect/signaal', gezinsPoort, signaal(gezin));

  /* ------------------------------------------------------------------- KRING */
  /* De beschermd-vlag komt UIT de sessie en nooit uit het lijf. Zou hij uit
     `req.body` mogen komen, dan zet een kind hem zelf op false. */
  const kringZet = (wie) => (req, res) => veilig(res, () => {
    const b = req.body || {};
    const w = wie(req);
    return kern.connectKringZet(b.huidig, b.kring, { beschermd: w.beschermd });
  });
  app.post('/api/connect/kring', auth, kringZet(lid));
  app.post('/api/rtf/connect/kring', gezinsPoort, kringZet(gezin));

  const kringKeuzes = (wie) => (req, res) => veilig(res, () =>
    ({ ok: true, keuzes: kern.connectKringKeuzes({ beschermd: wie(req).beschermd }) }));
  app.post('/api/connect/kring/keuzes', auth, kringKeuzes(lid));
  app.post('/api/rtf/connect/kring/keuzes', gezinsPoort, kringKeuzes(gezin));

  /* ----------------------------------------------------------------- UITLEG */
  /* De BEGRIJP-kant van de laag, en tegelijk het antwoord op "waarom zie ik
     dit". Geen sessie nodig om de lijsten te lezen? Toch wel: alles achter
     `auth`, want een open route die de motoren opsomt is een gratis kaart van
     hoe de mixer werkt. De uitleg is niet geheim, de deur is gewoon dezelfde. */
  app.post('/api/connect/uitleg', auth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return { ok: true,
      werkwoord: b.werkwoord ? kern.connectWerkwoord(b.werkwoord) : null,
      bruggen: b.onderwerp ? kern.connectBruggen(b.onderwerp, 5) : [],
      motoren: kern.connectMotoren(),
      lijsten: kern.CONNECT };
  }));
};
