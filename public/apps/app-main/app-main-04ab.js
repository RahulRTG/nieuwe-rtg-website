    /* Vervolg van app-main-04: de compositieregels van de poort (een kolom:
       klok, lippen, aanspreking, veld). Geknipt omdat deel 04 opnieuw over de
       10 KB-grens ging. De knip ligt midden in een stringconcatenatie -- deel
       04 eindigt op een + en dit deel maakt hem af; de bundel plakt 04, 04ab,
       04a en 04b weer aaneen tot exact hetzelfde bestand. */
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
      /* Schaal 1 op een telefoon: daar is de klok al bijna schermbreed en
         duwt elke vergroting het invoerveld uit beeld -- de actie hoort altijd
         zichtbaar te blijven. Op een breed scherm is er wel ruimte. */
      '#gate .os-lock{transform:scale(var(--klokschaal,1));transform-origin:center;margin:0;}' +
      /* de lippen sluiten AAN op de klok: Rahul komt eruit, hij zweeft er niet
         tientallen pixels onder */
      '#gate .ag-mond{margin:-0.6rem auto 0.2rem;width:min(52vw,240px);height:auto;}' +
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
         onderaan, buiten de kolom, waar hij de compositie niet meer breekt. */
      '#gate ~ .rtgcookie,.rtgcookie{position:fixed;left:50%;transform:translateX(-50%);' +
        'bottom:1rem;z-index:60;max-width:min(92vw,26rem);}' +
