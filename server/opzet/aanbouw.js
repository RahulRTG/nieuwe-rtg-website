/* ============================================================================
   DE KERN-AANBOUW, DEEL EEN: leren, zorg en samen.

   De biebs (school, beroepen, rijk), de bibliothecaris, Samen, de Residentie,
   Zelfzorg, de RTG AI en de Onderzoeker -- met de routers die erop leunen.

   Hoort bij ./routes.js en is er alleen van gescheiden omdat samen ze weer over
   de 10 kB-grens gingen -- dezelfde grens die dit werk in gang zette, en die tot
   vandaag alleen naar de bijna-overtreders keek.

   DE VOLGORDE IS GEDRAG. De bibliothecaris wil de biebs die er vlak boven bij
   komen; rtgai wil zelfzorg; de zorgpolis wil de wallet. Wie hier iets
   verplaatst, verplaatst gedrag.

   Alles wat dit blok gebruikt komt uit de kern zelf en niet uit een tweede
   parameterlijst: die zou meteen uit de pas kunnen lopen met de eerste.
   ========================================================================== */
'use strict';

module.exports = function bouwKernAan(kern, grens) {
  const { db, save, crypto, schoon, sseToCustomer, accounts, anthropic,
    beveilig, fs, path, DATA_DIR, rtf, gidsHaal, keyVanCodenaam, leeftijdVan, leeftijdInstr } = kern;
  /* De logger RECHTSTREEKS uit ./log, niet via kern.logboek. Bij het verhuizen
     van dit blok uit server.js kwam `logboek` hier uit de kern -- en daar is
     `logboek` de onderhoudslogboek-lezer van de Rechterhand
     (kern/rechterhand/logboek.js), een functie zonder .log. `log` werd dus
     stilletjes undefined: geen fout, geen melding, maar zelfzorg draaide zijn
     wachtronde zonder foutenbron en gezondheidscheck ERR-01 stond daarmee
     permanent op groen -- een storingsgolf van 25 uitzonderingen kantelde het
     oordeel niet meer van 'ok' naar 'let op'. Rechtstreeks requiren kan niet
     botsen; ./log is een singleton (dezelfde die server.js gebruikt). */
  const { log } = require('../log');
  /* De School-Bibliotheek (kern/schoolbieb.js): per leeftijdsgroep 10.000
     school-apps, van kleuter tot universiteit; plus Samen voor de gezinsapps
     (kern/samenrtf.js): kindveilig meekijken binnen gezin en vrienden. */
  Object.assign(kern, require('../kern/schoolbieb').maakSchoolBieb({ db, save }));
  /* De Beroepen-Bibliotheek (kern/beroepenbieb): twee werelden van elk een
     miljoen leer-apps (technisch/agrarisch + bedrijfsleven), altijd gratis. */
  Object.assign(kern, require('../kern/beroepenbieb').maakBeroepenBieb({ db, save }));
  /* De bibliothecaris (kern/bibliothecaris.js): de AI-assistent van de echte
     RTG Bibliotheek; adviseert alleen apps die echt in de catalogi staan. */
  Object.assign(kern, require('../kern/bibliothecaris')({ appbieb: kern.appbieb, reisbieb: kern.reisbieb,
    rtfbieb: kern.rtfbieb, schoolbieb: kern.schoolbieb, beroepenbieb: kern.beroepenbieb, geloofbieb: kern.geloofbieb, anthropic, schoon }));
  require('../routes/bieb')(grens('bieb'));
  Object.assign(kern, require('../kern/samenrtf')({ db, save, crypto, schoon, zijnVrienden: kern.zijnVrienden }));
  require('../routes/rtfschool')(grens('rtfschool'));
  /* Samen (kern/samen.js): met vrienden meekijken en samen doen door het hele
     leden-OS; kamers op code, live seintjes via de SSE-stroom. */
  Object.assign(kern, require('../kern/samen')({ db, save, crypto, sseToCustomer, schoon }));
  /* De Residence (kern/residentie): het virtuele grandhotel -- zalen en eigen
     suites waar leden als pionnen op codenaam rondlopen en praten, live over
     het bestaande SSE-kanaal. */
  Object.assign(kern, require('../kern/residentie').maakResidentie({ db, save, schoon, sseToCustomer }));
  require('../routes/samen')(grens('samen'));
  require('../routes/baby')(grens('baby'));
  require('../routes/tiener')(grens('tiener'));
  require('../routes/welzijn')(grens('welzijn'));
  /* De zelfzorg (kern/zelfzorg): de code ruimt zichzelf op, beschermt zichzelf,
     repareert zichzelf en upgradet zichzelf. De knoppen staan in de boardroom en
     de kamers Intern & IT en Ingenieurs; de veilige delen draaien ook als stille
     automaat. Geld en klantdata blijven altijd mensenwerk (advies, geen ingreep). */
  Object.assign(kern, require('../kern/zelfzorg')({
    db, save, accounts, sessions: kern.sessions, beveilig, pay: kern.pay, bank: kern.bank,
    log, fs, path, DATA_DIR
  }));
  kern.zelfzorg.autoStart();
  /* De RTG AI van het RTG Kantoor (kern/rtgai.js): leest mee, traint zichzelf
     en meldt wanneer hij klaar is; het roer geven blijft een menselijke knop. */
  Object.assign(kern, require('../kern/rtgai')({ db, save, zelfzorgVan: () => kern.zelfzorg }));
  kern.rtgai.autoStart();
  /* De Onderzoeker (kern/rtgonderzoeker.js): de tweede AI van het RTG Kantoor,
     door de RTG AI gebouwd; doet agentisch onderzoek en adviseert alleen. */
  Object.assign(kern, require('../kern/rtgonderzoeker')({ db, save, crypto, schoon, anthropic }));
  require('../routes/rtgkantoor')(grens('rtgkantoor'));
  require('../routes/kantoren')(grens('kantoren'));
  /* RTG Command (kern/command/): de bestuurslaag van het RTG- en RTF-kantoor.
     Eén app over alle domeinen heen -- de puls, de zoekbalk over alles, het
     objectdossier, de operator die een opdracht in gewone taal tot een plan
     rekent, de runbooks, het beleidsregister met versies en het onveranderlijke
     journaal. Hij hangt NA kantoren omdat hij op dezelfde kantoordeur zit; hij
     leest verder alleen db.data, dus hij hoeft niet op een motor te wachten. */
  Object.assign(kern, { command: require('../kern/command').maakCommand({ db, save, crypto, anthropic }) });
  require('../routes/command')(grens('command'));
  require('../routes/gemeente')(grens('gemeente'));
  /* De Rijks-Bibliotheek (kern/rijksbieb.js): 10.000 werk-apps voor elke
     overheidsafdeling, inbegrepen voor rijksambtenaren; routes in overheid. */
  Object.assign(kern, require('../kern/rijksbieb').maakRijksBieb({ db, save }));
  require('../routes/overheid')(grens('overheid'));
  require('../routes/luchthaven')(grens('luchthaven'));
  require('../routes/marechaussee')(grens('marechaussee'));
  require('../routes/uitgifte')(grens('uitgifte'));
  require('../routes/sportclub')(grens('sportclub'));
  require('../routes/drm')(grens('drm'));
  require('../routes/pay')(grens('pay'));
  require('../routes/bank')(grens('bank'));
  require('../routes/bankhart')(grens('bankhart'));
  require('../routes/reis')(grens('reis'));
  require('../routes/thuis')(grens('thuis'));
  require('../routes/werkvloer')(grens('werkvloer'));
  require('../routes/regering')(grens('regering'));
  require('../routes/stad')(grens('stad'));
  require('../routes/podium')(grens('podium'));
  require('../routes/ghost')(grens('ghost'));
  require('../routes/flits')(grens('flits'));
  require('../routes/theater')(grens('theater'));
  require('../routes/wbw')(grens('wbw'));
  require('../routes/ov')(grens('ov'));
  require('../routes/navigatie')(grens('navigatie'));
  require('../routes/clips')(grens('clips'));
  /* De Media OS leest de vier media-domeinen; hij hangt daarom NA clips,
     theater en podium, en heeft aan de kern verder niets eigens. */
  require('../routes/mediaos')(grens('mediaos'));
  require('../routes/kantoorpakket')(grens('kantoorpakket'));
  require('../routes/mobiliteit')(grens('mobiliteit'));
  /* Het Foundation OS: steden, partnerstichtingen, projecten, vrijwilligers,
     geld, hulpvragen, meldingen en de portalen voor partner, gemeente en
     ondernemer (de kern staat al in kernlaag7). */
  require('../routes/rtfos')(grens('rtfos'));

  /* Deel twee -- identiteit, wonen, vervoer en clubs -- staat in ./aanbouw2.js.
     Gesplitst omdat een bestand van 9,5 kB in de waarschuwingsband van de
     omvangregel valt, en die band is precies wat er niet moet groeien. */
  require('./aanbouw2')(kern, grens);
};
