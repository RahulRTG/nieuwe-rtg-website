/* DE KERN-AANBOUW, DEEL VIER: de identiteits- en toestemmingsstapel.

   Consent Center, de relatie-firewall, de inzagekaart, de gegevenskaart, de
   tijdlijn, de dagcoach, RTG Life en de App Store. Afgesplitst van ./aanbouw3.js
   toen die over de 10 KB-keuringsgrens ging -- precies zoals aanbouw3 zelf ooit
   van aanbouw2 werd afgesplitst.

   DE NAAD ZIT HIER EN NIET WILLEKEURIG. Wat in aanbouw3 achterblijft gaat over
   het lichaam en de dag (doelen, metingen, training, medicatie, noodkaart,
   gewoonten, gemoed, gedachten, toestellen, toegankelijkheid); wat hier staat
   gaat over wie er bij die gegevens mag en wat ermee gebeurd is -- vier vragen
   naast elkaar: wie MAG (consent), wie HEEFT gekeken (inzagekaart), wat er nog
   MOET (gegevenspoort) en wat er IS (gegevenskaart).

   DE VOLGORDE BLIJFT GEDRAG. De gegevenskaart peilt de inzagekaart en staat er
   dus na; de tijdlijn, de dagcoach en Life krijgen de KERN mee in plaats van
   losse functies en horen daarom onderaan -- ze lezen lagen die verspreid
   gemonteerd zijn, en een kopie op montagemoment zou undefined bevriezen. Deze
   deur wordt door ./aanbouw3.js aangeroepen als laatste stap, zodat alles wat
   hierboven staat er al is.
   ========================================================================== */
'use strict';

module.exports = function bouwKernAanVier(kern, grens) {
  const { db, save, DATA_DIR } = kern;
  /* Het Consent Center (kern/consent.js): wie raakt mijn gegevens aan, en waar
     zet ik dat stop. Bewaart niets en trekt in bij de bron; krijgt daarom de
     KERN mee, net als Life, want hij leest lagen die verspreid gemonteerd zijn. */
  Object.assign(kern, require('../kern/consent')({ kern }));
  /* De firewall herschikt wat consentVan oplevert en bewaart niets; hij krijgt
     die twee functies mee in plaats van de kern, zodat hij niets anders KAN
     lezen dan wat het Consent Center al toont. */
  Object.assign(kern, require('../kern/consent-relaties').maakRelaties({
    consentVan: kern.consentVan, consentIntrek: kern.consentIntrek }));
  require('../routes/consent')(grens('consent'));
  /* De inzagekaart (kern/inzagekaart.js): de andere helft van diezelfde vraag.
     Het Consent Center gaat over wat er OPENSTAAT, deze kaart over wat er IS
     GEBEURD -- de drie sporen (RTG iD, paspoortlaag, inzagejournaal) op een
     lijst. Leest alleen, schrijft niets, en staat naast consent omdat hij
     dezelfde verspreid gemonteerde lagen nodig heeft. */
  Object.assign(kern, require('../kern/inzagekaart')({ kern }));
  require('../routes/inzagekaart')(grens('inzagekaart'));
  /* De gegevenskaart (kern/identiteit/gegevenskaart.js): de VIERDE vraag naast
     de drie hierboven. Consent zegt wie er iets MAG, de inzagekaart wie er
     HEEFT gekeken, de gegevenspoort wat er nog MOET -- en deze zegt wat er IS.
     Hij hoort hier omdat hij de inzagekaart peilt, en die bestaat pas een regel
     eerder; hij krijgt met opzet losse functies mee en niet de kern, zodat hij
     niets anders KAN lezen dan de vier lagen die zijn register noemt. */
  Object.assign(kern, { gegevenskaart: require('../kern/identiteit/gegevenskaart').maakGegevenskaart({
    accounts: kern.accounts, sessieregister: kern.sessieregister, toestellen: kern.toestellen,
    commercieel: { standVan: kern.commercieelStand }, inzagekaart: kern.inzagekaartVan }) });
  require('../routes/member/gegevenskaart')(grens('gegevenskaart'));
  /* De tijdlijn (kern/tijdlijn.js): wat er in de tijd met u gebeurd is. Bezit
     niets en leidt niets af -- geen verbanden en geen score. Krijgt de KERN mee,
     net als Life en de dagcoach, en hangt daarom onderaan. */
  Object.assign(kern, require('../kern/tijdlijn')({ kern }));
  require('../routes/tijdlijn')(grens('tijdlijn'));
  /* De dagcoach (kern/dagcoach.js): wat er vandaag staat, op volgorde van de
     klok. Hij plant niets en bezit niets -- afvinken gebeurt in de laag die het
     ding wel bezit. Krijgt de KERN mee, net als Life, om dezelfde reden. */
  Object.assign(kern, require('../kern/dagcoach')({ kern }));
  require('../routes/dagcoach')(grens('dagcoach'));
  /* RTG Life (kern/life.js): het ene scherm dat de lagen hierboven bij elkaar
     leest -- ritme, doelen, afspraken en de check-in. Hij krijgt de KERN mee en
     geen losse functies, want hij pakt ze op aanroepmoment: hij hangt later in
     de bouw dan wat hij leest, en een kopie zou undefined bevriezen. */
  Object.assign(kern, require('../kern/life')({ kern }));
  require('../routes/life')(grens('life'));
  /* De RTG App Store (kern/appstore/): het kanaal waarlangs een DERDE een app in
     dit huis krijgt. Hij hangt HIER, onderaan, om twee redenen die allebei
     gedrag zijn: de virusscanner (kern/antivirus) staat dan zeker op de kern --
     en zonder scanner gaat de poort dicht in plaats van open -- en het
     tenantregister is dan gemount, zodat een uitgever aan een echte organisatie
     hangt in plaats van aan een code die hij zelf meestuurt.

     De drie lagen komen als een geheel binnen: motor, winkel en brug. Zie
     APPSTORE.md voor de zes begrippen en de zes grenzen. */
  Object.assign(kern, require('../kern/appstore').maakAppstore({
    db, save, dir: DATA_DIR, antivirus: kern.antivirus, pay: kern.pay, findSupplier: kern.findSupplier,
    /* De bus komt van de kern en wordt hier alleen doorgegeven: elke
       journaalregel gaat daarmee ook als gebeurtenis naar de andere processen
       in de vloot -- van een envelop voorzien door de bus zelf (server/bus.js,
       kern/envelop.js). Ontbreekt hij, dan werkt de App Store
       precies zoals hij altijd deed. */
    bus: kern.bus,
    /* DE 18+-POORT VAN DE SPELLENLAAG, doorgegeven en niet nagebouwd. Een app in
       de store mag een score bewaren (kern/appstore/arena.js), en daarvoor geldt
       exact dezelfde grens als voor de spellen van het huis: een eigen account,
       door RTG gekeurd, 18 of ouder. Twee leeftijdsregels in een huis is er een
       te veel (LAT-regel 4). */
    ...require('../kern/spellen/grens')({ volwassen: kern.volwassen }),
    log: (t) => { try { require('../log').log.warn(t); } catch (e) { console.warn(t); } } }));
  require('../routes/appstore')(grens('appstore'));
};
