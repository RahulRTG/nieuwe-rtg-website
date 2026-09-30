/* RTG Werk OS (deellaag): de werkruimte zelf.

   Een holding is een gewone werkruimte met kinderen eronder. Dat is bewust
   geen apart soort: anders krijgt de tweede laag zijn eigen rechten- en
   journaalregels, en die lopen gegarandeerd uit de pas met de eerste. */
'use strict';

module.exports = (sctx) => {
  const { app, save, crypto, schoon, kern, W, nu, rid, beheerVan, eigenVeld, sleutels } = sctx;
  const PRODUCTIE = String(process.env.NODE_ENV || '') === 'production';

  const code = () => {
    let waarde;
    do {
      waarde = 'W' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
    } while (W()[waarde]);
    return waarde;
  };

  /* De eerste deur van het Werk OS is BEWUST open (zie scripts/poortwacht.js,
     PUBLIEK): wie hem aanroept heeft nog niets -- geen zaak, geen login. Maar
     een open scheppingsdeur zonder rem is een uitnodiging om de opslag vol te
     gieten. Vijf per afzender per tien minuten is voor een echt bedrijf ruim
     en voor een script niets. Lokaal geteld: de gedeelde tooManyTries-emmer
     wordt alleen door mislukte logins gevuld en zou hier dus nooit remmen. */
  const maakBeurten = new Map();
  const GEEN_LIMIET = process.env.NODE_ENV === 'test';
  function maakRem(ip) {
    if (GEEN_LIMIET) return false;
    const t = Date.now();
    if (maakBeurten.size > 10000) maakBeurten.clear();
    const b = (maakBeurten.get(ip) || []).filter(x => t - x < 10 * 60000);
    b.push(t); maakBeurten.set(ip, b);
    return b.length > 5;
  }

  /* DE HERHALING MET DEZELFDE SLEUTEL. Deze route staat in
     lib/eenmalig-geheim-routes.js: het antwoord draagt een beheer-token dat
     alleen als hash blijft, dus geen generieke antwoordcache mag het bewaren of
     herhalen. Dan moet het domein de dubbele uitgifte zelf tegenhouden, zoals
     kern/pay/kasbak.js dat doet: een retry met dezelfde idem-sleutel maakt geen
     tweede werkruimte en toont het eerste token niet opnieuw (409 zonder token).
     Tot 29 september 2026 ontbrak dit, en maakte een retry met dezelfde sleutel
     een tweede werkruimte terwijl het mutatiecontract PROTECTED zei. */
  const idemAfdruk = (req) => {
    const s = String((req.body && req.body.idem) || req.get('Idempotency-Key') || '').slice(0, 200);
    return s ? crypto.createHash('sha256').update('werkruimte|maak|' + s).digest('hex') : null;
  };

  app.post('/api/bedrijf/werkruimte/maak', (req, res) => {
    const idem = idemAfdruk(req);
    if (idem && Object.values(W()).some(x => x && x.idemAfdruk === idem)) {
      return res.status(409).json({ code: 'WERKRUIMTE_AL_GEMAAKT',
        error: 'Met deze sleutel is al een werkruimte gemaakt. Het beheer-token wordt maar een keer getoond; vraag een nieuw via de beheerder.' });
    }
    if (maakRem(String(req.ip || ''))) {
      return res.status(429).json({ error: 'Te veel nieuwe werkruimtes achter elkaar. Wacht een paar minuten.' });
    }
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Hoe heet de organisatie?' });
    const moeder = schoon(req.body.moeder, 8).toUpperCase();
    if (moeder && PRODUCTIE) {
      const c = req.werkosContext;
      const ouder = c && c.werkruimte;
      const rechten = ouder && c.lid && kern.bedrijf && kern.bedrijf.rechtenVan
        ? kern.bedrijf.rechtenVan(c.lid) : [];
      if (!ouder || ouder.code !== moeder || !rechten.includes('werkruimte')) {
        return res.status(404).json({ error: 'Die moederwerkruimte kennen we niet of u mag er geen werkruimte aan koppelen.' });
      }
    } else if (moeder) {
      const ouder = eigenVeld(W(), moeder);
      const moederBeheerToken = String(req.body.moederBeheerToken || '');
      /* Een bekende werkruimtecode is geen bevoegdheid om aan die holding te
         schrijven. Bestaande en onbekende ouders krijgen bewust hetzelfde
         antwoord, zodat deze grens ook geen werkruimtes laat enumereren. */
      if (!ouder || !moederBeheerToken || !sleutels.beheerVan(ouder, moederBeheerToken)) {
        return res.status(404).json({ error: 'Die moederwerkruimte kennen we niet of u mag er geen werkruimte aan koppelen.' });
      }
    }
    const w = {
      code: code(), naam, land: schoon(req.body.land, 2).toUpperCase() || 'NL',
      valuta: schoon(req.body.valuta, 3).toUpperCase() || 'EUR',
      taal: schoon(req.body.taal, 5) || 'nl', moeder: moeder || null,
      kvk: schoon(req.body.kvk, 20) || null, btwNummer: schoon(req.body.btw, 20) || null,
      leden: {}, journaal: [], at: nu()
    };
    if (idem) w.idemAfdruk = idem;
    if (PRODUCTIE) {
      const sessie = req.session;
      const naamAccount = sessie && sessie.account && kern.accounts && kern.accounts.realNameOf
        ? kern.accounts.realNameOf(sessie.account) : null;
      const l = { id: rid(4), naam: naamAccount || 'Directie', functie: 'directie',
        afdeling: 'directie', extern: false,
        rollen: [{ id: 'directie', van: null, tot: null, at: nu() }],
        status: 'actief', token: null, rtgKey: sessie.key,
        rtgCodenaam: sessie.account && sessie.account.codename || null,
        gekoppeldAt: nu(), toegelatenAt: nu(), at: nu() };
      w.leden[l.id] = l;
    }
    // buiten productie: een beheersessie die alleen als hash op w staat (./sleutels.js)
    const beheerToken = PRODUCTIE ? null : sleutels.geefBeheer(w);
    W()[w.code] = w;
    save();
    const antwoord = { ok: true, werkruimte: w.code, naam: w.naam };
    if (!PRODUCTIE) {
      antwoord.beheerToken = beheerToken;
      antwoord.let = 'Bewaar dit beheer-token: het wordt EEN keer getoond en is de sleutel van deze werkruimte. Leden krijgen straks hun eigen lid-token; dat is bewust een andere sleutel.';
    } else antwoord.let = 'De werkruimte is aan uw RTG-account gekoppeld. Uw huidige directierol bepaalt wat u mag.';
    res.json(antwoord);
  });

  app.post('/api/bedrijf/werkruimte', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    const kinderen = Object.values(W()).filter(x => x.moeder === w.code)
      .map(x => ({ code: x.code, naam: x.naam, land: x.land, valuta: x.valuta }));
    res.json({ ok: true,
      werkruimte: { code: w.code, naam: w.naam, land: w.land, valuta: w.valuta, taal: w.taal,
        moeder: w.moeder, kvk: w.kvk, btwNummer: w.btwNummer, at: w.at },
      leden: Object.values(w.leden).length, dochters: kinderen,
      let: kinderen.length
        ? 'Dochters staan hier met naam, meer niet. Geconsolideerd kijken is een eigen handeling met een eigen recht; het rolt er niet vanzelf uit.'
        : null });
  });
};
