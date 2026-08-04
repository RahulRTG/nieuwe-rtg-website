/* Horeca OS (deellaag): verplaatsen, samenvoegen en splitsen -- de drie
   handelingen waaraan je een horecasysteem herkent, en de drie waar geld
   verdwijnt als ze slordig zijn.

   Alle drie lopen ze langs dezelfde controle: `controleerSom()` uit
   kern/horeca.js vergelijkt de netto waarde vóór en ná de handeling, tot op de
   cent. Klopt het niet, dan gebeurt er niets. Dat is geen extra veiligheid
   maar de kern van de zaak: splitsen en samenvoegen zijn VERPLAATSINGEN, geen
   berekeningen -- er hoort geen cent bij te komen en geen cent af te gaan.

   Het splitsen kan op twee manieren, en ze zijn allebei nodig:
   - PER PRODUCT: je wijst regels toe aan delen ("die twee biertjes zijn van
     hem"). De regels verhuizen; er wordt niets herrekend.
   - PER PERSOON: het bedrag wordt in gelijke delen geknipt. Dan komt de
     centenkwestie: 10,00 door drie is 3,33 + 3,33 + 3,33 = 9,99. De rest gaat
     naar de EERSTE delen, en de som is daarmee weer exact het geheel. Dat is
     de klassieke fout in kassasystemen, en hij staat hier in een toets. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { H, nu, id, totaal, openstaand, controleerSom, waarde, kortingCenten } = horeca;
  const rekVan = kern.horecaRekVan;
  const publiek = kern.horecaPubliek;

  const openCheck = (r, res) => {
    if (r.status !== 'open') { res.status(409).json({ error: 'Deze rekening is al ' + r.status + '.' }); return false; }
    if ((r.betalingen || []).length) { res.status(409).json({ error: 'Er is al (deels) betaald op deze rekening; schuiven kan dan niet meer.' }); return false; }
    return true;
  };

  /* ---------- verplaatsen ---------- */
  app.post('/api/supplier/horeca/rekening/verplaats', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (!openCheck(r, res)) return;
    const h = H(req.supplier.code);
    const naar = schoon(req.body.naarTafel, 30);
    if (!naar) return res.status(400).json({ error: 'Naar welke tafel?' });
    const bezet = Object.values(h.rekeningen).find(x => x.status === 'open' && x.id !== r.id && x.kanaal === 'tafel' && x.tafel === naar);
    if (bezet) return res.status(409).json({ error: 'Op ' + naar + ' staat al een open rekening. Voeg ze samen als de gasten zijn geschoven.', rekeningId: bezet.id });
    const van = r.tafel;
    r.tafel = naar; r.kanaal = 'tafel';
    r.verplaatsingen = (r.verplaatsingen || []).concat([{ van, naar, at: nu(), door: req.actor.name }]).slice(-20);
    save();
    logActivity(req.supplier.code, req.actor, 'verplaatste de rekening van ' + (van || '-') + ' naar ' + naar);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, rekening: publiek(r) });
  });

  /* ---------- samenvoegen ---------- */
  app.post('/api/supplier/horeca/rekening/voeg-samen', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (!openCheck(r, res)) return;
    const h = H(req.supplier.code);
    const ander = Object.prototype.hasOwnProperty.call(h.rekeningen, String(req.body.metId || ''))
      ? h.rekeningen[String(req.body.metId)] : null;
    if (!ander) return res.status(404).json({ error: 'Die tweede rekening kennen we niet.' });
    if (ander.id === r.id) return res.status(400).json({ error: 'Een rekening samenvoegen met zichzelf doet niets.' });
    if (!openCheck(ander, res)) return;

    const voor = [Object.assign({}, r), Object.assign({}, ander)];
    const samen = { regels: r.regels.concat(ander.regels), kortingen: (r.kortingen || []).concat(ander.kortingen || []) };
    /* Percentagekortingen tellen op een grotere bon anders uit, dus die worden
       op het moment van samenvoegen vastgezet als bedrag. Anders krijgt de ene
       tafel er korting bij omdat de andere tafel duur at. */
    const vastgezet = [];
    for (const bron of voor) for (const k of (bron.kortingen || []))
      vastgezet.push({ id: id(3), reden: k.reden || 'korting', centen: k.procent
        ? Math.round((bron.regels || []).reduce((t, x) => t + x.centen * x.aantal, 0) * k.procent / 100)
        : k.centen, at: k.at || nu(), vastgezetBij: 'samenvoegen' });
    samen.kortingen = vastgezet;

    if (!controleerSom(voor, [samen]))
      return res.status(500).json({ error: 'De som klopt niet na samenvoegen; er is niets gewijzigd.' });

    r.regels = samen.regels; r.kortingen = samen.kortingen;
    r.gasten = Math.min(500, (r.gasten || 1) + (ander.gasten || 1));
    r.samengevoegdUit = (r.samengevoegdUit || []).concat([{ id: ander.id, tafel: ander.tafel, at: nu() }]);
    ander.status = 'samengevoegd'; ander.regels = []; ander.kortingen = [];
    ander.samengevoegdIn = r.id; ander.geslotenAt = nu();
    save();
    logActivity(req.supplier.code, req.actor, 'voegde ' + (ander.tafel || ander.id) + ' samen met ' + (r.tafel || r.id));
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, rekening: publiek(r), somKlopt: true });
  });

  /* ---------- splitsen ---------- */
  app.post('/api/supplier/horeca/rekening/splits', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    if (!openCheck(r, res)) return;
    const h = H(req.supplier.code);
    const perPersoon = Math.max(0, Math.min(50, parseInt(req.body.perPersoon, 10) || 0));
    const delen = Array.isArray(req.body.delen) ? req.body.delen : null;
    if (!perPersoon && !delen) return res.status(400).json({ error: 'Splits per persoon (perPersoon: 3) of per product (delen: [[regelId, ...], ...]).' });

    const voor = [Object.assign({}, r)];
    const nieuw = [];

    if (delen) {
      // per product: elke regel hoort bij precies een deel
      const alle = r.regels.map(x => x.id);
      const gezien = [];
      for (const deel of delen) for (const rid of (Array.isArray(deel) ? deel : [])) gezien.push(String(rid));
      const missend = alle.filter(x => !gezien.includes(x));
      const dubbel = gezien.filter((x, i) => gezien.indexOf(x) !== i);
      const onbekend = gezien.filter(x => !alle.includes(x));
      if (dubbel.length) return res.status(400).json({ error: 'Een regel staat in twee delen: ' + dubbel[0] });
      if (onbekend.length) return res.status(400).json({ error: 'Onbekende regel: ' + onbekend[0] });
      if (missend.length) return res.status(400).json({ error: 'Deze regels zitten in geen enkel deel: ' + missend.join(', ') + '. Splitsen laat niets achter.' });
      const kort = kortingCenten(r);
      const brutoTot = r.regels.reduce((t, x) => t + x.centen * x.aantal, 0);
      let restKorting = kort;
      delen.forEach((deel, i) => {
        const regels = r.regels.filter(x => deel.map(String).includes(x.id));
        const bruto = regels.reduce((t, x) => t + x.centen * x.aantal, 0);
        // de korting evenredig mee, de laatste krijgt de rest (anders valt er een cent weg)
        const deelKorting = i === delen.length - 1 ? restKorting : (brutoTot ? Math.round(kort * bruto / brutoTot) : 0);
        restKorting -= deelKorting;
        nieuw.push({ regels, kortingen: deelKorting ? [{ id: id(3), reden: 'aandeel korting', centen: deelKorting, at: nu() }] : [] });
      });
    } else {
      // per persoon: gelijke delen, de rest-centen naar de eerste delen
      const w = waarde(r);
      const basis = Math.floor(w / perPersoon);
      const rest = w - basis * perPersoon;
      for (let i = 0; i < perPersoon; i++) {
        const deelBedrag = basis + (i < rest ? 1 : 0);
        nieuw.push({ regels: [{ id: id(3), naam: 'Deel ' + (i + 1) + ' van ' + perPersoon + (r.tafel ? ' (' + r.tafel + ')' : ''),
          aantal: 1, centen: deelBedrag, lijstprijs: deelBedrag, groep: null, gang: 0, station: null,
          notitie: null, allergie: null, gastNr: i + 1, stand: 'uitgegeven', at: nu(), door: req.actor.name }], kortingen: [] });
      }
    }

    if (!controleerSom(voor, nieuw))
      return res.status(500).json({ error: 'De som klopt niet na splitsen; er is niets gewijzigd.' });

    const gemaakt = nieuw.map((deel, i) => {
      const n = { id: id(5), kanaal: r.kanaal, tafel: r.tafel, naam: (r.naam || 'Rekening') + ' · deel ' + (i + 1),
        gasten: 1, status: 'open', regels: deel.regels, kortingen: deel.kortingen, betalingen: [], fooiCenten: 0,
        gastId: null, kamer: r.kamer || null, gesplitstUit: r.id, geopendAt: nu(), door: req.actor.name, at: nu() };
      h.rekeningen[n.id] = n;
      return n;
    });
    r.status = 'gesplitst'; r.regels = []; r.kortingen = []; r.geslotenAt = nu();
    r.gesplitstIn = gemaakt.map(x => x.id);
    save();
    logActivity(req.supplier.code, req.actor, 'splitste de rekening van ' + (r.tafel || r.id) + ' in ' + gemaakt.length + ' delen');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, somKlopt: true, delen: gemaakt.map(x => ({ id: x.id, naam: x.naam, totalen: totaal(x), openstaand: openstaand(x) })) });
  });
};
