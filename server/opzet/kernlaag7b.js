/* DE KERN SAMENSTELLEN -- deel 7b van 7.

   Hier hangen de ROUTERS aan de kern, en staat wat daarna nog moet gebeuren.
   Afgesplitst van ./kernlaag7.js toen die over de 10 KB ging, en de knip loopt
   langs een echte grens: hierboven wordt de kern GEVULD, hier wordt hij
   GEBRUIKT.

   DIE VOLGORDE IS GEDRAG, geen smaak. Een router pakt zijn kern uit elkaar op
   het moment dat hij wordt opgehangen (const { app, rtfos } = kern). Wat er
   daarna nog bij komt, ziet hij nooit meer. Dat is vandaag twee keer misgegaan:
   het Foundation OS en het Mobility OS stonden er wel als bestand maar werden
   pas na dit punt gebouwd, en dan hangt elke ingang aan een undefined -- zonder
   dat de server iets meldt. Wie hier een Object.assign(kern, ...) bij wil
   zetten: die hoort in kernlaag7.js, boven deze regel. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, archief, crypto, db, findSupplier, onboarding, haversine, keyVanCodenaam, klokVan, leeftijdVan, logActivity, notify, openVacatures, notifySupplier, path, rememberSession, save, schoon, sseToCustomer, sseToOffice, supplierState, zetRtgai } = hulp;

const gekozenDomeinen = require('./routes')(kern);
/* De meelezer van de RTG AI wordt hierboven in de bedrading gebouwd, maar de
   middleware die hem voedt staat bovenaan dit bestand en sluit over deze
   variabele. Hij wordt daarom HIER gezet en niet in opzet/routes.js: een
   toewijzing aan een binding uit een ander bestand is geen bedrading meer maar
   een verborgen draad terug. Per verzoek uitgelezen, dus dit moment is vroeg
   genoeg. */
zetRtgai(kern.rtgai || null);

/* Archiveren gebeurt bij het opstarten en daarna elk uur. In vloot-modus doet
   alleen het office-domein dit, zodat niet twee processen tegelijk aan de
   orders-collectie trekken. */
if (gekozenDomeinen.includes('office')) {
  try { archief.archiveerNu(); } catch (e) { console.warn('[archief] ronde mislukt:', e.message); }
  const archiefTimer = setInterval(() => {
    try { archief.archiveerNu(); } catch (e) { console.warn('[archief] ronde mislukt:', e.message); }
  }, 3600000);
  if (archiefTimer.unref) archiefTimer.unref();
}


};

