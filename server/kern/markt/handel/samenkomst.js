/* Markt-handel: SAMEN ZIJN bij de overhandiging, zonder de punten te bewaren
   (NAVIGATIE.md N21).

   WAAROM. De deal bewaarde de GPS van koper en verkoper (`koperGps`,
   `verkoperGps`) onbeperkt op de chat, terwijl het enige dat de deal ervan
   nodig heeft de UITKOMST is: waren ze samen, en hoe ver uit elkaar. Twee punten
   van twee mensen op hetzelfde moment, voor altijd aan een gesprek, is precies
   een bewegingsspoor.

   DE REGEL. Er bestaat hooguit EEN punt, en dat is van wie het eerst "ik ben
   hier" zegt. Het blijft alleen staan tot de ander komt, en nooit langer dan
   het venster waarin een punt vers heet (SAMEN_VERS_MS). Komt de ander en is hij
   dichtbij, dan vervangt de uitkomst (samen + afstand in meters) BEIDE punten.
   Is hij te ver, dan wordt ZIJN punt niet bewaard (alleen de afstand) en blijft
   het wachtende punt tot zijn venster sluit -- zodat wie nog aan komt lopen het
   gewoon opnieuw kan proberen. Van wie deelde blijft alleen het TIJDSTIP
   (`gedeeld`), zodat het scherm "jij bent er" kan zeggen zonder een plek. */
'use strict';

/* Een wachtend punt dat buiten zijn venster valt, verdwijnt; en een deal van
   voor N21 raakt zijn twee punten hier kwijt. Geeft true als er iets wegging. */
function vervalWacht(deal, nuMs, versMs) {
  if (!deal) return false;
  let weg = false;
  for (const oud of ['koperGps', 'verkoperGps']) if (oud in deal) { delete deal[oud]; weg = true; }
  if (deal.wacht && !(nuMs - deal.wacht.at < versMs)) { delete deal.wacht; weg = true; }
  return weg;
}

/* Het punt van `rol` komt binnen. Geeft de afstand in hele meters als er een
   ander punt was om mee te vergelijken, anders null, plus of ze nu samen zijn. */
function samenMeld(deal, rol, lat, lng, { nuMs, versMs, samenMeter, haversine }) {
  vervalWacht(deal, nuMs, versMs);
  deal.gedeeld = Object.assign({}, deal.gedeeld, { [rol]: nuMs });
  const w = deal.wacht;
  if (!w || w.rol === rol) {
    deal.wacht = { rol, lat, lng, at: nuMs };      // het eerste punt: wacht op de ander
    return { afstand: null, samen: false };
  }
  const m = haversine ? haversine({ lat: w.lat, lng: w.lng }, { lat, lng }) : null;
  const afstand = m == null ? null : Math.round(m);
  const samen = m != null && m <= samenMeter;
  if (samen) delete deal.wacht;                    // de uitkomst vervangt beide punten
  return { afstand, samen };
}

/* Heeft `rol` nu nog een geldige deling? Uit het tijdstip, nooit uit een punt. */
function gedeeldVers(deal, rol, nuMs, versMs) {
  if (deal && deal.samen) return true;
  const t = deal && deal.gedeeld && deal.gedeeld[rol];
  return !!t && nuMs - t < versMs;
}

/* Verlopen wachtende punten van ALLE gesprekken: er is geen veger voor de
   markt, dus elke nieuwe melding ruimt ze mee op. */
function vervalAlle(chats, nuMs, versMs) {
  for (const c of Object.values(chats || {})) vervalWacht(c && c.deal, nuMs, versMs);
}

module.exports = { vervalWacht, vervalAlle, samenMeld, gedeeldVers };
