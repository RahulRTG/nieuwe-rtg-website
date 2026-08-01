/* WIE MAG DE AI-WEG OP?

   /api/translate is publiek, en dat hoort ook: de taalkiezer staat al op het
   inlogscherm en het woordenboek moet het daar gewoon doen. Maar de AI-tak
   erachter kost geld en stuurt elke ingetypte zin naar een derde partij. Het
   commentaar in server/translate.js zegt het zelf: zonder grens is dit een
   gratis doorgeefluik naar een betaalde aanbieder.

   DE GRENS STOND ER, EN BEWEES NIETS. In de route stond:

       const ingelogd = /^Bearer\s+\S/i.test(req.get('authorization') || '');

   Dat is een vormcontrole op een header, geen authenticatie. Wie
   `Authorization: Bearer x` meestuurde zette de AI-weg aan zonder enig account:
   geen token dat ergens tegen gehouden werd, geen lid, geen rekening. Precies de
   klasse uit LAT.md regel 8 -- een controle op VORM is geen controle.

   EEN ANONIEME GAST IS GEEN INLOG. Een gastsessie is met een enkele aanroep te
   maken (POST /api/login met tier 'guest'), dus die toelaten zou de lat maar een
   verzoek hoger leggen. Dat is dezelfde afweging als bij het Lab-fonds, waar een
   gastsessie ook langs de "log in met je RTG-account"-grens kwam omdat zij nu
   eenmaal een key heeft. Hier telt alleen een echt account, of een demo-pas met
   een echte tier.

   Waarom een eigen bestandje en niet drie regels in de route: zo is de
   BESLISSING te beproeven zonder een server op te starten en zonder een
   AI-sleutel. In de route zat hij vast aan een verzoek, en dat is precies waarom
   er nooit een toets op stond. */
'use strict';

function maakAiPoort({ resolveSession }) {
  if (typeof resolveSession !== 'function')
    throw new Error('aipoort: resolveSession ontbreekt; zonder sessiecontrole is de AI-weg publiek.');

  /* Mag het verzoek achter dit request de AI-tak gebruiken? Geeft false bij elke
     twijfel: een dichte poort kost hooguit een woordenboekvertaling, een open
     poort kost geld en stuurt tekst naar buiten. */
  function magAi(req) {
    let header = '';
    try { header = (req && typeof req.get === 'function' && req.get('authorization')) || ''; }
    catch (e) { return false; }
    if (!header.startsWith('Bearer ')) return false;
    const token = header.slice(7).trim();
    if (!token) return false;
    let sess = null;
    try { sess = resolveSession(token); } catch (e) { return false; }
    if (!sess) return false;                       // geen geldige sessie: dicht
    if (sess.account) return true;                 // een echt account
    return !!(sess.tier && sess.tier !== 'guest'); // demo-pas, maar geen anonieme gast
  }

  return { magAi };
}

module.exports = { maakAiPoort };
