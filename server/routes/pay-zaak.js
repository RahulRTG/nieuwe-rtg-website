/* Domein "pay", de ZAAKKANT: alles wat een leverancier met RTG Pay doet.

   Afgesplitst van ./pay.js omdat dat bestand over de keuringsgrens ging, en de
   snede volgt de poort: hier komt niets binnen dat niet langs `supplierAuth` is
   gekomen. Dat is meer dan een ordeningsprincipe -- de ledenkant en de zaakkant
   hebben verschillende bedreigingen. Een lid dat een verzoek vervalst, komt bij
   zijn eigen wallet uit; een zaak die dat doet, komt bij die van iemand anders.

   Vier soorten handelingen, in oplopende zwaarte:
     budget      waarde uitgeven aan een lid, uit de eigen pot (manager)
     vooraf      een bedrag vastzetten op de code van een lid, en later
                 vastleggen of vrijgeven
     in          direct innen op een code
     uitbetaal   het saldo naar de bank (manager)

   Het GENRE komt overal uit het partnerregister (`req.supplier.type`) en nooit
   uit het verzoek. Een zaak die haar eigen genre mag opgeven, kan een
   maaltijdbudget innen door "restaurant" te sturen -- en dan is de
   bestedingsbeperking van een werkgever een suggestie geworden die de
   ontvanger zelf invult. */
module.exports = (kern, { stuur }) => {
  const { app, supplierAuth, managerOnly, pay, sseToOffice } = kern;

  /* WAT EEN ZAAK TE HOREN KRIJGT BIJ EEN WEIGERING, en waarom dat minder is dan
     wat er gebeurde.

     De waardepoort weigert met een reden, en die reden is vaak een privégegeven
     van het LID: dat hij zichzelf een daglimiet heeft opgelegd, dat zijn wallet
     tegen het plafond zit, dat een andere zaak een borg heeft vastgezet, of dat
     hij een werkgeversbudget heeft dat hier niet geldt. Dat gaat een kassa niets
     aan. Een pinautomaat vertelt de winkelier ook niet waarom de bank nee zei.

     Dus: alles wat een zaak bereikt is generiek, met ÉÉN uitzondering.
     "Onvoldoende saldo" blijft staan, want dat is precies wat een betaalterminal
     wel meldt en het verandert wat de zaak nu doet -- om een andere betaalwijze
     vragen. Maar zelfs daar gaat het bedrag eraf: hoeveel er tekort is, en
     hoeveel er vastgezet staat, is niet aan de kassa.

     Het LID krijgt de volledige reden wel, via zijn eigen app (./pay.js). */
  const stuurZaak = (res, r) => {
    if (!r || !r.error) return stuur(res, r);
    const status = r.status || 400;
    if (status === 402) return res.status(402).json({ error: 'Onvoldoende saldo.' });
    if (r.reden) return res.status(status).json({ error: 'Deze betaling is geweigerd.' });
    return stuur(res, r);
  };

  /* ---- een budget geven ----
     De uitgever boekt uit ZIJN EIGEN pot; er is geen manier om een andere pot
     op te geven. Zo kan een werkgever nooit uitdelen uit het saldo van een
     ander -- niet omdat er een controle op staat, maar omdat de vraag niet
     bestaat. Alleen de manager van de zaak, want dit is een geldhandeling en
     geen werkhandeling: net als de uitbetaling hieronder. */
  app.post('/api/supplier/pay/budget', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = await pay.budgetGeef({
      uitgeverRek: 'partner:' + req.supplier.code, uitgever: req.supplier.code,
      aanCodenaam: req.body.aan, klasse: req.body.klasse || 'EMPLOYER_BUDGET',
      centen: req.body.centen, beleid: req.body.beleid, vervaltOp: req.body.vervaltOp,
      oms: req.body.oms, idem: req.body.idem });
    if (r.ok) sseToOffice('sync', { scope: 'pay' });
    stuur(res, r);
  });
  /* LEZEN IS HIER ZWAARDER DAN SCHRIJVEN. `budgetGeef` hierboven kost geld en
     vroeg de manager al; deze route kost niets, maar geeft per regel de
     CODENAAM van de ontvanger, zijn restant en waaraan het gebonden is. Bij een
     werkgever met maaltijdbudget is dat het personeelsdossier in tabelvorm --
     en elke collega met een PDA kon het opvragen. Precies het gegeven waarvoor
     de codenamenlaag bestaat. */
  app.post('/api/supplier/pay/budget/lijst', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, pay.budgettenVan(req.supplier.code));
  });

  /* ---- de waardegraaf van de zaak ----
     Van klantbetaling naar wat er werkelijk van u is. Let op de vlag `afgeleid`
     per regel: de kosten staan echt in het grootboek, het btw- en loondeel zijn
     een percentage uit het eigen beleid. Een schatting die zich voordoet als een
     afdracht is gevaarlijker dan geen bedrag. */
  app.post('/api/supplier/pay/graaf', supplierAuth, (req, res) => {
    stuur(res, pay.graafVanZaak(req.supplier.code, { dagen: req.body.dagen }));
  });

  /* DE TREASURY EN DE PRE-AUTORISATIE (./pay-zaak-treasury.js): geld dat
     blijft STAAN met een bestemming -- opzij voor de belasting, of
     vastgehouden tot een levering klopt -- tegenover het geld dat hier NU
     beweegt. De snede loopt langs de tijd. */
  require('./pay-zaak-treasury')(kern, { stuurZaak });

  /* HET ZAAKTEGOED, hierheen verhuisd bij de samenvoeging van 26 augustus 2026.
     Deze drie stonden in routes/pay.js; main splitste de zaakkant af naar dit
     bestand en toen stond /api/supplier/pay/in twee keer geregistreerd -- de
     tweede registratie wint stil, en dan hangt een route aan een andere poort
     dan je leest. Ze horen hier: dit is het bestand waar niets binnenkomt dat
     niet langs supplierAuth is geweest, en managerOnly woont hier ook. */
  /* De zaak zet tegoed klaar voor personeel of klanten (kern/pay/tegoed-zaak.js).
     Klaarzetten en terugnemen zijn van de MANAGER en niet van elke ingelegde
     medewerker, om dezelfde reden als bij uitbetalen hieronder: het haalt geld
     uit de kas op een moment dat de eigenaar niet koos. Kijken mag iedereen --
     dat is het werk. */
  app.post('/api/supplier/pay/tegoed', supplierAuth, (req, res) => {
    res.json(pay.tegoedZaakOverzicht(req.supplier.code));
  });
  app.post('/api/supplier/pay/tegoed/zet', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, await pay.tegoedZaakKoop({ supplierCode: req.supplier.code, centen: req.body.centen, aanCodenaam: req.body.aan, oms: req.body.oms, idem: req.body.idem }));
  });
  app.post('/api/supplier/pay/tegoed/terug', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, await pay.tegoedZaakTerug({ supplierCode: req.supplier.code, tegoedId: String(req.body.id || ''), idem: req.body.idem }));
  });

  app.post('/api/supplier/pay/in', supplierAuth, async (req, res) => {
    /* Het genre komt uit het PARTNERREGISTER en niet uit het verzoek. Een zaak
       die haar eigen genre mag opgeven, kan een maaltijdbudget innen door
       "restaurant" te sturen -- en dan is de bestedingsbeperking van een
       werkgever een suggestie geworden die de ontvanger zelf invult. */
    const r = await pay.kasInt({ supplierCode: req.supplier.code, code: req.body.code,
      centen: req.body.centen, oms: req.body.oms, idem: req.body.idem, genre: req.supplier.type });
    if (r.ok) sseToOffice('sync', { scope: 'pay' });
    stuurZaak(res, r);
  });
  app.post('/api/supplier/pay/overzicht', supplierAuth, (req, res) => {
    res.json(pay.partnerOverzicht(req.supplier.code));
  });
  /* UITBETALEN IS GEEN WERKHANDELING MAAR EEN GELDHANDELING.

     Deze route stuurt het hele RTG Pay-saldo van de zaak naar de bank en roept
     daarvoor de echte betaaldienst aan. Hij stond op supplierAuth, en dat is
     ELKE ingelogde medewerker: de afwasser met een pincode kon het saldo van de
     zaak leegtrekken. Dat het geld naar de rekening van de zaak zelf gaat maakt
     het niet ongevaarlijk -- het is onomkeerbaar, het haalt geld uit de kas op
     een moment dat de eigenaar niet koos, en het is een prima manier om een
     zaak op een druk moment plat te leggen.

     Innen (pay/in) en het saldo bekijken (pay/overzicht) blijven voor iedereen:
     dat is het werk. Weghalen is van de manager. */
  app.post('/api/supplier/pay/uitbetaal', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, await pay.partnerUitbetaal({ supplierCode: req.supplier.code, idem: req.body.idem }));
  });

  /* WAAR DAT GELD HEEN GAAT. Deze vraag werd nooit gesteld: de uitbetaling ging
     de rail op met een lege iban, en die reserveert dan in plaats van te
     versturen -- terwijl het saldo er al af was (kern/pay/zaakrekening.js).

     Van de manager, om dezelfde reden als uitbetalen zelf: wie de bestemming
     mag zetten, mag het saldo verleggen. Dat is dezelfde handeling, een stap
     eerder. */
  app.post('/api/supplier/pay/rekening', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, pay.zaakRekeningZet(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/pay/rekening/stand', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = pay.zaakRekening(req.supplier.code);
    /* Alleen de laatste vier cijfers terug. Wie het scherm openzet hoeft het
       hele nummer niet te zien om te weten dat het goed staat. */
    stuur(res, { ok: true, ingesteld: !!r.iban, reden: r.reden || null,
      bruikbaarVanaf: r.bruikbaarVanaf || null,
      eind: r.iban ? String(r.iban).slice(-4) : null, naam: r.naam || null });
  });

};
