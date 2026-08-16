/* RTG Integratiekamer: lokale contract-sandboxes; live heeft geen schakelroute. */
'use strict';

const crypto = require('node:crypto');
const rtgKlok = require('../../lib/klok');
const proef = require('./integraties-proef');

module.exports = (ctx) => {
  const { app, boardroomAuth, db, save, kern } = ctx;
  const mail = kern.mail, betaal = kern.betaal;
  const IDS = ['smtp', 'sms', 'connect', 'sepa'];
  const DEF = {
    smtp: { naam: 'SMTP', doel: 'Herstellinks en bevestigingen', config: 'SMTP_SANDBOX=1 + lokale SMTP_URL' },
    sms: { naam: 'SMS', doel: 'Tweede herstelcode op een apart kanaal', config: 'SMS_SANDBOX=1' },
    connect: { naam: 'Stripe Connect', doel: 'DirectPay naar het juiste partneraccount', config: 'STRIPE_CONNECT_SANDBOX=1' },
    sepa: { naam: 'SEPA', doel: 'Uitbetalingen en RTFoundation-afdracht', config: 'SEPA_SANDBOX=1' }
  };

  function data() {
    if (!db.data.integratiekamer || typeof db.data.integratiekamer !== 'object')
      db.data.integratiekamer = { schakelaars: {}, verantwoordelijk: {}, tests: {}, storingen: {}, verzoeken: [], log: [] };
    const s = db.data.integratiekamer;
    for (const k of ['schakelaars', 'verantwoordelijk', 'tests', 'storingen']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    if (!Array.isArray(s.verzoeken)) s.verzoeken = [];
    if (!Array.isArray(s.log)) s.log = [];
    return s;
  }
  const postStand = () => mail.sandboxStand ? mail.sandboxStand() : { smtp: {}, sms: {} };
  const geldStand = () => betaal.sandboxStand ? betaal.sandboxStand() : { connect: {}, sepa: {} };
  function actueel(id) { return id === 'smtp' || id === 'sms' ? postStand()[id] : geldStand()[id]; }
  function zetRuntime(id, aan) { return id === 'smtp' || id === 'sms' ? mail.zetSandbox(id, aan) : betaal.zetSandbox(id, aan); }
  const door = req => req.boardroomBaas ? 'eigenaar' : (req.boardroomKey || 'boardroom');
  function log(soort, req, extra) {
    const s = data();
    s.log.unshift(Object.assign({ at: rtgKlok.datum().toISOString(), soort, door: door(req) }, extra || {}));
    s.log = s.log.slice(0, 100);
  }

  // Een bewaarde stand overleeft herstart, maar kan geen providerconfig maken.
  const bewaard = data().schakelaars;
  for (const id of IDS) {
    if (typeof bewaard[id] === 'boolean') zetRuntime(id, bewaard[id]);
    else bewaard[id] = !!actueel(id).aan;
  }

  function tegel(id) {
    const s = data(), a = actueel(id) || {}, test = s.tests[id] || null;
    return {
      id, naam: DEF[id].naam, doel: DEF[id].doel, config: DEF[id].config,
      geconfigureerd: !!a.geconfigureerd, aan: !!a.aan, live: !!a.live,
      status: a.aan ? 'aan' : (a.geconfigureerd ? 'uit' : 'niet-ingericht'),
      verantwoordelijke: s.verantwoordelijk[id] || '', laatsteTest: test,
      laatsteStoring: s.storingen[id] || null
    };
  }
  function beeld(extra) {
    const s = data(), tegels = IDS.map(tegel);
    const open = s.verzoeken.filter(v => v.status === 'wacht');
    const taken = [];
    for (const t of tegels) {
      if (!t.geconfigureerd) taken.push({ kanaal: t.id, ernst: 'open', tekst: t.config + ' ontbreekt in de lokale startconfiguratie.' });
      if (!t.verantwoordelijke) taken.push({ kanaal: t.id, ernst: 'open', tekst: 'Wijs een verantwoordelijke medewerker toe.' });
      if (!t.laatsteTest) taken.push({ kanaal: t.id, ernst: 'test', tekst: 'De lokale contractproef is nog niet uitgevoerd.' });
      if (t.laatsteStoring) taken.push({ kanaal: t.id, ernst: 'storing', tekst: t.laatsteStoring.tekst });
    }
    if (!betaal.WEBHOOK_SECRET) taken.push({ kanaal: 'keten', ernst: 'open', tekst: 'Een webhook-secret ontbreekt; lokale events kunnen nog niet als getekende providerbevestiging worden geoefend.' });
    for (const v of open) taken.push({ kanaal: v.kanaal, ernst: 'besluit', tekst: (v.aan ? 'Aanzetten' : 'Uitzetten') + ' wacht op het besluit van de eigenaar.' });
    const actief = Object.fromEntries(tegels.map(t => [t.id, t.aan]));
    return Object.assign({ ok: true, omgeving: process.env.NODE_ENV === 'production' ? 'productie' : 'lokale sandbox',
      liveActivering: 'geblokkeerd', tegels, taken, verzoeken: open.slice(0, 20), log: s.log.slice(0, 30),
      ketens: [
        { id: 'herstel', naam: 'Account herstellen', stappen: ['smtp', 'sms'], gereed: actief.smtp && actief.sms },
        { id: 'directpay', naam: 'DirectPay naar partner', stappen: ['connect'], gereed: actief.connect },
        { id: 'foundation', naam: 'RTFoundation-afdracht', stappen: ['sepa'], gereed: actief.sepa }
      ], waarborgen: ['Geen extern verkeer in de ketenproef', 'Sandbox en live strikt gescheiden',
        'Eigenaarsbesluit vóór elke opschaling', 'Noodstop verlaagt alleen bevoegdheid',
        'Webhook en idempotentie blijven de betaalwaarheid', 'Geen geheimen of persoonsgegevens op het bord'] }, extra || {});
  }

  app.post('/api/office/techniek/integraties', boardroomAuth, (req, res) => res.json(beeld({ baas: !!req.boardroomBaas })));

  app.post('/api/office/techniek/integraties/verantwoordelijke', boardroomAuth, (req, res) => {
    if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar wijst de verantwoordelijke medewerker aan.' });
    const id = String(req.body.id || ''), naam = String(req.body.naam || '').trim().slice(0, 80);
    if (!IDS.includes(id)) return res.status(404).json({ error: 'Onbekende integratie.' });
    data().verantwoordelijk[id] = naam;
    log('verantwoordelijke', req, { kanaal: id, naam }); save();
    res.json(beeld({ baas: true }));
  });

  app.post('/api/office/techniek/integraties/schakel', boardroomAuth, (req, res) => {
    const id = String(req.body.id || ''), aan = req.body.aan === true;
    if (!IDS.includes(id)) return res.status(404).json({ error: 'Onbekende integratie.' });
    const a = actueel(id);
    if (aan && !a.geconfigureerd) return res.status(409).json({ error: 'Kan niet aan: ' + DEF[id].config + ' ontbreekt.' });
    if (!!a.aan === aan) return res.json(beeld({ ongewijzigd: true, baas: !!req.boardroomBaas }));
    const s = data();
    if (s.verzoeken.some(v => v.kanaal === id && v.status === 'wacht')) return res.status(409).json({ error: 'Voor deze rail wacht al een besluit.' });
    const v = { id: crypto.randomBytes(6).toString('hex'), kanaal: id, aan, door: door(req), at: rtgKlok.datum().toISOString(), status: 'wacht' };
    s.verzoeken.unshift(v); s.verzoeken = s.verzoeken.slice(0, 100);
    log('schakelverzoek', req, { kanaal: id, aan }); save();
    res.json(beeld({ verzoek: v, baas: !!req.boardroomBaas }));
  });

  app.post('/api/office/techniek/integraties/besluit', boardroomAuth, (req, res) => {
    if (!req.boardroomBaas) return res.status(403).json({ error: 'Alleen de eigenaar neemt dit besluit.' });
    const s = data(), v = s.verzoeken.find(x => x.id === String(req.body.verzoekId || ''));
    if (!v) return res.status(404).json({ error: 'Schakelverzoek niet gevonden.' });
    if (v.status !== 'wacht') return res.status(409).json({ error: 'Dit verzoek is al behandeld.' });
    if (req.body.akkoord === false) v.status = 'geweigerd';
    else {
      const r = zetRuntime(v.kanaal, v.aan);
      if (!r || !r.ok) return res.status(409).json({ error: (r && r.error) || 'De runtime-zekering kon niet worden gezet.' });
      s.schakelaars[v.kanaal] = v.aan; v.status = 'akkoord';
    }
    v.besluitAt = rtgKlok.datum().toISOString(); v.besluitDoor = door(req);
    log('schakelbesluit', req, { kanaal: v.kanaal, aan: v.aan, besluit: v.status }); save();
    res.json(beeld({ baas: true }));
  });

  app.post('/api/office/techniek/integraties/test', boardroomAuth, (req, res) => {
    const gevraagd = String(req.body.id || 'keten');
    if (gevraagd !== 'keten' && !IDS.includes(gevraagd)) return res.status(404).json({ error: 'Onbekende integratieproef.' });
    const ids = gevraagd === 'keten' ? IDS : [gevraagd], s = data(), stappen = [];
    for (const id of ids) {
      try {
        const detail = proef(id, mail), r = { ok: true, at: rtgKlok.datum().toISOString(), detail, door: door(req) };
        s.tests[id] = r; delete s.storingen[id]; stappen.push({ id, ...r });
      } catch (e) {
        const r = { ok: false, at: rtgKlok.datum().toISOString(), detail: e.message, door: door(req) };
        s.tests[id] = r; s.storingen[id] = { at: r.at, tekst: e.message }; stappen.push({ id, ...r });
      }
    }
    if (gevraagd === 'keten') s.tests.keten = { ok: stappen.every(x => x.ok), at: rtgKlok.datum().toISOString(), stappen: stappen.map(x => x.id), door: door(req) };
    log('contractproef', req, { kanaal: gevraagd, ok: stappen.every(x => x.ok) }); save();
    res.status(stappen.every(x => x.ok) ? 200 : 409).json(beeld({ proef: { id: gevraagd, stappen }, baas: !!req.boardroomBaas }));
  });

  app.post('/api/office/techniek/integraties/noodstop', boardroomAuth, (req, res) => {
    const s = data();
    for (const id of IDS) { zetRuntime(id, false); s.schakelaars[id] = false; }
    log('noodstop', req, { reden: String(req.body.reden || 'handmatig veilig uit').slice(0, 120) }); save();
    res.json(beeld({ noodstop: true, baas: !!req.boardroomBaas }));
  });
};
