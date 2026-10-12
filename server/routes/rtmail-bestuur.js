/* Routes voor het BESTUUR van een postvak: rechten, delegatie, journaal,
   bewaartermijn, juridische bewaring, opruimen en export.

   Deze routes zien er anders uit dan de rest van RTMAIL, en dat is met opzet:
   ze gaan bijna allemaal over ANDERMANS postvak. Daarom komt het doeladres
   hier wel uit de body -- dat is het punt van delegatie -- en beslist
   kern/rtmail-recht.js of het mag. De aanvrager komt nog steeds uit de inlog
   en is niet te vervalsen.

   ELKE HANDELING OP ANDERMANS POSTVAK LANDT IN HET JOURNAAL, ook een geweigerde
   poging. Dat is precies wat een beveiligingsonderzoek wil zien, en het is de
   reden dat de poort logt en niet de route: een route die zelf mag kiezen of
   hij logt, vergeet dat een keer. */
const { magKlokZien } = require('../kern/leverancier/logboekzicht');
const { zelfdeBus } = require('../kern/rtmail-adres');
const { wie: envelopWie } = require('../opzet/envelop');
module.exports = (kern) => {
  const { app, auth, supplierAuth, db, rtmail, rtmailRecht, rtmailBewaar, codenaamVan, boardroomAuth, zwaarbewijs } = kern;
  const wie = require('../kern/rtmail-wie')({ db, rtmail, codenaamVan });
  const body = (req) => (req && req.body) || {};

  const paren = [
    { pad: '/api/member/rtmail', poort: auth, adres: wie.lidAdres },
    { pad: '/api/supplier/rtmail', poort: supplierAuth, adres: wie.zaakAdres }
  ];

  for (const p of paren) {
    // het postvak waar het over gaat: het eigen adres tenzij er een ander wordt gevraagd
    const doel = (req) => String(body(req).postvak || '') || p.adres(req);
    const geen = (res) => res.status(404).json({ error: 'Geen postvak voor deze inlog.' });
    const nee = (res, r) => res.status(403).json({ error: r.error || r.waarom });
    /* De leidingsplek (kern/rtmail-leiding.js) alleen voor een manager van PRECIES
       de zaak van dit postvak: magKlokZien kent de eigen zaak, dus via een
       delegatie op een ander postvak telt hij niet. De sessie gaat mee in het
       vernietigingsbewijs, uit de inlog en nooit uit de body; een gedelegeerde
       leest dat bewijs mee, dus een accountsleutel wordt daar een label. */
    const leidingVan = (req, ik, d) => p.pad === '/api/supplier/rtmail' && magKlokZien(req.actor) && zelfdeBus(ik, d);
    const sessieVan = (req) => (req.actor && (req.actor.staffId || (req.actor.lidKey ? 'lid-account' : null))) || null;

    app.post(p.pad + '/rechten', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const d = doel(req);
      const mijne = rtmailRecht.RECHTEN.filter(r => rtmailRecht.mag(ik, d, r).ok);
      res.json({ ok: true, ik, postvak: d, rechten: mijne, alle: rtmailRecht.RECHTEN,
        redenNodig: rtmailRecht.REDEN_NODIG, delegaties: rtmailRecht.opPostvak(d) });
    });

    app.post(p.pad + '/delegeer', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const b = body(req);
      const r = rtmailRecht.delegeer(ik, { postvak: b.postvak || ik, aan: b.aan,
        rechten: b.rechten, tot: b.tot, reden: b.reden });
      if (r.error) return nee(res, r);
      res.json(r);
    });

    app.post(p.pad + '/delegatie/weg', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const b = body(req);
      const r = rtmailRecht.neemAf(ik, { postvak: b.postvak || ik, aan: b.aan });
      if (r.error) return nee(res, r);
      res.json(r);
    });

    /* Het journaal van een postvak. Vraagt `metadata` -- lezen wie er in uw
       postvak heeft gekeken hoort bij het postvak, niet bij de inhoud. */
    app.post(p.pad + '/journaal', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const d = doel(req);
      const g = rtmailRecht.mag(ik, d, 'metadata');
      if (!g.ok) return nee(res, g);
      res.json({ ok: true, postvak: d, regels: rtmailRecht.journaal({ postvak: d, limit: body(req).limit }) });
    });

    app.post(p.pad + '/bewaarbeleid', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const r = rtmailBewaar.beleid(ik, doel(req), { leiding: leidingVan(req, ik, doel(req)) });
      if (r.error) return nee(res, r);
      res.json(r);
    });

    app.post(p.pad + '/bewaartermijn', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const b = body(req);
      const r = rtmailBewaar.zetTermijn(ik, doel(req), b.dagen, b.reden);
      if (r.error) return nee(res, r);
      res.json(r);
    });

    app.post(p.pad + '/bewaring', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const b = body(req);
      const r = rtmailBewaar.zetBewaring(ik, doel(req), { aan: b.aan, zaak: b.zaak, reden: b.reden });
      if (r.error) return res.status(400).json(r);
      res.json(r);
    });

    app.post(p.pad + '/opruimen', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const r = rtmailBewaar.ruimOp(ik, doel(req), body(req).reden, { sessie: sessieVan(req) });
      if (r.error) return res.status(400).json(r);
      res.json(r);
    });

    app.post(p.pad + '/vernietigingen', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const d = doel(req);
      const g = rtmailRecht.mag(ik, d, 'metadata');
      if (!g.ok) return nee(res, g);
      res.json({ ok: true, postvak: d, bewijs: rtmailBewaar.bewijs(d, { leiding: leidingVan(req, ik, d) }),
        let: 'Hier staat WAT er vernietigd is, niet wat erin stond. Dat laatste zou de vernietiging ongedaan maken.' });
    });

    app.post(p.pad + '/export', p.poort, (req, res) => {
      const ik = p.adres(req);
      if (!ik) return geen(res);
      const b = body(req);
      const r = rtmailBewaar.exporteer(ik, doel(req), { reden: b.reden, metInhoud: b.metInhoud,
        leiding: leidingVan(req, ik, doel(req)) });
      if (r.error) return nee(res, r);
      res.json(r);
    });
  }

  /* DE TERMIJN VAN DE LEIDINGSPLEK VERLENGEN (besluit 584A,
     kern/rtmail-leidingtermijn.js). Alleen een manager van DEZE zaak; een
     collega of een gedelegeerde van een andere zaak krijgt de reden. */
  app.post('/api/supplier/rtmail/leiding/verleng', supplierAuth, (req, res) => {
    const ik = wie.zaakAdres(req);
    if (!ik) return res.status(404).json({ error: 'Geen postvak voor deze inlog.' });
    const b = body(req);
    if (!magKlokZien(req.actor) || (b.postvak && !zelfdeBus(ik, String(b.postvak))))
      return res.status(403).json({ error: 'Alleen een manager van deze zaak kan de bewaartermijn van sollicitatiepost verlengen.' });
    const door = (req.actor && (req.actor.staffId || req.actor.lidKey)) || null;
    const r = rtmailBewaar.leiding.verleng({ adres: ik, id: b.id || null, dagen: b.dagen,
      grondslag: String(b.grondslag || ''), noodzaak: b.noodzaak, door });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  /* DE JURIDISCHE TOETS (de migratie van 584A): staat dicht tot de EIGENAAR hem
     op naam zet, met een verse passkey, zoals de terugstortstand. Zolang hij
     dicht staat, verwijdert de ronde geen post van voor de termijnregel. */
  app.post('/api/office/rtmail/leiding/toets', boardroomAuth, async (req, res) => {
    if (!req.boardroomBaas) return res.status(403).json({ error: 'De juridische toets zet alleen de eigenaar, op naam.' });
    const bewijs = await zwaarbewijs.eis(zwaarbewijs.boardroomUser(req), 'eigenaar-leidingtoets',
      zwaarbewijs.sessieSleutel(req), req, 'Het zetten van de juridische toets op sollicitatiepost');
    if (bewijs.error) return zwaarbewijs.stuur(res, bewijs);
    const r = rtmailBewaar.leiding.toets({ getoetst: body(req).getoetst === true, door: envelopWie(req), notitie: body(req).notitie });
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });
};
