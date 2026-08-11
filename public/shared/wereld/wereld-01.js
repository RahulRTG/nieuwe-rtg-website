/* DE LEVENDE WERELD -- het beginscherm als ruimte in plaats van een rooster.

   WAAROM DIT BESTAAT. Het beginscherm toonde acht tegels boven een klok. Dat
   werkt, en het is volstrekt inwisselbaar: elk toestel ter wereld opent met een
   rooster met icoontjes, dus het rooster zegt niets over wie dit huis is. Wat
   wel eigen is, stond er al -- de klok. Die is hier geen widget meer maar de
   KERN: de acht werelden hangen als merken op een bezel om hem heen, je DRAAIT
   eraan om te reizen, en je stapt een wereld binnen zonder de cirkel te
   verlaten.

   WAT DIT BESTAND NIET WEET, EN NIET MAG WETEN. De werelden zelf staan in
   MAPPEN (apps/app-main/app-main-24a2.js) -- dat is de enige lijst, en hij
   bepaalt ook de rasterstand. Deze module krijgt ze aangereikt en houdt geen
   eigen kopie (LAT.md regel 4). Ze weet ook niet hoe je een app opent: dat doet
   de aanroeper, want die kent openItem() al. Wie hier een tweede lijst werelden
   of een tweede navigatiepad ziet ontstaan, heeft de fout te pakken die dit
   commentaar probeert te voorkomen.

   DE BEDIENING, en elk gebaar heeft een toets-equivalent -- dit scherm is de
   voordeur, dus het mag nooit alleen met een vinger te bedienen zijn:

     slepen over de ring   reizen naar een andere wereld
     pijl links / rechts   idem, een wereld per aanslag
     tik op een merk       reizen ernaartoe; nog een tik opent de wereld
     tik op de klok        INZOOMEN: de merken worden de onderdelen van deze
                           wereld, in dezelfde cirkel
     tik op de klok (diep) weer uitzoomen
     lang drukken / w      het Command Wheel: Regel, Zoek, Analyseer, Maak,
                           Automatiseer
     Escape                uitzoomen, of het wiel sluiten

   BEWEGING IS EEN VOORKEUR, GEEN VERSIERING. Alles wat hier beweegt leest
   window.RTGBeweging (de schuif "Beweging" in het bedieningspaneel) en
   prefers-reduced-motion. Op stil staat de wereld stil -- hij blijft volledig
   bedienbaar, er beweegt alleen niets meer. */
(function (w) {
  'use strict';
  if (w.RTGWereld) return;

  var d = w.document;
  var RUSTIG = false;
  try { RUSTIG = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* De acht standen op de bezel. Ze staan hier als HOEK en niet als lijst
     werelden: hoeveel werelden er zijn bepaalt de aanroeper, en de ring rekent
     zijn verdeling daaruit uit. Zet iemand er ooit een negende bij, dan klopt
     de bezel vanzelf -- dat is het verschil tussen een verdeling en acht
     overgetikte hoeken. */
  var st = {
    aan: false,          // staat de wereldstand aan?
    werelden: [],        // wat de aanroeper aanreikte
    actief: 0,           // wat er op twaalf uur staat, geteld IN DE HUIDIGE RING
    wereldIdx: 0,        // in welke wereld we zijn ingezoomd (alleen als diep)
    diep: false,         // staan we IN een wereld (ingezoomd)?
    hoek: 0,             // waar de ring nu staat, in graden
    doel: 0,             // waar hij heen eased
    merken: [],          // de knoppen op de ring
    gesleept: false,     // is de laatste aanraking een sleep geweest? (dan geen tik)
    haak: null           // de rAF-lus, als hij loopt
  };

  // de aanroeper vult deze in via start(); zonder aanroeper doet de module niets
  var api = { openUrl: null, openDeel: null, zegRahul: null };

  /* Waar de ring naar kijkt. Bovenin zijn dat de werelden; ingezoomd zijn het
     de onderdelen van EEN wereld. Twee tellingen die makkelijk door elkaar
     lopen, dus ze hebben elk een eigen veld: st.actief telt in de ring die je
     NU ziet, st.wereldIdx onthoudt waar je in bent gestapt. Eén teller voor
     allebei leek korter en gaf een ring die na uitzoomen op de verkeerde
     wereld stond. */
  function ringItems() {
    if (!st.werelden.length) return [];
    if (!st.diep) return st.werelden;
    return (st.werelden[st.wereldIdx] && st.werelden[st.wereldIdx].delen) || [];
  }
  function huidige() { return ringItems()[st.actief] || null; }

  /* ---------- de kring bouwen ----------
     Hij komt in het vak waar de klok al stond (.os-klokvak) en neemt de klok
     op in zijn midden. DEZELFDE klok: er wordt er geen tweede gemaakt, want dan
     zou de tijd op twee plekken vandaan komen en op een dag uit elkaar lopen.
     De rasterstand krijgt hem zo ook gewoon terug als je terugschakelt. */
  var el = { vak: null, scherm: null, klok: null, kring: null, bezel: null, boog: null,
    kern: null, naam: null, sub: null, wiel: null, rahul: null, grond: null };

  function bouwKring() {
    if (el.kring) return el.kring;

    var kring = d.createElement('div');
    kring.className = 'os-wereldkring';
    kring.setAttribute('data-diep', 'nee');

    /* De bezel: een fijne gouden haarlijn met streepjes, en op twaalf uur het
       vaste merkteken. Dat teken staat STIL en de ring draait eronderdoor --
       zo lees je de stand af aan een vast punt, net als op een horloge. Een
       meedraaiende wijzer zou je juist laten zoeken. */
    var bezel = d.createElement('div');
    bezel.className = 'os-bezel';
    bezel.setAttribute('aria-hidden', 'true');
    bezel.innerHTML =
      '<svg viewBox="0 0 100 100" fill="none">' +
        '<circle cx="50" cy="50" r="41" stroke="var(--line)" stroke-width="0.4"/>' +
        '<g class="os-bezel-boog"></g>' +
        // het merkteken op twaalf uur: een korte gouden streep met een punt
        '<path d="M50 4.6 L50 9.4" stroke="var(--gold)" stroke-width="1" stroke-linecap="round"/>' +
        '<circle cx="50" cy="12.4" r="0.9" fill="var(--gold)"/>' +
      '</svg>';
    kring.appendChild(bezel);

    el.vak.insertBefore(kring, el.klok);
    kring.appendChild(el.klok);           // de klok verhuist naar het midden

    el.kring = kring;
    el.bezel = bezel;
    el.boog = bezel.querySelector('.os-bezel-boog');
    return kring;
  }

  /* De naam van de wereld waar je staat, en eronder EEN geteld feit. Geen
     verzonnen stand: CANVAS.md is er hard over dat een stand die niet gemeten
     kan worden, niet getoond hoort te worden. Wat we wel weten is hoeveel
     onderdelen deze wereld voor JOUW pas draagt, en dat staat er dan ook. */
  function bouwNaam() {
    if (el.naam) return;
    var naam = d.createElement('p');
    naam.className = 'os-wereld-naam';
    naam.id = 'osWereldNaam';
    naam.setAttribute('role', 'status');
    naam.setAttribute('aria-live', 'polite');
    var sub = d.createElement('p');
    sub.className = 'os-wereld-sub';
    sub.id = 'osWereldSub';
    el.vak.parentNode.insertBefore(naam, el.vak.nextSibling);
    naam.parentNode.insertBefore(sub, naam.nextSibling);
    el.naam = naam; el.sub = sub;
  }
