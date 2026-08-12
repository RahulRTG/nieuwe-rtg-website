/* Browser-driver, deel "locator": de Locator-klasse in Playwright-vorm.

   Een Locator is GEEN element maar een BELOFTE: een selector plus een index,
   die pas bij elke aanroep opnieuw in de pagina wordt opgezocht. Dat is precies
   waarom hij bestaat en waarom hij los staat van de Page -- tussen twee regels
   van een schermtoets kan de pagina hertekend zijn, en een vastgehouden element
   verwijst dan naar iets wat er niet meer staat. Elke methode hieronder zoekt
   opnieuw, en dat is geen inefficiëntie maar de hele bedoeling.

   Vandaar ook dat `first()` en `locator()` een NIEUWE Locator teruggeven in
   plaats van zichzelf aan te passen: een greep die onder je handen verandert,
   maakt een toets onleesbaar.

   Afgesplitst uit ./browser-page.js om diezelfde reden als het toetsenbord en
   de grepen: elk deel klein genoeg om in een keer te lezen (de 10 kB-lat). */
'use strict';

class Locator {
  constructor(page, sel, index) { this.page = page; this.sel = sel; this.index = index == null ? 0 : index; }
  first() { return new Locator(this.page, this.sel, 0); }
  locator(sub) { return new Locator(this.page, this.sel + ' ' + sub, this.index); }
  count() { return this.page._roep('function(sel){return __rtgdrv.zoekAlle(sel).length;}', [this.sel]); }
  textContent() { return this.page._roep('function(sel,i){var el=__rtgdrv.zoekAlle(sel)[i]||null;return el?el.textContent:null;}', [this.sel, this.index]); }
  async click() { await this.page._roep('function(sel,i){var el=__rtgdrv.zoekAlle(sel)[i]||null;__rtgdrv.klik(el);return true;}', [this.sel, this.index]); }
  /* Wachten tot hij er is EN zichtbaar. Alleen "bestaat" is niet genoeg: een
     scherm dat zijn blok al in de HTML heeft maar nog verborgen houdt, zou de
     toets laten doorlopen naar een klik die nergens landt. */
  async waitFor(opts) {
    const t = (opts && opts.timeout) || 15000;
    await this.page._wachtRoep('function(sel,i){var el=__rtgdrv.zoekAlle(sel)[i]||null;return !!el&&__rtgdrv.zichtbaar(el);}', [this.sel, this.index], t);
  }
}

module.exports = { Locator };
