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

module.exports = function bouwKernAan(kern) {
  const { db, save, crypto, schoon, sseToCustomer, accounts, anthropic,
    beveilig, logboek, fs, path, DATA_DIR, rtf, gidsHaal, keyVanCodenaam, leeftijdVan, leeftijdInstr } = kern;
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
  require('../routes/bieb')(kern);
  Object.assign(kern, require('../kern/samenrtf')({ db, save, crypto, schoon, zijnVrienden: kern.zijnVrienden }));
  require('../routes/rtfschool')(kern);
  /* Samen (kern/samen.js): met vrienden meekijken en samen doen door het hele
     leden-OS; kamers op code, live seintjes via de SSE-stroom. */
  Object.assign(kern, require('../kern/samen')({ db, save, crypto, sseToCustomer, schoon }));
  /* De Residence (kern/residentie): het virtuele grandhotel -- zalen en eigen
     suites waar leden als pionnen op codenaam rondlopen en praten, live over
     het bestaande SSE-kanaal. */
  Object.assign(kern, require('../kern/residentie').maakResidentie({ db, save, schoon, sseToCustomer }));
  require('../routes/samen')(kern);
  require('../routes/baby')(kern);
  require('../routes/tiener')(kern);
  require('../routes/welzijn')(kern);
  /* De zelfzorg (kern/zelfzorg): de code ruimt zichzelf op, beschermt zichzelf,
     repareert zichzelf en upgradet zichzelf. De knoppen staan in de boardroom en
     de kamers Intern & IT en Ingenieurs; de veilige delen draaien ook als stille
     automaat. Geld en klantdata blijven altijd mensenwerk (advies, geen ingreep). */
  Object.assign(kern, require('../kern/zelfzorg')({
    db, save, accounts, sessions: kern.sessions, beveilig, pay: kern.pay, bank: kern.bank,
    log: logboek.log, fs, path, DATA_DIR
  }));
  kern.zelfzorg.autoStart();
  /* De RTG AI van het RTG Kantoor (kern/rtgai.js): leest mee, traint zichzelf
     en meldt wanneer hij klaar is; het roer geven blijft een menselijke knop. */
  Object.assign(kern, require('../kern/rtgai')({ db, save, zelfzorgVan: () => kern.zelfzorg }));
  kern.rtgai.autoStart();
  /* De Onderzoeker (kern/rtgonderzoeker.js): de tweede AI van het RTG Kantoor,
     door de RTG AI gebouwd; doet agentisch onderzoek en adviseert alleen. */
  Object.assign(kern, require('../kern/rtgonderzoeker')({ db, save, crypto, schoon, anthropic }));
  require('../routes/rtgkantoor')(kern);
  require('../routes/kantoren')(kern);
  require('../routes/gemeente')(kern);
  /* De Rijks-Bibliotheek (kern/rijksbieb.js): 10.000 werk-apps voor elke
     overheidsafdeling, inbegrepen voor rijksambtenaren; routes in overheid. */
  Object.assign(kern, require('../kern/rijksbieb').maakRijksBieb({ db, save }));
  require('../routes/overheid')(kern);
  require('../routes/luchthaven')(kern);
  require('../routes/marechaussee')(kern);
  require('../routes/uitgifte')(kern);
  require('../routes/sportclub')(kern);
  require('../routes/drm')(kern);
  require('../routes/pay')(kern);
  require('../routes/bank')(kern);
  require('../routes/bankhart')(kern);
  require('../routes/reis')(kern);
  require('../routes/thuis')(kern);
  require('../routes/werkvloer')(kern);
  require('../routes/regering')(kern);
  require('../routes/stad')(kern);
  require('../routes/podium')(kern);
  require('../routes/ghost')(kern);
  require('../routes/flits')(kern);
  require('../routes/theater')(kern);
  require('../routes/wbw')(kern);
  require('../routes/ov')(kern);
  require('../routes/navigatie')(kern);
  require('../routes/clips')(kern);
  require('../routes/kantoorpakket')(kern);

  /* Deel twee -- identiteit, wonen, vervoer en clubs -- staat in ./aanbouw2.js.
     Gesplitst omdat een bestand van 9,5 kB in de waarschuwingsband van de
     omvangregel valt, en die band is precies wat er niet moet groeien. */
  require('./aanbouw2')(kern);
};
