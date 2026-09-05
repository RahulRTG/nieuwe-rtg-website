/* DE POORT VAN DE TENANTROUTES -- wie mag er bij de eigen organisatie.

   Het beheer-token OF een lid met het recht `werkruimte`. Er wordt geen derde
   manier bedacht om "mag deze aanroeper hier bij" te beantwoorden: allebei de
   takken vragen het aan bedrijf/index.js, net als de rest van de tenantlaag.
   Dat is precies de fout waar LAT-regel 4 over gaat, en bij een contractgrens
   zou hij de duurste zijn.

   WAAROM DE TWEEDE SLEUTEL ERBIJ KWAM. De tenantstand stond alleen achter het
   beheer-token, en dat typt niemand in het Werk OS in -- dat scherm draait op een
   lid-token. De stand bestond dus en was onbereikbaar vanaf de enige plek waar
   hij hoort te staan; een pagina die niemand kan openen is hetzelfde als een
   pagina die er niet is. In het rollenregister draagt alleen `directie` het
   recht `werkruimte`, en dat is per definitie wie deze werkruimte beheert.

   Hij staat in een eigen bestand sinds routes/tenant/bijstand.js hem óók nodig
   heeft. Twee kopieën van een poort lopen uiteen, en dan staat de ene deur op
   een dag wijder open dan de andere. */
'use strict';

module.exports = ({ bedrijf }) => function viaBeheerOfDirectie(req, res) {
  const productie = String(process.env.NODE_ENV || '') === 'production';
  /* EEN LEGE BODY IS EEN VRAAG EN GEEN STORING. Zonder deze regel loopt een
     aanroep met body `null` door naar bedrijf.lidVan(), en die leest
     `req.body.lidToken` -- een 500 met een stacktrace waar een 400 hoort te
     staan. Gevonden door een scherm dat zonder sessie laadde en netjes "er ging
     iets mis" te zien kreeg terwijl er niets mis was: er was alleen niets
     meegestuurd. */
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({ error: 'Stuur uw werkruimte mee, met het beheer-token of een lid-token.' });
    return null;
  }
  if (!productie && req.body.beheerToken) return bedrijf.beheerVan(req, res);
  const s = bedrijf.lidVan(req, res); if (!s) return null;
  const rechten = bedrijf.rechtenVan ? bedrijf.rechtenVan(s.l) : [];
  if (!rechten.includes('werkruimte')) {
    res.status(403).json({ error: 'Daar heeft u het recht "werkruimte" voor nodig, of het beheer-token.',
      recht: 'werkruimte' });
    return null;
  }
  return s.w;
};
