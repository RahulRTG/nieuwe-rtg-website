/* Routes "commerce": de verkooplaag boven de domeinen (kern/commerce/, COMMERCE.md).

   WAT HIER WEL EN NIET GEBEURT. Deze routes LEZEN en ze houden een mand bij.
   Er wordt niets besteld en niets betaald: bevestigen gebeurt in het domein dat
   er al over gaat (kern/lidacties voor een order bij een partner, routes/gast
   voor de gastdeur) en geld beweegt alleen langs kern/pay/poort.js. Een tweede
   besteldeur hier zou een tweede orderwaarheid maken, en dat is precies wat
   COMMERCE.md par. 5 verbiedt.

   DE MAND STAAT OP DE SESSIESLEUTEL en niet op een naam -- zie de kop van
   kern/commerce/mand.js. Dat is niet alleen privacy: het is ook waarom een gast
   aan een tafel straks dezelfde mand kan hebben zonder account.

   ALLES ACHTER `auth`. Een publieke verkoopweg (een winkel die een vreemde
   bezoeker bedient op een eigen domein) is een BESLUIT van de eigenaar en geen
   ontbrekende route: kern/webdomein.js legt uit waarom dat de grens is tussen
   "alleen een ingelogd lid leest dit" en "iedereen leest dit". Zolang dat besluit
   niet is genomen, komt er hier geen deur omheen. */
module.exports = (kern) => {
  /* `liveCodename` zet de sessie om in de codenaam waarop RTG Pay boekt. Hij
     staat hier en niet in de kern: welke codenaam bij een sessie hoort, is een
     vraag van de deur en niet van de commerce-laag. */
  const { app, auth, commerce, liveCodename } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const wie = (req) => req.session.key;
  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 80) || null;

  /* Wat er te koop staat. De filters gaan langs een schoonmaak en niet
     rechtstreeks de graaf in: `verkoper` belandt in een vergelijking op
     zaakcode. */
  app.post('/api/commerce/aanbod', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, commerce.aanbod({
      verkoper: tekst(b.verkoper, 40),
      bron: tekst(b.bron, 30),
      type: tekst(b.type, 30),
      alleenKoopbaar: !!b.alleenKoopbaar
    }));
  });

  /* De etalage van EEN verkoper, met de lijst "staat er niet bij, en waarom".
     Die tweede lijst is voor de ondernemer: een artikel dat niet te koop staat
     zonder dat iemand zegt waarom, is een artikel dat maanden blijft liggen. */
  app.post('/api/commerce/etalage', auth, (req, res) => {
    const code = tekst((req.body || {}).verkoper, 40);
    if (!code) return res.status(400).json({ error: 'Welke verkoper?' });
    stuur(res, commerce.etalage(code));
  });

  /* De mand, doorgerekend: per verkoper een afrekening, met blokkades, btw en
     de uitdrukkelijke mededeling dat RTG niets namens hen bevestigt. */
  app.post('/api/commerce/mand', auth, (req, res) => stuur(res, commerce.mandBeeld(wie(req))));

  /* Erin, eruit, of een ander aantal. `vervang: true` zet het aantal, anders
     telt hij op; `aantal: 0` haalt de regel weg. Het antwoord is meteen het
     nieuwe doorgerekende beeld -- anders moet elk scherm twee aanroepen doen en
     kan het tussendoor een oud totaal tonen. */
  app.post('/api/commerce/mand/zet', auth, (req, res) => {
    const b = req.body || {};
    /* `antwoorden` is de keuze achter een prijsvraag (welke kamer, hoeveel
       nachten). Geen bedrag: het bedrag komt uit de server. Zie
       kern/commerce/prijsvraag.js. */
    const r = commerce.mandZet(wie(req), b.koopbaarId, b.aantal, !!b.vervang,
      (b.antwoorden && typeof b.antwoorden === 'object') ? b.antwoorden : null);
    if (r.error) return stuur(res, r);
    stuur(res, commerce.mandBeeld(wie(req)));
  });

  app.post('/api/commerce/mand/leeg', auth, (req, res) => {
    const r = commerce.mandLeeg(wie(req));
    if (r.error) return stuur(res, r);
    stuur(res, commerce.mandBeeld(wie(req)));
  });

  /* ---------- de overdracht (kern/commerce/overdracht.js) ----------

     De keuze afleveren bij de deur die wel bevestigt. Er wordt hier NIETS
     besteld: het antwoord is een briefje-id en het adres van de pagina waar het
     domein zijn eigen bevestiging doet. Wat er in het briefje staat, komt uit
     het doorgerekende mandbeeld van deze sessie -- de body zegt alleen WELKE
     verkoper en, als er twee deuren zijn, welke. */
  app.post('/api/commerce/overdracht/maak', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, commerce.overdrachtMaak(wie(req), {
      verkoper: tekst(b.verkoper, 40), pagina: tekst(b.pagina, 200)
    }));
  });

  /* Lezen op het scherm van het DOMEIN: shared/overdracht.js haalt hem op zodra
     er `?overdracht=` in het adres staat. De sleutel komt uit de sessie en niet
     uit het adres -- een id in een adresbalk is anders een leesbaar briefje voor
     iedereen met wie die link wordt gedeeld. */
  app.post('/api/commerce/overdracht/lees', auth, (req, res) =>
    stuur(res, commerce.overdrachtLees(tekst((req.body || {}).id, 60), wie(req))));

  app.post('/api/commerce/overdracht/mijn', auth, (req, res) =>
    res.json({ ok: true, overdrachten: commerce.overdrachtMijn(wie(req)) }));

  /* ---------- de weg terug (COMMERCE.md par. 6, kern/commerce/retour.js) ----------

     WIE WAT MAG, ZIT IN DE KERN EN NIET HIER. `door` zegt namens welke partij
     een stand wordt gezet, en de standentabel bepaalt of dat mag. Deze routes
     leiden dat alleen door -- met EEN uitzondering die hier thuishoort: een lid
     is per definitie de koper, dus het lid kan zichzelf hier nooit tot verkoper
     benoemen. De verkoperkant hoort achter supplierAuth en staat in
     routes/supplier/; tot die er is, komen die standen niet langs deze deur. */
  app.post('/api/commerce/retour/vraag', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, commerce.retourVraag({
      sleutel: wie(req),
      /* Zonder codenaam kan er later geen geld terug. Hij wordt HIER vastgelegd
         en niet bij het afhandelen: op dat moment is de sessie er niet meer. */
      codenaam: liveCodename ? liveCodename(req.session) : null,
      koopbaarId: tekst(b.koopbaarId, 80),
      orderRef: tekst(b.orderRef, 80), grond: tekst(b.grond, 40),
      toelichting: tekst(b.toelichting, 500), centen: b.centen
    }));
  });

  /* Wat het LID zelf kan zetten: onderweg (hij heeft het verstuurd). Meer niet.
     Aanvaarden, beoordelen en afhandelen zijn handelingen van de verkoper, en
     die krijgen hier geen ingang -- ook niet met `door: 'verkoper'` in de body. */
  app.post('/api/commerce/retour/verstuurd', auth, (req, res) => {
    stuur(res, commerce.retourZet({ id: tekst((req.body || {}).id, 60), naar: 'onderweg', door: 'koper', sleutel: wie(req) }));
  });

  app.post('/api/commerce/retour/mijn', auth, (req, res) =>
    res.json({ ok: true, retouren: commerce.retourVanKoper(wie(req)),
      /* Wat er met opzet niet bestaat, gaat mee zodat een scherm het kan tonen
         in plaats van een knop te bouwen die nooit werkt. */
      nietGebouwd: commerce.RETOUR_NIET_GEBOUWD }));

  /* Doorrekenen zonder mand: voor een scherm dat een samenstelling wil laten
     zien voordat iemand iets bewaart. Dezelfde rekenaar, dus dezelfde grenzen --
     inclusief het melden van meegestuurde bedragen. */
  app.post('/api/commerce/reken', auth, (req, res) => {
    const regels = Array.isArray((req.body || {}).regels) ? req.body.regels : [];
    stuur(res, commerce.reken(regels));
  });
};
