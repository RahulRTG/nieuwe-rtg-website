/* Auth (deelmodule van ./account.js): DE POORTCONTROLE VAN DE AANMELDING.

   Wat mag er binnenkomen, en met welke pas. Geknipt uit ./account.js toen dat
   bestand de 10 KB-lat passeerde, en langs de naad die er al lag: hierboven
   staat wat we WEIGEREN, daaronder wat we AANMAKEN. Twee onderwerpen.

   Geeft een object terug: { status, error } als de aanmelding niet door mag, en
   anders de schoongemaakte velden. De route doet de HTTP; hier staat de regel. */
const eigenaar = require('../../eigenaar'); // een bron van waarheid over wie de eigenaar is

module.exports = ({ accounts, crypto, schoon, leeftijdVan, pasAppOk, PAS_FOUT }) => {
  return function keurAanmelding(req) {
    // schoon(): de echte naam wordt o.a. in de backoffice (KYC) getoond; geen opmaak.
    const name = schoon(req.body.name, 80);
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim().slice(0, 30);
    const password = String(req.body.password || '');
    if (!name) return { status: 400, error: 'Vul uw naam in.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, error: 'Vul een geldig e-mailadres in.' };
    /* Een gratis RTG-account vraagt VIER dingen: naam, geboortedatum, e-mail en een
       wachtwoord. Een telefoonnummer hoort daar niet bij -- dat vraagt Rahul pas als
       er iets geregeld moet worden waar een derde partij bij komt (een bestelling,
       een reservering, een bezorging). Geeft iemand hem hier toch mee, dan nemen we
       hem aan; is hij te kort om te kloppen, dan laten we hem weg in plaats van de
       aanmelding te weigeren. */
    const telefoon = phone.replace(/\D/g, '').length >= 8 ? phone : null;
    if (password.length < 6) return { status: 400, error: 'Wachtwoord moet minstens 6 tekens zijn.' };
    // de geboortedatum bepaalt de leeftijdsgroep en dus wat er opengaat
    // (15-17 alleen met toestemming van ouder/voogd); het paspoort komt pas later,
    // bij een bestelling of reservering waar een derde partij bij komt
    const geboren = String(req.body.geboortedatum || '').slice(0, 10);
    const lftNieuw = leeftijdVan(geboren);
    if (lftNieuw == null) return { status: 400, error: 'Vul uw geboortedatum in.' };
    if (lftNieuw < 15) return { status: 400, error: 'Het RTG-lidmaatschap kan vanaf 15 jaar.' };
    if (lftNieuw > 120) return { status: 400, error: 'Controleer uw geboortedatum.' };
    if (accounts.findByLogin(email)) return { status: 409, error: 'Er bestaat al een account met dit e-mailadres.' };
    /* HET EIGENAARSACCOUNT ONTSTAAT UIT EEN BEWUSTE HANDELING, NIET UIT EEN FORMULIER.

       De technische pagina bepaalt de eigenaar met eigenaarUser(): staat er nog
       geen eigenaarId, dan zoekt hij het account op het eigenaarsadres op en PINT
       dat vast. Dat is prima zolang alleen een bewuste handeling zo'n account kan
       maken -- maar deze route kon het ook. Op een verse productie-installatie
       werd daarmee wie het eigenaarsadres als eerste registreerde de eigenaar van
       het platform: de technische pagina, de hoofdzekering, de boardroom. Het
       adres is niet geheim -- het staat in de omgevingsvariabelen en in de
       documentatie -- dus geheimhouding was nooit de bescherming.

       De deur helemaal dichtdoen kon niet: in productie is dit de ENIGE weg om
       een eerste eigenaar te krijgen (de overdracht vanuit de boardroom vereist
       dat er er al een is). Daarom een eenmalige sleutel: RTG_OWNER_BOOTSTRAP.
       Staat die gezet, dan mag de registratie op het eigenaarsadres door mits ze
       hem meestuurt; staat hij niet gezet, dan gaat het adres niet meer door de
       voordeur. De beheerder zet hem bij de eerste start naast de andere
       sleutels, registreert een keer, en haalt hem weg.

       In demostand maakt de opstart het account rechtstreeks aan (createUserSync,
       niet via deze route), dus daar verandert er niets. Een OPVOLGER registreert
       gewoon zijn eigen adres en krijgt het eigenaarschap daarna overgedragen.

       Het antwoord bij een ontbrekende of verkeerde sleutel is bewust hetzelfde
       409 als bij een bestaand account: of dat adres al een account heeft, gaat
       een buitenstaander niet aan. */
    if (email === eigenaar.eigenaarEmail()) {
      const verwacht = String(process.env.RTG_OWNER_BOOTSTRAP || '');
      const gegeven = String(req.body.eigenaarSleutel || '');
      const goed = verwacht.length >= 16 && gegeven.length === verwacht.length
        && crypto.timingSafeEqual(Buffer.from(gegeven), Buffer.from(verwacht));
      if (!goed) return { status: 409, error: 'Er bestaat al een account met dit e-mailadres.' };
    }
    /* De poort van het merk: zelf-registreren levert ALTIJD hooguit een RTG Pass
       (of de gratis gast-laag). Lifestyle en Business komen -- per merkregel --
       uitsluitend na een menselijk besluit (kern/aanmeldingen.js beslis, dat
       accounts.setTier aanroept). Wie zich rechtstreeks als Lifestyle/Business
       probeert in te schrijven, krijgt gewoon RTG: geen enkele registratie geeft
       die passen zelf. Eerder gaf dit veld DIRECT een Business Pass -- dat gat is
       hier dicht. */
    const gevraagd = String(req.body.tier || 'rtg');
    const betaald = (gevraagd === 'lifestyle' || gevraagd === 'business');
    const tier = betaald ? 'rtg' : gevraagd;
    const pasApp = String(req.body.pasApp || '');
    /* In een pas-app registreer je alleen een account van die pas (gratis mag in de
       RTG-app). Vroeg iemand zich in de EIGEN betaalde-pas-app aan voor die pas
       (bijv. de Business-app, tier business) -- die we hierboven naar RTG
       terugbrengen -- dan zou de pasApp niet meer bij de (nu RTG-)pas passen. Dat
       is geen fout van de aanvrager maar het gevolg van onze eigen clamp, dus
       toetsen we dat geval tegen RTG: hij krijgt een RTG-account i.p.v. een
       weigering. Een ECHTE kruismismatch (bijv. business-tier in de Lifestyle-app)
       blijft gewoon geweigerd. */
    const pasAppKeuze = (betaald && pasApp === gevraagd) ? 'rtg' : pasApp;
    if (!pasAppOk(pasAppKeuze, tier)) return { status: 403, error: PAS_FOUT };
    return { ok: true, name, email, telefoon, password, geboren, tier, pasAppKeuze };
  };
};
