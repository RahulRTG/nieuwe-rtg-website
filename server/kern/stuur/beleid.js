/* Expliciete bevoegdheden voor het AI-stuur.

   Een route die nieuw aan RTG wordt toegevoegd, komt hier NIET vanzelf bij.
   Dat is de beveiligingsgrens: een nieuw POST-pad is pas AI-bedienbaar nadat
   iemand het doel en de impact heeft beoordeeld en het hieronder bewust als
   `direct` of `voorstel` heeft opgenomen.

   `direct` is uitsluitend lezen of een kleine, omkeerbare handeling zonder
   externe gevolgen. `voorstel` wijzigt gegevens, deelt informatie, boekt,
   publiceert of beweegt geld en vereist daarom een eenmalig servervoorstel dat
   de gebruiker buiten het model bevestigt. Alles wat niet genoemd is blijft
   dicht, ook als de ingelogde gebruiker de onderliggende route zelf wel mag. */

const DIRECT = Object.freeze({
  member: [
    /^\/api\/kantoorpakket\/(mijn|open|versies|uitslag)$/,
    /^\/api\/onderwijs\/(advies|ladder|mijn)$/,
    /^\/api\/leerstof\/(vakken|les|oefen|antwoord)$/,
    /^\/api\/bijles\/(vraag|gesprek)$/,
    /^\/api\/mediaos\/(wereld|stuur|volg|stuk)$/,
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

function raakt(lijst, pad) {
  return Array.isArray(lijst) && lijst.some(re => re.test(pad));
}

function beleidVoor(pad, wereld) {
  const w = String(wereld || '');
  if (!Object.prototype.hasOwnProperty.call(DIRECT, w)) {
    return { niveau: 'verboden', reden: 'Het AI-stuur mist een geldige, servergekozen rol.' };
  }
  if (raakt(DIRECT[w], pad)) return { niveau: 'direct', wereld: w };
  if (raakt(VOORSTEL[w], pad)) return { niveau: 'voorstel', wereld: w };
  return { niveau: 'verboden', wereld: w,
    reden: 'Deze actie staat niet op de expliciete AI-allowlist voor ' + w + '.' };
}

function toegestanePaden(paden, wereld) {
  return (paden || []).filter(p => beleidVoor(p, wereld).niveau !== 'verboden');
}

module.exports = { DIRECT, VOORSTEL, beleidVoor, toegestanePaden };
