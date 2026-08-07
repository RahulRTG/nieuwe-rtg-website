    /* HET BLOK VAN RAHUL: het antwoord boven, de balk eronder, en de ruimte
       die de pagina ervoor vrijhoudt. Apart deel omdat metgezel-01b.js anders
       over de 10 KB-lat komt (scripts/check.js regel 13) en omdat dit een eigen
       onderwerp is: waar Rahul STAAT, los van wat hij doet. */
    /* Een blok: het antwoord boven, de balk eronder. Ze horen bij elkaar en
       staan dus ook bij elkaar, op dezelfde breedte. */
    var blok = document.createElement('div');
    blok.className = 'mgz-blok';
    blok.appendChild(sheet);
    blok.appendChild(balk);
    document.body.appendChild(blok);

    /* Rahul openen van buitenaf. Het app-menu (shared/appmenu.js) heeft een rij
       "Vraag Rahul", en dat mag geen namaakknop worden die zelf een venster
       tekent: dan zijn er weer twee Rahuls. Er is er hier één, en dit is zijn
       deurklink. */
    window.RTGMetgezel = window.RTGMetgezel || {};
    window.RTGMetgezel.rahul = function (tekst) { zetMaat(false, false); opengaan(tekst); };

    /* De pagina reserveert de hoogte van het blok, zodat Rahul nergens overheen
       staat -- ook niet onderaan een lange lijst. Dat doen we met een leeg
       tussenstuk onderaan de body en NIET door body.paddingBottom te zetten:
       veel pagina's hebben daar hun eigen marge staan (de wallet 57,6 px) en
       die zouden we dan overschrijven. Een tussenstuk telt op bij wat er al
       is in plaats van het te vervangen.
       We meten het blok in plaats van een vaste hoogte te kiezen: hij groeit
       met een antwoord mee en krimpt als je hem klein klapt. */
    /* MAAR NIET OP EEN BODY DIE ZELF EEN INDELING IS. Op de leverancier-app is
       de body een flexrij met de app-schil erin. Een extra kind van 100% breed
       is daar geen tussenstuk maar een tweede KOLOM: de schil kreeg nul breedte
       en het hele scherm bleef leeg. Geen foutmelding, geen kapotte regel --
       alleen een lege app, en dat is precies het soort stilte waar dit huis
       niet tegen kan.

       Zo'n pagina scrollt zijn body ook helemaal niet (de inhoud scrollt binnen
       de schil), dus het tussenstuk had daar sowieso niets te reserveren. De
       maat komt wel gewoon in --rtg-rahul-h te staan; wie ruimte wil maken,
       gebruikt die. */
    var indeling = getComputedStyle(document.body).display;
    var eigenIndeling = indeling === 'flex' || indeling === 'inline-flex' ||
      indeling === 'grid' || indeling === 'inline-grid';
    var ruimte = document.createElement('div');
    ruimte.className = 'mgz-ruimte';
    ruimte.setAttribute('aria-hidden', 'true');
    if (!eigenIndeling) document.body.appendChild(ruimte);
    function meetRuimte() {
      var h = blok.hidden ? 0 : blok.getBoundingClientRect().height;
      var px = h ? Math.round(h + 18) : 0;   // 18px lucht tussen inhoud en blok
      document.documentElement.style.setProperty('--rtg-rahul-h', px + 'px');
      ruimte.style.height = 'calc(' + px + 'px + env(safe-area-inset-bottom, 0px))';
    }
    // de bewaarde stand pas zetten nu het blok bestaat: zetMaat() raakt hem aan
    zetMaat(klein, false);
    if (window.ResizeObserver) { try { new ResizeObserver(meetRuimte).observe(blok); } catch (e) {} }
    window.addEventListener('resize', meetRuimte);
    meetRuimte();
    // de waarnemer meldt de allereerste opmaak niet altijd; daarom nog twee keer
    setTimeout(meetRuimte, 200); setTimeout(meetRuimte, 900);
