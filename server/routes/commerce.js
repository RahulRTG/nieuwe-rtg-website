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
  const { app, auth, commerce } = kern;
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
    const r = commerce.mandZet(wie(req), b.koopbaarId, b.aantal, !!b.vervang);
    if (r.error) return stuur(res, r);
    stuur(res, commerce.mandBeeld(wie(req)));
  });

  app.post('/api/commerce/mand/leeg', auth, (req, res) => {
    const r = commerce.mandLeeg(wie(req));
    if (r.error) return stuur(res, r);
    stuur(res, commerce.mandBeeld(wie(req)));
  });

  /* Doorrekenen zonder mand: voor een scherm dat een samenstelling wil laten
     zien voordat iemand iets bewaart. Dezelfde rekenaar, dus dezelfde grenzen --
     inclusief het melden van meegestuurde bedragen. */
  app.post('/api/commerce/reken', auth, (req, res) => {
    const regels = Array.isArray((req.body || {}).regels) ? req.body.regels : [];
    stuur(res, commerce.reken(regels));
  });
};
