/* Domein "supplier" (deelmodule): De Salon (marketing van de zaak). Draait op de
   gedeelde kern. Publiceren kan pas met een compleet Salon-profiel en met de
   Salon-marketing aan in de eigen boardroom. */
module.exports = (kern) => {
  const { salonProfielCompleet, zaakFunctieAan } = kern;

// De Salon is verplicht: publiceren (post/folder/deal/poll) kan pas met een
// compleet profiel (bio + foto). De bio/foto-endpoints zelf blijven altijd open.
// Bovendien kan de zaak zijn Salon-marketing in zijn eigen boardroom uitzetten.
function eisSalonProfiel(req, res) {
  if (!zaakFunctieAan(req.supplier, 'salon')) { res.status(409).json({ error: 'Salon-marketing staat uit in uw boardroom. Zet het aan om te publiceren.' }); return false; }
  if (salonProfielCompleet(req.supplier)) return true;
  res.status(409).json({ error: 'Vul eerst uw Salon-profiel in (een bio en een profielfoto). De Salon is de plek voor uw marketing, producten en folders.' });
  return false;
}
/* De publicatie- en profiellaag draaien als submodules op de gedeelde
   kern; eisSalonProfiel gaat als tweede argument mee. */
require('./salon/publiceren')(kern, eisSalonProfiel);
require('./salon/profiel')(kern, eisSalonProfiel);
};
