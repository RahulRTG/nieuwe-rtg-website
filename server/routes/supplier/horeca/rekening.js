/* Horeca OS (deellaag): de rekening zelf -- openen, regels erop zetten,
   gangen aansturen en het overzicht van wat er openstaat.

   De rekening is het hart van een horecasysteem en niet de bon: hij gaat open
   als de gasten aanschuiven en blijft leven tot er betaald is. Drie dingen die
   hier bewust zo zijn:

   - EEN REGEL DRAAGT ZIJN EIGEN PRIJS. De prijs wordt vastgelegd op het moment
     van bestellen, inclusief een eventuele happy hour. Verandert de kaart
     daarna, dan verandert de rekening van deze gast niet. Dat is geen detail:
     een biertje dat na het bestellen duurder wordt, is precies waar ruzie aan
     de bar over ontstaat.
   - ALLERGIE IS GEEN NOTITIE. Een allergie staat in een eigen veld en gaat
     ongefilterd mee naar de keuken. In een vrij notitieveld verdwijnt hij
     tussen "zonder ui" en "extra krokant".
   - DE GANG IS EEN EIGENSCHAP VAN DE REGEL, niet van de bon. Alleen zo kan de
     keuken alle hoofdgerechten van tafel 24 tegelijk uitgeven terwijl het
     voorgerecht al weg is. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { KANALEN, H, Hlees, nu, id, totaal, openstaand } = horeca;
  const { bouwRegel } = require('../../../kern/horeca/regel')({ schoon, horeca });
  const correctie = require('../../../kern/horeca/correctie')({ horeca, schoon });
  kern.horecaCorrectie = correctie;
  /* Dezelfde kaartopbouw die de gastdeur leest (kern/horeca/kaart.js). Niet
     `kern.gastKaartVanZaak`: dat is een naam van het gast-domein en het
     supplier-domein hoort daar niet in te grijpen. */
  const { kaartVanZaak, kaartPerGroep } = require('../../../kern/horeca/kaart')({ findSupplier: kern.findSupplier, horeca });

  /* OPZOEKEN IS KIJKEN, dus Hlees en niet H: H() zet de doos van een zaak neer
     zodra iemand ernaar vraagt, ook als die vraag hieronder met een 404 eindigt.
     Bestaat de doos wel, dan geeft Hlees hem ECHT terug en landt elke wijziging
     gewoon in de opslag (zie kern/horeca.js). */
  const rekVan = (req, res) => {
    const h = Hlees(req.supplier.code);
    const r = Object.prototype.hasOwnProperty.call(h.rekeningen, String(req.body.rekeningId || ''))
      ? h.rekeningen[String(req.body.rekeningId)] : null;
    if (!r) { res.status(404).json({ error: 'Deze rekening kennen we niet.' }); return null; }
    return r;
  };
  const publiek = (r) => Object.assign({}, r, { totalen: totaal(r), openstaand: openstaand(r) });
  kern.horecaRekVan = rekVan;
  kern.horecaPubliek = publiek;

  /* ---------- openen ---------- */
  app.post('/api/supplier/horeca/rekening/open', supplierAuth, (req, res) => {
    const kanaal = String(req.body.kanaal || 'tafel');
    if (!KANALEN.includes(kanaal)) return res.status(400).json({ error: 'Onbekend verkoopkanaal. Kies uit: ' + KANALEN.join(', ') + '.' });
    const tafel = schoon(req.body.tafel, 30) || null;
    // een tafel heeft er hooguit een open: anders staan er twee rekeningen op
    // tafel 12 en betaalt de ene tafel de bestelling van de andere. Die controle
    // KIJKT alleen: een 409 hoort geen verse doos achter te laten.
    if (kanaal === 'tafel' && tafel) {
      const bestaand = Object.values(Hlees(req.supplier.code).rekeningen).find(r => r.status === 'open' && r.kanaal === 'tafel' && r.tafel === tafel);
      if (bestaand) return res.status(409).json({ error: 'Op ' + tafel + ' staat al een open rekening.', rekeningId: bestaand.id });
    }
    const r = { id: id(5), kanaal, tafel, naam: schoon(req.body.naam, 60) || null,
      gasten: Math.max(1, Math.min(500, parseInt(req.body.gasten, 10) || 1)),
      status: 'open', regels: [], kortingen: [], betalingen: [], fooiCenten: 0,
      gastId: schoon(req.body.gastId, 40) || null, kamer: schoon(req.body.kamer, 20) || null,
      geopendAt: nu(), door: req.actor.name, at: nu() };
    H(req.supplier.code).rekeningen[r.id] = r;
    save();
    logActivity(req.supplier.code, req.actor, 'opende een rekening op ' + (tafel || kanaal));
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, rekening: publiek(r) });
  });

  /* ---------- een regel erop ----------
     De regel zelf wordt gebouwd in kern/horeca/regel.js, want de gastenkant
     (routes/gast/) zet dezelfde regel op dezelfde rekening. Twee kopieen van
     deze rekensom betekent twee antwoorden op "wat kost dit met happy hour". */
  /* ---------- DE KAART VAN DE ZAAK, voor de bediening ----------

     Dezelfde kaart die de gast op zijn telefoon ziet (kern/horeca/kaart.js) en
     met opzet geen tweede opbouw. Een tweede kaart is een tweede antwoord op
     "wat kost een biertje" en op "staat dit gerecht uitverkocht" -- en dan wijst
     de gast op zijn scherm terwijl de bediening iets anders ziet (LAT-regel 4).

     WEL EEN VERSCHIL, EN DAT IS GEEN INCONSEQUENTIE: uitverkochte gerechten
     blijven hier STAAN, met hun vlag. De gast hoort ze niet te kunnen kiezen;
     de bediening hoort te kunnen zien dat ze op zijn, en mag na overleg met de
     keuken alsnog iets aanslaan. Wegfilteren zou van "op" een geheim maken. */
  app.post('/api/supplier/horeca/kaart', supplierAuth, (req, res) => {
    const groepen = kaartPerGroep(req.supplier.code).map(g => ({ cat: g.cat,
      items: g.items.map(i => ({ id: i.id, naam: i.naam, centen: i.centen, station: i.station,
        alcohol: i.alcohol, uitverkocht: i.uitverkocht, allergenen: i.allergenen })) }));
    res.json({ ok: true, aantal: groepen.reduce((n, g) => n + g.items.length, 0), groepen,
      let: 'Uitverkochte gerechten staan er met hun vlag bij: de gast kan ze niet kiezen, de bediening ziet ze wel.' });
  });

  app.post('/api/supplier/horeca/rekening/regel', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (r.status !== 'open') return res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' });
    /* EEN ITEM VAN DE KAART DRAAGT ZIJN PRIJS NIET MEE UIT DE CLIENT. Wie
       `itemId` stuurt, krijgt naam, prijs en station van de kaart van de zaak --
       precies zoals de gastkant het al deed (routes/gast/bestellen.js). Zou de
       PDA de prijs meesturen, dan bepaalt een scherm wat een biertje kost, en
       dan is er geen enkele controle meer op wat er wordt aangeslagen.

       Vrij typen blijft kunnen: een special, een gang uit een arrangement of
       iets dat niet op de kaart staat, is echt werk en geen misbruik. Wat er
       niet mag, is een itemId MET een eigen prijs -- dan zou de kaartprijs
       ongemerkt overschreven kunnen worden. */
    let invoer = req.body;
    if (req.body.itemId) {
      const item = kaartVanZaak(req.supplier.code).find(x => x.id === String(req.body.itemId));
      if (!item) return res.status(404).json({ error: 'Dit gerecht staat niet op de kaart van deze zaak.' });
      invoer = Object.assign({}, req.body, { naam: item.naam, centen: item.centen,
        station: req.body.station || item.station || null, prijs: undefined, itemId: item.id });
    }
    const uit = bouwRegel(req.supplier.code, invoer, req.actor.name);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    const regel = uit.regel;
    r.regels.push(regel);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, regel, rekening: publiek(r) });
  });

  // een regel eraf (verkeerd aangeslagen). Alleen zolang de keuken er niet aan
  // begonnen is; daarna is het derving en dat is een andere knop met een reden.
  app.post('/api/supplier/horeca/rekening/regel/weg', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const i = r.regels.findIndex(x => x.id === String(req.body.regelId || ''));
    if (i < 0) return res.status(404).json({ error: 'Die regel staat niet op deze rekening.' });
    /* DE OUDE MELDING WEES NAAR EEN DEUR DIE ER NIET WAS: "via derving",
       terwijl die alleen in de KASSA bestaat en geen rekening kent. De weg
       bestaat nu wel; zie kern/horeca/correctie.js. */
    if (r.regels[i].stand !== 'besteld')
      return res.status(409).json({
        error: 'De keuken is hier al aan begonnen. Haal hem eraf met een correctie, met een grond en een reden.',
        code: 'keuken-begonnen', via: '/api/supplier/horeca/rekening/regel/corrigeer',
        gronden: correctie.GRONDEN.map(g => ({ id: g.id, label: g.label })) });
    const weg = r.regels.splice(i, 1)[0];
    save();
    logActivity(req.supplier.code, req.actor, 'haalde ' + weg.naam + ' van de rekening');
    res.json({ ok: true, rekening: publiek(r) });
  });

  /* ---------- gangen ----------
     De bediening zet een gang vrij ("laat maar komen"); de keuken zet de
     regels daarna zelf door op het keukenscherm. Zo bepaalt de zaal het tempo
     van het diner en de keuken het tempo van de bereiding. */
  app.post('/api/supplier/horeca/gang/vrij', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const gang = Math.max(0, Math.min(9, parseInt(req.body.gang, 10) || 0));
    const regels = r.regels.filter(x => x.gang === gang && !x.vrijAt);
    if (!regels.length) return res.status(404).json({ error: 'Er staat niets meer open in gang ' + gang + '.' });
    const om = schoon(req.body.serveerOm, 5) || null;
    for (const x of regels) { x.vrijAt = nu(); x.serveerOm = om; }
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'keuken' });
    res.json({ ok: true, gang, vrijgegeven: regels.length, serveerOm: om, rekening: publiek(r) });
  });

  /* ---------- kijken ---------- */
  app.post('/api/supplier/horeca/rekening', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    res.json({ ok: true, rekening: publiek(r) });
  });

  app.post('/api/supplier/horeca/rekeningen', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const status = schoon(req.body.status, 20) || 'open';
    const kanaal = schoon(req.body.kanaal, 20);
    const rijen = Object.values(h.rekeningen)
      .filter(r => r.status === status && (!kanaal || r.kanaal === kanaal))
      .sort((a, b) => String(a.geopendAt).localeCompare(String(b.geopendAt)))
      .slice(0, 300)
      .map(r => ({ id: r.id, kanaal: r.kanaal, tafel: r.tafel, naam: r.naam, gasten: r.gasten,
        regels: r.regels.length, geopendAt: r.geopendAt, totalen: totaal(r), openstaand: openstaand(r) }));
    res.json({ ok: true, aantal: rijen.length, rekeningen: rijen,
      omzetOpen: rijen.reduce((t, r) => t + r.totalen.netto, 0) });
  });
};
