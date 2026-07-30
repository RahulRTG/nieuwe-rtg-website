/* Boardroom van het lid, deel "talen": de namen en uitleg van het bord in de
   taal van de lezer.

   De rest van het huis doet dit in de pagina: Nederlands staat in de HTML, en
   window.I18N levert de vertalingen (shared/i18n.js). Dit bord kan dat niet --
   zijn labels komen van de server, uit de catalogus, en die kent de pagina niet.
   Vandaar hier: één woordenboek naast de catalogus, en bord() geeft de taal mee.

   Nederlands is de basis en staat in ./catalogus; hier staat alleen wat afwijkt.
   Een taal die we niet kennen valt terug op Engels, en Engels dat een sleutel
   mist valt terug op het Nederlands. Zo staat er nooit een lege regel. */

const EN = {
  cat: {
    app: ['App features', 'The main modules of your app.'],
    privacy: ['Privacy & social', 'Who may see and ask what.'],
    ai: ['AI & notifications', 'The smart and attentive layer.'],
    verbinding: ['Connections', 'The device and connection side.']
  },
  fn: {
    reizen: ['Travel & bookings', 'Search, book and manage journeys.'],
    salon: ['The Salon', 'The private social network.'],
    spelen: ['Games', 'Games with friends.'],
    bestellen: ['Ordering', 'Pick-up and delivery from partners.'],
    care: ['RTG Care', 'Care, spa and wellness.'],
    werk: ['Work & vacancies', 'Applying to partners.'],
    tickets: ['Tickets & entry', 'Activities and events.'],
    vervoer: ['Transport & rides', 'Rides and transfers.'],
    pay: ['RTG Pay', 'Paying and settling between friends.'],
    wallet: ['Wallet & member card', 'Your card, tickets, keys and coins.'],
    gids: ['Visible in the directory', 'Findable by other members.'],
    verzoeken: ['Friend requests', 'Others may send you a request.'],
    dm: ['Direct messages', 'Receiving private messages.'],
    locatie: ['Share location', 'Your live location, with whom you choose.'],
    paspoort: ['Share passport / ID', 'Share verified identity on request.'],
    rahul: ['Rahul (AI help)', 'Your personal travel AI.'],
    spraak: ['Voice control', 'Operate Rahul with your voice.'],
    push: ['Push notifications', 'Alerts on your device.'],
    streak: ['Daily prompt', 'The daily photo invitation. Skipping costs you nothing.'],
    gps: ['GPS tracking', 'Location sensing by the device.'],
    wifi: ['Wi-Fi pairing', 'Pairing with local Wi-Fi (e.g. a Zaakdoos).'],
    bluetooth: ['Bluetooth pairing', 'Pairing with Bluetooth devices.']
  },
  zin: {
    globaal: 'Temporarily switched off by RTG.',
    pas: 'Switched off by RTG for your pass.',
    land: 'Switched off by RTG in your country.',
    persoon: 'Switched off by RTG for your account.',
    genre: 'Switched off by RTG for this kind of business.',
    werk: 'Switched off by your employer',
    vast: 'Part of the basics of your device.'
  }
};

const NL_ZIN = {
  globaal: 'Tijdelijk uitgeschakeld door RTG.',
  pas: 'Voor jouw pas uitgeschakeld door RTG.',
  land: 'In jouw land uitgeschakeld door RTG.',
  persoon: 'Voor jouw account uitgeschakeld door RTG.',
  genre: 'Voor dit genre uitgeschakeld door RTG.',
  werk: 'Uitgezet door je werkgever',
  vast: 'Hoort bij de basis van je toestel.'
};

const talen = { en: EN };
const isNl = lang => !lang || String(lang).slice(0, 2).toLowerCase() === 'nl';
function woordenboek(lang) {
  if (isNl(lang)) return null;
  return talen[String(lang).slice(0, 2).toLowerCase()] || EN;
}

/* De naam en uitleg van een categorie of functie, in de gevraagde taal. */
function categorie(id, nlNaam, nlUitleg, lang) {
  const w = woordenboek(lang);
  const v = w && w.cat[id];
  return { naam: (v && v[0]) || nlNaam, uitleg: (v && v[1]) || nlUitleg };
}
function functie(id, nlNaam, nlUitleg, lang) {
  const w = woordenboek(lang);
  const v = w && w.fn[id];
  return { naam: (v && v[0]) || nlNaam, uitleg: (v && v[1]) || nlUitleg };
}
/* De zinnen die uitleggen waarom iets vaststaat of beheerd wordt. */
function zin(sleutel, lang) {
  const w = woordenboek(lang);
  return (w && w.zin[sleutel]) || NL_ZIN[sleutel] || NL_ZIN.globaal;
}

module.exports = { categorie, functie, zin, isNl };
