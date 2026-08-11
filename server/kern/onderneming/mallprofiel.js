/* HET MALL-PROFIEL: wat een lid bij DEZE zaak kan doen.

   De Mall toont elke partner al, gegroepeerd per genre (kern/mall/etalage.js).
   Wat daar niet stond is de vraag die een ondernemer stelt: hoe hoort MIJN
   pagina eruit te zien, en wat mist er nog. Een restaurant heeft een kaart,
   reserveren, bezorgen en openingstijden; een kapper heeft behandelingen, een
   agenda en vrije tijdvakken; een aannemer heeft een portfolio en een
   offerteaanvraag. Dat is geen opmaak maar architectuur: de branche bepaalt
   welke onderdelen er zijn.

   MAAR NIET VIA EEN LIJST PER BRANCHE. Zo'n lijst zou de eenendertigste keer
   worden dat dit huis een genre-tabel bijhoudt, en de eerste die vergeten wordt
   bij genre tweeëndertig. De onderdelen hangen daarom aan CAPS, en die komen
   uit kern/werkvormen.js -- dezelfde afleiding die de gereedschapskisten en de
   eerste-klant-lijst al gebruiken. Een zaak die er een busje bij zet, krijgt
   het ritblok vanzelf.

   DIT BESLIST NIETS OVER ZICHTBAARHEID. Of een zaak in de Mall STAAT, bepalen
   de ondernemerpoort en de salonregel (`salonZichtbaar`), en die blijven de
   enige waarheid daarover. Deze module beschrijft alleen de opbouw van de
   pagina en zegt per onderdeel of de zaak er de gegevens voor heeft. Zou hij
   ook over zichtbaarheid gaan, dan waren er twee antwoorden op dezelfde vraag.

   EN HIJ VERZINT GEEN PAGINA'S. Waar een genre in de app geboekt wordt, staat
   al in kern/mall (GENRE_PAGINA); dat wordt hier geïmporteerd en niet
   overgetypt. */
'use strict';

const { MALL_GENRE_PAGINA } = require('../mall');

/* De onderdelen, elk met de cap die hem oproept en de plek waar zijn gegevens
   staan. `gevuld` is een functie op de zaak, zodat er nergens een tweede
   opslag bijkomt: alles wordt gelezen uit wat de zaak al heeft. */
const ONDERDELEN = [
  { id: 'kaart', cap: 'menu', label: 'De kaart',
    wat: 'Leden zien wat u serveert en wat het kost.',
    gevuld: s => (s.menu || []).length > 0, waaruit: 'menu' },

  { id: 'bestellen', cap: 'orders', label: 'Bestellen en afhalen',
    wat: 'Leden bestellen vooruit en halen op.',
    gevuld: s => !(s.settings && s.settings.ordersOpen === false), waaruit: 'instelling' },

  { id: 'reserveren', cap: 'reservations', label: 'Een tafel reserveren',
    wat: 'Leden reserveren zelf, u ziet het in uw boek.',
    gevuld: s => !(s.settings && s.settings.reservationsOpen === false), waaruit: 'instelling' },

  { id: 'bezorgen', cap: 'bezorgen', label: 'Bezorgen',
    wat: 'Leden laten het thuisbezorgen.',
    gevuld: s => !!(s.bezorg && s.bezorg.aan), waaruit: 'bezorg' },

  { id: 'kamers', cap: 'bookings', label: 'Kamers en beschikbaarheid',
    wat: 'Leden zien vrije nachten en boeken direct.',
    gevuld: s => (s.rooms || []).length > 0, waaruit: 'rooms' },

  { id: 'diensten', cap: 'services', label: 'Uw diensten',
    wat: 'Leden zien wat u doet, wat het kost en hoe lang het duurt.',
    gevuld: s => (s.services || []).length > 0, waaruit: 'services' },

  { id: 'afspraak', cap: 'agenda', label: 'Zelf een afspraak inplannen',
    wat: 'Leden kiezen een vrij tijdvak uit uw agenda.',
    gevuld: s => !!(s.openingstijden || s.werkdagen || (s.services || []).some(x => x && x.duurMin > 0)),
    waaruit: 'agenda' },

  { id: 'catalogus', cap: 'retail', label: 'Uw collectie',
    wat: 'Leden bladeren, leggen in de tas en rekenen af.',
    gevuld: s => (s.collecties || []).length > 0, waaruit: 'collecties' },

  { id: 'programma', cap: 'tickets', label: 'Uw programma',
    wat: 'Leden kopen entree of een ticket.',
    gevuld: s => (s.activiteiten || []).length > 0, waaruit: 'activiteiten' },

  { id: 'ritten', cap: 'rides', label: 'Een rit boeken',
    wat: 'Leden bestellen een rit bij u.',
    gevuld: s => (s.fleet || []).length > 0, waaruit: 'fleet' },

  /* Deze drie horen bij ELKE zaak, ongeacht wat zij doet: waar zit u, hoe ziet
     het eruit, en wat vinden anderen. Ze hangen daarom niet aan een cap. */
  { id: 'vindplaats', label: 'Waar u zit',
    wat: 'Leden zoeken op plaats; zonder plaats staat u nergens tussen.',
    gevuld: s => !!(s.city || s.loc), waaruit: 'plaats' },

  { id: 'beeld', label: 'Beeld van uw zaak',
    wat: 'Wat een lid ziet voordat hij iets kiest.',
    gevuld: s => !!((s.photos || []).length || (s.salon && s.salon.foto)), waaruit: 'fotos' },

  { id: 'verhaal', label: 'Uw verhaal',
    wat: 'Waarom een lid voor u kiest en niet voor de zaak ernaast.',
    gevuld: s => ((s.salon && s.salon.bio) || '').trim().length >= 15, waaruit: 'salon' }
];

module.exports = ({ db }) => {

  /* Het profiel van een zaak: welke onderdelen horen erbij, en welke zijn
     gevuld. Null als de zaak er niet is -- niet een leeg profiel, want dat
     leest als "een zaak zonder onderdelen" in plaats van "geen zaak". */
  function mallProfiel(s) {
    if (!s) return null;
    const caps = db.capsVan(s);
    const onderdelen = ONDERDELEN
      .filter(o => !o.cap || caps.includes(o.cap))
      .map(o => ({ id: o.id, label: o.label, wat: o.wat, cap: o.cap || null,
        waaruit: o.waaruit, gevuld: !!o.gevuld(s) }));
    const gevuld = onderdelen.filter(o => o.gevuld).length;
    return {
      zaak: s.code, type: s.type,
      /* Waar een lid deze zaak in de app tegenkomt. Uit kern/mall, niet
         overgetypt; onbekende genres landen in de gids van de Mall zelf. */
      pagina: MALL_GENRE_PAGINA[s.type] || '/apps/mall.html',
      onderdelen, gevuld, totaal: onderdelen.length,
      percentage: onderdelen.length ? Math.round((gevuld / onderdelen.length) * 100) : null,
      open: onderdelen.filter(o => !o.gevuld),
      /* Wat dit NIET zegt. Zie de kop: zichtbaarheid is niet aan deze module,
         en dat hoort in het antwoord te staan en niet alleen in de code. */
      voorbehoud: 'Dit beschrijft de opbouw van uw Mall-pagina. Of u zichtbaar bent voor leden, hangt af van de ondernemerspoort en of uw zaak online staat.'
    };
  }

  /* Het profiel via de onderneming, zodat de route en het dagbeeld dezelfde
     ingang gebruiken als de rest van dit OS. */
  function ondernemingMallProfiel(o) {
    const s = o && o.supplierCode ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) : null;
    return mallProfiel(s);
  }

  return { MALL_ONDERDELEN: ONDERDELEN.map(o => o.id), mallProfiel, ondernemingMallProfiel };
};

module.exports.ONDERDELEN = ONDERDELEN;
