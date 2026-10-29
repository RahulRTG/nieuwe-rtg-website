/* Supplier-submodule "netwerk": Partner Network, de netwerkkant van een zaak.
   Een leesroute die alleen tellingen met een bron teruggeeft
   (kern/partnernetwerk.js); schrijven gaat langs de routes van de Mall, de
   conciërge-lus en de samenwerkingen. De zaakcode komt uit de sessie. */
module.exports = (kern) => {
  const { app, supplierAuth, db } = kern;
  const maak = require('../../kern/partnernetwerk');
  // per verzoek: de domeinen hangen pas na het opbouwen van de kern aan `kern`
  const ticketsVanZaak = code => require('../../kern/leverancier/zaak').ticketsVanZaak(db, code);
  const netwerk = () => maak({ ticketsVanZaak, mall: kern.mall, bureauZaak: kern.bureauZaak, samenwerking: kern.samenwerking });
  app.post('/api/supplier/netwerk/overzicht', supplierAuth, (req, res) => {
    try { res.json(netwerk().overzicht(req.supplier, req.routeBeleid)); }
    catch (e) { console.error('[netwerk]', e); res.status(500).json({ error: 'Het netwerkoverzicht kon niet worden opgebouwd. Probeer het opnieuw.' }); }
  });
};
