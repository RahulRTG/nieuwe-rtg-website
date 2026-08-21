/* De ene registratiebalie van FOUNDATION. Catalogus en aanvraag zijn openbaar
   omdat de aanvrager nog geen account of code heeft. De status vraagt de
   willekeurige bezitssleutel; controleren en beslissen zijn Boardroomwerk. */
'use strict';

const rem = require('../rem');

module.exports = kern => {
  const { app, boardroomAuth, boardroomWie, foundationregistratie, mail,
    officeAuth, sseToOffice } = kern;
  const aanvraagRem = rem({ windowMs:60 * 60 * 1000, limit:5,
    key:req => 'foundation-registratie|' + String(req.ip) });
  const leesRem = rem({ windowMs:60 * 1000, limit:60,
    key:req => 'foundation-registratie-lees|' + String(req.ip) });
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error:r.error, open:r.open }) : res.json(r);
  const mailVeilig = (aan, onderwerp, tekst) => {
    try { const p = mail.send(aan, onderwerp, tekst); if (p && p.catch) p.catch(() => {}); } catch (_) {}
  };

  app.post('/api/foundation/registratie/catalogus', leesRem, (req, res) =>
    res.json(foundationregistratie.catalogus()));

  app.post('/api/foundation/registratie/aanvragen', aanvraagRem, (req, res) => {
    const r = foundationregistratie.aanvragen(req.body || {}, req.ip);
    if (r.error) return stuur(res, r);
    if (r.stil) return res.json({ ok:true });
    mailVeilig(req.body.email, 'Uw FOUNDATION-registratie is ontvangen',
      'Beste ' + String(req.body.contactNaam || req.body.naam || '').slice(0, 80) + ',\n\n' +
      'We hebben de registratie voor ' + r.aanvraag.naam + ' ontvangen. Er ontstaat pas toegang nadat de toepasselijke officiële en interne controles zijn afgerond. ' +
      'Mail geen identiteitsbewijs of VOG naar ons; de bevoegde medewerker legt alleen de controle-uitkomst vast.\n\n' +
      'Aanvraagnummer: ' + r.id + '\nBewaar de persoonlijke statuslink uit het registratiescherm.\n\nFOUNDATION');
    sseToOffice('sync', { scope:'foundation-registraties', id:r.id });
    res.json(r);
  });

  app.post('/api/foundation/registratie/status', leesRem, (req, res) =>
    stuur(res, foundationregistratie.status(req.body.id, req.body.statusToken)));

  app.post('/api/office/foundation/registraties', officeAuth, (req, res) =>
    res.json({ registraties:foundationregistratie.kantoorLijst() }));

  app.post('/api/office/foundation/registratie/controle', boardroomAuth, (req, res) => {
    const r = foundationregistratie.controleer(req.body.id, req.body || {}, boardroomWie(req));
    if (r.ok) sseToOffice('sync', { scope:'foundation-registraties', id:req.body.id });
    stuur(res, r);
  });

  app.post('/api/office/foundation/registratie/besluit', boardroomAuth, (req, res) => {
    const r = foundationregistratie.beslis(req.body.id, req.body.action, req.body.reden, boardroomWie(req));
    if (r.error) return stuur(res, r);
    const a = r.aanvraag;
    if (a.status === 'afgewezen') {
      mailVeilig(a.email, 'Besluit over uw FOUNDATION-registratie',
        'Beste ' + a.contactNaam + ',\n\nWe kunnen de registratie voor ' + a.naam + ' nu niet toelaten.\nReden: ' + a.besluit.reden + '\n\nFOUNDATION');
    } else {
      const t = r.toegang || {}, geheim = r.geheim || {};
      const basis = String(process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
      const toegang = t.schoolCode
        ? 'Schoolcode: ' + t.schoolCode + '\nActiveer de directieomgeving binnen 48 uur via:\n' +
          basis + '/apps/foundation/school.html#activeren=' + encodeURIComponent(geheim.activatie || '')
        : 'Persoonlijke portaalcode: ' + (t.code || 'wordt persoonlijk verstrekt');
      mailVeilig(a.email, 'Uw FOUNDATION-registratie is goedgekeurd',
        'Beste ' + a.contactNaam + ',\n\nDe registratie voor ' + a.naam + ' is na controle goedgekeurd.\n\n' + toegang +
        (t.opmerking ? '\n\n' + t.opmerking : '') + '\n\nBewaar deze gegevens veilig en deel ze niet per openbare chat.\n\nFOUNDATION');
    }
    sseToOffice('sync', { scope:'foundation-registraties', id:a.id });
    res.json({ ok:true, toegang:r.toegang || null });
  });
};
