/* Domein "supplier" (deelmodule): paspoort/identiteit. Draait op de gedeelde kern.
   Een partner vraagt de identiteit achter een codenaam op; inzage is tijdgebonden
   en (behalve bevestiging) alleen met toestemming of na een gemeld incident. */
module.exports = (kern) => {
  const { app, supplierAuth, keyVanCodenaam, logActivity, PASPOORT_NIVEAUS,
    paspoortVraag, paspoortBekijk, paspoortIncident, paspoortPartner } = kern;

/* ================= PASPOORT / IDENTITEIT (kern/paspoort.js) =================
   Een partner vraagt de identiteit achter een codenaam op. 'bevestiging' (ja/nee)
   komt direct terug; 'idkaart'/'paspoort' vereisen toestemming van het lid. Bij
   een incident kan de partner het opeisen; RTG-kantoor beoordeelt dat. */
async function keyVanReq(req) {
  // een partner verwijst met de codenaam (die hij op het codescherm ziet)
  if (req.body.codenaam) { const hit = await keyVanCodenaam(String(req.body.codenaam)); return hit ? { key: hit.key, codenaam: hit.codename } : null; }
  /* DE INTERNE SLEUTEL MAG HIER NIET MEER BINNENKOMEN.

     Hier stond `if (req.body.key) return { key: String(req.body.key) }`, en dat
     sprak het commentaar erboven tegen: een partner verwijst met de CODENAAM,
     die hij op het codescherm van het lid ziet. Een codenaam krijg je van het
     lid zelf; een sleutel is 'user-<volgnummer>', en die kun je gewoon aflopen.

     Daarmee was het hele ledenbestand op nummer af te struinen: user-1, user-2,
     user-3. Niveau 'bevestiging' komt zonder toestemming terug, dus van elk lid
     was zo de leeftijdsbevestiging op te vragen -- door elke partner, over leden
     die nooit bij hem binnen zijn geweest.

     Geen enkel scherm en geen enkele toets stuurde ooit `key`; alleen de deur
     stond open. Dus dicht. Wie een lid bedoelt, noemt zijn codenaam. */
  return null;
}
// een identiteit opvragen (niveau: bevestiging | idkaart | paspoort)
app.post('/api/supplier/paspoort/vraag', supplierAuth, async (req, res) => {
  const t = await keyVanReq(req);
  if (!t) return res.status(404).json({ error: 'Codenaam onbekend.' });
  const r = paspoortVraag(req.supplier, t.key, String(req.body.niveau || 'bevestiging'),
    req.actor, { minLeeftijd: req.body.minLeeftijd, reden: req.body.reden, codenaam: t.codenaam });
  if (r.error) return res.status(r.status).json({ error: r.error });
  if (r.verzoek) logActivity(req.supplier.code, req.actor, 'vroeg een ' + r.niveau + '-inzage aan (' + (t.codenaam || t.key) + ')');
  res.json(r);
});
// een goedgekeurde (of bij incident vrijgegeven) inzage openen; tijdgebonden
app.post('/api/supplier/paspoort/bekijk', supplierAuth, (req, res) => {
  const r = paspoortBekijk(req.supplier, String(req.body.id || ''), req.actor);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'opende een identiteitsinzage (' + (r.verzoek.codenaam || '') + ')');
  res.json(r);
});
// bij een incident de identiteit opeisen (RTG-kantoor beoordeelt het)
app.post('/api/supplier/paspoort/incident', supplierAuth, async (req, res) => {
  const t = await keyVanReq(req);
  if (!t) return res.status(404).json({ error: 'Codenaam onbekend.' });
  const r = paspoortIncident(req.supplier, t.key, req.body.reden, req.body.niveau, req.actor);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'meldde een incident en eiste identiteit op (' + (t.codenaam || t.key) + ')');
  res.json(r);
});
// het overzicht van eigen verzoeken en incidenten
app.post('/api/supplier/paspoort/overzicht', supplierAuth, (req, res) => {
  res.json({ ...paspoortPartner(req.supplier.code), niveaus: PASPOORT_NIVEAUS });
});
};
