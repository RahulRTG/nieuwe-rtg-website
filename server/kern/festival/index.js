/* RTG FESTIVAL: een tijdelijke stad. Zie FESTIVAL.md voor de doctrine; dit
   bestand is de fabriek die de delen aan elkaar knoopt.

   DE ZES DELEN, EN WAAR ZE OVER GAAN:

     ./model.js         de TIJD    festival, editie, dag -- en het rekenen over
                                   middernacht heen, op een plek
     ./terrein.js       de PLAATS  de boom van plekken, met een cyclusgrendel
     ./rechten.js       schrijven  wat een recht is, en hoe een pas ontstaat
     ./product.js       aanbod     wat er te koop is: prijs, voorraad, bundels
     ./poort.js         lezen      mag deze pas hier, nu -- en waarom niet
     ./toegang.js       handelen   de scan, dubbelgebruik, de offline bundel
     ./bezetting.js     tellen     hoeveel mensen waar, en hoe snel erbij
     ./bundel.js        rekenen    de keten van een product en de ruimte erin
     ./verkoop.js       verkopen   reserveren, loslaten en rondmaken
     ./artiest.js       het schema wie speelt wanneer; een voornemen is geen boeking
     ./rider.js         klaarzetten wat er moet staan, en wat er open staat
     ./podium.js        de vloer   wat er nu speelt, en wat er niet klopt
     ./dienst.js        de ploeg   wie waar staat; geen tweede klok, geen score
     ./groep.js         samen      een groep gasten; RTG verstuurt hier niets
     ./partner.js       banden     een band die beide kanten sluiten
     ./signalen.js      van buiten wat andere domeinen al bijhouden
     ./uitzondering.js  vooruit    wat er over dertig minuten misgaat
     ./gereed.js        keuren     controls met bewijs; alleen afgetekend telt
     ./gereedheid.js    de uitslag het ene getal waar een terrein op opengaat

   DE VOLGORDE VAN OPBOUW IS NIET VRIJ, en het is dezelfde reden als bij
   kern/concern/index.js: elk deel leest wat het vorige heeft neergezet. ./model
   eerst (alles hangt aan de dagen), dan ./terrein (rechten wijzen naar plekken),
   dan ./rechten, dan ./poort (die pasOpCode en plekIn nodig heeft), dan
   ./toegang (die magHier nodig heeft), en ./uitzondering als laatste, want die
   leest de twee tellingen erboven.

   WAT DEZE LAAG NIET DOET, EN NOOIT MAG DOEN (FESTIVAL.md par. 7). Zij vervangt
   niets. Het rooster blijft in kern/beveiliging/ en kern/personeel.js, de
   meldkamer in kern/hulpdienst/, de vergunning in kern/gemeente/, de keuken in
   kern/events/, de kassa en de polsband in de horecalaag, de inkoop in
   kern/handelsketen.js, het vervoer in kern/mobiliteit/. Deze laag WIJST AAN en
   LEEST -- hetzelfde patroon als kern/concern/ en om dezelfde reden: wie
   overschrijft, verliest wat de andere laag wist.

   Als deze wereld ooit een eigen rooster, een eigen kassa of een eigen
   meldkamer krijgt, is het project mislukt, ook als het werkt. */
'use strict';

module.exports = (ctx) => {
  const { db, save, crypto, schoon } = ctx;

  /* Een gedeelde context die per deel wordt aangevuld, zodat elk volgend deel
     leest wat het vorige neerzette zonder een tweede kopie van een leesfunctie. */
  /* `kern` gaat als functie mee zodat ./signalen.js hem LAAT leest: die hangt
     aan domeinen die in dezelfde ronde worden samengesteld. Zie de kop daar. */
  const k = { db, save, crypto, schoon, kern: ctx.kern };

  Object.assign(k, require('./model')(k));
  Object.assign(k, require('./terrein')(k));
  Object.assign(k, require('./rechten')(k));
  Object.assign(k, require('./product')(k));   // gebruikt keurRecht uit ./rechten.js
  Object.assign(k, require('./poort')(k));
  Object.assign(k, require('./toegang')(k));
  Object.assign(k, require('./bezetting')(k));
  /* ./partner.js voor ./signalen.js (die leest partnersVan), en beide voor
     ./uitzondering.js (die de signalen mee op de hoop gooit). */
  /* ./bundel.js rekent, ./verkoop.js handelt en gebruikt dat rekenwerk; beide
     na ./rechten.js, want de verkoop geeft passen uit. */
  Object.assign(k, require('./bundel')(k));
  Object.assign(k, require('./verkoop')(k));
  Object.assign(k, require('./artiest')(k));
  Object.assign(k, require('./rider')(k));
  Object.assign(k, require('./podium')(k));
  Object.assign(k, require('./dienst')(k));
  Object.assign(k, require('./groep')(k));
  Object.assign(k, require('./partner')(k));
  Object.assign(k, require('./signalen')(k));
  Object.assign(k, require('./uitzondering')(k));
  /* De gereedheid als laatste twee: ./gereedheid.js leest standVanControl uit
     ./gereed.js, dus die volgorde is gedrag en geen smaak. */
  Object.assign(k, require('./gereed')(k));
  Object.assign(k, require('./gereedheid')(k));

  /* ---------- de samenvatting ----------

     CONCERN.md par. 8 stelt de eis die hier ook geldt: alles hierboven is pas
     geslaagd als er iets LEESBAARS uit komt. Dit is die zin, en hij staat met
     opzet in de kern en niet in een scherm -- een tweede scherm zou zijn eigen
     telling gaan doen, en dan lopen er twee cijfers rond over hetzelfde terrein.

     Hij zegt niet "alles in orde". Hij zegt wat er gemeten is, wat er aandacht
     vraagt, en wat er niet gemeten wordt. Dat laatste is het eerlijkste deel. */
  function festivalStand(fid, eid, vraag) {
    const v = vraag || {};
    const u = k.uitzonderingen(fid, eid, v);
    if (u.error) return u;
    const kritiek = u.uitzonderingen.filter(x => x.ernst === 'kritiek').length;
    const eerste = u.uitzonderingen[0] || null;

    let zin;
    if (kritiek) zin = kritiek + ' kritiek. ' + eerste.zin;
    else if (eerste) zin = eerste.zin;
    else if (u.rust) zin = 'Rustig: ' + u.gemeten + ' plekken gemeten, niets binnen ' + u.horizon + ' minuten.';
    else if (!u.gemeten) zin = 'Er wordt nog niets gemeten op deze dag.';
    else zin = u.gemeten + ' plekken gemeten, niets binnen ' + u.horizon + ' minuten -- maar '
      + u.ongemeten.length + ' plek(ken) met een drempel worden niet gemeten.';

    return { ok: true, zin, kritiek, uitzonderingen: u.uitzonderingen,
      gemeten: u.gemeten, ongemeten: u.ongemeten, rust: u.rust };
  }

  return { ...k, festivalStand };
};
