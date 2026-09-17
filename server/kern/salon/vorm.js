/* De gedeelde grammatica van een Saloon-moment. De bronapps bewaren hun eigen
   objecten; deze lijst zorgt alleen dat een Salon-post overal dezelfde soort
   en dezelfde publiekskeuze draagt. */
'use strict';

const SOORTEN = Object.freeze([
  'moment', 'story', 'place', 'plan', 'event', 'travel', 'food',
  'activity', 'question', 'offer', 'live'
]);
const PUBLIEKEN = Object.freeze(['salon', 'iedereen', 'volgers', 'vrienden', 'contacten', 'alleenik']);

const soort = waarde => SOORTEN.includes(String(waarde || '')) ? String(waarde) : 'moment';
const publiek = waarde => PUBLIEKEN.includes(String(waarde || '')) ? String(waarde) : 'salon';

module.exports = { SOORTEN, PUBLIEKEN, soort, publiek };
