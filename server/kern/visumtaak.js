/* De visumtaak: wie een vlucht boekt of een reis aanvraagt naar een land dat
   VOORAF een visum of reistoestemming vraagt, krijgt daarvoor een afvinkbare
   taak in zijn persoonlijke agenda -- ruim voor vertrek, met de regels van de
   Reiswijzer erbij.

   De twee kanten bestonden al jaren naast elkaar: de Reiswijzer (kern/reis.js)
   weet per land of er iets aangevraagd moet worden, en de persoonlijke agenda
   (kern/agenda.js) draagt taken met een ballon op de voorkant. Alleen het
   MOMENT waarop die kennis ertoe doet -- de boeking zelf -- verbond ze niet:
   de reiswijzer ging als leestekst mee in het boekingsantwoord en verdween
   daarna. Een visum dat je te laat aanvraagt is een reis die niet doorgaat.

   Alleen de soorten die je vooraf regelt ('toestemming', 'evisum', 'visum')
   geven een taak; visumvrij en visum-bij-aankomst niet. De taakdatum is
   dertig dagen voor vertrek (of vandaag, als dat dichterbij is of de
   vertrekdatum nog niet vaststaat). EEN taak, geen aftelling: de agenda toont
   hem tot hij is afgevinkt, en dat is genoeg.

   De domeinen (luchthaven, reisbureau) roepen dit aan via een laat gebonden,
   optionele haak (visumtaakVan) -- hetzelfde patroon als kern/mediaos/wekken.js
   -- dus ze weten niets van deze laag en werken zonder haar gewoon door. Bij
   een annulering gaat de taak weer weg, op de bron-sleutel 'reis:<ref>' die
   het agenda-item zelf draagt: geen tweede lijst die kan verouderen. */
const { agendaLidSleutel } = require('./agenda');

function maakVisumtaak({ agenda, reiswijzer }) {
  const VOORAF = { toestemming: 'Reistoestemming', evisum: 'E-visum', visum: 'Visum' };
  const bron = ref => ('reis:' + String(ref || '')).slice(0, 60);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function taakDatum(vertrek) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(vertrek || ''))) return vandaag();
    const d = new Date(vertrek + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 30);
    const ds = d.toISOString().slice(0, 10);
    return ds > vandaag() ? ds : vandaag();
  }

  /* Bij een boeking of aanvraag: maakt de taak als de bestemming erom vraagt.
     Idempotent op de bron: een tweede boeking op dezelfde ref (een herhaalde
     aanroep) zet geen tweede taak. Geeft { taak } terug zodat het antwoord
     van de boeking kan zeggen wat er is klaargezet. */
  function bijBoeking(key, { ref, bestemming, vertrek }) {
    if (!key || !ref) return { taak: null };
    const w = reiswijzer(bestemming);
    if (!w || w.error || !w.visum || !VOORAF[w.visum.soort]) return { taak: null };
    const eigenaar = agendaLidSleutel(key);
    const b = bron(ref);
    if (agenda.lijst(eigenaar).some(i => i.bron === b)) return { taak: null };
    const r = agenda.voegToe(eigenaar, {
      titel: VOORAF[w.visum.soort] + ' aanvragen voor ' + w.naam,
      datum: taakDatum(vertrek),
      notitie: w.visum.tekst + (vertrek ? ' Vertrek: ' + vertrek + '.' : ' De vertrekdatum staat nog niet vast; vraag hem op tijd aan.'),
      bron: b
    });
    return { taak: r.ok ? r.item : null };
  }

  /* Bij een annulering: alle taken met deze bron gaan weg, ook een taak die
     al was afgevinkt (een visum voor een reis die niet doorgaat is klaar
     noch nodig). */
  function bijAnnulering(key, ref) {
    if (!key || !ref) return { weg: 0 };
    const eigenaar = agendaLidSleutel(key);
    const b = bron(ref);
    let weg = 0;
    for (const i of agenda.lijst(eigenaar)) if (i.bron === b) { agenda.verwijder(eigenaar, i.id); weg++; }
    return { weg };
  }

  return { visumtaak: { bijBoeking, bijAnnulering } };
}

module.exports = { maakVisumtaak };
