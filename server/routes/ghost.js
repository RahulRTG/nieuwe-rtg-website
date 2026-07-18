/* Domein "ghost": de Ghost Driver, de vooruitkijkende verkeersleider.
   De zaakkant (eigen voorspelling + vlootadvies) achter de leverancier-inlog;
   het overzicht over alle vervoerszaken achter de kantoor-inlog. */
module.exports = (kern) => {
  const { app, supplierAuth, officeAuth, ghostSimuleer, ghostKantoor } = kern;

  // de eigen zaak: waar loopt het de komende twaalf uur vast, en wat te doen
  app.post('/api/supplier/ghost', supplierAuth, (req, res) => {
    res.json(ghostSimuleer(req.supplier));
  });
  // de verkeersleider: dezelfde blik over alle vervoerszaken heen
  app.post('/api/office/ghost', officeAuth, (req, res) => {
    res.json(ghostKantoor());
  });
};
