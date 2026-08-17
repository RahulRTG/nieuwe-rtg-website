/* Routes "vakbewijs": de drie kanten van hetzelfde stuk papier.

   WAAROM DIT EEN EIGEN BESTAND IS EN NIET DRIE. Een vakbewijs raakt member
   (het is van de MENS), office (RTG tekent af) en supplier (de zaak wil weten
   of haar mensen erdoor komen). Het in drie domeinen uitsmeren zou drie plekken
   opleveren die iets over dezelfde rij beweren; het staat hier naast elkaar,
   met per route wie er doorheen mag. Zelfde reden als routes/concern.js.

   DE VOLGORDE IS DE HELE VEILIGHEID:

     1. de MENS legt vast wat hij heeft            (eigen RTG-account)
     2. RTG ziet het stuk en tekent af             (kantoor)
     3. de zaak ziet ALLEEN of het rond is         (leverancier)

   Stap 1 loopt bewust NIET via de werkgever. Wie zijn eigen VOG bij zijn baas
   inlevert en die baas laat aftekenen, heeft een VOG die precies zoveel waard
   is als het vertrouwen tussen die twee -- en dat is nul zodra ze onder een
   hoedje spelen. De aftekening ligt daarom bij RTG en nergens anders.

   Stap 3 geeft JA of NEE en verder niets. Een werkgever hoeft niet te weten wat
   iemands BIG-nummer is om te weten of hij vandaag kan voorschrijven; dat is
   dezelfde regel die kern/payroll/identiteit.js al trekt voor de identiteit. */
'use strict';

module.exports = (kern) => {
  const { app, auth, accounts, officeAuth, supplierAuth, persoonseis, sleutelLid,
    vakbewijsZet, vakbewijsTeken, vakbewijsIntrek, vakbewijzenVan, vakbewijzenVerlopend,
    notify } = kern;

  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  /* Een vakbewijs hoort bij een ECHT account. Een gast heeft geen werk en dus
     ook geen stuk -- en zonder deze regel zou een gastsessie rijen achterlaten
     die aan niemand hangen. */
  function eigenSleutel(req, res) {
    if (req.session.tier === 'guest' || !req.session.account) {
      res.status(403).json({ error: 'Een vakbewijs hoort bij een echt RTG-account.' });
      return null;
    }
    return sleutelLid(req.session.account.id);
  }

  /* ---- 1. de mens zelf ---- */

  /* Wat staat er op mijn naam, en wat vraagt mijn werk van mij? De tweede helft
     is het punt: een lijst van wat je HEBT zonder wat er NODIG is, laat iemand
     zelf puzzelen waarom hij er niet in komt. */
  app.post('/api/vakbewijs', auth, (req, res) => {
    const sleutel = eigenSleutel(req, res);
    if (!sleutel) return;
    const genres = [];
    try {
      for (const st of accounts.staffPositions(req.session.account.id) || []) {
        const s = kern.findSupplier(st.supplier_code);
        if (s && s.type && !genres.some(g => g.genre === s.type)) genres.push(persoonseis.eisenVoorGenre(s.type));
      }
    } catch (e) { /* geen werkplekken is geen fout: dan is de eisenlijst gewoon leeg */ }
    res.json({ ok: true, soorten: persoonseis.SOORTEN,
      vakbewijzen: vakbewijzenVan(sleutel), eisen: genres });
  });

  /* Vastleggen. Dit VERLEENT NIETS: tot een mens van RTG het heeft gezien,
     staat er een bewering. Zie kern/vakbewijs.js voor waarom een wijziging de
     aftekening wist. */
  app.post('/api/vakbewijs/zet', auth, (req, res) => {
    const sleutel = eigenSleutel(req, res);
    if (!sleutel) return;
    const b = req.body || {};
    const soort = String(b.wat || '');
    /* Alleen soorten die het register kent. Vrije tekst zou betekenen dat
       iemand "vog " met een spatie indient en daarna eeuwig wacht op een
       aftekening voor een stuk waar geen enkele eis naar vraagt. */
    if (!persoonseis.SOORTEN[soort] || persoonseis.SOORTEN[soort].bron !== 'vakbewijs') {
      return res.status(400).json({ error: 'Dit soort stuk kennen we niet.',
        soorten: Object.keys(persoonseis.SOORTEN).filter(s => persoonseis.SOORTEN[s].bron === 'vakbewijs') });
    }
    stuur(res, vakbewijsZet(sleutel, b));
  });

  /* ---- 2. het kantoor: zien en aftekenen ---- */

  /* De stapel. Alleen wat nog niet is gezien; een kantoor dat door afgetekende
     stukken moet bladeren om het openstaande te vinden, tekent uiteindelijk
     alles af om van de lijst af te zijn. */
  app.post('/api/office/vakbewijzen', officeAuth, (req, res) => {
    const open = [];
    for (const v of (kern.db.data.vakbewijzen || [])) {
      if (v.afgetekend || v.ingetrokken) continue;
      open.push(Object.assign({}, v, { wie: codenaamBijSleutel(v.sleutel) }));
    }
    /* De soortenlijst gaat mee: het scherm hoort "een Verklaring Omtrent het
       Gedrag" te tonen en niet "vog". Een tweede lijst in de client zou de
       tweede plek zijn die dezelfde namen vasthoudt (LAT-regel 4). */
    res.json({ ok: true, open, soorten: persoonseis.SOORTEN,
      verlopend: vakbewijzenVerlopend(null, 60).map(v =>
        Object.assign({}, v, { wie: codenaamBijSleutel(v.sleutel) })) });
  });

  /* DE CODENAAM EN NIET DE ECHTE NAAM. Die staat in de kluis, en elke blik erin
     hoort door het inzagejournaal (zie pendingVerifications in
     kern/kantoor/index.js, dat daar precies om die reden een `wie` voor vraagt).
     Voor deze stapel is dat ook niet nodig: wie aftekent bekijkt een STUK, en
     de koppeling tussen dat stuk en de mens is de identiteitsverificatie die al
     eerder is gedaan. Een naam erbij zou de kluis opentrekken voor gemak. */
  function codenaamBijSleutel(sleutel) {
    const m = /^lid:(\d+)$/.exec(String(sleutel || ''));
    if (!m) return null;
    try { return (accounts.getUserById(Number(m[1])) || {}).codename || null; } catch (e) { return null; }
  }

  app.post('/api/office/vakbewijs/teken', officeAuth, (req, res) => {
    const b = req.body || {};
    const door = String(b.door || (req.session && req.session.naam) || '').trim();
    stuur(res, vakbewijsTeken(String(b.sleutel || ''), String(b.wat || ''), door));
  });

  /* Intrekken. Dit is de knop die er nooit was: een afgetekend stuk kon alleen
     verlopen, en een ingetrokken BIG-registratie wacht niet netjes op zijn
     einddatum. */
  app.post('/api/office/vakbewijs/intrek', officeAuth, (req, res) => {
    const b = req.body || {};
    const door = String(b.door || (req.session && req.session.naam) || '').trim();
    const r = vakbewijsIntrek(String(b.sleutel || ''), String(b.wat || ''), door, b.reden);
    if (!r.error && notify) {
      const m = /^lid:(\d+)$/.exec(String(b.sleutel || ''));
      /* De betrokkene hoort het te weten. Dat is niet alleen netjes: het is de
         enige manier waarop iemand kan merken dat er iets misgaat met zijn
         papieren, in plaats van het bij de deur te ontdekken. */
      if (m) { try { kern.sendPushToUser(Number(m[1]), { title: 'Vakbewijs ingetrokken',
        body: 'Uw ' + String(b.wat) + ' telt niet meer mee voor uw werk bij RTG-partners.' }); } catch (e) {} }
    }
    stuur(res, r);
  });

  /* ---- 3. de zaak: staat mijn ploeg erdoor? ---- */

  /* JA of NEE per medewerker, plus wat het genre vraagt. Geen nummers, geen
     data, geen documentsoorten van een ander -- alleen of iemand erdoor komt.
     Wie meer wil weten, vraagt het de mens zelf. */
  app.post('/api/supplier/persoonseis', supplierAuth, (req, res) => {
    const genre = req.supplier.type;
    const eisen = persoonseis.eisenVoorGenre(genre);
    const ploeg = accounts.listStaff(req.supplier.code).map(st => {
      const persoon = st.member_id != null ? { lid: Number(st.member_id), sleutel: sleutelLid(st.member_id) } : null;
      const werk = persoonseis.magWerkenHier(genre, persoon);
      const handelingen = {};
      for (const h of Object.keys(eisen.handelingen || {})) {
        handelingen[h] = persoonseis.magHandeling(genre, h, persoon).ok;
      }
      return { staffId: st.id, naam: st.name, rol: st.role, func: st.func || null,
        mag: werk.ok, reden: werk.ok ? null : werk.error, handelingen };
    });
    res.json({ ok: true, eisen, ploeg });
  });
};
