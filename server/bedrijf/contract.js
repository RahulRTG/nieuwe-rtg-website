/* RTG Werk OS (deellaag): de contractbibliotheek.

   Contracten gaan bijna nooit mis op de inhoud. Ze gaan mis op de DATUM: een
   opzegtermijn die twee weken geleden verstreek, een verzekering die stil
   afliep, een verwerkersovereenkomst die niemand meer kon vinden toen de
   toezichthouder ernaar vroeg. Deze module is daarom vooral een klok.

   1. EEN CONTRACT MET STILZWIJGENDE VERLENGING KENT ZIJN LAATSTE OPZEGDAG, en
      die wordt UITGEREKEND uit de einddatum en de opzegtermijn -- niet met de
      hand ingevuld. Een datum die iemand overtypt, is een datum die een keer
      fout staat.
   2. HET SIGNAAL KOMT VOOR DE DEADLINE, NIET ERNA. De lijst toont wat er
      binnen de opzegtermijn valt, met het aantal dagen erbij.
   3. TEKENEN IS EEN HANDELING MET TWEE NAMEN. Een contract zonder
      wederpartij-ondertekenaar staat als concept; er is geen knop die het
      stilletjes op "actief" zet.
   4. WAT VERLOPEN IS, BLIJFT STAAN. Een aflopend contract wordt niet
      opgeruimd: bij een geschil is juist de oude tekst het bewijs. */
'use strict';

/* Elke toestandswijziging loopt via DE ENE DEUR van de gebeurtenislaag
   (./gebeurtenis.js): het veld wordt gezet EN de gebeurtenis vastgelegd, met
   actor, bron en waar nodig een reden. Buitenom schrijven merkt het vangnet
   alsnog op, maar dan zonder tijdstip -- en op deze vier families geldt dat als
   een defect. Zie de kop van ./gebeurtenis-lezen.js. */
const { werkVeld } = require('./gebeurtenis');

const SOORTEN = ['klant', 'leverancier', 'arbeid', 'huur', 'licentie', 'verwerkers',
  'geheimhouding', 'verzekering', 'vergunning', 'overig'];

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;
  const C = (w) => { if (!w.contracten) w.contracten = {}; return w.contracten; };
  /* De klok staat in ./contractklok.js, gedeeld met het Ondernemers-OS: die
     heeft dezelfde berekening nodig en zou hem anders overtypen. */
  const KLOK = require('./contractklok');
  const klok = (c) => KLOK.klok(c, dag());

  app.post('/api/bedrijf/contract/zet', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const titel = schoon(req.body.titel, 120);
    const wederpartij = schoon(req.body.wederpartij, 80);
    if (!titel || !wederpartij) return res.status(400).json({ error: 'Een contract heeft een titel en een wederpartij.' });
    const soort = String(req.body.soort || 'overig');
    if (!SOORTEN.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' });
    const id = schoon(req.body.contractId, 20) || rid(5);
    const c = eigenVeld(C(g.w), id) || { id, status: 'concept', handtekeningen: [], at: nu() };
    const oudeWaarde = Number(c.waardeCenten || 0);
    c.titel = titel; c.wederpartij = wederpartij; c.soort = soort;
    c.klantId = schoon(req.body.klantId, 20) || c.klantId || null;
    c.begint = schoon(req.body.begint, 10) || c.begint || dag();
    c.eindigt = schoon(req.body.eindigt, 10) || c.eindigt || null;
    c.opzegtermijnDagen = req.body.opzegtermijnDagen != null
      ? Math.max(0, Math.min(730, parseInt(req.body.opzegtermijnDagen, 10) || 0)) : (c.opzegtermijnDagen || 0);
    c.stilzwijgend = req.body.stilzwijgend === true;
    c.waardeCenten = req.body.waarde != null ? Math.round(Math.max(0, Number(req.body.waarde) || 0) * 100) : (c.waardeCenten || 0);
    c.verplichtingen = Array.isArray(req.body.verplichtingen)
      ? req.body.verplichtingen.slice(0, 30).map(v => schoon(v, 200)).filter(Boolean) : (c.verplichtingen || []);
    c.vindplaats = schoon(req.body.vindplaats, 200) || c.vindplaats || null;
    /* Land en afdeling staan OP HET CONTRACT en worden nergens afgeleid. Een
       bedrijfsregel mag erop drempelen, en dan moet de waarde onbetwistbaar bij
       dit contract horen -- afleiden uit de klant zou betekenen dat een contract
       zonder klant stilzwijgend buiten elke landregel valt. Leeg = niet
       ingevuld, en een regel die op dat veld drempelt, geldt dan NIET; dat staat
       zo in regels.js en in het antwoord van /keuring. */
    c.land = (schoon(req.body.land, 2) || c.land || '').toUpperCase() || null;
    c.afdeling = schoon(req.body.afdeling, 40) || c.afdeling || null;
    C(g.w)[c.id] = c;
    /* Het bedrag ophogen is de makkelijkste weg om een bedrijfsregel te
       omzeilen: teken een contract van een euro en maak er daarna vijf miljoen
       van. Daarom wordt bij ELKE wijziging herwogen -- een goedkeuring geldt
       voor het bedrag waarop hij is gegeven. */
    const s = sctx.regelHerwaardeer(g.w, c, oudeWaarde);
    save();
    res.json({ ok: true, contract: Object.assign({}, c, klok(c)), soorten: SOORTEN,
      ontbreekt: s.ontbreekt,
      let: c.status === 'wacht op goedkeuring' && oudeWaarde && c.waardeCenten > oudeWaarde
        ? 'De waarde ging omhoog. Goedkeuringen die op het oude bedrag zijn gegeven, zijn vervallen: er is ja gezegd tegen een andere afspraak. Nodig: ' + s.ontbreekt.join(' en ') + '.'
        : null });
  });

  /* Tekenen: twee namen, en pas dan is het actief. Er is geen route die de
     status zonder handtekeningen op actief zet. */
  app.post('/api/bedrijf/contract/teken', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const c = eigenVeld(C(g.w), String(req.body.contractId || ''));
    if (!c) return res.status(404).json({ error: 'Dat contract kennen we niet.' });
    const naam = schoon(req.body.naam, 80);
    const partij = String(req.body.partij || '');
    if (!naam) return res.status(400).json({ error: 'Wie tekent er?' });
    if (!['wij', 'wederpartij'].includes(partij)) return res.status(400).json({ error: 'Namens wie: wij of wederpartij?' });
    if (c.handtekeningen.some(h => h.partij === partij))
      return res.status(409).json({ error: 'Namens ' + partij + ' is er al getekend, door ' + c.handtekeningen.find(h => h.partij === partij).naam + '.' });
    c.handtekeningen.push({ partij, naam, op: schoon(req.body.op, 10) || dag(), genoteerdDoor: g.l.naam, at: nu() });
    /* De status wordt hier niet meer zelf gezet. ./regels.js is de ENIGE plek
       die dat doet, want er is een tweede voorwaarde bij gekomen (de
       goedkeuringen die een bedrijfsregel eist) en twee plekken die bepalen
       wanneer een contract actief is, lopen uiteen (LAT-regel 4). Late binding
       via sctx: regels.js wordt na dit bestand gemount. */
    const s = sctx.regelHerzie(g.w, c);
    log(g.w, g.l, 'contract-getekend', c.id, partij + ': ' + naam);
    save();
    res.json({ ok: true, contract: Object.assign({}, c, klok(c)), ontbreekt: s.ontbreekt,
      let: s.mag ? null
        : !s.handtekeningenCompleet
          ? 'Nog niet actief: er ontbreekt een handtekening. Een contract dat maar door een partij is getekend, is een aanbod.'
          : 'Getekend, maar nog niet actief: een bedrijfsregel eist goedkeuring namens ' + s.ontbreekt.join(' en ') + '.' });
  });

  app.post('/api/bedrijf/contract/opzeggen', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const c = eigenVeld(C(g.w), String(req.body.contractId || ''));
    if (!c) return res.status(404).json({ error: 'Dat contract kennen we niet.' });
    const reden = schoon(req.body.reden, 300);
    if (!reden) return res.status(400).json({ error: 'Noteer waarom dit contract wordt opgezegd.' });
    const k = klok(c);
    const gm = werkVeld(g.w, 'contract', c, { status: 'opgezegd' }, { actor: g.l.naam, reden, bron: 'werk/contract' });
    if (!gm.ok) return res.status(gm.status).json(gm);
    c.opgezegd = { reden, door: g.l.naam, op: dag(), tijdig: k.dagenTotOpzegdag == null ? null : k.dagenTotOpzegdag >= 0 };
    log(g.w, g.l, 'contract-opgezegd', c.id, reden);
    save();
    res.json({ ok: true, contract: Object.assign({}, c, klok(c)),
      let: c.opgezegd.tijdig === false
        ? 'LET OP: de laatste opzegdag was ' + k.laatsteOpzegdag + ', dat is ' + Math.abs(k.dagenTotOpzegdag) + ' dag(en) geleden. Deze opzegging is waarschijnlijk te laat; dat staat zo genoteerd in plaats van weggepoetst.'
        : null });
  });

  app.post('/api/bedrijf/contracten', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const rijen = Object.values(C(g.w))
      .filter(c => !req.body.soort || c.soort === String(req.body.soort))
      .map(c => Object.assign({ id: c.id, titel: c.titel, wederpartij: c.wederpartij, soort: c.soort,
        status: c.status, eindigt: c.eindigt, waardeCenten: c.waardeCenten }, klok(c)))
      .sort((a, b) => (a.dagenTotOpzegdag == null ? 99999 : a.dagenTotOpzegdag) - (b.dagenTotOpzegdag == null ? 99999 : b.dagenTotOpzegdag));
    res.json({ ok: true, aantal: rijen.length, contracten: rijen,
      binnenkortOpzeggen: rijen.filter(c => c.dagenTotOpzegdag != null && c.dagenTotOpzegdag >= 0 && c.dagenTotOpzegdag <= 30),
      opzegdagVoorbij: rijen.filter(c => c.status === 'actief' && c.dagenTotOpzegdag != null && c.dagenTotOpzegdag < 0 && c.dagenTotEinde >= 0),
      zonderEinddatum: rijen.filter(c => !c.eindigt).length,
      let: 'Wat verlopen is blijft staan: bij een geschil is juist de oude tekst het bewijs.' });
  });

  sctx.startBron('contracten', 'recht', (g) => {
    const rijen = Object.values(C(g.w)).map(c => klok(c));
    return { binnenkortOpzeggen: rijen.filter(c => c.dagenTotOpzegdag != null && c.dagenTotOpzegdag >= 0 && c.dagenTotOpzegdag <= 30).length,
      opzegdagVoorbij: rijen.filter(c => c.dagenTotOpzegdag != null && c.dagenTotOpzegdag < 0 && c.dagenTotEinde >= 0).length };
  });

  return { CONTRACTSOORTEN: SOORTEN, CONTRACTEN: C, contractKlok: klok };
};
