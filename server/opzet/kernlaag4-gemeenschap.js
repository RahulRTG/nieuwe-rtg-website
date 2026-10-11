/* DE KERN SAMENSTELLEN -- deel 4, de gemeenschapslaag.

   Geknipt uit ./kernlaag4.js omdat dat bestand over de omvanggrens van dit huis
   stond en elke nieuwe gemeenschapsmodule (verbond, beraad, drager) er een paar
   regels bij moest zetten -- en over de grens mag je repareren, niet uitbreiden.
   De naad is echt: alles hieronder hoort bij het genootschap en wat erop draait,
   en niets anders. Het wordt vanuit kernlaag4 aangeroepen op de plek waar het
   stond, want de volgorde is inhoudelijk: na Metier, voor de Berichten-app.

   Wat `kern` en `hulp` zijn: zie de kop van ./kernlaag1.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { anthropic, db, keyVanCodenaam, liveCodename, notify, save } = hulp;

  /* Genootschap (kern/genootschap/): besloten groepen van leden, met een prikbord
     en bijeenkomsten. Bewust een EIGEN app en geen verbouwing van Cercle (het
     register van je societeiten) of Rendez-vous (de datingdienst van de Lifestyle
     Pass); zie de kop van kern/genootschap/index.js voor waarom. */
  kern.genootschap = require('../kern/genootschap')({ db, save, codenaamVan: kern.codenaamVan,
    keyVanCodenaam, liveCodename, notify, zijnVrienden: kern.zijnVrienden });
  kern.genootschapBeheer = require('../kern/genootschap/beheer')({ save, codenaamVan: kern.codenaamVan,
    keyVanCodenaam, genootschap: kern.genootschap });
  kern.prikbord = require('../kern/genootschap/prikbord')({ db, save, codenaamVan: kern.codenaamVan,
    liveCodename, notify, genootschap: kern.genootschap });
  kern.bijeenkomst = require('../kern/genootschap/bijeenkomst')({ db, save, codenaamVan: kern.codenaamVan,
    notify, genootschap: kern.genootschap });
  // de AI-laag krijgt een bevroren leesweergave, nooit de modules met hun schrijffuncties
  const { leesweergave } = require('../kern/genootschap/leesweergave');
  kern.genootschapAI = require('../kern/genootschap/ai')({ anthropic,
    lees: leesweergave({ genootschap: kern.genootschap, prikbord: kern.prikbord, bijeenkomst: kern.bijeenkomst }) });
  kern.genootschapInzicht = require('../kern/genootschap/inzicht')({ db, save, genootschap: kern.genootschap,
    prikbord: kern.prikbord, bijeenkomst: kern.bijeenkomst });
  kern.genootschapUitvoer = require('../kern/genootschap/uitvoer')({ genootschap: kern.genootschap,
    codenaamVan: kern.codenaamVan });
  /* Het verbond (kern/verbond/): een afspraak tussen twee genootschappen. Het
     krijgt het genootschap om te VRAGEN wie lid of beheerder is, en bezit zelf
     geen leden (GEMEENSCHAP-FASE0.md par. 4.2). */
  kern.verbond = require('../kern/verbond')({ db, save, notify, genootschap: kern.genootschap });
};
