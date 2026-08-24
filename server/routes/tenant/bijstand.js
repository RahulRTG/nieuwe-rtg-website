/* DE KLANTKANT VAN RTG BIJSTAND -- de deuren waarmee een organisatie RTG
   binnenlaat, en er weer uitzet.

   DIT ZIJN DE ENIGE ROUTES DIE EEN SESSIE AANMAKEN. Aan de RTG-kant
   (routes/command/toezicht.js) staat er geen enkele, en dat is de belofte in
   zijn zichtbaarste vorm: toegang tot de omgeving van een klant is een
   uitnodiging en geen recht. Wie dat wil veranderen, moet hier bijbouwen.

   `org` KOMT NIET UIT DE BODY. Hij komt uit de werkruimte van de beller, en die
   wordt vastgesteld met dezelfde functie als de rest van de tenantlaag --
   `viaBeheerOfDirectie`, dus het beheer-token of een lid met het recht
   `werkruimte`. Er wordt hier geen derde manier bedacht om "mag deze aanroeper
   hier bij" te beantwoorden; dat is precies de fout waar LAT-regel 4 over gaat,
   en bij een deur naar de eigen omgeving zou het de duurste zijn.

   DE STAND IS NIET GEQUOTEERD. Een klant die middenin een storing tegen zijn
   verzoeklimiet aanloopt, kan dan niet meer zien wat RTG in zijn omgeving doet
   -- en dat is precies het moment waarop hij dat wil zien. Zelfde reden als bij
   /api/tenant/status. */
'use strict';

module.exports = ({ app, tenant, bijstand, viaBeheerOfDirectie }) => {
  /* `bijstand` komt als FUNCTIE binnen en niet als waarde. De tenantroutes
     hangen in server/opzet/routes-dwars.js en RTG Command pas in ./aanbouw.js
     -- op dit moment bestaat de laag dus nog niet. Op AANROEPMOMENT wel, en dan
     is deze bedrading ook onafhankelijk van de volgorde. Zelfde haak als bij
     `bedrijf` bovenin routes/tenant.js.

     En het is BIJSTAND en niet `command`: de domeingrens (GRENZEN.json) geeft
     de tenantkant daarmee precies deze ene laag, en niet de operator, de
     recepten en het beleid erbij. */
  const B = () => bijstand();
  /* DE POORT STAAT BIJ ELKE ROUTE ZELF en niet in dit hulpje. Dat is geen
     omhaal: `npm run check` regel 28 kijkt per route of er een deur voor staat,
     en een deur die achter een eigen wrapper verdwijnt, is een deur die niemand
     bij het lezen ziet -- ook geen mens. Wat hier overblijft is de vraag ná de
     deur: bij welke ORGANISATIE hoort deze werkruimte. */
  function orgVan(w, res) {
    const t = tenant.register.vanWerkruimte(w.code);
    if (!t) {
      res.status(404).json({ error: 'Deze werkruimte hoort bij geen enkele organisatie met een contract.',
        let: 'Bijstand loopt via de organisatie, want die is de grens waarbinnen een sessie geldt.' });
      return null;
    }
    return { org: t.org, w };
  }
  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(Object.assign({ ok: true }, r));

  /* Wat er te kiezen valt, vóór er iets gekozen is. Open voor wie de stand mag
     zien: een klant hoort te kunnen lezen wat de vier niveaus betekenen zonder
     eerst een sessie te openen. */
  app.post('/api/tenant/bijstand/niveaus', (req, res) => {
    req.geenQuotum = true;
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    if (!orgVan(w, res)) return;
    res.json({ ok: true, niveaus: B().NIVEAUS,
      let: 'Op elk niveau geldt: de sessie verloopt vanzelf, u ziet live wat er gebeurt, en de inhoud van ' +
        'uw gegevens blijft dicht tenzij u daar apart toestemming voor geeft.' });
  });

  app.post('/api/tenant/bijstand', (req, res) => {
    req.geenQuotum = true;
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const o = orgVan(w, res); if (!o) return;
    res.json({ ok: true, sessies: B().lijst({ org: o.org, max: 20 }),
      niveaus: B().NIVEAUS });
  });

  app.post('/api/tenant/bijstand/dossier', (req, res) => {
    req.geenQuotum = true;
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const o = orgVan(w, res); if (!o) return;
    const d = B().dossier(String(req.body.id || ''), { voorKlant: true });
    if (d.error) return res.status(d.status || 400).json(d);
    /* De org wordt HIER nagekeken en niet in de kern: het dossier is een lezer
       en hoort niet te weten wie er belt. Een sessie van een andere organisatie
       bestaat voor deze beller niet -- 404 en geen 403, want een 403 bevestigt
       dat hij bestaat. */
    if (d.org !== o.org) return res.status(404).json({ error: 'Die sessie bestaat niet.' });
    res.json({ ok: true, sessie: d });
  });

  app.post('/api/tenant/bijstand/vraag', (req, res) => {
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const o = orgVan(w, res); if (!o) return;
    stuur(res, B().vraag(o.org, {
      niveau: req.body.niveau, onderwerp: req.body.onderwerp, minuten: req.body.minuten,
      reden: req.body.reden, werkruimte: o.w.code, door: 'de werkruimte ' + o.w.code }));
  });

  /* Intrekken vraagt geen reden. Een uitnodiging die je niet zonder uitleg kunt
     terugnemen, is geen uitnodiging. */
  app.post('/api/tenant/bijstand/intrekken', (req, res) => {
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const o = orgVan(w, res); if (!o) return;
    stuur(res, B().trekIn(o.org, String(req.body.id || ''), 'de werkruimte ' + o.w.code));
  });

  app.post('/api/tenant/bijstand/besluit', (req, res) => {
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const o = orgVan(w, res); if (!o) return;
    stuur(res, B().besluit(o.org, String(req.body.id || ''), req.body.index,
      req.body.akkoord === true, 'de werkruimte ' + o.w.code));
  });

  app.post('/api/tenant/bijstand/inhoud', (req, res) => {
    const w = viaBeheerOfDirectie(req, res); if (!w) return;
    const o = orgVan(w, res); if (!o) return;
    stuur(res, B().inhoudBesluit(o.org, String(req.body.id || ''),
      req.body.akkoord === true, 'de werkruimte ' + o.w.code));
  });
};
