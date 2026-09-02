/* DE DRIE ALLOWLISTS VAN HET AI-STUUR -- de gegevens, niet het besluit.

   Deze stonden in ./beleid.js, tot dat bestand over de tienkilobytegrens van
   keuringsregel 13 groeide. De naad zit hier en nergens anders: hieronder staat
   WELKE paden een niveau hebben, in beleid.js staat WAT dat niveau betekent en
   welke poorten er nog overheen gaan (de bodem, de bewijspoort). Wie een route
   toevoegt raakt dit bestand aan; wie het besluit verandert raakt beleid.js
   aan, en die twee horen niet in dezelfde bewerking thuis.

   De kop van ./beleid.js legt uit waarom het er drie zijn en niet twee; die
   uitleg gaat over het besluit en blijft daar staan. */
'use strict';

/* LEZEN: haalt op en verandert niets. Wie hier iets bij zet dat schrijft,
   verplaatst een bevoegdheid zonder het te merken -- daarom staat de scheiding
   met KLEIN hieronder, en niet in een commentaarregel. */
const LEZEN = Object.freeze({
  member: [
    /^\/api\/kantoorpakket\/(mijn|open|versies|uitslag)$/,
    /^\/api\/onderwijs\/(advies|ladder|mijn)$/,
    /^\/api\/leerstof\/(vakken|les)$/,
    /^\/api\/bijles\/gesprek$/,
    /^\/api\/mediaos\/(wereld|stuk)$/,
    /^\/api\/agenda\/(mijn|mijn-lijst|bereik|ics)$/,
    /^\/api\/locatie\/mijn$/,
    /^\/api\/asset\/(document|mijn)$/,
    /^\/api\/site\/(mijn|haal|versies|spoor|cijfers|sjablonen|sjabloon|fotos)$/,
    /^\/api\/meet\/mijn$/,
    /^\/api\/pay\/(overzicht|saldo|tiks)$/,
    /^\/api\/bank\/(overzicht|rekening|afschrift|rente-voorbeeld|passen|krediet|terugkerend|advies|hart|inzichten|vastelasten)$/,
    /^\/api\/bookings\/mine$/
  ],
  supplier: [
    /^\/api\/supplier\/state$/,
    /^\/api\/supplier\/agenda\/lijst$/,
    /^\/api\/supplier\/rtmail\/(inbox|verzonden|ongelezen)$/,
    /^\/api\/supplier\/site\/(mijn|haal|versies|spoor|cijfers)$/,
    /^\/api\/supplier\/pay\/overzicht$/
  ],
  staff: [
    /^\/api\/staff\/fluister\/profiel$/,
    /^\/api\/staff\/ov\/(dienst|lijnen)$/,
    /^\/api\/staff\/mob\/kaart\/storingen$/
  ]
});

/* KLEIN: verandert iets, maar alleen bij de gebruiker zelf, omkeerbaar en
   zonder dat er iemand anders of geld aan te pas komt. Deze vijf stonden
   hierboven bij het lezen en doen dat aantoonbaar niet. */
const KLEIN = Object.freeze({
  member: [
    /^\/api\/mediaos\/(stuur|volg)$/,   // zet de smaak / het volgen van dit lid
    /^\/api\/leerstof\/(oefen|antwoord)$/, // schrijft de oefenstand van dit lid
    /^\/api\/bijles\/vraag$/           // roept een model aan: omkeerbaar, maar niet gratis
  ],
  supplier: [],
  staff: []
});

const VOORSTEL = Object.freeze({
  member: [
    /^\/api\/kantoorpakket\/(maak|bewaar|deel|weg|ster|terug|fase|vul)$/,
    /^\/api\/onderwijs\/(inschrijf|jaar-over|doel)$/,
    /^\/api\/leerstof\/(examen|examen-antwoord)$/,
    /^\/api\/agenda\/(toevoegen|wijzig|verwijder|bewaar|uitnodig|antwoord)$/,
    /^\/api\/locatie\/(deel|stop)$/,
    /^\/api\/asset\/(koop|herroep|wachtlijst|gebruik|uitstap)$/,
    /^\/api\/site\/(bewaar|verwijder|herstel|publiceer|live|offline|plan|domein|foto|foto-weg)$/,
    /^\/api\/meet\/(maak|kom|verlaat|weg|sein)$/,
    /^\/api\/booking\/(request|pay)$/,
    /^\/api\/reservering\/annuleer$/,
    /^\/api\/pay\/(oplaad|stuur|verzoek|verzoek\/betaal|verzoek\/intrek|tik|kascode)$/,
    /^\/api\/bank\/(akkoord|rekening\/open|bevries|storten|overboek|naar-wallet|van-wallet|sepa|spaardoel|veeg)$/,
    /^\/api\/bank\/pas\/(uitgeven|bevries|limiet|betaal|sluit)$/,
    /^\/api\/bank\/krediet\/(aanvraag|aflossing)$/,
    /^\/api\/bank\/terugkerend\/(zet|stop)$/,
    /^\/api\/bank\/(bulk|salaris)$/
  ],
  supplier: [
    /^\/api\/supplier\/agenda\/(toevoegen|wijzig|verwijder)$/,
    /^\/api\/supplier\/rtmail\/(lees|stuur|inkoop|btw-herinner)$/,
    /^\/api\/supplier\/site\/(team\/zet|genereer|bewaar|publiceer|live|offline|herstel|plan|domein)$/,
    /^\/api\/supplier\/pay\/(in|uitbetaal)$/,
    /^\/api\/supplier\/(room\/hk|door\/zet|ticket\/add)$/,
    /^\/api\/overheid\/(toeslag\/beslis|uitkering\/beslis|bezwaar\/beslis|subsidie\/beslis|water\/melding\/zet|verkiezing\/sluit)$/,
    /^\/api\/gemeente\/(melding\/zet|vergunning\/beslis)$/
  ],
  staff: [
    /^\/api\/staff\/ov\/(pos|checkin|stand|lijn\/zet)$/,
    /^\/api\/staff\/mob\/kaart\/(controle|storing)$/,
    /^\/api\/staff\/mob\/cdt\/(aanmelden|soort|afmelden)$/,
    /^\/api\/supplier\/(room\/hk|door\/zet|ticket\/add)$/
  ]
});

module.exports = { LEZEN, KLEIN, VOORSTEL };
