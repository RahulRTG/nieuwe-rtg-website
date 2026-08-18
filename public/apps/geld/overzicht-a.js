/* Stand Overzicht, deel 1a -- alleen de stijl van het command center.

   Stond in deel 1 en moest eruit toen dat bestand op 10,2 KB kwam (scripts/check.js
   regel 13). Dat is niet alleen een maatregel: de stijl van een paneel en het
   tekenwerk ervan zijn twee onderwerpen, en de een verandert veel vaker dan de
   ander. Deel 1 leest hem als Deel.ovcss; de bundel plakt dit deel er eerder in,
   want "overzicht-a.js" sorteert voor "overzicht.js". */
(function (w) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.ovcss =
    '#ovWrap .ov-start{margin:.4rem 0 1.1rem;}' +
    '#ovWrap .ov-groet{font-size:clamp(1.7rem,6vw,2.3rem);margin:0;}' +
    '#ovWrap .ov-staat{margin:.35rem 0 0;font-size:1rem;color:var(--rtg-soft);}' +
    '#ovWrap .ov-staat[data-aandacht]{color:var(--rtg-sig-aandacht);}' +
    '#ovWrap .ov-stil{margin:.5rem 0 0;font-size:.8rem;color:var(--rtg-sig-aandacht);}' +
    '#ovWrap .ov-cijfers{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));' +
      'gap:1rem;align-items:end;margin:1.2rem 0 .9rem;}' +
    '#ovWrap .ov-lbl{display:block;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;' +
      'color:var(--rtg-soft);margin-bottom:.3rem;}' +
    '#ovWrap .ov-getal{font-size:1.12rem;font-weight:500;}' +
    '#ovWrap .ov-rust{font-size:.92rem;line-height:1.6;color:var(--rtg-soft);max-width:38rem;margin:.2rem 0 1.1rem;}' +
    '#ovWrap .ov-vooruit{display:flex;gap:1.6rem;flex-wrap:wrap;margin:0 0 1.2rem;}' +
    '#ovWrap .ov-vsom{display:block;font-size:1rem;font-weight:500;}' +
    '#ovWrap .ov-vwoord{display:block;font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;' +
      'color:var(--rtg-soft);margin-top:.15rem;}' +
    '#ovWrap .ov-kaart{padding-left:1.15rem;}' +
    '#ovWrap .ov-rij{display:flex;align-items:center;justify-content:space-between;gap:.8rem;}' +
    '#ovWrap .ov-som{font-weight:600;}' +
    '#ovWrap .ov-titel{margin:.45rem 0 .2rem;font-size:.98rem;font-weight:600;}' +
    '#ovWrap .ov-uitleg{margin:0 0 .6rem;font-size:.86rem;line-height:1.55;color:var(--rtg-soft);}' +
    '#ovWrap .ov-waarom{background:none;border:0;padding:0;cursor:pointer;font:inherit;' +
      'font-size:.74rem;font-weight:600;color:var(--rtg-goud);}' +
    /* Het beleid-paneel (deel 3) hangt buiten #ovWrap en heeft daarom eigen
       scoping; het staat hier omdat een stand EEN stijlblad hoort te hebben
       en niet twee die elkaar in de head verdringen. */
    '#paneel .ov-vraagrij{display:flex;gap:.6rem}#paneel .ov-vraagrij input{flex:1;min-width:0}' +
    '#paneel #ovBeleidKnop{margin:1.4rem 0 .6rem}' +
    '#paneel .ov-regel{display:flex;align-items:center;justify-content:space-between;' +
      'padding:.45rem 0;border-top:1px solid var(--rtg-line)}' +
    '#paneel .ov-doe{display:flex;flex-wrap:wrap;gap:.5rem;margin:.4rem 0 1rem}' +
    '#paneel .ov-doe input,#paneel .ov-doe select{flex:1;min-width:7rem}' +
    '#ovWrap .ov-standen{display:flex;flex-wrap:wrap;gap:.1rem 1rem;margin-top:1.8rem;' +
      'padding-top:.75rem;border-top:1px solid var(--rtg-line);}' +
    /* padding en geen min-height: met min-height komt de tekst boven in een
       hoger vak te staan, met padding blijft hij in het midden van zijn
       raakvlak. 17,8px regel plus tweemaal 4 is 25,8 -- over de 24 van
       WCAG 2.5.8, en de rij herschikt niet. */
    '#ovWrap .ov-standen a{font-size:.74rem;color:var(--rtg-soft);text-decoration:none;' +
      'display:inline-block;padding:4px 0;}' +
    '#ovWrap .ov-standen a:hover,#ovWrap .ov-standen a:focus-visible{color:var(--rtg-txt);}';
})(window);
