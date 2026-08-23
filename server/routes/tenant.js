/* ============================================================================
   De runtime-deuren van de Tenant Control Plane.

   Drie routes, en ze delen één eigenschap: ze bedenken geen nieuwe poort. De
   werkruimte had al twee sleutels -- een beheer-token voor wie de werkruimte
   opende en een lid-token per medewerker -- en die worden hier gecontroleerd
   door dezelfde functies die bedrijf/index.js gebruikt (kern.bedrijf.beheerVan
   en .lidVan). Een derde manier om "mag deze aanroeper hier bij" te
   beantwoorden is precies de fout waar LAT-regel 4 over gaat, en bij een
   contractgrens zou hij de duurste zijn.

   Het BEHEER van de tenants zelf (aanmaken, koppelen, merk) staat er bewust
   niet bij: dat hoort bij de eigenaar en staat in routes/techniek/tenant.js.
   Wie zijn eigen werkruimte aan een tenant kan hangen, kan hem aan andermans
   tenant hangen. */
'use strict';

module.exports = (kern) => {
  /* De laag zelf hangt hier op, net als bij routes/bedrijf.js: een dun
     bedradingsbestand dat de kern meegeeft. `bedrijf` komt als FUNCTIE mee en
     niet als waarde -- de rollenlezing van de werkruimte wordt op aanroepmoment
     opgehaald, zodat deze module niet afhangt van de volgorde waarin de twee
     lagen worden opgehangen. */
  kern.tenant = require('../kern/tenant')({
    db: kern.db, save: kern.save, schoon: kern.schoon,
    findSupplier: kern.findSupplier, bedrijf: () => kern.bedrijf
  });
  const { app, auth, tenant, bedrijf } = kern;

  /* ---------- de bootstrap via het lid-token ----------
     Eén werkruimte, want een lid-token hoort bij één werkruimte. */
  app.post('/api/tenant/bootstrap', (req, res) => {
    const s = bedrijf.lidVan(req, res); if (!s) return;
    const b = tenant.bootstrap.voorLid(s.w.code, s.l);
    if (!b) return res.status(404).json({ error: 'Die werkruimte kennen we niet.' });
    res.json({ ok: true, bootstrap: b });
  });

  /* ---------- de bootstrap via de eigen RTG-sessie ----------
     Voor wie via de provider van zijn werkgever binnenkwam. Die persoon heeft
     nooit een lid-token in handen gehad om in te typen; hij haalt het hier op,
     over een POST achter de gewone auth-poort. Geeft een LIJST terug: iemand
     kan bij meerdere werkruimtes van dezelfde tenant horen, en een antwoord dat
     er stilletjes één uitkiest, kiest voor de gebruiker. */
  app.post('/api/tenant/bootstrap/mijn', auth, (req, res) => {
    const key = req.session && req.session.key;
    if (!key) return res.status(403).json({ error: 'Geen RTG-sessie gevonden.' });
    const rijen = tenant.bootstrap.voorRtg(key);
    res.json({ ok: true, aantal: rijen.length, werkruimtes: rijen,
      let: rijen.length ? null : 'Uw RTG-account hangt aan geen enkele werkruimte. Dat gebeurt pas als uw werkgever een groep van zijn identiteitsprovider aan een rol koppelt.' });
  });

  /* ---------- de groepsafbeelding ----------
     Achter het beheer-token van de werkruimte zelf. Dit is het moment waarop de
     huisregel "aanmelden is niet binnen zijn" wordt waargemaakt voor SSO: hier
     schrijft een mens op dat groep X rol Y krijgt, en zonder die regel laat de
     identiteitsbrug niemand binnen -- hoe goed hij ook inlogt. */
  app.post('/api/tenant/groep', (req, res) => {
    const w = bedrijf.beheerVan(req, res); if (!w) return;
    const uit = tenant.groepZet(w.code, req.body);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    res.json({ ok: true, groepen: uit.groepen,
      let: 'Rollen uit een groep worden bij elke inlog opnieuw gezet. Valt de groep weg, dan valt de rol weg; handmatig gegeven rollen blijven staan.' });
  });

  app.post('/api/tenant/groepen', (req, res) => {
    const w = bedrijf.beheerVan(req, res); if (!w) return;
    const t = tenant.register.vanWerkruimte(w.code);
    if (!t) return res.json({ ok: true, tenant: null, groepen: [],
      let: 'Deze werkruimte hoort bij geen enkele tenant. Een groepsafbeelding heeft dan geen provider om uit te lezen; dat koppelt de eigenaar van het platform.' });
    res.json({ ok: true, tenant: { org: t.org, naam: t.naam, modus: t.modus },
      groepen: t.groepen.filter(g => g.werkruimte === w.code),
      merk: tenant.merkVan(t.org) });
  });
};
