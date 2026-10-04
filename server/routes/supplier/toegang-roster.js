/* De oude namenlijst van de viercijferige PIN-fixture. Hij bestaat uitsluitend
   in Magnaat Test en is in iedere echte omgeving hard gesloten vóór opzoeking.

   Wat er wel aan moest. Hij had geen enkele rem en gaf publicStaff volledig
   terug: naam, rol, functie en of het personeelslid ook RTG-lid is. Met
   /api/suppliers als lijst van alle bedrijfscodes was daarmee het complete
   personeelsbestand van elke zaak in een paar minuten uit te lezen. Nu: een
   tempolimiet per IP, en alleen de velden die de kiezer echt toont. Wie het
   bedrijf niet kent, krijgt dezelfde 404 als voorheen.

   Buiten die geïsoleerde omgeving is er dus geen publiek personeelsregister. */
module.exports = ({ app, accounts, findSupplier }) => {
/* Een eigen, ruime teller. Bewust NIET tooManyTries/noteFailedTry: die tellen
   MISLUKTE inlogpogingen en slaan bij tien alarm ("mogelijk brute force"). Een
   inlogscherm dat de lijst ophaalt is geen mislukte poging, en van vals alarm
   wordt niemand veiliger. Dertig zaken per kwartier is ruim voor iemand die van
   bedrijf wisselt en te weinig om alle partners leeg te trekken. */
const rosterTeller = new Map();
function rosterMag(ip) {
  const nu = Date.now(), r = rosterTeller.get(ip);
  if (!r || nu > r.tot) { rosterTeller.set(ip, { n: 1, tot: nu + 15 * 60000 }); return true; }
  if (rosterTeller.size > 5000) rosterTeller.clear();  // geheugenplafond
  return ++r.n <= 30;
}
app.post('/api/supplier/roster', (req, res) => {
  if (!accounts.legacyStaffPinToegestaan || !accounts.legacyStaffPinToegestaan())
    return res.status(403).json({ error: 'De openbare personeelskiezer bestaat alleen in Magnaat Test. Log in met uw persoonlijke RTG-account.' });
  if (!rosterMag(req.ip)) return res.status(429).json({ error: 'Te veel opvragingen. Probeer het over een kwartier opnieuw.' });
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Deze leverancierscode kennen we niet.' });
  res.json({
    supplier: { code: s.code, name: s.name, type: s.type },
    staff: accounts.listStaff(s.code).map(accounts.publicStaff).map(m => ({ id: m.id, name: m.name, role: m.role, func: m.func }))
  });
});
};
