
  /* ---------- de levende wereld aanreiken ----------
     shared/wereld.js tekent het beginscherm als kring om de klok in plaats van
     als rooster met tegels. Die module weet met opzet NIETS: niet welke
     werelden er zijn, niet hoe je er een opent, niet welke onderdelen jouw pas
     draagt. Dat staat hier al -- in MAPPEN, itemZichtbaar, itemNaam,
     tegelInhoud en openItem -- en dit blok geeft het door.

     Dat is de reden dat de omschakeling geen tweede beginscherm oplevert: beide
     standen lezen DEZELFDE lijst, tonen DEZELFDE klok en openen apps met
     DEZELFDE openItem(). Wie hier ooit een eigen lijst werelden ziet ontstaan,
     of een tweede manier om een app te openen, heeft de fout te pakken waar
     LAT.md regel 4 over gaat.

     Ontbreekt de module (een oude service-worker-cache, een geblokkeerd
     script), dan gebeurt er niets en staat het rooster er gewoon. Een
     beginscherm dat leeg blijft omdat een sierlaag niet laadde, is erger dan
     geen sierlaag. */

  /* Wordt aan het eind van bouw() aangeroepen, dus op precies het moment dat
     ook de tegels worden bijgewerkt. De module vergelijkt zelf of er iets
     veranderd is en doet niets als het antwoord nee is. */
  function wereldBij() {
    if (!window.RTGWereld || !RTGWereld.werelden) return;
    RTGWereld.werelden(MAPPEN.filter(function (m) {
      return m.wereld && m.items.some(itemZichtbaar);
    }).map(function (m) {
      return {
        sleutel: m.sleutel,
        naam: mapNaam(m),
        url: m.wereld,
        /* De glyf van de wereld: hetzelfde teken als op de tegel, uit dezelfde
           bron. Een tweede tekenset zou twee werelden geven die anders heten. */
        teken: function () { return (window.RTGGlyf && RTGGlyf.svg(m.glyf)) || null; },
        delen: m.items.filter(itemZichtbaar).map(function (item) {
          return {
            sleutel: item,
            naam: itemNaam(item),
            teken: function () { try { return tegelInhoud(item); } catch (e) { return null; } }
          };
        })
      };
    }));
  }

  (function () {
    var scherm = document.querySelector('.os-thuisscherm');
    var vak = document.querySelector('.os-klokvak');
    var klok = $('#homeKlok');
    if (!scherm || !vak || !klok || !window.RTGWereld) return;

    RTGWereld.start({
      scherm: scherm, vak: vak, klok: klok, werelden: [],
      openUrl: function (url) { location.href = url; },
      openDeel: function (sleutel) { openItem(sleutel); },
      /* Een werkwoord uit het Command Wheel gaat naar de balk van Rahul, met de
         wereld erbij waar je het vandaan haalde. Niet meteen VERSTUREN: je hebt
         gezegd wat je wilt doen, nog niet waarmee. De cursor staat klaar achter
         de zin, zodat je hem afmaakt in plaats van hem te lezen. */
      zegRahul: function (zin) {
        var invoer = $('#osAiIn');
        if (!invoer) return;
        invoer.value = zin + ' ';
        invoer.focus();
        try { invoer.setSelectionRange(invoer.value.length, invoer.value.length); } catch (e) {}
      }
    });

    /* De schakelaar in het bedieningspaneel. Hij zet niets zelf: hij vraagt de
       module om te wisselen en leest daarna terug wat de stand IS, zodat de
       knop niet kan gaan afwijken van het scherm. */
    var knoppen = document.querySelectorAll('#osCcWereld button');
    function merk() {
      knoppen.forEach(function (b) {
        b.classList.toggle('actief', (b.dataset.wereld === 'aan') === RTGWereld.aan());
      });
    }
    knoppen.forEach(function (b) {
      b.addEventListener('click', function () { RTGWereld.zet(b.dataset.wereld === 'aan'); merk(); });
    });
    window.addEventListener('rtg-wereld', merk);
    merk();
  })();
