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

  /* ---------- de uitgang ----------
     Achter het beheer-token van de werkruimte zelf, want dit is HAAR data. Er
     zit met opzet GEEN voorwaarde op de stand van de tenant of op een
     betaalstatus: een klant die zijn rekening niet betaalt verliest zijn geld
     en niet zijn geschiedenis. Zou dat wel mogen, dan is exit-recht een gunst
     in plaats van een recht -- en dan is de hele belofte niets waard op het
     enige moment dat hij telt. Ook in de bewaring werkt deze deur; alleen na
     de vernietiging is er niets meer om op te halen, en dan zegt de 404 dat. */
  app.post('/api/tenant/export', (req, res) => {
    req.geenQuotum = true;              // exit-recht loopt niet stuk op een teller
    const w = bedrijf.beheerVan(req, res); if (!w) return;
    const uit = tenant.uitgang.exporteer(w.code);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    /* `vorm: 'leesbaar'` geeft een overzicht in Markdown. Platte tekst en geen
       PDF: een archief hoort over tien jaar nog open te gaan zonder een
       bibliotheek die tegen die tijd niet meer bestaat. */
    if (String((req.body || {}).vorm) === 'leesbaar') {
      return res.type('text/markdown; charset=utf-8').send(tenant.uitgang.leesbaar(uit.uitvoer));
    }
    res.json({ ok: true, ...uit.uitvoer });
  });

  /* HIER STOND EEN DEUR OM DE UITVOER TE LATEN NAREKENEN, en die is er weer uit.
     Twee redenen, en de tweede is de zwaarste. Een open deur die sha256 rekent
     over willekeurige JSON is rekenwerk dat een vreemde bij ons kan bestellen.
     En belangrijker: een checksum die door de PRODUCENT wordt nagerekend
     bewijst de ontvanger niets -- wij zouden even goed kunnen liegen over de
     uitkomst. Wat wel bewijst is het RECEPT, en dat reist mee in het antwoord:
     sha256 over de canonieke JSON (sleutels alfabetisch) per soort, en daarna
     over de catalogus. Drie regels code aan de ontvangende kant, zonder ons. */

  /* ---------- de status- en bewijsstand ----------
     NIET meegeteld in het quotum: een statuspagina die dichtgaat zodra je aan
     je grens zit, gaat dicht op precies het moment dat je hem nodig hebt.

     TWEE SLEUTELS, EN DAT IS EEN VERRUIMING MET EEN REDEN. Hij stond alleen
     achter het beheer-token, en dat typt niemand in het Werk OS in -- dat
     scherm draait op een lid-token. De stand bestond dus en was onbereikbaar
     vanaf de enige plek waar hij hoort te staan; een pagina die niemand kan
     openen is hetzelfde als een pagina die er niet is.

     De tweede sleutel is een LID met het recht `werkruimte`. In het
     rollenregister draagt alleen `directie` dat, en dat is per definitie wie
     deze werkruimte beheert. Wat er te zien is past daarbij: contract, pakket,
     verbruik, levensloop en de beweringen met hun bron -- geen
     persoonsgegevens, geen journaalINHOUD (alleen het aantal regels), geen
     sleutels. Wie het recht mist krijgt de 403 van het rollenmodel. */
  app.post('/api/tenant/status', (req, res) => {
    req.geenQuotum = true;
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const t = tenant.register.vanWerkruimte(w.code);
    if (!t) return res.json({ ok: true, tenant: null,
      let: 'Deze werkruimte hoort bij geen enkele organisatie met een contract. Er is dus geen tenantstand; de platformcijfers staan in SLO.md.' });
    res.json({ ok: true, status: tenant.bewijs.stand(t.org) });
  });

  /* ---------- de herstelproef ----------
     Exporteren, teruglezen in een tijdelijke werkruimte, de catalogus per soort
     vergelijken, en die tijdelijke werkruimte weer weg. Achter dezelfde deur
     als de status, en NIET meegeteld in het quotum: dit is de proef op het
     exit-recht, en die hoort niet stuk te lopen op een teller.

     Wat hij bewijst staat in het antwoord zelf, en de grens staat er hard bij:
     dit is het EXIT-pad en niet het terugzetten van de dagback-up van het
     platform. Die tweede claim hangt onder de SLA en blijft onbewezen. */
  app.post('/api/tenant/herstelproef', (req, res) => {
    req.geenQuotum = true;
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const uit = tenant.herstelproef.doe(w.code, req.body && req.body.beheerToken ? 'beheer' : 'directie');
    if (uit.error) return res.status(uit.status || 400).json(uit);
    res.json(uit);
  });

  /* De poort staat in ./tenant/poort.js sinds ./tenant/bijstand.js hem ook
     nodig heeft: twee kopieën van een deur lopen uiteen. */
  const viaBeheerOfDirectie = require('./tenant/poort')({ bedrijf });

  app.post('/api/tenant/groepen', (req, res) => {
    const w = bedrijf.beheerVan(req, res); if (!w) return;
    const t = tenant.register.vanWerkruimte(w.code);
    if (!t) return res.json({ ok: true, tenant: null, groepen: [],
      let: 'Deze werkruimte hoort bij geen enkele tenant. Een groepsafbeelding heeft dan geen provider om uit te lezen; dat koppelt de eigenaar van het platform.' });
    res.json({ ok: true, tenant: { org: t.org, naam: t.naam, modus: t.modus },
      groepen: t.groepen.filter(g => g.werkruimte === w.code),
      merk: tenant.merkVan(t.org) });
  });

  require('./tenant/bijstand')({ app, tenant, bijstand: () => kern.bijstand, viaBeheerOfDirectie });
};
