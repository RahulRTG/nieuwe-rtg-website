
  /* ---------- Rahul kent je ritme ----------

     "Normaal open je om deze tijd RTG Kantoor." Dat is een van de mooiste
     zinnen uit het ontwerp en tegelijk de gevaarlijkste, want er zit gedrag van
     een mens onder. Vier grenzen daarom, en ze staan hier omdat een grens die
     alleen in een document staat over drie maanden weg is:

     1. HET BLIJFT OP HET TOESTEL. De telling woont in localStorage, naast de
        gebruiksteller die het OS al had (rtg_os_gebruik_*). Er gaat niets over
        dit lid naar de server -- niet zijn ritme, niet zijn uren, niets. Dat is
        dezelfde regel als de codenamen: wat je niet verstuurt, kan ook niet
        uitlekken.

     2. HET OPENT, HET STUURT NIET. Er is geen badge, geen teller, geen "je hebt
        dit al drie dagen niet gedaan", geen streak. Het is een aanbod dat je
        kunt negeren, en negeren kost niets. CLAUDE.md verbiedt verslavende
        patronen, en een ritme dat je eraan HERINNERT dat je iets normaal doet,
        is precies zo'n patroon.

     3. PAS ALS HET ECHT EEN PATROON IS. Een keer om tien uur Kantoor openen is
        geen ritme. Er moet een duidelijke koploper zijn in dit uur, en die moet
        het vaak genoeg gedaan hebben (DREMPEL). Tot die tijd zegt hij niets --
        liever stil dan een gok die als inzicht klinkt.

     4. HIJ BELOOFT NIETS WAT HIJ NIET DOET. Het ontwerp zei "Ik heb het alvast
        voorbereid". Dat zou hier een leugen zijn: er wordt niets voorbereid.
        Wat hij WEL kan, doet hij ook echt -- de ring zet klaar wat je normaal
        opent, en tikken draait je er meteen heen. */
  var ritme = null;         // { sleutel, naam } of null
  var ritmeWeg = false;     // vandaag weggetikt? dan zwijgt hij

  function heeftRitme() { return !!ritme && !ritmeWeg; }

  function zetRitme(v) {
    ritme = (v && v.sleutel && v.naam) ? v : null;
    toonRitme();
  }

  /* De ring van Rahul draagt hoogstens EEN ding. Wat hij zelf te melden heeft
     gaat voor: dat is nieuws, en dit is een gewoonte. Zegt hij niets, dan mag
     het ritme de ring hebben. */
  function toonRitme() {
    if (!st.aan || !el.rahul || !ritme || ritmeWeg) return;
    if (el.rahul.getAttribute('data-soort') === 'rahul' &&
        el.rahul.getAttribute('data-toon') === 'ja') return;
    if (draadStaatOpen()) return;
    el.rahul.querySelector('span').textContent = 'Normaal open je nu ' + ritme.naam;
    el.rahul.setAttribute('data-soort', 'ritme');
    el.rahul.setAttribute('data-toon', 'ja');
  }

  /* Tikken draait de bezel naar die wereld -- en opent hem NIET. Het verschil
     is de hele afspraak: hij zet klaar, jij besluit. Meteen openen zou van een
     aanbod een handeling maken die je niet hebt gedaan. */
  function ritmeVolg() {
    if (!ritme) return;
    var i = -1;
    for (var j = 0; j < st.werelden.length; j++) {
      if (st.werelden[j].sleutel === ritme.sleutel) { i = j; break; }
    }
    ritmeSluit();
    if (i >= 0) { if (st.diep) zoom(false); naar(i); }
  }

  /* Weggetikt is weg, voor vandaag. Niet voor altijd -- morgen is het weer een
     nieuwe dag en misschien klopt het dan wel. Maar hem dezelfde dag opnieuw
     laten opkomen is zeuren, en dat is precies wat grens 2 verbiedt. */
  function ritmeSluit() {
    ritmeWeg = true;
    if (el.rahul) {
      el.rahul.setAttribute('data-toon', 'nee');
      el.rahul.setAttribute('data-soort', 'rahul');
    }
  }
