/* Persoonlijke personeelsdeur van RTF School.

   Een schoolcode is een adres, geen bewijs van een dienstverband. Daarom kan
   in productie alleen de gecontroleerde directie een medewerker uitnodigen.
   De uitnodiging en iedere latere inloglink gaan naar het opgegeven werkadres,
   werken een keer en liggen uitsluitend als hash in de database. De browser
   wisselt de link in voor het bestaande personeel-token en bewaart dat alleen
   in de tabsessie (public/shared/rtg-school-session.js).

   De uitnodiging draagt meteen de rollen. Toegang ontstaat dus niet eerst
   breed om daarna te worden ingeperkt: identificeren, toelaten en autoriseren
   gebeuren in een handeling van de directie. */
'use strict';

const mail = require('../mail');

module.exports = sctx => {
  const { router, save, rid, nu, schoon, crypto, encS, decS, eigenVeld, S,
    schoolVan, isActief, teVaak, misluktePoging, goedePoging, ipVan,
    ROLLEN, rollenVan, rechtenVan, log } = sctx;
  const hash = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const gelijk = (a, b) => {
    const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
    return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  const emailVan = waarde => String(waarde || '').trim().toLowerCase().slice(0, 254);
  const geldigeEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const geheimPatroon = /^([A-Z0-9]{6})\.([a-f0-9]{48})$/i;
  const vervalt = uren => new Date(Date.parse(nu()) + uren * 60 * 60 * 1000).toISOString();
  const uitnodigingen = sch => {
    if (!Array.isArray(sch.personeelsUitnodigingen)) sch.personeelsUitnodigingen = [];
    return sch.personeelsUitnodigingen;
  };
  const verlopen = item => !item || item.status !== 'open' || Date.parse(item.verlooptAt) <= Date.parse(nu());
  const basisUrl = req => {
    const vast = String(process.env.APP_URL || '').trim();
    if (vast) return vast.replace(/\/+$/, '');
    if (process.env.NODE_ENV === 'production') return 'https://localhost';
    return (req.protocol + '://' + req.get('host')).replace(/\/+$/, '');
  };
  const stuurMail = (aan, onderwerp, tekst) => {
    try { const p = mail.send(aan, onderwerp, tekst); if (p && p.catch) p.catch(() => {}); } catch (_) {}
  };
  function kiesRollen(waarde) {
    const gevraagd = Array.isArray(waarde) ? waarde.map(String) : [String(waarde || '')];
    const rollen = [...new Set(gevraagd)].filter(r => r !== 'directie' && Object.prototype.hasOwnProperty.call(ROLLEN, r));
    return rollen.slice(0, 6);
  }
  function zoekUitnodiging(sleutel) {
    const m = geheimPatroon.exec(String(sleutel || '').trim());
    const sch = m ? eigenVeld(S(), m[1].toUpperCase()) : null;
    const h = m ? hash(m[2]) : '';
    const item = sch ? uitnodigingen(sch).find(x => gelijk(x.sleutelHash, h)) : null;
    return item ? { sch, item } : null;
  }
  const verbergEmail = email => {
    const delen = String(email || '').split('@');
    if (delen.length !== 2) return '';
    return delen[0].slice(0, 2) + '***@' + delen[1];
  };
  const publiek = (sch, item, directie) => ({
    id:item.id, naam:item.naam, email:directie ? decS(item.email) : verbergEmail(decS(item.email)),
    rollen:item.rollen, status:verlopen(item) && item.status === 'open' ? 'verlopen' : item.status,
    verlooptAt:item.verlooptAt, school:{ code:sch.code, naam:sch.naam, plaats:sch.plaats }
  });

  router.post('/school/personeel/uitnodig', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    if (!isActief(sch)) return res.status(403).json({ error:'De school moet eerst door RTG zijn goedgekeurd.' });
    const naam = schoon(req.body.naam, 60), email = emailVan(req.body.email), rollen = kiesRollen(req.body.rollen);
    if (!naam || !geldigeEmail(email)) return res.status(400).json({ error:'Vul de naam en het persoonlijke schoolmailadres van de medewerker in.' });
    if (!rollen.length) return res.status(400).json({ error:'Geef de medewerker minstens één schoolrol.' });
    const emailHash = hash(email);
    if (Object.values(sch.personeel || {}).some(p => p.status === 'actief' && gelijk(p.emailHash, emailHash)))
      return res.status(409).json({ error:'Dit schoolmailadres heeft al actieve toegang.' });
    const open = uitnodigingen(sch).filter(x => !verlopen(x));
    if (open.length >= 50) return res.status(429).json({ error:'Er staan al 50 personeelsuitnodigingen open. Trek eerst een oude uitnodiging in.' });
    if (open.some(x => gelijk(x.emailHash, emailHash))) return res.status(409).json({ error:'Voor dit schoolmailadres staat al een uitnodiging open.' });
    const geheim = rid(24), item = { id:rid(6), naam, email:encS(email), emailHash,
      rollen, sleutelHash:hash(geheim), status:'open', at:nu(), verlooptAt:vervalt(48) };
    uitnodigingen(sch).unshift(item);
    sch.personeelsUitnodigingen = sch.personeelsUitnodigingen.slice(0, 200);
    log(sch, { naam:'Directie', rollen:['directie'] }, 'personeel-uitgenodigd', item.id, 'persoonlijke schooluitnodiging');
    save();
    const link = basisUrl(req) + '/apps/schoolpartner.html#uitnodiging=' + sch.code + '.' + geheim;
    stuurMail(email, 'Uw persoonlijke uitnodiging voor ' + sch.naam,
      'Beste ' + naam + ',\n\nDe directie van ' + sch.naam + ' nodigt u uit voor RTF School. ' +
      'De uitnodiging geeft alleen deze rollen: ' + rollen.map(r => ROLLEN[r].naam).join(', ') + '.\n\n' +
      'Activeer binnen 48 uur via:\n' + link + '\n\nDeze link werkt een keer. Deel hem niet en meld een onverwachte uitnodiging bij uw school.\n\nFOUNDATION');
    res.json({ ok:true, uitnodiging:publiek(sch, item, true), bezorgd:true });
  });

  router.post('/school/personeel/uitnodigingen', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    res.json({ ok:true, uitnodigingen:uitnodigingen(sch).slice(0, 100).map(x => publiek(sch, x, true)) });
  });

  router.post('/school/personeel/uitnodiging/intrek', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    const item = uitnodigingen(sch).find(x => x.id === String(req.body.uitnodigingId || ''));
    if (!item) return res.status(404).json({ error:'Deze uitnodiging bestaat niet.' });
    if (item.status !== 'open') return res.status(409).json({ error:'Deze uitnodiging is niet meer open.' });
    item.status='ingetrokken'; item.ingetrokkenAt=nu(); delete item.sleutelHash;
    log(sch, { naam:'Directie', rollen:['directie'] }, 'personeelsuitnodiging-ingetrokken', item.id, 'ingetrokken door directie');
    save(); res.json({ ok:true });
  });

  router.post('/school/personeel/uitnodiging/bekijk', (req, res) => {
    const bucket = 'school-personeel-uitnodiging:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const r = zoekUitnodiging(req.body.uitnodiging);
    if (!r || verlopen(r.item)) { misluktePoging(bucket, 8, 15); return res.status(404).json({ error:'Deze personeelsuitnodiging is ongeldig, gebruikt of verlopen.' }); }
    goedePoging(bucket); res.json({ ok:true, uitnodiging:publiek(r.sch, r.item, false) });
  });

  router.post('/school/personeel/uitnodiging/accepteer', (req, res) => {
    const bucket = 'school-personeel-accepteer:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const r = zoekUitnodiging(req.body.uitnodiging);
    if (!r || verlopen(r.item)) { misluktePoging(bucket, 6, 15); return res.status(404).json({ error:'Deze personeelsuitnodiging is ongeldig, gebruikt of verlopen.' }); }
    let p = Object.values(r.sch.personeel || {}).find(x => x.status !== 'actief' && gelijk(x.emailHash, r.item.emailHash));
    if (!p) { const id=rid(6); p=r.sch.personeel[id]={ id }; }
    p.naam=r.item.naam; p.rol=r.item.rollen.includes('leraar') ? 'leraar' : 'ondersteuning';
    p.rollen=r.item.rollen; p.email=r.item.email; p.emailHash=r.item.emailHash;
    p.token=rid(24); p.status='actief'; p.at=p.at || nu(); p.geactiveerdAt=nu();
    if (sctx.zorgPersoneelsMail) sctx.zorgPersoneelsMail(r.sch, p);
    r.item.status='gebruikt'; r.item.gebruiktAt=nu(); r.item.personeelId=p.id; delete r.item.sleutelHash;
    log(r.sch, p, 'personeel-geactiveerd', p.id, 'persoonlijke schooluitnodiging geaccepteerd');
    save(); goedePoging(bucket);
    res.json({ ok:true, schoolCode:r.sch.code, personeelToken:p.token,
      medewerker:{ id:p.id, naam:p.naam, rtgMail:p.rtgMail || null,
        rollen:rollenVan(p), rechten:[...rechtenVan(p)] }, school:{ naam:r.sch.naam } });
  });

  return { personeelToegang:{ hash, gelijk, emailVan, geldigeEmail, geheimPatroon,
    vervalt, basisUrl, stuurMail } };
};
