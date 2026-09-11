/* DE PRIORITEITSHOOP van de A*-zoeker: de kleinste f bovenop.

   Apart van ./gebiednet.js omdat hij niets met gebieden of kaarten te maken
   heeft -- het is een gegevensstructuur, en de motor werd te groot om in een
   keer na te kijken. Een array met sort() per stap zou hetzelfde antwoord geven
   en de zoeker onbruikbaar traag maken, dus staat hij hier uitgeschreven. */
'use strict';

class Hoop {
  constructor() { this.rij = []; }
  zet(x) {
    const a = this.rij; a.push(x); let i = a.length - 1;
    while (i) { const p = (i - 1) >> 1; if (a[p].f <= x.f) break; a[i] = a[p]; i = p; }
    a[i] = x;
  }
  pak() {
    const a = this.rij, boven = a[0], x = a.pop();
    if (!a.length) return boven;
    let i = 0;
    while (true) {
      let c = i * 2 + 1; if (c >= a.length) break;
      if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
      if (a[c].f >= x.f) break; a[i] = a[c]; i = c;
    }
    a[i] = x; return boven;
  }
  get lengte() { return this.rij.length; }
}

module.exports = { Hoop };
