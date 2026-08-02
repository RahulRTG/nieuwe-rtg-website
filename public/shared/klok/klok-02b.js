    /* ---- de wijzers: slank, gepolijst goud met een lume-kanaal ----
       Een fijne baton met een pale lume-strook in het midden, en een fijne
       slagschaduw eronder: ingetogen, precies, chic. De secondewijzer is dun
       met een lollipop en een klein tegengewicht. */
    const goud = 'url(#rr-goud' + klokNr + ')';
    function baton(len, tail, w) {
      const b = w / 2;
      return 'M' + (100 - b) + ' ' + (100 - len * 0.1).toFixed(2) +
        ' L' + (100 - b * 0.78) + ' ' + (100 - len) +
        ' L' + (100 + b * 0.78) + ' ' + (100 - len) +
        ' L' + (100 + b) + ' ' + (100 - len * 0.1).toFixed(2) +
        ' L' + (100 + b * 0.85) + ' ' + (100 + tail) +
        ' L' + (100 - b * 0.85) + ' ' + (100 + tail) + ' Z';
    }
    const wijzers = maak('g', {});
    /* Elke wijzer krijgt zijn eigen schaduw, maar die moet blijven vallen waar
       het licht hem laat vallen -- niet meedraaien met de wijzer. Vandaar de
       omhulsel-groep: die staat stil en is alleen VERSCHOVEN in de lichtrichting
       (rechtsonder, zoals het glashoogsel linksboven zit); daarbinnen draait een
       zwarte kopie van de wijzer synchroon mee. Hoe hoger de wijzer boven de
       plaat, hoe verder de schaduw verschuift en hoe lichter hij wordt -- dat
       hoogteverschil maakt van drie platte vormen een gestapeld uurwerk.
       Zonder blur: op deze schaal (een 200-tellige wijzerplaat) leest een
       strakke schaduw als scherpte, en het spaart de SVG-filters uit die
       anders elk beeldje opnieuw gerasterd zouden worden. */
    function schaduwhuls(dx, dy, alpha) {
      const huls = document.createElementNS(NS, 'g');
      huls.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')');
      huls.setAttribute('opacity', alpha);
      wijzers.appendChild(huls);
      const draaier = document.createElementNS(NS, 'g');
      huls.appendChild(draaier);
      return draaier;
    }
    /* Een wijzer is voortaan een paar: de schaduwkopie in zijn verschoven huls,
       en de echte wijzer erbovenop. draai() zet beide in dezelfde stand. */
    function wijzer(len, tail, w, dx, dy, alpha) {
      const schaduw = document.createElementNS(NS, 'path');
      schaduw.setAttribute('d', baton(len, tail, w)); schaduw.setAttribute('fill', '#000');
      const sHuls = schaduwhuls(dx, dy, alpha);
      sHuls.appendChild(schaduw);
      const g = document.createElementNS(NS, 'g');
      const body = document.createElementNS(NS, 'path');
      body.setAttribute('d', baton(len, tail, w)); body.setAttribute('fill', goud);
      body.setAttribute('stroke', '#3E2E0C'); body.setAttribute('stroke-width', '0.2');
      const lume = document.createElementNS(NS, 'line');
      lume.setAttribute('x1', 100); lume.setAttribute('y1', (100 - len + 3).toFixed(2));
      lume.setAttribute('x2', 100); lume.setAttribute('y2', (100 - len * 0.06).toFixed(2));
      lume.setAttribute('stroke', '#E7E2CC'); lume.setAttribute('stroke-width', (w * 0.4).toFixed(2));
      lume.setAttribute('stroke-linecap', 'round');
      g.append(body, lume);
