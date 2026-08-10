/* RTMAIL-routes voor de leverancier: elke zaak heeft een postvak op zijn
   zaakcode ("<code>@rtmail"). De automatiseringen bezorgen hier hun berichten
   (sollicitatie binnen, inkoopvoorstel, factuur-seintje, overheidspost); de
   zaak leest ze, en kan zelf een bericht sturen naar een andere code.

   Alles achter de leverancier-inlog; het adres komt uit de sessie, nooit uit
   de body -- zo kan niemand in het postvak van een ander kijken. */
module.exports = (kern) => {
  const { app, supplierAuth, auth, rtmail, codenaamVan, automatisering, anthropic, db } = kern;
  /* Het adres draagt nu welk huis je hoort (kern/rtmail-adres.js). Een zaak
     handelt onder haar eigen code op partner.rtg. Post aan het oude "@rtmail"
     komt nog steeds aan: het postvak hangt aan het linkerdeel. */
  const wie = require('../kern/rtmail-wie')({ db, rtmail, codenaamVan });
  const adresVan = wie.zaakAdres;
  // het lid-adres: de codenaam van het account (privacy by design)
  const lidCodenaam = wie.lidCodenaam;

  app.post('/api/supplier/rtmail/inbox', supplierAuth, (req, res) => {
    const adres = adresVan(req);
    res.json({ adres, ongelezen: rtmail.ongelezen(adres), berichten: rtmail.postvak(adres) });
  });

  app.post('/api/supplier/rtmail/verzonden', supplierAuth, (req, res) => {
    res.json({ berichten: rtmail.verzonden(adresVan(req)) });
  });

  app.post('/api/supplier/rtmail/ongelezen', supplierAuth, (req, res) => {
    res.json({ ongelezen: rtmail.ongelezen(adresVan(req)) });
  });

  app.post('/api/supplier/rtmail/lees', supplierAuth, (req, res) => {
    const r = rtmail.lees(adresVan(req), String((req.body && req.body.id) || ''));
    if (r.error) return res.status(404).json({ error: r.error });
    res.json({ ok: true, bericht: r });
  });

  // Zelf een bericht sturen naar een andere code (van de eigen zaak vandaan).
  // De zaak is door supplierAuth geverifieerd, dus bron 'zaak' (vertrouwd): de
  // ontvanger krijgt een geverifieerd bericht. De client bepaalt het vertrouwen
  // nooit zelf -- dat gebeurt hier, bij de geverifieerde inlog.
  app.post('/api/supplier/rtmail/stuur', supplierAuth, (req, res) => {
    const b = req.body || {};
    const r = rtmail.stuur({ van: adresVan(req), naar: b.naar, onderwerp: b.onderwerp, tekst: b.tekst, soort: 'zaak', bron: 'zaak' });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, bericht: r });
  });

  /* ---- de premium AI-baan (alleen voor het geverifieerde postvak) ----
     Rahul vat het postvak samen of stelt een antwoord voor. Regelgebaseerd als
     basis (werkt ook zonder AI-sleutel), met Claude als verfijning. De AI
     verstuurt nooit zelf, opent nooit een link, en werkt alleen op de eigen post
     van de ingelogde partij -- geld/toegang blijft achter de menselijke poort. */
  function nood(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }
  function vatSamen(berichten) {
    const lijst = Array.isArray(berichten) ? berichten : [];
    const ongelezen = lijst.filter(m => !m.gelezen).length;
    // wat vraagt actie: overheid/inkoop/personeel, of een deadline/herinnering
    const actie = lijst.filter(m => ['overheid', 'inkoop', 'personeel'].includes(m.soort) ||
      /deadline|herinner|aangifte|actie|reageer/i.test((m.onderwerp || '') + ' ' + (m.tekst || '')));
    const zinnen = [];
    zinnen.push(lijst.length ? ('Je hebt ' + lijst.length + ' bericht' + (lijst.length === 1 ? '' : 'en') +
      (ongelezen ? (', waarvan ' + ongelezen + ' ongelezen') : '') + '.') : 'Je postvak is leeg.');
    if (actie.length) {
      const top = actie.slice(0, 3).map(m => '- ' + nood(m.onderwerp).slice(0, 70)).join('\n');
      zinnen.push(actie.length + ' vraag' + (actie.length === 1 ? 't' : 'en') + ' mogelijk actie:\n' + top);
    } else if (lijst.length) {
      zinnen.push('Niets vraagt directe actie; het zijn seintjes ter kennisname.');
    }
    return zinnen.join('\n\n');
  }
  function stelAntwoordVoor(m) {
    const soort = (m && m.soort) || 'bericht';
    const ond = 'Re: ' + nood((m && m.onderwerp) || '').slice(0, 120);
    const sjabloon = {
      inkoop: 'Dank voor het concept. We bevestigen de bestelling zelf zodra de prijsopgave rond is; graag jullie beste tarief en levertijd.',
      personeel: 'Dank voor het seintje. We bekijken de kandidaat en het cv en nemen zelf een besluit over uitnodigen.',
      factuur: 'Ontvangen, dank. We verwerken de factuur in onze administratie.',
      overheid: 'Genoteerd. We controleren de cijfers en dienen zelf op tijd in.',
      zaak: 'Dank voor je bericht, we pakken het op en komen erop terug.'
    };
    return { onderwerp: ond, tekst: sjabloon[soort] || sjabloon.zaak };
  }
  async function claudeSamenvatting(berichten, basis) {
    if (!anthropic) return basis;
    try {
      const context = (berichten || []).slice(0, 12).map(m =>
        '- [' + (m.soort || 'bericht') + (m.gelezen ? '' : ', ongelezen') + '] ' + nood(m.onderwerp).slice(0, 90)).join('\n');
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 300,
        system: 'Je bent Rahul, de rustige AI-conciërge van RTG. Vat een RTMAIL-postvak kort en zakelijk samen in het Nederlands (je/jij), ' +
          'noem wat actie vraagt, verzin niets, en beloof nooit iets namens RTG. Max 4 zinnen. Geen opsomming van alles, alleen wat telt.',
        messages: [{ role: 'user', content: 'Postvak:\n' + (context || '(leeg)') }]
      });
      const t = r && r.content && r.content[0] && r.content[0].text;
      return nood(t) || basis;
    } catch (e) { return basis; }
  }

  async function assist(berichten, body, res) {
    const b = body || {};
    if (b.actie === 'antwoord') {
      const m = (berichten || []).find(x => x.id === String(b.id || ''));
      if (!m) return res.status(404).json({ error: 'Bericht niet gevonden.' });
      return res.json({ ok: true, voorstel: stelAntwoordVoor(m) });
    }
    const basis = vatSamen(berichten);
    const tekst = await claudeSamenvatting(berichten, basis);
    res.json({ ok: true, samenvatting: tekst, ai: !!anthropic });
  }
  app.post('/api/supplier/rtmail/assist', supplierAuth, (req, res) => assist(rtmail.postvak(adresVan(req)), req.body, res));
  app.post('/api/member/rtmail/assist', auth, (req, res) => {
    const codenaam = lidCodenaam(req);
    if (!codenaam) return res.json({ ok: true, samenvatting: 'Je postvak is nog leeg.' });
    return assist(rtmail.postvak(codenaam), req.body, res);
  });

  /* ---- de draaiboeken die de zaak zelf (of Rahul namens de zaak) aftrapt ----
     Elk bereidt voor en bericht over RTMAIL; het bestellen en indienen blijft
     de zaak zelf. */
  app.post('/api/supplier/rtmail/inkoop', supplierAuth, (req, res) => {
    if (!automatisering) return res.status(503).json({ error: 'De automatiseringen draaien niet.' });
    const b = req.body || {};
    const r = automatisering.inkoopVoorstel({ zaakCode: req.supplier.code, groothandelCode: b.groothandel, regels: b.regels });
    if (!r) return res.status(400).json({ error: 'Geef een groothandel-code op.' });
    res.json({ ok: true, bezorgd: r.length });
  });
  /* De btw-herinnering. Periode, bedrag en deadline stonden hier in het LIJF en
     werden overgenomen; nu leidt het draaiboek ze zelf af uit het
     factuurregister (kern/automatisering.js). Een herinnering met een getypt
     bedrag is een tweede getal naast de aangifte waar hij naar verwijst, en dan
     zegt de een iets anders dan de ander.

     Geen bericht is hier een geldige uitkomst en geen fout: is er over het
     tijdvak al ingediend of viel er niets aan te geven, dan valt er niets te
     herinneren. Dat zegt hij met zoveel woorden, want een stille 200 laat de
     zaak denken dat er post onderweg is. */
  app.post('/api/supplier/rtmail/btw-herinner', supplierAuth, (req, res) => {
    if (!automatisering) return res.status(503).json({ error: 'De automatiseringen draaien niet.' });
    const r = automatisering.btwHerinnering({ zaakCode: req.supplier.code });
    if (!r) return res.status(200).json({ ok: true, bericht: null,
      reden: 'Er valt niets te herinneren: over het laatst afgesloten tijdvak is al ingediend, of er was niets aan te geven.' });
    res.json({ ok: true, bericht: r });
  });

  /* ---- de lid-kant: het RTMAIL-postvak in de verenigde Berichten-app ----
     Het adres is de codenaam van het lid; leden lezen alleen (RTMAIL bezorgt,
     het lid antwoordt niet naar de systeem-afzender). */
  /* Het adres van een lid: de codenaam op het domein van zijn lidmaatschap.
     De soort wordt AFGELEID uit de pas en de bewezen rollen -- niemand kiest
     zijn eigen domein, want dan was het adres een bewering in plaats van een
     feit. Het linkerdeel blijft de codenaam: een adres reist, en de echte naam
     hoort in de kluis te blijven (server/accounts.js). */
  const lidSoort = wie.lidSoort;
  const lidAdres = wie.lidAdres;

  app.post('/api/member/rtmail/adres', auth, (req, res) => {
    const adres = lidAdres(req);
    if (!adres) return res.json({ adres: null });
    const soort = lidSoort(req);
    res.json({ ok: true, adres, soort, domein: rtmail.DOMEINEN[soort],
      domeinen: rtmail.DOMEINEN,
      uitleg: 'Je adres volgt je lidmaatschap. Verandert je pas, dan verandert het domein mee -- en post aan je vorige adres komt gewoon aan.' });
  });

  app.post('/api/member/rtmail/inbox', auth, (req, res) => {
    const codenaam = lidCodenaam(req);
    if (!codenaam) return res.json({ adres: null, ongelezen: 0, berichten: [] });
    res.json({ adres: lidAdres(req), soort: lidSoort(req),
      ongelezen: rtmail.ongelezen(codenaam), berichten: rtmail.postvak(codenaam) });
  });
  app.post('/api/member/rtmail/lees', auth, (req, res) => {
    const codenaam = lidCodenaam(req);
    if (!codenaam) return res.status(404).json({ error: 'Geen postvak voor dit account.' });
    const r = rtmail.lees(codenaam, String((req.body && req.body.id) || ''));
    if (r.error) return res.status(404).json({ error: r.error });
    res.json({ ok: true, bericht: r });
  });

};
