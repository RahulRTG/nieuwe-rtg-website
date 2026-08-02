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
       omhulsel-groep: die staat stil en draagt het filter, de wijzer zelf draait
       daarbinnen. Zet je het filter op de draaiende groep, dan zwiept de schaduw
       met de secondewijzer mee rond de plaat. */
    function schaduwhuls(filterId) {
      const huls = document.createElementNS(NS, 'g');
      huls.setAttribute('filter', 'url(#' + filterId + klokNr + ')');
      wijzers.appendChild(huls);
      return huls;
    }
    function wijzer(len, tail, w, filterId) {
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
