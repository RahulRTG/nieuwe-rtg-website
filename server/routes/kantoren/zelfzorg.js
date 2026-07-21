/* Kantoren, deel "zelfzorg": de vier knoppen (opruimen, beschermen, repareren,
   upgraden) voor de boardroom en de kamers Intern & IT en Ingenieurs. Elke druk
   komt met naam in het kantoor-auditlog en in het zelfzorg-journaal; de
   bescherm-ronde geeft adviezen terug (mens beslist, precies zoals overal). */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, afdelingen, kern } = ctx;
  const zz = () => kern.zelfzorg;
  const wie = (req) => String(req.body.naam || 'kantoor').slice(0, 40);

  app.post('/api/office/zelfzorg', officeAuth, (req, res) => veilig(res, () => zz().status()));
  app.post('/api/office/zelfzorg/opruim', officeAuth, (req, res) => veilig(res, () => {
    const r = zz().opruim(wie(req));
    afdelingen.audit(wie(req), 'zelfzorg: opruimronde (' + r.acties.length + ' actie(s))');
    return r;
  }));
  app.post('/api/office/zelfzorg/bescherm', officeAuth, async (req, res) => {
    try {
      const r = await zz().bescherm(wie(req));
      afdelingen.audit(wie(req), 'zelfzorg: beschermronde (oordeel ' + r.oordeel + ', ' + r.adviezen.length + ' advies/adviezen)');
      res.json(r);
    } catch (e) { console.error('[zelfzorg]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/zelfzorg/herstel', officeAuth, (req, res) => veilig(res, () => {
    const r = zz().herstel(wie(req));
    afdelingen.audit(wie(req), 'zelfzorg: reparatieronde (' + r.reparaties.length + ' reparatie(s))');
    return r;
  }));
  app.post('/api/office/zelfzorg/upgrade', officeAuth, (req, res) => veilig(res, () => {
    const r = zz().upgrade(wie(req));
    afdelingen.audit(wie(req), 'zelfzorg: upgrade naar schema v' + r.schema + (r.bijgewerkt ? '' : ' (stond al klaar)'));
    return r;
  }));
};
