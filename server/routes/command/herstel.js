/* RTG Command, deel herstel: de runbooks, het droog draaien, het uitvoeren,
   het terugdraaien en de uitzonderingenrij.

   DROOG IS DE STANDAARD. `droog` moet expliciet op false om iets te veranderen;
   wie het veld vergeet, krijgt een droogloop en geen wijziging. Een schrijfpad
   dat standaard schrijft, is een schrijfpad waar je per ongeluk op komt. */
'use strict';

const { NIVEAUS } = require('../../kern/frictie');

module.exports = ({ app, officeAuth, veilig, wie, command }) => {

  app.post('/api/command/runbooks', officeAuth, (req, res) => veilig(res, () =>
    ({ runbooks: command.runbooks.lijst() })));

  /* HET ENIGE PAD NAAR EEN RECEPT LOOPT DOOR DE TRANSACTIE, en niet meer
     rechtstreeks langs runbooks.voer(). Dat is geen laagje eromheen: de
     voorcontrole kan hier weigeren, en na afloop wordt er POSITIEF nagekeken
     of het werkelijk is gelukt -- mislukt dat, dan draait hij zichzelf terug.
     Een tweede ingang die dat overslaat, zou de belofte meteen leeg maken. */
  app.post('/api/command/runbook/voer', officeAuth, (req, res) => veilig(res, () =>
    command.transactie.draai(String(req.body.id || ''), {
      droog: req.body.droog !== false,
      door: wie(req),
      reden: req.body.reden,
      alleen: Array.isArray(req.body.alleen) ? req.body.alleen : null,
      max: req.body.max,
      /* Het menselijk akkoord is geen vinkje dat de grendel opheft: de kern
         eist het pas als de routering op 'hand' uitkomt, en dan is het de
         handtekening van degene die het scherm bediende. */
      menselijkAkkoord: !!req.body.menselijkAkkoord
    })));

  app.post('/api/command/runbook/terug', officeAuth, (req, res) => veilig(res, () =>
    command.runbooks.draaiTerug(String(req.body.run || ''), wie(req), req.body.reden)));

  app.post('/api/command/runs', officeAuth, (req, res) => veilig(res, () =>
    req.body.id ? ({ run: command.runbooks.run(String(req.body.id)) })
      : ({ runs: command.runbooks.runs(Number(req.body.n || 25)) })));

  /* HET INCIDENT. `weeg` is de enige die OPENT (de machine ziet een storing);
     `sluit` is de enige die afsluit, en dat is mensenwerk met een verslag. Dat
     die twee niet dezelfde kant op werken, is met opzet: een incident dat
     zichzelf sluit, laat een storing achter zonder conclusie. */
  app.post('/api/command/incidenten', officeAuth, (req, res) => veilig(res, () => ({
    incidenten: command.incident.lijst({ status: req.body.status, vermogen: req.body.vermogen,
      alles: !!req.body.alles, max: req.body.max }),
    tel: command.incident.tel()
  })));
  app.post('/api/command/incident', officeAuth, (req, res) => veilig(res, () =>
    command.incident.dossier(String(req.body.id || ''))));
  app.post('/api/command/incident/weeg', officeAuth, (req, res) => veilig(res, () =>
    command.incident.weeg(wie(req))));
  app.post('/api/command/incident/open', officeAuth, (req, res) => veilig(res, () =>
    command.incident.opdeHand(String(req.body.vermogen || ''), wie(req), req.body.wat, req.body.reden)));
  app.post('/api/command/incident/neem', officeAuth, (req, res) => veilig(res, () =>
    command.incident.neem(String(req.body.id || ''), wie(req))));
  app.post('/api/command/incident/maatregel', officeAuth, (req, res) => veilig(res, () =>
    command.incident.maatregel(String(req.body.id || ''),
      { wat: req.body.wat, soort: req.body.soort, verwijzing: req.body.verwijzing, door: wie(req) })));
  app.post('/api/command/incident/sluit', officeAuth, (req, res) => veilig(res, () =>
    command.incident.sluit(String(req.body.id || ''),
      { verslag: req.body.verslag, door: wie(req), toch: !!req.body.toch, reden: req.body.reden })));

  /* De uitzonderingenrij: alleen wat de automatisering écht niet zelf kon. */
  app.post('/api/command/zaken', officeAuth, (req, res) => veilig(res, () => ({
    zaken: command.zaken.lijst({ status: req.body.status, domein: req.body.domein,
      eigenaar: req.body.eigenaar, oorzaak: req.body.oorzaak, max: req.body.max }),
    tellingen: command.zaken.tellingen(),
    leerpunten: command.zaken.leerpunten(3)
  })));

  app.post('/api/command/zaak/open', officeAuth, (req, res) => veilig(res, () =>
    ({ zaak: command.zaken.open({
      titel: req.body.titel, domein: req.body.domein, objectType: req.body.objectType,
      objectId: req.body.objectId, oorzaak: req.body.oorzaak, bron: 'kantoor',
      door: wie(req), niveau: NIVEAUS.hand, reden: req.body.reden,
      bewijs: req.body.bewijs || null }) })));

  app.post('/api/command/zaak/neem', officeAuth, (req, res) => veilig(res, () =>
    command.zaken.neem(String(req.body.id || ''), wie(req))));

  app.post('/api/command/zaak/besluit', officeAuth, (req, res) => veilig(res, () =>
    command.zaken.besluit(String(req.body.id || ''), wie(req), req.body.keuze, req.body.reden)));

  /* Het werkbesparingsbord: hoeveel handwerk kost dit platform nog, en waar
     zit het volgende lek. Dit is de meter waarop deze hele laag zichzelf kan
     tegenspreken -- daarom staat hij in dezelfde app en niet in een rapport. */
  app.post('/api/command/werk', officeAuth, (req, res) => veilig(res, () => ({
    bord: command.werkbesparing.bord(Number(req.body.dagen || 30)),
    opbrengst: command.werkbesparing.opbrengst()
  })));
};
