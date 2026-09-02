/* Het Consent Center: wie raakt mijn gegevens aan, en waar zet ik dat stop.

   Net als RTG Life bewaart deze laag NIETS. Hij leest de lagen die de
   toestemming zelf beheren en zet ze naast elkaar in een vorm. Intrekken gaat
   ook via die laag: er staat hier geen tweede knop die zijn eigen vlaggetje
   omzet, want dan is er een tweede waarheid over of iets nog mag (LAT regel 4).

   Wat een toets wel bewaakt: dat voor elke gedekte laag de intrekknop echt
   intrekt (heen en terug), en dat het register en wat het scherm toont niet
   uiteenlopen.

   DRIE BESTANDEN, DRIE SOORTEN WERK. ./consent-register.js is de LIJST (welke
   lagen toestemming dragen en waar hij ophoudt), ./consent-lezers.js LEEST die
   negen lagen uit, en dit bestand beslist wat er met een rij mag gebeuren. De
   firewall (./consent-relaties.js) herschikt diezelfde rijen per partij en
   bewaart evenmin iets. Nergens staat een tweede waarheid. */

/* Het register gaat aan het eind van dit bestand weer naar buiten, zodat
   test/consent-dekking.test.js en de route het op de oude plek blijven vinden. */
const { LAGEN, NIET_GEDEKT } = require('./consent-register');

module.exports = ({ kern }) => {
  /* De negen lezers staan in ./consent-lezers.js; hier blijft wat er met een
     rij MAG gebeuren. */
  const { consentVan } = require('./consent-lezers')({ kern, LAGEN, NIET_GEDEKT });

  
  /* Intrekken gaat naar de laag die de toestemming beheert. Er staat hier met
     opzet geen eigen vlaggetje: dan zou dit scherm kunnen zeggen dat iets uit
     staat terwijl de laag zelf het nog toelaat. */
  function consentIntrek(key, body) {
    const laag = String(body.laag || '');
    const id = String(body.id || '');
    const def = LAGEN.find(l => l.id === laag);
    if (!def) return { status: 404, error: 'Dit soort toestemming kent RTG niet.' };

    if (laag === 'care-intake') return kern.careIntakeStop(key, id);
    if (laag === 'care-vastlegging') return kern.vastleggingStop(key, id);
    if (laag === 'paspoort-inzage') return kern.paspoortTrekIn(key, id);
    if (laag === 'rtgid-sessie') return kern.rtgid.intrek(key, id);
    if (laag === 'rtgid-machtiging') return kern.rtgid.machtigIntrek(key, id);
    if (laag === 'locatie') return kern.locStopKlant(key, id);
    if (laag === 'toestel') return kern.toestelIntrek(key, { id });
    if (laag === 'wachtlijst') return kern.wachtlijstAf(key, { id });
    if (laag === 'metier-naam') return kern.metierBewijs.trekIn(key, id);
    /* Intrekken is hier: geen kanaal meer. Dat is dezelfde weg als het scherm
       gebruikt, dus er ontstaat geen tweede manier om hetzelfde uit te zetten. */
    if (laag === 'commercieel') return kern.commercieelZet(key, id, [], 'consentcentrum');
    if (laag === 'zorgprofiel') {
      /* Het profiel zelf blijft staan; alleen het MEEREIZEN gaat uit. Het
         weggooien zou meer doen dan er gevraagd is, en het lid raakt dan zijn
         eigen allergenenlijst kwijt. */
      const p = kern.zorgVan(key);
      return kern.zorgZet(key, { ...p, delen: false });
    }
    return { status: 500, error: 'Deze laag staat in het register maar heeft geen intrekpad.' };
  }

  return { consentVan, consentIntrek };
};

module.exports.LAGEN = LAGEN;
module.exports.NIET_GEDEKT = NIET_GEDEKT;
