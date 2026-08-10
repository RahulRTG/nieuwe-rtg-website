    /* Vervolg van app-main-04: de compositieregels van de poort (een kolom:
       klok, lippen, aanspreking, veld). Geknipt omdat deel 04 opnieuw over de
       10 KB-grens ging. De knip ligt midden in een stringconcatenatie -- deel
       04 eindigt op een + en dit deel maakt hem af.

       DE VOLGORDE IS DE BESTANDSNAAM. bundel.js plakt de delen in de volgorde
       van readdirSync().sort(), dus puur alfabetisch: 04, 04a, 04ab, 04b. Deze
       regels stonden een commit lang in 04ab, DUS na de `document.head
       .appendChild(st);` die 04a afsloot -- waarmee ze een losse expressie
       werden die JavaScript netjes uitrekent en weggooit. Geen syntaxfout,
       geen consolemelding, en de halo, de klokschaal en de uitlijning van de
       zin waren simpelweg weg terwijl de code er nog stond.
       controleer() kon dat niet zien: die vergelijkt de bundel met dezelfde
       som van dezelfde delen en is dus per definitie consistent met zichzelf.
       Wat het nu wel ziet, is toets 43 in scripts/check.js. */
      /* DE COMPOSITIE. Dit scherm had vijf objecten die allemaal ongeveer even
         belangrijk waren -- klok, lippen, zin, invoerveld, koekjesmelding --
         met grote lege vlakken ertussen die niets deden. Leegte in een premium
         ontwerp is bewust; dit was leegte omdat de inhoud niet wist waar hij
         moest staan.
         Nu is het EEN verticale kolom met een duidelijke rangorde: de klok is
         de identiteit en de held, Rahul komt er direct onder uit, en daaronder
         staat de actie. Alles daaronder is bijzaak. */
      '#gate{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:0;padding:6vh 1.1rem;}' +
      /* DE POORT IS ALTIJD NACHT, ook onder een licht thema.
         Dit scherm is een sterrenhemel; dat is niet een van de vier smaken
         maar wat het scherm IS. Toen de thema's platformbreed gingen, zette
         champagne netjes zijn donkere inkt op de body -- en die inkt landde op
         een invoerveld dat op een zwarte hemel ligt. Gemeten: 1,11:1. Niet
         "wat flets": onzichtbaar.
         De poort verklaart daarom zijn eigen materiaal (onyx) en laat het
         thema alleen los op wat er OP die hemel ligt: de wijzerplaat van de
         klok. Een lichte wijzerplaat tegen een nachthemel is precies wat een
         horloge met een wit blad 's avonds doet. */
      '#gate{color:var(--op-onyx);' +
        '--rtg-txt:var(--op-onyx);--txt:var(--op-onyx);' +
        '--rtg-muted:rgba(244,240,233,0.72);--rtg-soft:rgba(244,240,233,0.56);' +
        '--muted:rgba(244,240,233,0.72);--soft:rgba(244,240,233,0.56);}' +
      '#gate input,#gate textarea{color:inherit;}' +
      /* DE HALO. De sterren waren overal even druk, ook precies daar waar de
         klok en de tekst staan -- en dan moet het oog zelf uitzoeken wat het
         onderwerp is. Een zachte donkere ovaal achter de kolom maakt het daar
         stil, zodat de klok vanzelf naar voren komt. Geen vlak en geen kader:
         een verloop dat aan de randen volledig verdwijnt, zodat je hem niet
         als vorm ziet maar alleen als rust. */
      '#gate::after{content:"";position:absolute;left:50%;top:50%;' +
        'width:min(150vw,1100px);height:min(120vh,1000px);' +
        'transform:translate(-50%,-50%);pointer-events:none;z-index:0;' +
        'background:radial-gradient(ellipse at center,' +
          'rgba(0,0,0,0.62) 0%,rgba(0,0,0,0.45) 32%,rgba(0,0,0,0.18) 58%,rgba(0,0,0,0) 78%);}' +
      /* de klok groeit: hij is letterlijk het merk, en stond op een zesde van
         de hoogte alsof hij een illustratie was */
      '#gate .os-lock{margin:0;}' +
      /* SCHALEN MET TRANSFORM, niet met width/height. De klok tekent zijn
         wijzers, het merkje en de datumvensters op VASTE posities binnen zijn
         eigen maat; zet je die maat om, dan verschuift het draaipunt en staat
         alles scheef -- precies wat er gebeurde toen ik hem groter maakte.
         transform schaalt het hele beeld uniform, dus de geometrie blijft heel. */
      /* Schaal op de telefoon: 1,2. Hij stond op 1 omdat elke vergroting het
         invoerveld uit beeld duwde -- maar dat was toen de koekjesmelding nog
         een kaart van 160px was. Nu die een regel van 26px is, past het wel,
         en de kolom vulde met schaal 1 maar 51% van de hoogte terwijl de
         opzet 70 a 80% vraagt. Gemeten op 430 en op 375 breed. */
      '#gate{--klokschaal:1.2;}' +
      /* En de indeling moet de GESCHAALDE maat reserveren. Een transform tekent
         groter maar verandert de doos niet: op 1,5x groeide de klok 73px naar
         boven en 73px naar beneden buiten zijn eigen vak, en de lippen -- die
         netjes 10px onder de rand horen te zitten, en dat op een telefoon ook
         deden -- kwamen op een breed scherm midden op de wijzerplaat te liggen.
         Gemeten, niet gegokt: telefoon klok 201-494 met mond op 484 (goed),
         breed klok 98-537 met mond op 454 (83px de plaat in).
         Daarom draagt het vak zelf de hoogte, en schaalt de ring erin. */
      '#gate .os-lock{display:flex;align-items:center;justify-content:center;padding:0;margin:0;' +
        'height:calc(var(--rtg-klok-maat,16rem) * var(--klokschaal,1));transform:none;}' +
      '#gate .os-lock > .rtg-ring{transform:scale(var(--klokschaal,1));transform-origin:center;}' +
      /* de lippen sluiten AAN op de klok: Rahul komt eruit, hij zweeft er niet
         tientallen pixels onder */
      /* DE MOND HOORT BIJ DE KLOK, dus meet hij zich aan de klok en niet aan
         het venster. Met min(52vw,240px) was hij op een telefoon 224 breed
         onder een klok van 256 (verhouding 0,87) en op een breed scherm 240
         onder een klok van 384 (0,63) -- dezelfde mond, twee verhoudingen.

         En het optrekken gebeurt met de LEEGTE VAN HET DOEK erin verrekend:
         de tekening vult verticaal ongeveer 46% van haar canvas, dus boven de
         inkt zit ruim een kwart niets. Trek je alleen de doos op, dan sluit
         de doos aan en de tekening niet -- precies het gat dat hier zat. */
      '#gate .ag-mond{--mondbreed:calc(var(--rtg-klok-maat,16rem) * var(--klokschaal,1) * 0.875);' +
        'width:var(--mondbreed);height:auto;' +
        'margin:calc(var(--mondbreed) * -0.125) auto 0.2rem;}' +
      // de zin is de aanspreking en geen onderschrift
      /* margin-inline:auto, anders staat de zin 43px links van de as. De doos
         is een flexkolom met align-items:stretch, dus een kind met een
         max-width blijft aan de linkerrand plakken -- gemeten, niet gegokt. */
      '#gate .ag-zin{font-size:clamp(1.35rem,5.2vw,1.9rem);line-height:1.3;' +
        'min-height:0;padding:0.5rem 0 1.1rem;max-width:22ch;margin-inline:auto;}' +
      // het invoerveld is de actie: breed en royaal, geen streepje
      /* EEN rand, niet twee. De rij had al een border-bottom uit de basisstijl;
         daar een volledige rand overheen leggen gaf een dubbele doos met een
         verspringende binnenrand. Eerst de oude weg, dan de nieuwe. */
      /* EEN doos, en symmetrisch. De rij droeg mijn ring en het invoerveld
         binnenin had zijn EIGEN achtergrond, rand en radius -- vandaar de
         dubbele doos met een binnenvlak dat 8px uit het midden lag. De rij
         draagt nu het kader, het veld erin is kaal. De padding was ook
         asymmetrisch (0,9rem links tegen 0,5rem rechts). */
      '#gate .ag-rij{width:min(100%,30rem);min-height:58px;border:0;' +
        'box-shadow:inset 0 0 0 1px var(--line);border-radius:14px;' +
        'margin-inline:auto;padding:0 0.9rem;}' +
      '#gate .ag-rij:focus-within{box-shadow:inset 0 0 0 1px var(--burgundy);}' +
      '#gate .ag-rij input{background:none;border:0;border-radius:0;box-shadow:none;}' +
      '#gate .ag-rij input{font-size:1rem;padding:1rem 0.4rem;text-align:left;}' +
      /* de koekjesmelding hoort niet MIDDEN in de kennismaking. Hij zweeft
         onderaan, buiten de kolom, waar hij de compositie niet meer breekt.

         Deze regel stond er als `.rtgcookie` -- een klasse die nergens
         bestaat. Het element heet `#rtg-cookie` (shared/cookie.js) en zet zijn
         eigen positie al: vast, onderaan, gecentreerd. Er viel dus niets te
         verplaatsen, en het commentaar hierboven beschreef een verhuizing die
         nooit heeft plaatsgevonden. Wat er ECHT misging is iets anders: de
         melding ligt met z-index 9999 over het invoerveld heen, en dan is de
         enige actie op het scherm onbereikbaar tot je hem wegklikt.
         De kolom houdt daarom ruimte vrij zolang de melding er staat, en niet
         langer -- `:has()` volgt het element vanzelf als hij verdwijnt. */
      'body:has(#rtg-cookie) #gate{padding-bottom:calc(6vh + 3rem);}' +
