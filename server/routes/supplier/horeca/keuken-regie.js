/* Horeca OS (deellaag): het regiescherm van de chef en de drukterem. Hoort bij
   horeca/keuken.js (het stationsbord), dat de bordweergave en de
   bereidingstijden via de context meegeeft.

   Twee getallen dragen dit scherm, en allebei zijn ze een feit met een
   rekensom erachter:

   - STAAT-KOUD: hoeveel minuten het eerste bord van een tafel al klaar staat
     terwijl de rest nog loopt. Dat is het echte werk van een expediteur, en
     het is iets anders dan "hoeveel bonnen staan er open".
   - VERWACHTE WACHTTIJD: alle openstaande bereidingsminuten gedeeld door het
     aantal koks. Dat is een WAARSCHUWING en geen automatische blokkade -- een
     systeem dat zelf de bestellingen dichtzet, sluit op de drukste avond van
     het jaar de omzet af. Het besluit hoort bij de chef, met het getal erbij. */
module.exports = (kern) => {
  const { app, save, supplierAuth, horeca } = kern;
  const { H } = horeca;
  const bord = kern.horecaBord;
  const { openWerk } = require('../../../kern/horeca/keukenlaag');
  const minutenSinds = (at) => at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0;

  /* ---------- het regiescherm van de chef ----------
     Per tafel en gang: is alles klaar, wat is de laatste, en hoe lang staat de
     eerste al te wachten. Dat laatste getal is het echte werk van een
     expediteur -- niet hoeveel bonnen er zijn. */
  app.post('/api/supplier/horeca/keuken/regie', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const groepen = new Map();
    for (const rek of Object.values(h.rekeningen)) {
      if (rek.status !== 'open') continue;
      for (const regel of (rek.regels || [])) {
        if (!regel.vrijAt || regel.stand === 'uitgegeven') continue;
        const sleutel = rek.id + '|' + regel.gang;
        if (!groepen.has(sleutel)) groepen.set(sleutel, { rekeningId: rek.id, tafel: rek.tafel, kanaal: rek.kanaal,
          gang: regel.gang, serveerOm: regel.serveerOm || null, regels: [] });
        groepen.get(sleutel).regels.push(bord(h, rek, regel));
      }
    }
    const rijen = [...groepen.values()].map(g => {
      const klaar = g.regels.filter(r => r.stand === 'klaar');
      const wacht = klaar.length && klaar.length < g.regels.length
        ? Math.max(...klaar.map(r => minutenSinds((h.rekeningen[g.rekeningId].regels.find(x => x.id === r.regelId) || {}).klaarAt)))
        : 0;
      const langzaamste = g.regels.slice().sort((a, b) => (b.norm - b.loopt) - (a.norm - a.loopt))[0];
      return Object.assign(g, {
        gereed: g.regels.every(r => r.stand === 'klaar'),
        klaar: klaar.length, totaal: g.regels.length,
        staatKoud: wacht, // hoe lang het eerste bord al klaar staat terwijl de rest nog loopt
        laatste: langzaamste ? { naam: langzaamste.naam, station: langzaamste.station, over: langzaamste.over } : null,
        allergieen: g.regels.map(r => r.allergie).filter(Boolean)
      });
    }).sort((a, b) => b.staatKoud - a.staatKoud || String(a.serveerOm || '~').localeCompare(String(b.serveerOm || '~')));
    res.json({ ok: true, aantal: rijen.length, tafels: rijen.slice(0, 100),
      gereed: rijen.filter(r => r.gereed).length,
      let: 'Staat-koud is het aantal minuten dat het eerste bord van een tafel al klaar staat terwijl de rest nog loopt.' });
  });

  /* ---------- de drukterem ----------
     Hoeveel werk staat er nu open, uitgedrukt in bereidingsminuten per station,
     en past dat binnen wat er in de keuken staat? Dit is een WAARSCHUWING met
     zijn eigen rekensom erbij, geen automatische blokkade: een systeem dat
     zelf de bestellingen dichtzet, sluit op de drukste avond van het jaar de
     omzet af. */
  app.post('/api/supplier/horeca/keuken/druk', supplierAuth, (req, res) => {
    const w = openWerk(H(req.supplier.code), req.body.kokken);
    res.json({ ok: true, kokken: w.kokken, openMinuten: w.openMinuten, perStation: w.perStation,
      verwachteWachttijd: w.wachttijd,
      /* De rekensom als zin, zodat het scherm hem niet zelf hoeft samen te
         stellen. Dat deed het wel, en dan staan er twee formuleringen van
         dezelfde som in het huis die uiteen gaan lopen (LAT-regel 4). */
      rekensom: w.rekensom,
      waarschuwing: w.wachttijd > 25
        ? 'De keuken staat op ' + w.wachttijd + ' minuten wachttijd. ' + w.rekensom
          + ' Overweeg de bezorging of de online bestellingen tijdelijk te pauzeren.'
        : null,
      let: 'Dit is een advies met de rekensom erbij. Het systeem zet zelf niets dicht -- dat besluit hoort bij de chef.' });
  });

  // bereidingstijden per gerecht instellen (die maken het signaal pas scherp)
  app.post('/api/supplier/horeca/keuken/tijden', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const tijden = req.body.tijden && typeof req.body.tijden === 'object' ? req.body.tijden : {};
    h.instel.bereidingstijden = h.instel.bereidingstijden || {};
    let n = 0;
    for (const [naam, min] of Object.entries(tijden).slice(0, 500)) {
      const m = Math.max(1, Math.min(180, parseInt(min, 10) || 0));
      if (!m) continue;
      h.instel.bereidingstijden[String(naam).toLowerCase().slice(0, 80)] = m;
      n++;
    }
    if (req.body.kokken != null) h.instel.kokken = Math.max(1, Math.min(60, parseInt(req.body.kokken, 10) || 3));
    save();
    res.json({ ok: true, gezet: n, kokken: h.instel.kokken || null });
  });
};
