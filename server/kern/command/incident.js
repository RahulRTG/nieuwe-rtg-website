/* HET INCIDENT ALS OBJECT -- een storing die een identiteit heeft, en daarmee
   iets waar je naar kunt verwijzen, aan kunt werken en van kunt leren.

   ZONDER DIT IS EEN STORING EEN ALARM PLUS EEN JOURNAALREGEL. Die twee
   verdwijnen allebei in een lijst: het alarm zwijgt weer zodra de drempel
   terugloopt, en de journaalregel staat tussen tienduizend andere. Wat er dan
   ontbreekt is precies wat een mens nodig heeft: waar begon het, wat is
   eraan gedaan, wat was de uitkomst, en wat weten we nog steeds niet.

   DIT IS GEEN TWEEDE UITZONDERINGENRIJ. ./zaken.js gaat over EEN GEVAL dat de
   machine niet zelf kon afhandelen, met een eigenaar, een termijn en een
   besluit. Een incident gaat over een VERMOGEN dat het niet doet. Andere
   gegevens, andere werkstroom, andere levensduur -- en dat is precies de
   toetsvraag uit PLATFORM.md: een zelfstandige capability of een tweede ingang
   naar dezelfde. Hier is het de eerste.

   DE MACHINE MAG OPENEN, EEN MENS MOET SLUITEN. `weeg()` opent een incident
   zodra een vermogen op storing komt -- een storing die niemand vastlegt, is een
   storing waar niemand van leert. Sluiten doet hij niet: dan zou er een incident
   in de historie staan zonder conclusie. Herstelt de bron zich, dan wordt het
   incident `hersteld` gemarkeerd en wacht het op een verslag.

   EN SLUITEN KAN NIET TERWIJL HET NOG STUK IS. Een incident dat gesloten wordt
   terwijl zijn vermogen nog op storing staat, is een leugen in de historie --
   en het is de makkelijkste leugen om te vertellen, want het scherm wordt er
   rustiger van. Het kan wel met `toch`, met een reden, en dan staat dat zo in
   het verslag.

   De impact en de aanleidingen staan in ./incident-impact.js, met de reden dat
   ze daar apart staan. */
'use strict';

const klok = require('../../lib/klok');

const { impactVan, aanleidingen } = require('./incident-impact');
const { NIVEAUS } = require('../frictie');

const OPEN = 'open', BEZIG = 'in behandeling', HERSTELD = 'hersteld', DICHT = 'gesloten';

function maakIncidenten({ opslag, save, journaal, gezondheid }) {
  const nu = () => klok.datum().toISOString();

  function rij() {
    return opslag.bak('commandIncidenten');
  }
  /* Een oplopend nummer en geen willekeurige sleutel: hier wordt naar verwezen
     in een gesprek, in een ticket en in een verslag. */
  function nummer() {
    return 'RTG-' + String(opslag.teller('commandIncidentTeller', 1)).padStart(4, '0');
  }
  const vind = (id) => rij().find(i => i.id === String(id)) || null;
  const levend = (i) => i.status !== DICHT;

  function kaart() {
    try { const st = gezondheid.stand(); return st && st.vermogens ? st.vermogens : null; }
    catch (e) { return null; }
  }
  const vermogenUit = (vs, id) => (vs || []).find(v => v.id === id) || null;

  /* Het afsluiten en het teruglezen staan in ./incident-verslag.js: dat is een
     andere handeling dan de levensloop beheren, en dit bestand ging er door zijn
     omvangsgrens van. */
  const teruglezen = require('./incident-verslag').maakVerslag({
    rij, vind, save, journaal, kaart, vermogenUit, levend });
  const { kort, sluit, dossier, lijst, tel } = teruglezen;

  /* ---------- openen ---------- */
  function maak(v, vs, bron, door, reden) {
    const at = nu();
    const inc = { id: nummer(), at, status: OPEN, bron, door: String(door || 'de gezondheidskaart'),
      vermogen: v.id, naam: v.naam, wat: v.taal ? v.taal.mens : v.naam + ' heeft een storing',
      reden: String(reden || ''), eigenaar: null,
      begonnen: at, hersteldAt: null, geslotenAt: null,
      /* De momentopname bij het ONTSTAAN blijft staan. Wie later kijkt, ziet
         anders alleen de toestand van nu -- en dat is precies de toestand
         waarin het probleem er niet meer is. */
      bijAanvang: { impact: impactVan(v), aanleidingen: aanleidingen(v, vs) },
      maatregelen: [], verslag: null };
    rij().push(inc);
    if (save) save();
    journaal.noteer({ actor: inc.door, actie: 'incident geopend', objectType: 'incident', objectId: inc.id,
      niveau: bron === 'hand' ? 'hand' : 'auto',
      reden: inc.wat, na: { vermogen: v.id, aanleidingen: inc.bijAanvang.aanleidingen.lijst.length } });
    return inc;
  }

  /* De machine kijkt of er iets is bijgekomen of hersteld. Op VERANDERING en
     niet elke ronde: een tweede incident voor dezelfde storing leert niemand
     iets, en een melding die blijft terugkomen leert mensen wegklikken. */
  function weeg(door) {
    const vs = kaart();
    if (!vs) return { error: 'De gezondheidskaart is niet te lezen; er valt niets te wegen.', status: 503 };
    const nieuw = [], hersteld = [];
    for (const v of vs) {
      const lopend = rij().find(i => i.vermogen === v.id && levend(i));
      if (v.oordeel === 'storing') {
        if (!lopend) nieuw.push(maak(v, vs, 'gezondheid', door, 'de gezondheidskaart zag een storing'));
        else if (lopend.status === HERSTELD) { lopend.status = OPEN; lopend.hersteldAt = null; }
      } else if (lopend && lopend.status !== HERSTELD) {
        lopend.status = HERSTELD; lopend.hersteldAt = nu();
        hersteld.push(lopend.id);
        journaal.noteer({ actor: 'de gezondheidskaart', actie: 'incident hersteld', objectType: 'incident',
          objectId: lopend.id, niveau: NIVEAUS.auto,
          reden: 'de bron meldt geen storing meer; dit incident wacht op een verslag' });
      }
    }
    if (save) save();
    return { nieuw: nieuw.map(i => i.id), hersteld,
      let: 'De machine opent en markeert; sluiten doet een mens, met een verslag. Een incident dat ' +
        'zichzelf sluit, laat een storing achter zonder conclusie.' };
  }

  function opdeHand(vermogen, door, wat, reden) {
    const vs = kaart();
    const v = vermogenUit(vs, String(vermogen));
    if (!v) return { error: 'Dat vermogen kennen we niet.', status: 404 };
    const lopend = rij().find(i => i.vermogen === v.id && levend(i));
    if (lopend) return { error: 'Voor dit vermogen loopt al incident ' + lopend.id + '.', status: 409, incident: kort(lopend) };
    const inc = maak(v, vs, 'hand', door, reden);
    if (wat) { inc.wat = String(wat).slice(0, 300); if (save) save(); }
    return { incident: kort(inc) };
  }

  /* ---------- eraan werken ---------- */
  function neem(id, wie) {
    const i = vind(id);
    if (!i) return { error: 'Dat incident bestaat niet.', status: 404 };
    if (i.status === DICHT) return { error: 'Dat incident is gesloten.', status: 409 };
    i.eigenaar = String(wie); if (i.status === OPEN) i.status = BEZIG;
    if (save) save();
    journaal.noteer({ actor: String(wie), actie: 'incident overnemen', objectType: 'incident', objectId: i.id,
      niveau: NIVEAUS.hand, reden: 'eigenaar' });
    return { incident: kort(i) };
  }

  /* Een maatregel VERWIJST naar iets dat is gebeurd (een herstelronde, een
     controleronde) in plaats van het na te vertellen. Een verslag dat zijn eigen
     versie van de feiten opschrijft, loopt uit de pas met de ronde waar het over
     gaat. */
  function maatregel(id, m) {
    const i = vind(id);
    if (!i) return { error: 'Dat incident bestaat niet.', status: 404 };
    if (i.status === DICHT) return { error: 'Dat incident is gesloten.', status: 409 };
    const r = { at: nu(), door: String((m && m.door) || 'onbekend'), wat: String((m && m.wat) || '').slice(0, 300),
      soort: String((m && m.soort) || 'notitie'), verwijzing: (m && m.verwijzing) ? String(m.verwijzing) : null };
    if (!r.wat) return { error: 'Een maatregel zonder omschrijving zegt niets.', status: 400 };
    i.maatregelen.push(r);
    if (save) save();
    journaal.noteer({ actor: r.door, actie: 'incident maatregel', objectType: 'incident', objectId: i.id,
      niveau: NIVEAUS.hand, reden: r.wat, na: { soort: r.soort, verwijzing: r.verwijzing } });
    return { incident: kort(i) };
  }

  return { weeg, opdeHand, neem, maatregel, sluit, lijst, dossier, tel, OPEN, BEZIG, HERSTELD, DICHT };
}

module.exports = { maakIncidenten, OPEN, BEZIG, HERSTELD, DICHT };
