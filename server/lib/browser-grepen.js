/* Browser-driver, deel "grepen": de methoden die onze scherm-tests aanroepen op
   een pagina en die hier ontbraken.

   Waarom dit bestaat. De kop van browser-page.js belooft "precies de methoden
   die onze scherm-tests gebruiken", en dat was niet waar: vijftien e2e-toetsen
   liepen niet op een bewering stuk maar op een TypeError (page.selectOption is
   not a function, page.$$ is not a function, ...). Een toets die valt voordat
   hij iets beweert, bewaakt niets -- en hij ziet er in de uitslag net zo rood
   uit als een echt defect, wat het lezen van die uitslag vergiftigt.

   Apart bestand omdat browser-page.js anders over de 10 KB-lat komt (zie
   scripts/check.js regel 13), net als het toetsenbord in ./browser-toetsen.js.

   Vorm en semantiek volgen Playwright, want de toetsen zijn daarvoor
   geschreven. Bewust NIET compleet: alleen wat er in test/ echt wordt
   aangeroepen; een methode erbij verzinnen die niemand gebruikt, is een belofte
   die niemand nakijkt. */
'use strict';

/* Een enkele greep: een handvat op EEN element, zoals page.$ teruggeeft. De
   toetsen doen er textContent(), click() en getAttribute() op, meer niet. De
   greep houdt de selector vast en niet het element zelf: de pagina hertekent
   tussendoor, en een vastgehouden knooppunt is dan stil van het scherm af. */
class Greep {
  constructor(page, sel, index) { this.page = page; this.sel = sel; this.index = index || 0; }
  textContent() { return this.page._roep('function(s,i){var el=__rtgdrv.zoekAlle(s)[i]||null;return el?el.textContent:null;}', [this.sel, this.index]); }
  getAttribute(attr) { return this.page._roep('function(s,i,a){var el=__rtgdrv.zoekAlle(s)[i]||null;return el?el.getAttribute(a):null;}', [this.sel, this.index, attr]); }
  async click() { await this.page._roep('function(s,i){var el=__rtgdrv.zoekAlle(s)[i]||null;__rtgdrv.klik(el);return true;}', [this.sel, this.index]); }
  async fill(w) { await this.page._roep('function(s,i,w){var el=__rtgdrv.zoekAlle(s)[i]||null;__rtgdrv.vul(el,w);return true;}', [this.sel, this.index, w]); }
  async isChecked() { return this.page._roep('function(s,i){var el=__rtgdrv.zoekAlle(s)[i]||null;return !!(el&&el.checked);}', [this.sel, this.index]); }
  async inputValue() { return this.page._roep('function(s,i){var el=__rtgdrv.zoekAlle(s)[i]||null;return el?el.value:null;}', [this.sel, this.index]); }
}

/* De methoden worden op de bestaande Page-klasse gezet in plaats van hem te
   laten erven: browser-page.js maakt de instanties zelf, en een tweede klasse
   ertussen zou daar een wijziging vragen die niets oplevert. */
function rustUit(Page) {
  /* page.$ en page.$$ geven grepen terug, geen elementen: een CDP-driver kan
     geen DOM-knooppunt over de lijn geven. Null bij niets gevonden, zoals
     Playwright. */
  Page.prototype.$ = async function (sel) {
    const n = await this._roep('function(s){return __rtgdrv.zoekAlle(s).length;}', [sel]);
    return n ? new Greep(this, sel, 0) : null;
  };
  Page.prototype.$$ = async function (sel) {
    const n = await this._roep('function(s){return __rtgdrv.zoekAlle(s).length;}', [sel]);
    const uit = [];
    for (let i = 0; i < n; i++) uit.push(new Greep(this, sel, i));
    return uit;
  };

  /* Een toets indrukken OP een element: eerst de focus daarheen, dan de echte
     aanslag via het toetsenbord. Zonder de focus zou Control+c bij het
     document belanden en niet bij de cel die de toets bedoelt. */
  Page.prototype.press = async function (sel, toets) {
    await this._roep('function(s){var el=__rtgdrv.zoek(s);if(!el)throw new Error("press: niet gevonden "+s);if(el.focus)el.focus();return true;}', [sel]);
    await this.keyboard.press(toets);
  };

  /* Herladen. Page.reload wacht op dezelfde gebeurtenis als goto(), dus we
     hergebruiken die: navigeren naar het huidige adres is voor onze toetsen
     hetzelfde als herladen, en het scheelt een tweede wachtlus die eigen
     fouten kan maken. */
  Page.prototype.reload = async function (opts) {
    const url = await this._roep('function(){return location.href;}', []);
    await this.goto(url, opts);
  };

  /* Een keuzelijst zetten. Playwright accepteert een waarde of {label}; onze
     toetsen gebruiken allebei. De change-gebeurtenis moet erbij, anders ziet
     de app de keuze niet. */
  Page.prototype.selectOption = async function (sel, keuze) {
    const label = keuze && typeof keuze === 'object' ? keuze.label : null;
    const waarde = keuze && typeof keuze === 'object' ? (keuze.value == null ? null : keuze.value) : keuze;
    return this._roep(
      'function(s,w,l){var el=__rtgdrv.zoek(s);if(!el)throw new Error("selectOption: niet gevonden "+s);' +
      'var o=null,i;for(i=0;i<el.options.length;i++){var k=el.options[i];' +
      'if(l!=null?(k.textContent||"").trim()===l:k.value===w){o=k;break;}}' +
      'if(!o)throw new Error("selectOption: geen keuze "+(l!=null?l:w)+" in "+s);' +
      'el.value=o.value;el.dispatchEvent(new Event("input",{bubbles:true}));' +
      'el.dispatchEvent(new Event("change",{bubbles:true}));return o.value;}',
      [sel, waarde, label]);
  };

  /* Wie een luisteraar aanzet moet hem ook kunnen afzetten. Zonder off()
     struikelde test/leven.e2e.js -- de wachter over ALLE schermen -- meteen op
     een TypeError in plaats van op een bewering. */
  Page.prototype.off = function (gebeurtenis, cb) {
    if (gebeurtenis === 'pageerror') this._errCbs = this._errCbs.filter((f) => f !== cb);
    return this;
  };

  /* Het adres en de inhoud van de pagina, en hem sluiten. Drie kleine
     methoden waar toetsen op vielen zodra ze eindelijk zover kwamen: close()
     bij vijf, url() en content() elk bij een. content() geeft de HTML zoals
     hij NU in de DOM staat (niet de bron van de server): daar toetst
     veiligheid.e2e.js mee dat een codewoord na het instellen nergens meer op
     het scherm staat. */
  Page.prototype.url = function () { return this._roep('function(){return location.href;}', []); };
  Page.prototype.content = function () { return this._roep('function(){return document.documentElement.outerHTML;}', []); };
  Page.prototype.close = async function () {
    try { await this.conn.stuur('Target.closeTarget', { targetId: this.targetId }); } catch (e) { /* al weg */ }
  };

  /* Bestanden in een <input type=file>. Een echte bestandskiezer kan een
     driver niet bedienen, dus zetten we de bestanden er via DataTransfer in --
     dat is wat de pagina daarna leest, en het is de enige weg die zonder
     gebruikersgebaar werkt. De inhoud gaat als tekst mee: onze toetsen kiezen
     kleine, zelfgemaakte bestanden. */
  Page.prototype.setInputFiles = async function (sel, bestanden) {
    const lijst = (Array.isArray(bestanden) ? bestanden : [bestanden]).map((b) => ({
      naam: b.name || 'bestand.txt',
      type: b.mimeType || 'text/plain',
      inhoud: b.buffer == null ? '' : String(b.buffer)
    }));
    return this._roep(
      'function(s,l){var el=__rtgdrv.zoek(s);if(!el)throw new Error("setInputFiles: niet gevonden "+s);' +
      'var dt=new DataTransfer();for(var i=0;i<l.length;i++){' +
      'dt.items.add(new File([l[i].inhoud],l[i].naam,{type:l[i].type}));}' +
      'el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));return el.files.length;}',
      [sel, lijst]);
  };
}

module.exports = { rustUit, Greep };
