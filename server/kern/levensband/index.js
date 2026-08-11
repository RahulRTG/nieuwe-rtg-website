/* Kern-module "levensband": de banden tussen mensen, en wat een band mag zien
   (LEVEN.md par. 2.8, fase 2).

   WAT EEN BAND IS. Een verbinding tussen een RTG-lid (op codenaam) en een
   gezinsprofiel van de RTFoundation (op handle). Twee sessiewerelden die
   elkaar tot nu toe niet kenden: het huis draait op een gezinscode met een
   profieltoken, de levenslijn op de lidsleutel.

   DE TWEE BESLUITEN VAN 11 AUGUSTUS 2026 STAAN HIER IN CODE, niet in een
   instelling die iemand kan vergeten:

   1. EEN BAND ONTSTAAT ALLEEN ALS BEIDE KANTEN HEM BEVESTIGEN. Wie vraagt,
      bevestigt niet: ./banden.js weigert dat expliciet, en de toets die het
      bewaakt is met een mutatie gezien zakken. Dat is trager dan "wie de
      gezinscode heeft mag koppelen", en dat is de bedoeling -- een code is
      geen instemming. Een oppas, een familielid of een ex-partner heeft die
      code ooit gekregen; bezit van een sleutel bewijst dat iemand een keer
      binnen mocht, niet dat hij er nu bij hoort.

   2. VAN EEN MINDERJARIGE ZIET DE ANDER STANDAARD NIETS. Er is geen
      standaardpakket dat een ouder krijgt: ./inzage.js geeft uitsluitend
      terug wat het kind zelf per stuk heeft gedeeld, en alleen zolang die
      deling niet is verlopen. Dit is niet wat ouders verwachten, dus het
      scherm zegt het hardop; deze laag doet niet alsof het anders is.

   DE UITZONDERING DIE ERBIJ HOORT: VEILIGHEID. Een ouder hoort te kunnen zien
   DAT er iets mis is zonder te lezen WAT er staat. Dat loopt via
   ./inzage.js signaal(), en het is met opzet een SIGNAAL en geen inzage: het
   zegt dat er aandacht nodig is en noemt nooit de inhoud. Wie dat ooit wil
   uitbreiden tot "en dit staat er dan", leest eerst par. 2.1 opnieuw.

   ALLES IS INTREKBAAR, ALTIJD, DOOR ELKE KANT. Een band verbreken en een
   deling intrekken kan zonder toestemming van de ander en zonder uitleg. Een
   toestemming die je niet kunt intrekken is geen toestemming.

   Deze module heeft WEL eigen opslag (db.data.levensbanden): een band is een
   nieuw gegeven dat nergens anders bestaat. De graaf en de lijn blijven
   alleen-lezen; die raken hier niets aan. */
'use strict';

const MAX_BANDEN = 40;   // meer is geen kring meer maar een adresboek
const MAX_DELINGEN = 200; // per mens; houdt de opslag begrensd

/* De soorten band die dit huis kent. De soort zegt WAT iemand voor je is en
   NIET wat hij mag zien: dat laatste hangt uitsluitend aan de delingen. Een
   ouder krijgt hier dus geen recht mee -- LEVEN.md par. 2.8. */
const SOORTEN = ['ouder', 'kind', 'partner', 'familie', 'mentor', 'leerkracht', 'vertrouwenspersoon'];

module.exports = ({ db, save, klok }) => {
  const nu = () => (klok ? klok() : new Date());
  const nuIso = () => nu().toISOString();
  const vandaag = () => nuIso().slice(0, 10);

  /* Opslag pas AANMAKEN als er echt iets bewaard wordt; kijken laat geen spoor
     achter. Dezelfde afspraak als kern/geldbeleid, en om dezelfde reden: een
     rij per mens die een keer keek is opslag die niemand heeft gevraagd. */
  function pak() {
    if (!db.data.levensbanden || typeof db.data.levensbanden !== 'object') {
      db.data.levensbanden = { banden: [], delingen: [] };
    }
    const d = db.data.levensbanden;
    if (!Array.isArray(d.banden)) d.banden = [];
    if (!Array.isArray(d.delingen)) d.delingen = [];
    return d;
  }
  function kijk() {
    const d = db.data.levensbanden;
    return {
      banden: Array.isArray(d && d.banden) ? d.banden : [],
      delingen: Array.isArray(d && d.delingen) ? d.delingen : []
    };
  }

  const id = (voor) => voor + '-' + Math.random().toString(36).slice(2, 10);

  /* Een band heeft twee kanten en die zijn GELIJKWAARDIG. Er is geen eigenaar
     en geen aanvrager met meer recht: allebei kunnen bevestigen (de ander),
     allebei kunnen verbreken, allebei kunnen delen wat van hen is. */
  const isKant = (b, wie) => b.lid === wie || b.profiel === wie;
  const andereKant = (b, wie) => (b.lid === wie ? b.profiel : b.lid);

  /* Verlopen is niet hetzelfde als verbroken: een band met een vervaldatum
     (een leerkracht, een mentorschap) dooft vanzelf en hoeft door niemand te
     worden opgezegd. Dat is de bedoeling van par. 2.8 -- toegang die vanzelf
     eindigt vraagt niemand om eraan te denken. */
  const verlopen = (x) => !!x.vervalt && x.vervalt < vandaag();
  const levend = (b) => b.staat === 'bevestigd' && !verlopen(b);

  /* Wat er naar buiten gaat: kopieen, nooit de opgeslagen rij. Wie meekijkt
     mag niet meeschrijven. */
  function zichtBand(b) {
    return { id: b.id, lid: b.lid, profiel: b.profiel, gezin: b.gezin, soort: b.soort,
      staat: verlopen(b) && b.staat === 'bevestigd' ? 'verlopen' : b.staat,
      gevraagdDoor: b.gevraagdDoor, gevraagdAt: b.gevraagdAt,
      bevestigdAt: b.bevestigdAt || null, vervalt: b.vervalt || '' };
  }
  function zichtDeling(x) {
    return { id: x.id, bandId: x.bandId, van: x.van, stuk: x.stuk, wat: x.wat,
      vervalt: x.vervalt || '', at: x.at, verlopen: verlopen(x) };
  }

  const ctx = { pak, kijk, id, nuIso, vandaag, isKant, andereKant, verlopen, levend,
    zichtBand, zichtDeling, save, SOORTEN, MAX_BANDEN, MAX_DELINGEN };

  const banden = require('./banden')(ctx);
  const delen = require('./delen')(Object.assign({ bandVan: banden.bandVan }, ctx));
  const inzage = require('./inzage')(Object.assign({ bandVan: banden.bandVan }, ctx));

  return { levensband: Object.assign({ SOORTEN }, banden.api, delen, inzage) };
};
