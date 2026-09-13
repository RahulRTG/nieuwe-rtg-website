/* Kern-module "ledenbalie": de derde poort van het kantoor, naast de gewone
   backoffice en de boardroom. Hier helpt een medewerker een LID -- zoeken,
   dossier inzien, een herstel-link in gang zetten, een klacht noteren, een
   ander abonnement voorstellen.

   Drie regels waar dit bestand op gebouwd is, en waarom:

   1. DE BALIE ZIET GEEN IDENTITEIT. Geen naam, geen e-mailadres, geen
      telefoonnummer, geen document. Wel de codenaam, de pas, land en stad, lid
      sinds, de abo-stand en de open klachten. Dat is niet zuinigheid maar het
      ontwerp: de operationele kant draait op codenamen, de echte naam ligt in
      de kluis (server/accounts/). Een balie die "even de naam" mag zien maakt
      die kluis waardeloos -- dan is er een tweede kopie, met een vriendelijker
      scherm ervoor.

   2. ELKE BLIK LAAT EEN SPOOR NA. Zoeken en dossier gaan door het bestaande
      inzagejournaal (server/inzagelog.js), met een reden die iets zegt. Er komt
      geen tweede journaal bij: twee sporen van dezelfde handeling lopen uiteen
      zodra iemand er een aanpast.

   3. DE BALIE VERLEENT NIETS. Geen wachtwoord zetten (dat doet het lid zelf via
      de bestaande herstelstroom), geen pas toekennen (dat is een menselijk
      besluit via /api/aanmelding/beslis). De balie helpt; ze beslist niet.

   Twee buurbestanden, elk langs een echte scheiding afgesplitst: wie er aan de
   balie mag zitten staat in ./ledenbalie-zetels.js (toegang), wat de balie zelf
   noteert in ./ledenbalie-zaken.js (eigen administratie, raakt de kluis niet).
   Hier blijft over wat WEL in de kluis kijkt. Beide worden doorgegeven, zodat
   de bedrading een keer require't. */
'use strict';

const crypto = require('crypto');
const inzagelog = require('../inzagelog');          // het bestaande spoor, geen tweede
const { maandCentenVoor, contractueel } = require('./pasprijs');  // een antwoord op "wat kost een pas"

/* Een reden moet iets zeggen. De grens ligt laag maar niet op nul, want een
   verplicht veld dat je met een punt kunt vullen is geen verplicht veld. Op
   LETTERS en cijfers geteld en niet op tekens, anders is "........." zo tien
   tekens lang. Zelfde lijn als kern/payroll/identiteit.js. */
const REDEN_MIN = 10;
const { PASSEN, pasVan } = require('./passen');   // een plek, zie ./passen.js

module.exports = ({ db, save, accounts, onboarding, geldPasprijzen, magBoardroom, herstelStart, serviceEnvelop }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const kort = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const inhoud = s => String(s).replace(/[^\p{L}\p{N}]/gu, '').length;
  const wie = d => kort((d && d.naam) || (typeof d === 'string' ? d : '') || 'balie', 60);
  const redenOf = reden => { const r = kort(reden, 300); return inhoud(r) >= REDEN_MIN ? r : null; };
  const geenReden = { status: 400, error: 'Noteer waarvoor u dit doet. Het lid kan die reden later opvragen.' };
  const geenLid = { status: 404, error: 'Dit lid kennen we niet.' };
  function lidOf(id) {
    try { return id == null ? null : (accounts.getUserById(Number(id)) || null); } catch (e) { return null; }
  }

  const zetels = require('./ledenbalie-zetels')({ db, save, accounts, magBoardroom });
  const zaken = require('./ledenbalie-zaken')({ db, save, inzagelog, serviceEnvelop,
    hulp: { nu, rid, kort, inhoud, wie, redenOf, lidOf, pasVan, PASSEN, REDEN_MIN, geenReden, geenLid } });

  /* De steuncode en de stad komen uit ./ledenbalie-pseudoniem.js: daar woont de
     vertaling van een sleutel naar iets dat een mens aan de balie kan noemen. */
  const { steuncodeVan, stadVan } = require('./ledenbalie-pseudoniem')({ db, save, crypto, onboarding });

  /* Het abonnementsbeeld komt uit ./ledenbalie-abo.js: dat heeft zijn eigen
     bronnen (de prijslijst, de pasladder) en die raken de rest van de balie
     niet. */
  const aboVan = require('./ledenbalie-abo')({ pasVan, geldPasprijzen, maandCentenVoor,
    contractueel, voorstellenVan: (id) => zaken.voorstellenVan(id) });

  /* Zoeken en het dossier staan in ./ledenbalie-inzage.js: dat zijn de twee
     wegen die WERKELIJK in de kluis kijken, en ze delen sinds 13 september 2026
     een harde regel -- geen aantoonbaar journaal, geen inzage. Die regel is een
     eigen subject en hoort niet verspreid over de bedrading te staan. */
  const { balieZoek, balieDossier } = require('./ledenbalie-inzage')({
    inzagelog, kort, redenOf, lidOf, geenReden, geenLid, accounts,
    steuncodeVan, stadVan, aboVan, klachtenVan: (id) => zaken.klachtenVan(id), pasVan });

  /* ---------- wachtwoordherstel ---------- */
  /* De balie zet GEEN wachtwoord en ziet het adres niet. Ze zet de bestaande
     stroom in gang (/api/auth/forgot in routes/auth/herstel.js): het lid krijgt
     zelf de link per e-mail en een code op zijn telefoon. Dat is meteen het
     antwoord op "hoe weet u dat u de rekeninghouder spreekt" -- dat weet de
     balie niet, en daarom komt het bericht bij het lid uit en niet hier.

     herstelStart komt uit de bedrading en krijgt de accountrij mee; die laag
     kent het adres (accounts.emailOf) en dit bestand daarom juist niet.
     Ontbreekt hij, dan zeggen we dat luid: een balie die denkt te hebben
     geholpen terwijl er niets is verstuurd, is erger dan een balie die
     weigert. */
  /* Dezelfde volgorde als bij het dossier, en hier telt hij zwaarder: dit zet
     een herstelstroom in gang naar de telefoon en het adres van een lid. Het
     spoor staat er dus VOOR de envelop op de bus gaat -- andersom zou een
     mislukte commit een bericht achterlaten dat niemand meer kan verklaren. */
  async function balieHerstel(id, { door, reden } = {}) {
    const r = redenOf(reden);
    if (!r) return geenReden;
    const u = lidOf(id);
    if (!u) return geenLid;
    if (typeof herstelStart !== 'function')
      return { status: 500, error: 'De herstelstroom is niet aangesloten. Meld dit; er is niets verstuurd.' };
    const spoor = await inzagelog.noteerVast({
      door, over: { id: u.id, codenaam: u.codename }, waarom: r, bron: 'ledenbalie/herstel' });
    if (!spoor.ok) return { status: spoor.status || 503, error: spoor.error + ' Er is niets verstuurd.', spoor: spoor.reden };
    try {
      const p = herstelStart(u);
      if (p && typeof p.catch === 'function') p.catch(e => console.error('[ledenbalie] herstel', e));
    } catch (e) {
      console.error('[ledenbalie] herstel', e);
      return { status: 500, error: 'Het herstelbericht kon niet worden verstuurd.' };
    }
    return { ok: true, verstuurd: true };
  }

  return {
    // toegang (./ledenbalie-zetels.js) en de eigen administratie (./ledenbalie-zaken.js)
    balieZetels: zetels.balieZetels, balieZetelZet: zetels.balieZetelZet,
    balieZetelWeg: zetels.balieZetelWeg, magBalie: zetels.magBalie,
    balieKlachtOpen: zaken.balieKlachtOpen, balieKlachtStatus: zaken.balieKlachtStatus,
    balieAboVoorstel: zaken.balieAboVoorstel,
    // het werk dat in de kluis kijkt
    balieZoek, balieDossier, balieHerstel,
    // zodat de app van het lid dezelfde steuncode toont als de balie zoekt
    balieSteuncode: steuncodeVan
  };
};
