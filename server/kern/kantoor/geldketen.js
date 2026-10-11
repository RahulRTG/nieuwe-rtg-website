/* ============================================================================
   DE GOUDEN WEG -- een geldhandeling die door de hele machine loopt.

   WAT DIT OPLOST, en het is gemeten en niet gevoeld. `MACHINEDEKKING.json` legt
   zestien motoren naast elkaar op dezelfde route en vindt dit: de hoogst
   geintegreerde handeling van dit huis raakt DRIE assen, en 2818 van de 4952
   muterende routes raken er geen enkele. Elke motor is apart gebouwd, getoetst en
   gemeten -- en er is geen enkele handeling die de keten heeft gelopen. Dat is het
   verschil tussen zestien organen en een machine.

   Deze module is die ene handeling. Niet een zeventiende motor: een BAAN waarlangs
   de bestaande motoren elkaar in de juiste orde raken, met per as een uitslag en
   een graad. Wat hier gebeurt, gebeurt nergens anders opnieuw.

   DE BAAN, en elke stap noemt de module die hem bezit:

     mensbewijs    de deur (kern/kantoor/kluispoort.js) -- een NAAM, geen code
     assurance     kern/zwaarbewijs.js -- een passkey onder deze handeling
     mandaat       kern/stuur/mandaat.js -- en die zegt hier NEE, zie hieronder
     streefstand   wat er na de handeling waar moet zijn (het `doel`)
     voornemen     kern/commercie/voornemen.js -- het TOTAAL wegen voor stap een
       autoriteit    kern/commercie/besluit.js, binnen de keuring
       bewijstoken   kern/commercie/bewijstoken.js, binnen de keuring
       veiligheidskern kern/commercie/veiligheidskern.js, binnen de uitvoering
     tegenfeit     wat zou deze handeling doen -- door het domein aangeleverd
     frictie       kern/frictie/ -- hand, assist of auto, met de opbouw erbij
     tweede mens   kern/kantoor/tweedehandtekening.js -- de bestaande deur
     idempotentie  de economische sleutel, en die komt NIET van de client
     atomair       per klasse anders; zie KLASSEN hieronder
     envelop       kern/envelop.js -- oorzaak en correlatie door de hele keten
     bewijsketen   lib/keten.js -- een hashketen die niet te herschrijven is
     gevolg        kern/stuur/gevolg.js -- wat raakt deze route werkelijk aan

   HET MANDAAT ZEGT HIER NEE, EN DAT IS DE AS DIE WERKT. `NOOIT_AUTONOOM` in
   kern/stuur/mandaat.js noemt geld met zoveel woorden: geen enkel mandaat maakt
   een geldhandeling zelfstandig. Deze baan vraagt het daarom niet om toestemming
   maar om de GRENS, en legt het antwoord vast: een mens voert uit. Een as die
   "nee" antwoordt is een as die meedoet -- hem overslaan omdat het antwoord
   voorspelbaar is, is precies hoe een grens verdwijnt.

   WAT DEZE MODULE NIET DOET:

   - Zij beslist niets. Elk oordeel komt van de motor die het bezit; hier staat de
     ORDE en de vastlegging. Een baan die zelf gaat wegen is de tweede
     autorisatielaag, en dan is de vraag "wie besliste dit" weer onbeantwoordbaar.
   - Zij verplaatst geen geld. `doe` komt van de aanroeper: het domein weet wat
     een stap betekent, deze laag weet of hij mag en of het bewijsbaar is.
   - Zij verzint geen plan. `stappen` komt van de aanroeper, net als bij het
     voornemen zelf.
   ========================================================================== */
'use strict';

const keten = require('../../lib/keten');
const envelopLaag = require('../envelop');
const mandaatLaag = require('../stuur/mandaat');
const gevolgLaag = require('../stuur/gevolg');
const klok = require('../../lib/klok');
/* De handelingsklassen en de ketendeclaratie staan apart: een register hoort niet
   in een machine te wonen. Zie ./geldketen/klassen.js. */
const { KLASSEN, KETENS } = require('./geldketen/klassen');

const MAX_JOURNAAL = 20000;
const MAX_DOSSIERS = 5000;

function maakGeldketen({ voornemens, frictie, bak, nu, mandaatBron }) {
  const tijd = nu || klok.nu;

  /* De twee bakken: het JOURNAAL is een hashketen (lib/keten.js) en de DOSSIERS
     zijn de leesbare kant ervan. Ze staan los omdat ze verschillende dingen zijn:
     het journaal mag nooit herschreven worden, een dossier wordt per as bijgewerkt
     terwijl de handeling loopt. */
  const boeken = require('./geldketen/boeken').maakBoeken({ bak, tijd });
  const { journaal, dossiers, vindDossier, leg, noteer, bewaar } = boeken;
  const { publiek, dossier, lijst, voorspellingVan } = require('./geldketen/dossier').maakDossierlaag({ dossiers, vindDossier });

  /* De eerste helft van de baan staat apart: zie ./geldketen/klaarzet.js. */
  const klaarzet = require('./geldketen/klaarzet').maakKlaarzet({
    voornemens, frictie, mandaatBron, tijd, leg, noteer, bewaar, publiek });
  /* DE TWEEDE MENS staat apart: zie ./geldketen/tekenen.js. */
  const tekenAf = require('./geldketen/tekenen').maakTekenen({ voornemens, vindDossier, leg, noteer, bewaar });

  /* ------------------------------------------------------------------------
     UITVOEREN. Hier verplaatst het domein het geld, binnen de envelop van deze
     keten zodat elk gevolg weet waardoor het ontstond. De drie grendels van het
     voornemen (vingerafdruk, bewijstoken, veiligheidskern) staan in
     kern/commercie/voornemen/uitvoeren.js en worden hier niet nagedaan.
     ---------------------------------------------------------------------- */
  async function uitvoer({ id, doe, door, verzoek }) {
    const d = vindDossier(id);
    if (!d) return { status: 404, error: 'Er is geen geldketen met dit voornemen.' };
    if (typeof doe !== 'function') return { status: 400, error: 'Er is geen uitvoerder meegegeven.' };
    /* Een voornemen dat al UITGEVOERD of GESTAAKT staat, wordt niet uitgevoerd -- en dan
       hoort het dossier van die eerdere uitvoering niet overschreven te worden. */
    const v = voornemens.vind ? voornemens.vind(id) : null;
    if (v && (v.stand === 'UITGEVOERD' || v.stand === 'GESTAAKT' || v.stand === 'AFGEWEZEN'))
      return { status: 409, error: 'Dit voornemen staat al op ' + v.stand + ' en wordt niet uitgevoerd.' };

    /* WELK VERZOEK DEZE UITVOERING DEED, en dat is een id en geen identiteit. Het is de
       enige brug tussen deze keten en de effectbon van server/effectbon.js: die bon wordt
       pas gemaakt als het antwoord de deur uit gaat, dus hij kan hier niet gelezen worden
       -- maar hij kan straks WEL gevonden worden. Zonder dit veld is de voorspelling van
       de aanvraag niet meer te koppelen aan de observatie van de uitvoering, en dat is
       precies de koppeling die een causale keten maakt. */
    if (verzoek) d.uitvoerVerzoek = String(verzoek).slice(0, 64);

    const env = envelopLaag.maak({ kanaal: 'office', actor: null, classificatie: 'intern',
      correlatie: d.correlatie, oorzaak: d.envelop });

    const r = await envelopLaag.inKeten(env, () => voornemens.voerUit(id, { doe, context: { pad: d.pad, door: door || null } }));

    leg(d, 'uitvoering', { graad: r && r.ok ? 'gemeten' : 'onbekend',
      uitslag: r && r.voornemen ? r.voornemen.stand : null,
      reden: r && r.ok ? 'het voornemen is uitgevoerd; de vingerafdruk klopte en het bewijs is ingeleverd'
        : ('de uitvoering ging niet door: ' + ((r && r.error) || 'onbekende storing')) });
    const schakel = noteer(env, r && r.ok ? 'geldketen.uitgevoerd' : 'geldketen.uitvoering.geweigerd',
      { voornemen: id, door: door || null, fout: r && r.ok ? null : (r && r.error) || null });
    d.keten = schakel.hash;
    leg(d, 'bewijsketen', { graad: 'gemeten', uitslag: schakel.hash,
      reden: 'ook de uitvoering hangt in de hashketen; het spoor loopt van de aanvraag tot het gevolg' });
    bewaar(d);
    return r;
  }

  /* DE RISICOGOEDKEURING (eigenaarsbesluit 2C): een eigen menselijke stap, voor de tweede
     handtekening, en alleen voor een handeling die kern/commercie/risicouitzondering.js
     toelaat. Het voornemen weegt haar; hier komt zij in het dossier en de hashketen. Wie
     de handeling aanvroeg, geeft haar niet: dat wordt op de SLEUTEL vergeleken, want de
     naam alleen is een zwakkere vergelijking waar een harde bestaat. */
  function risicoGoedkeur({ id, door, naam, reden }) {
    const d = vindDossier(id);
    if (!d) return { status: 404, error: 'Er is geen geldketen met dit voornemen.' };
    if (door && d.doorSleutel && String(door) === String(d.doorSleutel))
      return { status: 403, error: 'Wie de handeling aanvroeg, geeft er niet zelf de risicogoedkeuring voor.' };
    const r = voornemens.risicoGoedkeur(id, { door, naam, reden });
    if (!r.ok) return r;
    const env = envelopLaag.maak({ kanaal: 'office', actor: null, classificatie: 'intern',
      correlatie: d.correlatie, oorzaak: d.envelop });
    leg(d, 'risicogoedkeuring', { graad: 'gemeten', uitslag: naam || door, omkeerbaar: false,
      bron: r.voornemen.risicogoedkeuring && r.voornemen.risicogoedkeuring.bron,
      reden: String(reden || '').slice(0, 400) });
    bewaar(d);
    noteer(env, 'geldketen.risicogoedkeuring', { voornemen: id, door: naam || door });
    return { status: 200, ok: true, voornemen: r.voornemen, dossier: publiek(d), aanvrager: d.doorSleutel || null };
  }

  return { klaarzet, tekenAf, uitvoer, risicoGoedkeur, dossier, lijst, voorspellingVan,
    journaalTop: boeken.top, journaalVerifieer: boeken.verifieer, KLASSEN, KETENS };
}

module.exports = { maakGeldketen, KLASSEN, KETENS };
