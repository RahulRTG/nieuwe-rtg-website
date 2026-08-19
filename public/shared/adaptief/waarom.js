/* "WAAROM KAN IK DIT NIET?" -- en waarom dat de belangrijkste knop van dit huis
   kan worden.

   HET PROBLEEM MET GRIJS. Bedrijfssoftware zit vol uitgeschakelde knoppen, en
   bijna geen enkele zegt waarom. Wat een gebruiker dan doet is voorspelbaar: hij
   probeert het nog een keer, hij denkt dat het stuk is, en daarna belt hij
   iemand. Elke grijze knop zonder uitleg is een supportvraag die staat te
   wachten -- en in een huis met rechten, classificaties, vergunningen en
   bewijsstukken zijn dat er veel.

   DE REGEL IS DAAROM: EEN VERHINDERING DRAAGT ALTIJD EEN REDEN. Niet "geen
   toegang", maar:

     Extern delen is uitgeschakeld omdat dit document als Vertrouwelijk is
     geclassificeerd.

     Betaling uitvoeren vereist goedkeuring van Finance.

     Deze handeling is tijdelijk beperkt omdat de synchronisatie niet is
     voltooid.

   shared/adaptief/grammatica.js weigert een verhindering zonder reden, en
   test/grammatica.test.js laat de bouw daarop zakken. Zo kan "even grijs maken"
   niet meer stil gebeuren.

   EN LANG DRUKKEN BETEKENT OVERAL HETZELFDE. Tik doet, lang drukken legt uit --
   ook op een knop die het wél doet. Dan vertelt hij wat de handeling is en wat
   hij weegt: of je hem ongedaan kunt maken, of hij om bevestiging vraagt. Dat is
   dezelfde beweging voor "wat is dit?" en "waarom niet?", en daardoor hoeft een
   lid maar één ding te onthouden.

   Levert window.RTGWaarom. */
(function (w, d) {
  'use strict';
  if (w.RTGWaarom) return;
  var gram = w.RTGGrammatica;

  /* Wat een gewicht BELOOFT, in gewone taal. Dit is geen versiering: wie weet dat
     iets ongedaan te maken is, durft het te proberen -- en dat is precies het
     verschil tussen software die je gebruikt en software waar je omheen werkt. */
  var BELOFTE = {
    licht:    'Gebeurt meteen.',
    terug:    'Gebeurt meteen, en u kunt het daarna ongedaan maken.',
    bewust:   'U ziet eerst wie dit krijgt en welke classificatie eraan hangt.',
    zwaar:    'Vraagt een reden en een bevestiging die u vasthoudt.',
    plechtig: 'Wordt eerst klaargezet en daarna door een mens bevestigd.'
  };

  function regel(lijf, tekst, klasse) {
    if (!tekst) return;
    var p = d.createElement('p');
    p.className = klasse || 'wm-regel';
    p.textContent = tekst;
    lijf.appendChild(p);
  }

  /* WAAR DE VERHINDERING VANDAAN KOMT, als woord. Een reden zonder bron is een
     mening; met bron is het iets wat iemand kan natrekken -- en desnoods
     veranderen. */
  var BRONWOORD = {
    beleid: 'Beleid van uw organisatie',
    classificatie: 'Classificatie van dit stuk',
    bevoegdheid: 'Uw bevoegdheid',
    bewijs: 'Een ontbrekend stuk',
    toestand: 'De toestand van dit moment'
  };

  function leguit(it) {
    if (!it || !w.RTGLagen) return false;
    var h = it.verhinderd && gram ? gram.verhindering(it.verhinderd) : null;
    w.RTGLagen.lade({
      titel: it.naam,
      inhoud: function (lijf) {
        if (h) {
          regel(lijf, gram.uitleg(h), 'wm-reden');
          var bron = d.createElement('div');
          bron.className = 'wm-bron';
          var k = d.createElement('span'); k.className = 'wm-bronkop'; k.textContent = 'Waardoor';
          var v = d.createElement('span'); v.textContent = BRONWOORD[h.bron] || BRONWOORD.toestand;
          bron.appendChild(k); bron.appendChild(v);
          lijf.appendChild(bron);
          /* WAT U ER ZELF AAN KUNT DOEN, of dat er niets is. Dat tweede eerlijk
             opschrijven is beter dan een vage aanmoediging: "vraag het na bij
             uw beheerder" is een doodlopende zin als de classificatie het
             gewoon verbiedt. */
          if (h.stap) regel(lijf, h.stap, 'wm-stap');
          else if (h.los) regel(lijf, 'Dit kan veranderen zodra hierboven iets is opgelost.', 'wm-stap');
          else regel(lijf, 'Hier kunt u zelf niets aan veranderen.', 'wm-stap');
        } else {
          regel(lijf, BELOFTE[it.gewicht || 'licht'] || BELOFTE.licht, 'wm-belofte');
          if (it.groep) regel(lijf, 'Hoort bij: ' + it.groep, 'wm-stap');
          /* De handeling staat er ook als KNOP: wie lang drukt om te kijken wat
             iets is, wil het daarna vaak gewoon doen, en hem terugsturen naar de
             balk om opnieuw te mikken is een tik die nergens voor nodig is. */
          var b = d.createElement('button');
          b.type = 'button'; b.className = 'lg-rij';
          b.textContent = it.naam;
          b.onclick = function () {
            w.RTGLagen.sluit();
            if (w.RTGGewicht) w.RTGGewicht.voer(it);
            else if (w.RTGAdaptief) w.RTGAdaptief.doe(it.id);
          };
          lijf.appendChild(b);
        }
      }
    });
    return true;
  }

  w.RTGWaarom = { leguit: leguit, BELOFTE: BELOFTE };
})(window, document);
