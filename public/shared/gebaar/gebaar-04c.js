/* Slot van de gebarenlaag, deel drie: DE VEEG DIE DE SERVER RAAKT.

   Tot hier deed elke actie iets in de browser -- openen, delen, kopieren. Dit
   deel is voor de acties die echt iets veranderen aan de andere kant, en dat is
   een ander soort belofte: als de regel wegschuift, is hij ook echt weg.

   OPTIMISTISCH, MET EEN WEG TERUG (ONTWERP.md par. 6). De regel verdwijnt
   meteen en de server volgt. Snelheid is wat een veeg beter maakt dan een knop;
   die weggeven maakt hem zinloos. De prijs is dat er drie dingen geregeld
   moeten zijn, en ze staan HIER en niet in elk scherm opnieuw:

     1. de regel gaat meteen weg, met een korte inklap zodat de lijst niet
        springt;
     2. gaat het mis aan de andere kant, dan komt hij TERUG en zegt waarom --
        stil falen is hier de ergste uitkomst, want het lid denkt dat het gelukt
        is en het staat er morgen weer;
     3. lukt het wel, dan staat de weg terug klaar -- en die roept de omgekeerde
        route aan, niet een kopie van de administratie.

   WAT DIT NIET DOET: verzinnen dat iets omkeerbaar is. Een actie zonder `terug`
   krijgt geen terugdraai-knop maar een borg: die gaat alleen op vasthouden.
   Dat is geen strengheid maar de enige eerlijke uitkomst -- een knop
   'Terugdraaien' die niets terugdraait is erger dan geen knop. */

  /* De inklap. Hij zet een vaste hoogte voordat hij naar nul gaat, want een
     element klapt niet in vanaf `auto`. Geeft een functie terug die hem
     terugzet, en die is het vangnet van punt 2 hierboven. */
  function verberg(rij) {
    var h = rij.offsetHeight;
    var oud = { hoogte: rij.style.height, marge: rij.style.marginTop, over: rij.style.overflow };
    rij.style.height = h + 'px';
    rij.style.overflow = 'hidden';
    /* een frame ertussen, anders ziet de browser alleen de eindstand */
    requestAnimationFrame(function () {
      if (!rij.isConnected) return;
      rij.classList.add('gb-weg');
      rij.style.height = '0px';
    });
    return function terugzetten() {
      rij.classList.remove('gb-weg');
      rij.style.height = oud.hoogte; rij.style.marginTop = oud.marge; rij.style.overflow = oud.over;
    };
  }

  /* Een actie die de server raakt. doe() en terug() geven een Promise terug;
     alles daaromheen -- inklappen, terugzetten bij een fout, de melding, de
     knop Terugdraaien -- doet deze laag. */
  KLAAR.server = function (o) {
    if (!o || typeof o.doe !== 'function') return null;
    return {
      naam: o.naam, teken: o.teken, sig: o.sig,
      /* melding MOET mee. Hij stond eerst alleen in de o hierboven, en voerUit()
         leest hem van de ACTIE -- dus de melding was "Prullenbak" in plaats van
         "Contract-2026.txt ligt in de prullenbak". Gevonden in een echte
         browser, niet met lezen: het verschil is een woord op een toast. */
      melding: o.melding,
      /* Geen terugweg betekent vasthouden. Zie de kop hierboven. */
      borg: o.borg || typeof o.terug !== 'function',
      doe: function (rij) {
        var terugzetten = verberg(rij);
        var klaar = function () { if (typeof o.na === 'function') try { o.na(); } catch (e) {} };
        var gelukt = true;
        var fouttekst = function (f, sl, nl, en) {
          return (f && f.message) || T(sl, nl, en);
        };
        /* De heenweg wordt VASTGEHOUDEN, en dat is niet netjesheid maar een
           gemeten fout. De melding met Terugdraaien staat er meteen -- dat is
           wat optimistisch betekent -- dus een snelle hand drukt hem in terwijl
           de eerste aanvraag nog onderweg is. Zonder deze ketting racen 'weg' en
           'herstel' met elkaar, en wie het laatst aankomt wint: het bestand
           bleef weg terwijl het scherm zei dat het terug was. Betrapt door een
           toets die de ene keer zakte en de andere keer niet. */
        var heenweg = Promise.resolve()
          .then(function () { return o.doe(rij); })
          .then(klaar, function (fout) {
            gelukt = false;
            terugzetten();
            melding(fouttekst(fout, 'gebaar.mislukt', 'Dat lukte niet; de regel staat er nog.',
              'That did not work; the row is still there.'), null);
          });
        if (typeof o.terug !== 'function') return o.melding || o.naam;
        return function () {
          heenweg.then(function () {
            /* Ging de heenweg mis, dan staat de regel er al weer en valt er
               niets terug te draaien. Alsnog terug gaan zou een tweede,
               tegengestelde opdracht sturen voor iets dat nooit gebeurd is. */
            if (!gelukt) return;
            return Promise.resolve(o.terug(rij)).then(function () { terugzetten(); klaar(); },
              function (fout) {
                melding(fouttekst(fout, 'gebaar.terugmislukt', 'Terugdraaien lukte niet.',
                  'Undo did not work.'), null);
              });
          });
        };
      }
    };
  };

  /* De laag laadt zonder haast (shared/basis.js zet hem op async), dus een
     scherm dat zijn regels wil ophangen kan er niet vanuit gaan dat hij er al
     is. Dit sein zegt: nu wel. Wie eerder klaar is dan de laag, luistert;
     wie later komt, ziet window.RTGGebaar gewoon staan. */
  try { d.dispatchEvent(new CustomEvent('rtg-gebaar')); } catch (e) {}

  d.addEventListener('pointerdown', opNeer);
  d.addEventListener('pointermove', opBeweeg);
  d.addEventListener('pointerup', opLos);
  d.addEventListener('pointercancel', opLos);
})();
