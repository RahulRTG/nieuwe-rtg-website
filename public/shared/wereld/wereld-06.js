
  /* ---------- aanzetten, uitzetten ----------
     ER ZIJN GEEN TWEE BEGINSCHERMEN. Dat is de belangrijkste regel van dit
     blok, en de reden dat het zo weinig doet: omschakelen verplaatst de KLOK en
     zet een attribuut. De passregel, de balk van Rahul, de draad, de klok en de
     lijst werelden zijn in beide standen letterlijk dezelfde onderdelen. Wie
     hier ooit een tweede opbouw naast zet, krijgt twee schermen die langzaam
     uit elkaar lopen -- precies wat LAT.md regel 4 verbiedt.

     Vandaar ook dat de rasterstand hier niets hoeft te herstellen behalve de
     klok: hij is nooit weg geweest, hij stond alleen onder display:none. */
  var SLEUTEL = 'rtg_os_wereld';

  function bewaard() {
    try {
      var v = localStorage.getItem(SLEUTEL);
      if (v === 'aan' || v === 'uit') return v;
    } catch (e) {}
    return null;
  }

  function zet(aan, bewaren) {
    if (!el.vak || !el.scherm) return;
    st.aan = !!aan;
    if (bewaren !== false) { try { localStorage.setItem(SLEUTEL, st.aan ? 'aan' : 'uit'); } catch (e) {} }
    el.scherm.setAttribute('data-os-wereld', st.aan ? 'aan' : 'uit');

    if (st.aan) {
      /* DEZELFDE GROND ALS DE POORT. data-inlogkleur is geen versiering maar een
         koppeling: shared/inlogkleur.js verft elk vlak dat hem draagt met de
         levende dagkleur -- de boog van de dag, het seizoen, de dag van het
         jaar. De inlogpoort draagt hem al. Zet je hem hier ook op, dan loop je
         letterlijk dezelfde lucht binnen als waar je onder inlogde, en blijft
         het EEN kleur die op EEN plek wordt uitgerekend.
         In de rasterstand gaat hij er weer af: daar hoort de wallpaper die het
         lid zelf koos (os-wall-*) het te winnen. */
      el.scherm.setAttribute('data-inlogkleur', '');
      if (w.Inlogkleur && w.Inlogkleur.verf) { try { w.Inlogkleur.verf(); } catch (e) {} }
      bouwKring(); bouwNaam(); bouwKern(); bouwWiel(); bouwRahul(); bouwHemel(); bouwGrond();
      if (!gebonden) { bindSleep(); bindToetsen(); gebonden = true; }
      el.kring.hidden = false;
      el.naam.hidden = false; el.sub.hidden = false;
      if (el.grond) el.grond.hidden = false;
      var hemelAan = el.scherm.querySelector('canvas.rtg-sterren');
      if (hemelAan) hemelAan.hidden = false;
      if (el.klok && el.klok.parentNode !== el.kring) el.kring.appendChild(el.klok);
      vulRing(); toonNaam(); kernLabel(); grondKies(); grondMaat(); grondStart();
    } else {
      wiel(false);
      grondStop();
      el.scherm.removeAttribute('data-inlogkleur');
      var hemel = el.scherm.querySelector('canvas.rtg-sterren');
      if (hemel) hemel.hidden = true;
      if (el.klok && el.vak && el.klok.parentNode !== el.vak) el.vak.appendChild(el.klok);
      if (el.kring) el.kring.hidden = true;
      if (el.naam) el.naam.hidden = true;
      if (el.sub) el.sub.hidden = true;
      if (el.rahul) el.rahul.setAttribute('data-toon', 'nee');
      if (el.grond) el.grond.hidden = true;
    }
    try { w.dispatchEvent(new Event('rtg-wereld')); } catch (e) {}
  }
  var gebonden = false;

  /* ---------- de aanroeper reikt de wereld aan ----------
     Alles wat deze module NIET zelf mag weten komt hier binnen: welke werelden
     er zijn (uit MAPPEN), hoe je er een opent, hoe je een onderdeel opent, en
     hoe je iets in de balk van Rahul zet.

     WAAROM DIT IN TWEE STAPPEN GAAT. start() bedraadt, werelden() vult. Bij het
     laden van de pagina IS de lijst namelijk nog leeg: welke onderdelen jouw
     pas draagt hangt aan je boardroom-instellingen, en die komen van de server.
     De tegels hebben dat probleem ook, en lossen het al op -- bouw() tekent ze
     opnieuw zodra er iets verandert. De ring hangt daarom aan diezelfde
     bouw(), en niet aan een eigen moment: twee lijsten die op verschillende
     momenten worden bijgewerkt, zijn twee lijsten die uit elkaar lopen.

     Dit is precies de fout die deze opmerking documenteert: de eerste versie
     vulde de ring bij het laden, kreeg nul zichtbare onderdelen terug en toonde
     een leeg beginscherm. */
  function start(o) {
    if (!o || !o.vak || !o.scherm || !o.klok) return false;
    el.vak = o.vak; el.scherm = o.scherm; el.klok = o.klok;
    api.openUrl = o.openUrl || null;
    api.openDeel = o.openDeel || null;
    api.zegRahul = o.zegRahul || null;

    // de schuif Beweging raakt zowel de grond als het draaien
    try {
      w.addEventListener('rtg-beweging', function () {
        if (!st.aan) return;
        if (beweegFactor() === 0) { grondStop(); grondFrame(); } else grondStart();
      });
    } catch (e) {}

    /* Zelf beginnen te typen is ook "laat dat gesprek maar zien". Zonder dit
       zou je een vraag stellen en je eigen zin nergens terugzien -- alleen het
       antwoord, in de ring. Dat leest als een AI die je niet gehoord heeft. */
    var balk = d.getElementById('osAiBalk');
    if (balk) balk.addEventListener('submit', draadOpen);

    werelden(o.werelden || []);
    return true;
  }

  /* De lijst werelden (opnieuw) aanreiken. Wordt bij elke bouw() aangeroepen,
     dus meestal verandert er niets -- en dan hoort er ook niets te gebeuren.
     Zonder deze vergelijking bouwt de ring zichzelf een paar keer per seconde
     opnieuw op en springt hij terug naar de eerste wereld, precies terwijl je
     eraan draait. */
  var vorigeLijst = null, begonnen = false;
  function werelden(lijst) {
    if (!el.vak) return;
    lijst = lijst || [];
    var vinger = lijst.map(function (x) {
      return x.sleutel + '~' + x.naam + '~' + (x.delen || []).length;
    }).join('|');
    if (vinger === vorigeLijst) return;
    vorigeLijst = vinger;
    st.werelden = lijst;

    // een wereld die verdwijnt (uitgezet in de boardroom) mag de ring niet op
    // een stand laten staan die niet meer bestaat
    if (st.actief >= lijst.length) { st.actief = 0; st.hoek = 0; st.doel = 0; }
    if (st.wereldIdx >= lijst.length) { st.wereldIdx = 0; st.diep = false; }

    if (!lijst.length) return;
    if (!begonnen) {
      begonnen = true;
      /* DE STANDAARD IS DE LEVENDE WERELD. Dat is een besluit en geen toeval:
         het beginscherm HOORT dit te zijn, en de schakelaar bestaat om terug te
         kunnen, niet om het aan te moeten zetten. Wie ooit terugschakelt, houdt
         die keuze -- vandaar dat bewaard() voorrang heeft. */
      var stand0 = bewaard();
      zet(stand0 ? stand0 === 'aan' : true, false);
      return;
    }
    if (st.aan) { vulRing(); toonNaam(); kernLabel(); grondKies(); }
  }

  /* Wat er nu op het scherm staat, als leesbaar feit. Dit bestaat voor de
     toetsen: een e2e-toets die de stand uit pixels moet afleiden meet vooral
     zijn eigen aannames, en zakt op de verkeerde momenten. */
  function stand() {
    var it = huidige();
    return {
      aan: st.aan,
      diep: st.diep,
      actief: st.actief,
      naam: (it && it.naam) || null,
      wereld: st.diep ? (st.werelden[st.wereldIdx] || {}).naam || null : (it && it.naam) || null,
      merken: st.merken.length,
      wiel: wielOpen()
    };
  }

  w.RTGWereld = {
    start: start,
    werelden: werelden,
    zet: function (aan) { zet(!!aan, true); },
    aan: function () { return st.aan; },
    naar: naar,
    zoom: zoom,
    wiel: wiel,
    rahulZei: rahulZei,
    stand: stand
  };
})(window);
