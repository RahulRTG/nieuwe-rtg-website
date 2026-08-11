/* Horeca OS (deellaag): de pols van de zaak -- wat wij meten, wat de zaak
   erbij invult, en wat gasten vanaf hun tafel melden.

   Voor de ZAAK zijn dit twee heel verschillende schermen in een: links wat er
   over haar gemeten wordt (en dat kan ze niet bijstellen), rechts wat ze zelf
   kan invullen. Dat onderscheid is de reden dat deze route de drie blokken
   apart teruggeeft en er geen totaalcijfer van maakt.

   WAAROM DE ZAAK HAAR EIGEN WACHTTIJD NIET MAG INVULLEN: dat getal komt uit
   haar eigen keuken (openstaande bereidingsminuten gedeeld door de koks) en
   staat in de kaartlijst van de gast. Wie hem met de hand mag zetten, zet hem
   laag. De verdeling wie-mag-wat-zeggen staat in kern/horeca/pols.js en niet
   hier, zodat de gastkant en de avondplanner er niet omheen kunnen. */
module.exports = (kern) => {
  const { app, supplierAuth, logActivity, polslaag } = kern;

  /* Wat de zaak kan invullen, met de keuzes erbij -- zodat het scherm de lijst
     niet zelf hoeft te kennen (dat zou een tweede waarheid zijn die stilletjes
     uit de pas loopt zodra er een onderwerp bij komt). */
  const invulbaar = () => Object.entries(polslaag.ONDERWERPEN)
    .filter(([, o]) => o.bronnen.includes('zaak'))
    .map(([sleutel, o]) => ({ sleutel, naam: o.naam, standen: o.standen }));

  app.post('/api/supplier/horeca/pols', supplierAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, polslaag.pols(req.supplier.code), {
      invulbaar: invulbaar(),
      versMinuten: polslaag.VERS,
      let: 'Wat je invult vervalt na ' + Math.round(polslaag.VERS.zaak / 60)
        + ' uur. Een sfeer van vanmiddag zegt niets over vanavond, dus tonen we hem dan liever niet meer.'
    }));
  });

  app.post('/api/supplier/horeca/pols/zet', supplierAuth, (req, res) => {
    const r = polslaag.zetZaak(req.supplier.code, (req.body || {}).standen, req.actor && req.actor.naam);
    if (r.gezet.length) logActivity(req.supplier.code, req.actor,
      'zette de pols: ' + r.gezet.map(g => g.onderwerp + ' = ' + (g.stand || 'leeg')).join(', '));
    res.json(r);
  });
};
