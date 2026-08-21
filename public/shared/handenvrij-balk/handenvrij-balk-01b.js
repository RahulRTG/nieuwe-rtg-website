/* Muisvrij bedienen, deel 2a: WAAR DE BALK VAN GEMAAKT IS.

   Afgesplitst van handenvrij-balk-01.js, dat met deze stijl over de 10 KB uit
   regel 13 van scripts/check.js ging. De snede loopt langs een echte grens:
   hiernaast staat wat de balk DOET, hier staat waar hij van gemaakt is. Ze
   delen alleen de naam .hv-balk.

   Deze delen worden aaneengeplakt tot EEN IIFE (scripts/bundel.js), dus dit
   bestand staat middenin die functie en opent er zelf geen. */
  /* DE BALK IS VAN ONYXGLAS MET EEN GOUDEN HAARLIJN.

     Hier stond een strook: volle breedte, plat tegen de onderrand, een harde
     gouden bovenlijn, en daarin een invoerveld met een eigen kader (#333) en
     knoppen met een eigen kader (#444). Drie randen boven elkaar, twee grijzen
     die nergens uit het merk komen, en een vorm die niets deelt met de rest van
     het huis. Naast de werktafel las hij als een balk uit een andere app.

     Wat er nu staat is HETZELFDE MATERIAAL als de console van RTG Command
     (shared/command.css): een zwevende bak van onyxglas, een haarlijn van
     champagnegoud, en licht dat er langs de bovenrand invalt. Een materiaal,
     geen kleur -- zie MATERIAAL.md. De tokens komen uit rtg-materiaal.css en
     hebben allemaal een terugval, want deze balk hangt ook op pagina's die die
     laag niet laden.

     Het veld heeft daarbinnen GEEN eigen kader meer. Een doos in een doos is de
     stapeling waar ONTWERP.md par. 1 over gaat; wat een invoerveld is, blijkt
     uit de cursor en de plaatshouder, niet uit een tweede rand. */
  var css = '.hv-balk{position:fixed;left:12px;right:12px;z-index:38;display:flex;gap:.45rem;align-items:center;' +
    'bottom:calc(12px + env(safe-area-inset-bottom,0px));padding:.4rem .4rem .4rem .55rem;border-radius:22px;' +
    'font-family:var(--rtg-interface,Inter,system-ui,sans-serif);' +
    'border:1px solid color-mix(in srgb,var(--gold-tekst,#C0A544) 24%,rgba(255,255,255,.1));' +
    'background:linear-gradient(145deg,rgba(28,25,24,.84),rgba(5,5,5,.78));' +
    'backdrop-filter:blur(30px) saturate(1.08);-webkit-backdrop-filter:blur(30px) saturate(1.08);' +
    'box-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 -1px 0 rgba(192,165,68,.09) inset,0 14px 38px rgba(0,0,0,.34);}' +
    '.hv-balk form{display:flex;gap:.45rem;flex:1;min-width:0;align-items:center;margin:0;}' +
    /* HET VELD IS LETTERLIJK DAT VAN DE CONSOLE (.cmd-ai-in in command.css).

       Eerst stond hier een veld zonder kader -- mooier op zichzelf, maar het
       huis heeft al een vraagveld voor Rahul en dat draagt wel een kader. Twee
       bijna-gelijke velden naast elkaar is precies de stapeling waar ONTWERP.md
       par. 1 over gaat, dus dit is er een.

       De !important-en zijn niet van mij maar van dat veld: rtg-ui.css geeft
       ELKE input in dit huis een eigen oppervlak, rand en binnenschaduw, met een
       selector die zwaarder weegt dan een klasse. De console gebruikt dezelfde
       uitweg, en twee keer dezelfde uitzondering is beter dan twee vormen. */
    '.hv-balk input{flex:1;min-width:0;height:38px!important;padding:0 .85rem!important;' +
    'background:rgba(5,5,5,.42)!important;border:1px solid var(--rtg-line,rgba(255,255,255,.09))!important;' +
    'border-radius:13px!important;color:var(--rtg-txt,#F4F0E9)!important;' +
    'font:400 .84rem var(--rtg-interface,Inter,system-ui,sans-serif)!important;' +
    'box-shadow:0 2px 7px rgba(0,0,0,.3) inset!important;}' +
    '.hv-balk input::placeholder{color:var(--rtg-soft,rgba(244,240,233,.56));}' +
    '.hv-balk input:focus-visible,.hv-k:focus-visible{outline:2px solid var(--gold-tekst,#C0A544);outline-offset:2px;}' +
    /* De knoppen moeten op een telefoon van 390px naast het veld passen; met
       drie woorden erin liep de rij het beeld uit. Vandaar een pijl voor sturen
       (zoals in de metgezel) en korte woorden voor de twee schakelaars. */
    '.hv-k{background:transparent;border:1px solid var(--rtg-line,rgba(255,255,255,.09));border-radius:999px;' +
    'color:var(--rtg-muted,rgba(244,240,233,.72));font:500 .72rem/1 inherit;' +
    'padding:.5rem .7rem;cursor:pointer;white-space:nowrap;flex:0 0 auto;' +
    'transition:color 140ms,border-color 140ms,background 140ms;}' +
    '.hv-k:hover{color:var(--rtg-txt,#F4F0E9);background:rgba(255,255,255,.04);}' +
    /* Sturen is de enige knop met autoriteit, dus de enige die goud MAG zijn
       (ONTWERP.md par. 4). Een schijf en geen pil: hij doet een ding. */
    '.hv-go{width:34px;height:34px;padding:0;border:0;border-radius:50%;font-size:.95rem;line-height:1;' +
    'display:flex;align-items:center;justify-content:center;color:#0C0C0B;' +
    'background:var(--gold-glans,linear-gradient(145deg,#C0A544,#857007));}' +
    '.hv-go:hover{background:var(--gold-glans,linear-gradient(145deg,#C0A544,#857007));filter:brightness(1.08);}' +
    '.hv-k[aria-pressed="true"]{background:rgba(192,165,68,.14);color:var(--gold-tekst,#C0A544);' +
    'border-color:color-mix(in srgb,var(--gold-tekst,#C0A544) 42%,transparent);}' +
    '.hv-k.hv-hoort{background:rgba(158,28,64,.22);color:#E36385;border-color:rgba(158,28,64,.5);}' +
    /* Weggelegd tot je hem oproept. Deze strook stond op ELK scherm onderaan,
       altijd, en was daarmee de grootste vaste knoppenrij van het huis --
       terwijl hij hetzelfde doet als Rahul: zeggen of typen wat er moet
       gebeuren. Je haalt hem nu van de onderrand omhoog (shared/randen.js),
       net als het bedieningspaneel van de bovenrand. Escape legt hem weg.
       Zolang hij weg is neemt hij ook geen ruimte meer in (hv-ruimte). */
    '.hv-balk.hv-weg,.hv-werk.hv-weg,.hv-chat.hv-weg{display:none;}' +
    'body.hv-ruimte{padding-bottom:3.6rem;}' +
    'body.hv-opgeruimd{padding-bottom:0;}' +
    '@media (prefers-reduced-motion: reduce){.hv-balk{backdrop-filter:none;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
