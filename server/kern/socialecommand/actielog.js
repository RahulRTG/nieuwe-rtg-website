/* Life Command, deel "actielog": het geheugen dat elke handeling verantwoordt.

   Zelfde discipline als kern/geldbeleid/actielog.js, en met opzet zelfde vorm --
   twee werelden die hun geheugen anders opschrijven, zijn twee producten. Wat
   hier ANDERS weegt staat in de derde alinea.

   APPEND-ONLY. Dit bestand heeft geen functie die een regel herschrijft,
   verwijdert of het log leegt. Wie er ooit een wil, heeft de verkeerde vraag;
   de juiste is waarom er iets in staat dat er niet had moeten staan. De enige
   verwijdering staat in schrijf() zelf: boven MAX gaat de oudste regel eruit,
   zodat de opslag per lid begrensd blijft.

   WAAROM HET LOG IN DEZE WERELD ZWAARDER WEEGT DAN BIJ GELD. Hier staan
   handelingen in die een ANDER MENS hebben bereikt: een antwoord dat een groep
   ziet, een plek die iemand anders daardoor niet krijgt. Bij geld verantwoordt
   het log wat er met uw eigen tegoed gebeurde; hier verantwoordt het wat er
   namens u tussen mensen is gebeurd. Vandaar dat elke regel niet alleen zegt
   WAT er is gedaan, maar ook WIE het deed (het lid of Rahul) en WAAROM -- en dat
   de FIFO de rahul-regels ontziet, precies zoals bij geld: wat het systeem zelf
   deed is wat een mens niet met eigen ruis moet kunnen wegdrukken.

   DIT IS DE ENIGE PLEK IN DEZE WERELD DIE BEWAART. De graaf, de objectlaag, de
   relatieruimte en de momentlijn zijn alle vier projecties zonder opslag. Dat
   dit bestand wel schrijft, is geen uitzondering op die regel maar het bewijs
   ervoor: een actielog is GEEN kopie van een domein. Het is nieuw gegeven --
   wat er gebeurde en waarom -- dat nergens anders bestaat. */
'use strict';

/* De tijd komt van de tijdmachine (server/lib/klok.js) en niet van het
   besturingssysteem: wie rechtstreeks aan het OS vraagt hoe laat het is, doet
   niet mee aan RTG_KLOK en is dus niet te beproeven op schrikkeldag, zomertijd
   of een verlopen mandaat. */
const { datum } = require('../../lib/klok');

const MAX = 200;

module.exports = ({ db, save, klok }) => {
  const nu = () => (klok ? klok() : datum());

  /* Opslag pas aanmaken als er echt iets bewaard wordt; kijken laat geen spoor
     achter. Dezelfde afspraak als kern/geldbeleid en kern/levensband. */
  function pak(key) {
    if (!db.data.socialeacties || typeof db.data.socialeacties !== 'object') db.data.socialeacties = {};
    const k = String(key || '');
    if (!k) return null;
    if (!Array.isArray(db.data.socialeacties[k])) db.data.socialeacties[k] = [];
    return db.data.socialeacties[k];
  }
  const kijk = (key) => {
    const alles = db.data.socialeacties;
    const k = String(key || '');
    return (alles && Array.isArray(alles[k])) ? alles[k] : [];
  };

  const kopie = (r) => ({ tijd: r.tijd, wie: r.wie, wat: r.wat, waarom: r.waarom,
    gegevens: r.gegevens.slice() });

  /* Boven de grens wijkt de oudste regel van het LID; alleen als die er niet
     meer zijn, de oudste van rahul. */
  function snoei(rijen) {
    while (rijen.length > MAX) {
      const i = rijen.findIndex(r => r.wie === 'lid');
      rijen.splice(i === -1 ? 0 : i, 1);
    }
  }

  /* Onbekende of ontbrekende `wie` wordt 'rahul', nooit 'lid': het log mag niet
     beweren dat het lid iets deed dat het lid niet deed. Andersom is
     onschuldiger -- Rahul iets te veel toeschrijven kost hooguit uitleg. */
  function schrijf(key, regel) {
    const rijen = pak(key);
    if (!rijen) return { status: 400, error: 'Geen sleutel.' };
    const r = regel && typeof regel === 'object' ? regel : {};
    const rij = {
      tijd: nu().toISOString(),
      wie: r.wie === 'lid' ? 'lid' : 'rahul',
      wat: String(r.wat || '').slice(0, 200),
      waarom: String(r.waarom || '').slice(0, 300),
      /* De GEGEVENS waarop de handeling rustte (GELD.md par. 5, LEVEN.md par.
         2.10): welke bron, welk feit. Zonder die regels is een log een lijst
         beweringen. */
      gegevens: (Array.isArray(r.gegevens) ? r.gegevens : []).slice(0, 12)
        .map(g => String(g).slice(0, 200))
    };
    rijen.push(rij);
    snoei(rijen);
    save();
    /* Een KOPIE terug: de aanroeper hoort de opgeslagen rij niet in handen te
       krijgen, want dan is append-only een belofte en geen eigenschap. */
    return { status: 200, ok: true, regel: kopie(rij) };
  }

  /* Nieuwste eerst voor het scherm; de opslag blijft oudste-eerst zodat
     aanvullen goedkoop is. Kopieen, geen verwijzingen: meekijken is geen
     meeschrijven. */
  const log = (key) => kijk(key).map(kopie).reverse();

  return { schrijf, log, MAX };
};
