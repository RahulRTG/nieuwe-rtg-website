/* De applicatie bepaalt deze vertrouwensvelden zelf. Een model mag nooit
   veinzen dat inhoud lokaal bleef of dat een menselijke goedkeuring is gegeven. */
'use strict';

function kompasStatus({ hybride, heeftLokaal, lokaleGrens, beschikbaar }) {
  const route = hybride ? 'hybride' : heeftLokaal ? lokaleGrens : beschikbaar ? 'extern' : 'regels';
  const privacy = hybride ? 'Lokale start; externe uitwijk kan inhoud verwerken'
    : heeftLokaal && lokaleGrens === 'rtg-server' ? 'Inhoud blijft op de eigen modelserver van RTG'
    : heeftLokaal ? 'Inhoud blijft binnen de eigen omgeving'
    : beschikbaar ? 'Inhoud wordt door een externe modelprovider verwerkt'
    : 'Geen inhoud naar een model';
  return {
    naam: 'RTG Kompas', route, privacy,
    ritme: ['nu', 'straks', 'let-op'],
    uitleg: 'bron-en-grens-zichtbaar',
    autoriteit: 'mens',
    menselijkAkkoord: ['geld', 'publicatie', 'toegang', 'definitieve-toezegging']
  };
}

module.exports = { kompasStatus };
