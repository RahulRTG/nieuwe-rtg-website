/* Geldgraaf, deelbestand "hulp": het gereedschap dat de andere delen delen.

   Apart bestand om dezelfde reden als levensgraaf/hulp.js: bronnen.js,
   patronen.js en vooruitblik.js hebben alle drie dezelfde datumrekenarij
   nodig, en drie eigen versies van "dagen tussen twee datums" lopen stil
   uiteen (LAT.md regel 4) -- juist hier zou dat onzichtbaar zijn: een
   vooruitblik die een dag anders telt dan de patroonherkenning geeft een
   verwachting die net niet klopt, en niemand kan aanwijzen waarom.

   De datumkeuring komt uit levensgraaf/hulp.js en staat hier NIET nog een
   keer: de les dat '2027-13-45' door een regex heen komt en als NaN in een
   teller belandt, is daar al een keer geleerd en hoort maar op een plek
   geleerd te blijven. */
'use strict';

/* `dagVan` woont sinds de sociale graaf ook daar: drie grafen die ieder hun
   eigen "welke dag was dit" schrijven, lopen stil uiteen. */
const { isDatum, dagVan } = require('../levensgraaf/hulp');

const vandaag = () => new Date().toISOString().slice(0, 10);

/* Op het middaguur rekenen, zodat een zomertijdgrens nooit een dag kan
   verschuiven; zelfde truc als de datumkeuring in levensgraaf/hulp.js. */
const plusDagen = (dag, n) =>
  new Date(new Date(dag + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

const dagenTussen = (a, b) =>
  Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);

/* De mediaan en niet het gemiddelde: een vaste post die een keer een week te
   laat werd afgeschreven mag de verwachte volgende datum niet meeslepen. */
const mediaan = (getallen) => {
  const g = [...getallen].sort((a, b) => a - b);
  if (!g.length) return 30;
  const m = Math.floor(g.length / 2);
  return Math.round(g.length % 2 ? g[m] : (g[m - 1] + g[m]) / 2);
};

/* ALLEEN voor zinnen: de verwachting, de uitleg en de gegevens-regels van een
   uitzondering zijn schermtekst, en daar moet een bedrag leesbaar in staan.
   Elk cijfer-VELD blijft rauw in centen; dit is de ene plek waar de omzetting
   naar euro's woont, zodat er nooit twee afrondlagen op elkaar komen. */
const euroTekst = (centen) => {
  const c = Math.round(Number(centen) || 0);
  const abs = Math.abs(c);
  /* Met duizendtalpunten, want dit zijn Nederlandse zinnen: "1000,00" leest
     als een tikfout en "1.000,00" als een bedrag. Handmatig gegroepeerd en
     niet met toLocaleString: die hangt aan de landinstelling van de SERVER,
     en die hoort de tekst van een lid niet te bepalen. */
  const heel = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (c < 0 ? '-' : '') + '€ ' + heel + ',' + String(abs % 100).padStart(2, '0');
};

/* Voor stabiele uitzondering-ids: het scherm mag een uitzondering aan zijn id
   herkennen over twee opeenvolgende ophaalrondes heen. */
const slug = (t) => String(t == null ? '' : t).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';

const LINK = (stand) => '/apps/geld.html#' + stand;

/* De enige plek waar een feit ontstaat (GELD.md par. 1): overal dezelfde
   vorm, en dus een plek waar de vorm wordt afgedwongen. Een bron die een
   euro-bedrag of een kapotte datum aanlevert, komt hier niet doorheen als
   iets dat op een feit lijkt maar het niet is.

   `tijd` is geen negende betekenisveld maar de klok achter `wanneer`: de
   tijdlijn wil gebeurtenissen op volgorde binnen een dag kunnen zetten.
   Alleen gebeurtenissen (een betaling, een bijdrage, een loonstrook) krijgen
   hem mee; standen en verwachtingen niet. */
function feit(o) {
  const f = {
    soort: String(o.soort || ''),
    titel: String(o.titel == null ? '' : o.titel).slice(0, 120),
    centen: Number.isFinite(o.centen) ? Math.round(o.centen) : null,
    richting: o.richting === 'in' || o.richting === 'uit' ? o.richting : '',
    wanneer: isDatum(o.wanneer) ? o.wanneer : null,
    herhaling: o.herhaling === 'maandelijks' ? 'maandelijks' : null,
    bron: String(o.bron || ''),
    link: String(o.link || LINK('overzicht'))
  };
  if (o.tijd) f.tijd = String(o.tijd);
  return f;
}

module.exports = { vandaag, dagVan, plusDagen, dagenTussen, mediaan, euroTekst, slug, LINK, feit };
