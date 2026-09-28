/* DE KLOON PER ZAAK (devices.zaakdoos_sleutel, besluit B12).

   Een Zaakdoos draait de schermen van EEN zaak door als de lijn wegvalt. Vroeger
   kreeg hij daarvoor de hele db.data van alle zaken en alle leden (sessies,
   live-locaties, identiteitsverzoeken), achter een sleutel die elke doos deelde.

   Nu is de kloon een POSITIEVE LIJST (de vorm van AI-CONTEXT-01): per collectie
   staat hier uitgeschreven wat mee mag en waarom, en per rij geldt de zaak van
   de SLEUTEL. Nooit "alles behalve het gevoelige": een collectie die er morgen
   bij komt, blijft buiten de kloon tot iemand haar hier bewust bijzet. Van de
   zaak zelf gaan alleen de velden in ZAAK_VELDEN mee.

   Drie vormen:
     zaak     het eigen zaakrecord uit `suppliers`, alleen de velden in ZAAK_VELDEN
     rijen    een lijst; alleen rijen met supplierCode === de zaak van de sleutel
     perZaak  een kaart op zaakcode; alleen de sleutel van deze zaak
     geheel   gedeelde naslag zonder zaak- of persoonsgegevens

   De doos past de kloon toe in ./synchronisatie.js en neemt daar ook alleen de
   collecties uit deze lijst over -- twee kanten van dezelfde lijst. */
'use strict';

const FORMAAT = 'rtg-zaakdoos-kloon-v1';

/* Wat de zaakstaat (kern/leverancier/state.js) van de zaak zelf leest, plus
   partnerStatus (een gesloten werkplek blijft ook op de doos dicht). Niet:
   salon, rondleiding, geseed en elk veld dat hier niet staat. */
const ZAAK_VELDEN = Object.freeze(['code', 'name', 'type', 'city', 'country', 'loc', 'rate', 'vak', 'partnerStatus',
  'settings', 'online', 'menu', 'overschot', 'lijn', 'tables', 'rooms', 'doors', 'services', 'activiteiten',
  'transfer', 'autos', 'boten', 'panden', 'fleet', 'voorraad', 'minibar', 'photos', 'bezorg', 'events', 'dailyMeps']);

const KLOON = Object.freeze({
  suppliers: { vorm: 'zaak', waarom: 'de zaak zelf: menu, tafels, kamers en instellingen, zodat de schermen lokaal doordraaien' },
  supplierTypes: { vorm: 'geheel', waarom: 'het genreregister (label, caps); naslag zonder zaak- of persoonsgegevens, en de zaakstaat leest het' },
  orders: { vorm: 'rijen', waarom: 'de lopende bestellingen van deze zaak: de keuken en de bar werken ermee door' },
  reserveringen: { vorm: 'rijen', waarom: 'de tafelreserveringen van deze zaak voor de bediening' },
  boekingen: { vorm: 'rijen', waarom: 'de boekingen van deze zaak (kamers, diensten) voor de balie' },
  posSales: { vorm: 'perZaak', waarom: 'de kassadag van deze zaak: de kassa telt lokaal door' },
  tickets: { vorm: 'perZaak', waarom: 'de open serviceverzoeken van deze zaak' },
  lostfound: { vorm: 'perZaak', waarom: 'gevonden voorwerpen van deze zaak' },
  minibarCounts: { vorm: 'perZaak', waarom: 'de minibartellingen van deze zaak (hotel)' },
  supplierNotifications: { vorm: 'perZaak', waarom: 'de meldingen aan deze zaak, zodat het belletje lokaal klopt' }
});

const kopie = x => JSON.parse(JSON.stringify(x));

function zaakRecord(s) {
  const uit = {};
  for (const v of ZAAK_VELDEN) if (Object.prototype.hasOwnProperty.call(s, v) && s[v] !== undefined) uit[v] = s[v];
  return uit;
}

/* De kloon van een zaak uit `data` (db.data). `zaak` komt uit de SLEUTEL en nooit
   uit het verzoek. Geen zaakrecord is geen lege kloon maar een weigering. */
function kloonVoorZaak(data, zaak) {
  const z = String(zaak || '');
  const s = (Array.isArray(data.suppliers) ? data.suppliers : []).find(x => x && x.code === z);
  if (!z || !s) return null;
  const uit = {};
  for (const [naam, regel] of Object.entries(KLOON)) {
    const bron = data[naam];
    if (regel.vorm === 'zaak') uit[naam] = [zaakRecord(s)];
    else if (regel.vorm === 'geheel') uit[naam] = bron == null ? {} : bron;
    else if (regel.vorm === 'rijen') uit[naam] = (Array.isArray(bron) ? bron : []).filter(r => r && r.supplierCode === z);
    else if (regel.vorm === 'perZaak') uit[naam] = bron && typeof bron === 'object' && Object.prototype.hasOwnProperty.call(bron, z)
      ? { [z]: bron[z] } : {};
  }
  return { formaat: FORMAAT, zaak: z, data: kopie(uit) };
}

/* De doos-kant: wat de doos uit een antwoord overneemt. Alleen een kloon in dit
   formaat, alleen de collecties uit KLOON, en de rest van de doos blijft van de
   doos. Geeft het aantal overgenomen collecties terug, of null bij een ander antwoord. */
function pasToe(db, antwoord) {
  if (!antwoord || antwoord.formaat !== FORMAAT || !antwoord.data || typeof antwoord.data !== 'object') return null;
  let n = 0;
  for (const naam of Object.keys(KLOON)) {
    if (!Object.prototype.hasOwnProperty.call(antwoord.data, naam)) continue;
    db.data[naam] = antwoord.data[naam];
    n++;
  }
  return n;
}

module.exports = { FORMAAT, ZAAK_VELDEN, KLOON, kloonVoorZaak, pasToe };
