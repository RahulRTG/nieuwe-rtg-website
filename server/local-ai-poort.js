/* ============================================================================
   DE POORT VOOR DE EIGEN MODELSERVER: EEN EIGEN GPU IS GEEN WOLK.

   Een externe aanbieder schaalt mee; een eigen modelserver niet. Die doet er
   twee, misschien vier tegelijk, en daarboven wordt hij niet langzamer maar
   STUK: alles kruipt, alles loopt in de timeout, en de uitwijkketen stuurt
   vervolgens ALLES naar de betaalde aanbieder. Dat is de dure faalstand, en hij
   is stil -- de rekening ziet hem eerder dan een mens, en ondertussen verlaat
   de inhoud wel het huis.

   TWEE KLEPPEN DAARTEGEN, en ze staan HIER en niet in de HTTP-laag eronder:
   die bedient ook de betaalprovider en weet niets van een GPU.

   1. HOEVEEL TEGELIJK. Standaard twee, met een wachtrij. Wie te lang moet
      wachten geeft op en de keten wijkt uit -- want een lid drie minuten laten
      wachten is erger dan de vraag naar buiten sturen. Waar die grens ligt is
      een keuze en geen natuurwet, dus hij staat in de env.

   2. WANNEER WE HET OPGEVEN. Blijft de server hangen (niet weigeren, maar
      hangen), dan betaalt ELK verzoek eerst de volle timeout voordat de uitwijk
      begint. Na een paar storingen op rij slaat de onderbreker aan en slaan we
      lokaal over -- meteen extern, geen minuten wachten. Daarna mag er weer een
      verzoek langs om te kijken of hij terug is; lukt dat, dan gaat de klep
      dicht. Dat is het halfopen-gedrag, zonder een derde toestand.

   Beide standen zijn af te lezen (staat()), zodat het luik op de meter
   (routes/techniek/aikosten.js) kan laten zien dat de eigen server aan het
   worstelen is. Zonder dat zie je alleen dat het aandeel extern oploopt, en
   niet waarom.

   WAAROM APART VAN ./local-ai.js. Dat bestand kiest een model per soort vraag
   en bewaakt de netwerkgrens (loopback of eigen netwerk, nooit publiek). Dit
   bewaakt CAPACITEIT. Twee onderwerpen, en de poort is bovendien los te
   beproeven met een nagemaakte modelserver -- zie test/lokale-ai-poort.test.js.
   ========================================================================== */
'use strict';
/* De tijd uit de klok van dit huis. Het herstelvenster hieronder is tijdgedrag,
   en met server/lib/klok.js is dat te beproeven (RTG_KLOK) zonder een halve
   minuut te moeten wachten. */
const klok = require('./lib/klok');

/* NUL IS EEN ANTWOORD, GEEN LEEGTE. Hier stond `Number(x) || standaard`, en
   daarmee werd LOCAL_AI_WACHT_MS=0 stilletjes 20000 en LOCAL_AI_HERSTEL_MS=0
   stilletjes 30000 -- terwijl nul juist iets zegt: "niet in de rij, meteen
   uitwijken" en "geen herstelvenster". Wie dat zette kreeg het
   tegenovergestelde van wat hij vroeg, zonder melding. */
const getal = (uitOpts, uitEnv, standaard, minimum) => {
  const rauw = uitOpts != null ? uitOpts : uitEnv;
  const n = Number(rauw);
  return Math.max(minimum, (rauw != null && rauw !== '' && Number.isFinite(n)) ? n : standaard);
};

class Poort {
  constructor(opts) {
    opts = opts || {};
    this.gelijktijdig = getal(opts.gelijktijdig, process.env.LOCAL_AI_GELIJKTIJDIG, 2, 1);
    this.wachtMs = getal(opts.wachtMs, process.env.LOCAL_AI_WACHT_MS, 20000, 0);
    this.storingsgrens = getal(opts.storingsgrens, process.env.LOCAL_AI_STORINGSGRENS, 3, 1);
    this.herstelMs = getal(opts.herstelMs, process.env.LOCAL_AI_HERSTEL_MS, 30000, 0);
    this._bezig = 0;
    this._rij = [];
    this._storingen = 0;
    this._openTot = 0;
  }

  /* Staat de onderbreker open? Zo ja, dan slaan we lokaal over in plaats van de
     timeout te betalen. Zodra het herstelvenster om is mag er weer een verzoek
     langs; faalt die, dan staat _storingen nog boven de grens en gaat de klep
     meteen weer open. */
  onderbrokenTot(nu) { return this._openTot > (nu || klok.nu()) ? this._openTot : 0; }

  staat(nu) {
    const open = this.onderbrokenTot(nu);
    return {
      bezig: this._bezig, wachtend: this._rij.length, gelijktijdig: this.gelijktijdig,
      storingen: this._storingen, onderbroken: !!open,
      onderbrokenNog: open ? Math.max(0, open - (nu || klok.nu())) : 0
    };
  }

  _neemSlot() {
    if (this._bezig < this.gelijktijdig) { this._bezig += 1; return Promise.resolve(true); }
    return new Promise((klaar) => {
      const plek = { klaar, klok: null, af: false };
      const geef = (ok) => { if (plek.af) return; plek.af = true; if (plek.klok) clearTimeout(plek.klok);
        const i = this._rij.indexOf(plek); if (i !== -1) this._rij.splice(i, 1); klaar(ok); };
      plek.geef = geef;
      /* Niet oneindig wachten: dan staat een lid naar een leeg scherm te kijken
         terwijl de uitwijk allang had kunnen antwoorden. */
      if (this.wachtMs > 0) { plek.klok = setTimeout(() => geef(false), this.wachtMs); if (plek.klok.unref) plek.klok.unref(); }
      else return geef(false);
      this._rij.push(plek);
    });
  }

  _geefSlotTerug() {
    const volgende = this._rij.shift();
    if (volgende) { volgende.af = true; if (volgende.klok) clearTimeout(volgende.klok); volgende.klaar(true); return; }
    this._bezig = Math.max(0, this._bezig - 1);
  }

  async door(werk) {
    const nu = klok.nu();
    if (this.onderbrokenTot(nu)) {
      throw Object.assign(new Error('De eigen modelserver is tijdelijk overgeslagen na herhaalde storingen.'),
        { code: 'LOKAAL_ONDERBROKEN' });
    }
    if (!(await this._neemSlot())) {
      throw Object.assign(new Error('De eigen modelserver is bezet; de wachttijd is verstreken.'),
        { code: 'LOKAAL_BEZET' });
    }
    try {
      const uit = await werk();
      this._storingen = 0;
      this._openTot = 0;
      return uit;
    } catch (e) {
      this._storingen += 1;
      if (this._storingen >= this.storingsgrens) this._openTot = klok.nu() + this.herstelMs;
      throw e;
    } finally {
      this._geefSlotTerug();
    }
  }
}

module.exports = { Poort };
