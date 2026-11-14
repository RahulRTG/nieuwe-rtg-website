/* DE ONDERTITELBAND -- hoe een cue-lijst in beeld komt, op EEN plek.

   De serverkant van dit verhaal staat in server/kern/ondertitels.js: daar is
   vastgelegd wat een geldige regel is (begin, eind, tekst, gesorteerd, begrensd).
   Dit is de andere helft: hoe die regels op het juiste moment op het beeld
   verschijnen.

   WAAROM GEDEELD. Tot vandaag stond dit als private functie in de clipdeler, en
   die kende alleen clips. Het Theater kreeg vandaag hetzelfde spoor, en de Media
   OS speelt hetzelfde bestand als het Theater -- dat zijn drie schermen die
   dezelfde band willen. Drie kopieen van "welke regel hoort nu in beeld" lopen
   uiteen op precies de dingen die je niet ziet: wat er gebeurt bij een sprong in
   de tijd, of een regel blijft hangen na het eind, of de band wordt opgeruimd
   als er een andere video in hetzelfde vlak komt.

   HIJ HEEFT EEN GEDEELD STIJLBLAD, want anders werkt hij alleen op de schermen
   die toevallig een .ondert-regel in hun eigen blad hebben staan -- en dat was
   precies de situatie: clips.html en media.html hadden er elk een, met andere
   maten. Een pagina die zelf een .ondert-stijl heeft, wint nog steeds: deze
   stijl staat er als BASIS onder (hij wordt als eerste in de head gezet).

   Gebruik:
     RTGOndertitelband.zet(vlak, videoElement, regels);   // regels: [{van,tot,tekst}]
     RTGOndertitelband.weg(vlak);                         // band opruimen

   `vlak` is het element om de video heen; de band wordt daar als kind in gezet
   en gaat mee met de vorm van dat vlak. Zonder regels doet zet() niets -- en
   ruimt hij een eventuele oude band wel op, want een achtergebleven regel van de
   vorige video is erger dan geen ondertitel. */
(function (w, d) {
  'use strict';

  if (w.RTGOndertitelband) return;

  function bandVan(vlak) {
    var band = vlak.querySelector(':scope > .ondert') || vlak.querySelector('.ondert');
    if (!band) {
      band = d.createElement('div');
      band.className = 'ondert ds-ondertitelband';
      /* aria-live=off met opzet: de tekst hoort BIJ het beeld en wordt door een
         schermlezer niet als melding voorgelezen. Wie geen beeld ziet, heeft aan
         een ondertitel niets -- die heeft audiodescriptie nodig, en dat is een
         ander ding dat dit huis niet heeft. */
      band.setAttribute('aria-live', 'off');
      vlak.appendChild(band);
    }
    return band;
  }

  function weg(vlak) {
    if (!vlak) return;
    var band = vlak.querySelector('.ondert');
    if (band) band.remove();
  }

  function zet(vlak, video, regels) {
    if (!vlak || !video) return;
    weg(vlak);
    if (!regels || !regels.length) return;
    var band = bandVan(vlak);
    var lijst = regels.slice().sort(function (a, b) { return a.van - b.van; });
    var laatste = null;
    function teken() {
      var t = video.currentTime, nu = null;
      for (var i = 0; i < lijst.length; i++) {
        if (t >= lijst[i].van && t <= lijst[i].tot) { nu = lijst[i]; break; }
      }
      if (nu === laatste) return;          // niets veranderd: de DOM met rust laten
      laatste = nu;
      band.textContent = '';
      if (nu) { var s = d.createElement('span'); s.textContent = nu.tekst; band.appendChild(s); }
    }
    video.addEventListener('timeupdate', teken);
    /* Een sprong in de tijd geeft niet altijd meteen een timeupdate, en na het
       eind blijft de laatste regel anders staan. Vandaar deze drie erbij. */
    video.addEventListener('seeked', teken);
    video.addEventListener('ended', function () { laatste = null; band.textContent = ''; });
    video.addEventListener('emptied', function () { laatste = null; band.textContent = ''; });
    teken();
  }

  w.RTGOndertitelband = { zet: zet, weg: weg };
})(window, document);
