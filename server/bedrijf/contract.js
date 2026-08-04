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

const SOORTEN = ['klant', 'leverancier', 'arbeid', 'huur', 'licentie', 'verwerkers',
  'geheimhouding', 'verzekering', 'vergunning', 'overig'];

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;
  const C = (w) => { if (!w.contracten) w.contracten = {}; return w.contracten; };
  const dagenTot = (d) => Math.round((Date.parse(d) - Date.parse(dag())) / 86400000);
  const minDagen = (d, n) => new Date(Date.parse(d) - n * 86400000).toISOString().slice(0, 10);

  /* De klok van een contract, altijd uitgerekend en nooit overgetypt. */
  function klok(c) {
    if (!c.eindigt) return { stand: 'zonder einddatum', let: 'Een contract zonder einddatum loopt door tot iemand er iets van vindt.' };
    const laatsteOpzegdag = c.opzegtermijnDagen ? minDagen(c.eindigt, c.opzegtermijnDagen) : c.eindigt;
    const dagenEinde = dagenTot(c.eindigt);
    const dagenOpzeg = dagenTot(laatsteOpzegdag);
    return {
      laatsteOpzegdag, dagenTotEinde: dagenEinde, dagenTotOpzegdag: dagenOpzeg,
      stand: dagenEinde < 0 ? 'verlopen'
        : (dagenOpzeg < 0 && c.stilzwijgend ? 'stilzwijgend verlengd (opzegdag voorbij)'
          : (dagenOpzeg <= 30 ? 'opzegtermijn loopt af' : 'loopt')),
      let: c.stilzwijgend
        ? 'Deze verlengt stilzwijgend. De laatste opzegdag is uitgerekend uit de einddatum en de opzegtermijn; hij staat nergens overgetypt.'
        : null
    };
  }

  app.post('/api/bedrijf/contract/zet', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const titel = schoon(req.body.titel, 120);
    const wederpartij = schoon(req.body.wederpartij, 80);
    if (!titel || !wederpartij) return res.status(400).json({ error: 'Een contract heeft een titel en een wederpartij.' });
    const soort = String(req.body.soort || 'overig');
    if (!SOORTEN.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' });
    const id = schoon(req.body.contractId, 20) || rid(5);
    const c = eigenVeld(C(g.w), id) || { id, status: 'concept', handtekeningen: [], at: nu() };
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
    C(g.w)[c.id] = c;
    save();
    res.json({ ok: true, contract: Object.assign({}, c, klok(c)), soorten: SOORTEN });
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
    const beide = ['wij', 'wederpartij'].every(p => c.handtekeningen.some(h => h.partij === p));
    if (beide) { c.status = 'actief'; c.actiefAt = nu(); }
    log(g.w, g.l, 'contract-getekend', c.id, partij + ': ' + naam);
    save();
    res.json({ ok: true, contract: Object.assign({}, c, klok(c)),
      let: beide ? null : 'Nog niet actief: er ontbreekt een handtekening. Een contract dat maar door een partij is getekend, is een aanbod.' });
  });

  app.post('/api/bedrijf/contract/opzeggen', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const c = eigenVeld(C(g.w), String(req.body.contractId || ''));
    if (!c) return res.status(404).json({ error: 'Dat contract kennen we niet.' });
    const reden = schoon(req.body.reden, 300);
    if (!reden) return res.status(400).json({ error: 'Noteer waarom dit contract wordt opgezegd.' });
    const k = klok(c);
    c.status = 'opgezegd';
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
