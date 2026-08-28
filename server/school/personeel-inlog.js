/* Wachtwoordloze herinlog en intrekken van schoolpersoneel.

   De eerste persoonlijke toelating staat in personeelstoegang.js. Dit bestand
   regelt de levensloop daarna: een generiek verzoek om een kort houdbare
   schoolmail-link, het eenmalig inwisselen ervan en onmiddellijk intrekken
   door de directie. Zo staat de uitnodiging niet verstopt tussen sessiebeheer. */
'use strict';

module.exports = sctx => {
  const { router, save, rid, nu, decS, eigenVeld, S, schoolVan, isActief,
    teVaak, misluktePoging, goedePoging, ipVan, rollenVan, rechtenVan, log,
    personeelToegang:t } = sctx;

  router.post('/school/personeel/inloglink', (req, res) => {
    const bucket='school-personeel-inlogmail:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    misluktePoging(bucket, 5, 15);
    const sch=eigenVeld(S(), String(req.body.schoolCode || '').trim().toUpperCase());
    const email=t.emailVan(req.body.email), emailHash=t.geldigeEmail(email) ? t.hash(email) : '';
    const p=sch && isActief(sch) ? Object.values(sch.personeel || {})
      .find(x => x.status === 'actief' && t.gelijk(x.emailHash, emailHash)) : null;
    if (p) {
      const geheim=rid(24); p.inlogHash=t.hash(geheim); p.inlogVerlooptAt=t.vervalt(0.25); p.inlogStatus='open'; save();
      const link=t.basisUrl(req) + '/apps/schoolpartner.html#inloggen=' + sch.code + '.' + geheim;
      t.stuurMail(decS(p.email), 'Uw eenmalige inloglink voor ' + sch.naam,
        'Beste ' + p.naam + ',\n\nOpen uw RTF School-werkruimte binnen 15 minuten via:\n' + link +
        '\n\nDeze link werkt een keer. Hebt u dit niet aangevraagd, meld dit dan bij uw school.\n\nFOUNDATION');
    }
    /* Bekend en onbekend krijgen niet alleen dezelfde tekst maar ook dezelfde
       minimale antwoordtijd; anders kan een aanvaller het bestaan van een
       account alsnog uit een snelle versus langzame reactie afleiden. */
    setTimeout(() => res.json({ ok:true,
      bericht:'Als dit actieve schoolaccount bestaat, is een eenmalige inloglink verstuurd.' }), 120);
  });

  router.post('/school/personeel/inlog/accepteer', (req, res) => {
    const bucket='school-personeel-inlog:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const m=t.geheimPatroon.exec(String(req.body.inlog || '').trim());
    const sch=m ? eigenVeld(S(), m[1].toUpperCase()) : null, h=m ? t.hash(m[2]) : '';
    const p=sch ? Object.values(sch.personeel || {}).find(x => t.gelijk(x.inlogHash, h)) : null;
    const geldig=p && p.status === 'actief' && p.inlogStatus === 'open' && Date.parse(p.inlogVerlooptAt) > Date.parse(nu());
    if (!geldig) { misluktePoging(bucket, 6, 15); return res.status(403).json({ error:'Deze personeelsinlog is ongeldig, gebruikt of verlopen.' }); }
    p.inlogStatus='gebruikt'; p.laatstIngelogdAt=nu(); delete p.inlogHash; delete p.inlogVerlooptAt;
    log(sch, p, 'personeel-ingelogd', p.id, 'eenmalige schoolmail-link'); save(); goedePoging(bucket);
    res.json({ ok:true, schoolCode:sch.code, personeelToken:p.token,
      medewerker:{ id:p.id, naam:p.naam, rollen:rollenVan(p), rechten:[...rechtenVan(p)] }, school:{ naam:sch.naam } });
  });

  router.post('/school/personeel/toegang/intrek', (req, res) => {
    const sch=schoolVan(req, res); if (!sch) return;
    const p=eigenVeld(sch.personeel || {}, String(req.body.personeelId || ''));
    if (!p) return res.status(404).json({ error:'Dit personeelslid is niet gevonden.' });
    p.status='ingetrokken'; p.ingetrokkenAt=nu(); p.token=rid(24);
    delete p.inlogHash; delete p.inlogVerlooptAt; p.inlogStatus='ingetrokken';
    log(sch, { naam:'Directie', rollen:['directie'] }, 'personeelstoegang-ingetrokken', p.id, 'toegang ingetrokken door directie');
    save(); res.json({ ok:true });
  });
};
