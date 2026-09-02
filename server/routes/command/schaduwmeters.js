/* Command (deelmodule): DE SCHADUWMETERS -- wat zou er zijn gebeurd?

   Uit ./meten.js geknipt op de 10 kB-grens, en op een echte naad: deze twee
   meters gaan niet over hoe het huis DRAAIT (dat is de rest van meten.js) maar
   over een regel die nog NIET wordt afgedwongen. CONTROLPLANE.md schrijft die
   volgorde voor -- je kunt niet afdwingen wat nooit in de schaduw heeft
   gelopen -- en dus staat hier een tweede soort getal: niet wat er gebeurde,
   maar wat er gebeurd ZOU zijn.

   Ze horen bij elkaar omdat een mens ze samen leest. Bij allebei is de vraag
   dezelfde: is er genoeg langsgekomen om de stand te durven omzetten? En bij
   allebei geldt dezelfde beperking, die in het antwoord zelf staat: de tellers
   lopen per werkproces en beginnen opnieuw bij een herstart. Dit huis draait er
   meerdere, dus dit is een steekproef en geen totaal -- en wie hem als totaal
   leest, telt te laag. Dat is de gevaarlijke kant, want te laag lijkt "nog niet
   klaar" terwijl het "niet gemeten" is. */
module.exports = (ctx) => {
  const { app, officeAuth, veilig, bezitsbewijs, doelpoort } = ctx;

  /* DE SCHADUWMETER VAN HET BEZITSBEWIJS (MIJNRTG.md blok 4).

     Waarom hier: dit is een meting en geen instelling. Er staat dan ook GEEN
     route naast om de stand aan te zetten -- dat gebeurt met RTG_BEZITSBEWIJS
     bij het opstarten, en dat is bewust een besluit van wie de omgeving beheert
     en niet iets dat een kantoorsessie even omzet. Een knop die stilletjes de
     betalingen van elk gebonden lid kan weigeren, hoort niet naast een grafiek
     te staan.

     Het antwoord draagt zijn eigen beperking mee (`nietGemeten`): de tellers
     lopen per werkproces en beginnen opnieuw bij een herstart. Dit huis draait
     er meerdere, dus dit is een steekproef. Wie hem als totaal leest, telt te
     laag -- en dat is de gevaarlijke kant, want te laag lijkt "nog niet klaar". */
  app.post('/api/command/bezitsbewijs', officeAuth, (req, res) => veilig(res, () =>
    (bezitsbewijs ? bezitsbewijs.stand()
      : { nietGebouwd: 'De bezitsbewijslaag draait niet in dit proces.' })));

  /* DE DOELBINDING, en hij staat hier om dezelfde reden als het bezitsbewijs
     hierboven: hij loopt in de schaduw, en zonder een plek waar een mens ziet
     WAT er zou zijn geweigerd, blijft die schaduw voor altijd staan.

     Let op de vorm van het antwoord: er staat geen oordeel bij. `vaakstGeweigerd`
     is een werklijst en geen verwijt -- een doel dat vaak weigert kan een
     verkeerd ingerichte aanroep zijn of juist een grens die zijn werk doet, en
     dat verschil kan deze laag niet zien. Dat hoort een mens te bekijken. */
  app.post('/api/command/doelbinding', officeAuth, (req, res) => veilig(res, () =>
    (doelpoort ? doelpoort.meter()
      : { nietGebouwd: 'De doelpoort draait niet in dit proces.' })));
};
