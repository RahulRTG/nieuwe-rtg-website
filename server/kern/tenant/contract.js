/* ============================================================================
   HET CONTRACT EN HET QUOTUM -- wat een tenant mag, en hoeveel.

   TWEE DINGEN DIE DIT BEWUST NIET IS

   1. GEEN NOODKNOP. Een verlopen contract sluit niemand buiten. Het weigert
      NIEUWE inrichting (een werkruimte erbij, een groepsafbeelding erbij), en
      verder niets: de mensen die er werken blijven werken en de uitvoer blijft
      open. Toegang sluiten is een handeling in de levensloop -- met een reden,
      een actor en een spoor -- en geen bijwerking van een openstaande factuur.
      Zou een factuur dat wel kunnen, dan hebben wij een knop waarmee we het
      bedrijf van een klant stilleggen, en die knop hoort niet te bestaan.

   2. GEEN VERZONNEN GRENZEN. In het contract staan alleen grenzen die hier ook
      WORDEN AFGEDWONGEN. Wat een verkooppraatje verder belooft (opslag,
      supportvenster, hersteltijd) staat in `nietAfgedwongen` met de reden --
      een grens in een object waar geen enkele regel code naar kijkt, leest voor
      elk scherm als een werkende limiet.

   HET QUOTUM OVERLEEFT EEN HERSTART, dezelfde eis die kern/command/apipoort.js
   aan zichzelf stelt: een teller die bij elke herstart op nul begint is geen
   quotum maar een suggestie -- en juist een tenant die te hard loopt,
   veroorzaakt de herstart. Hij staat daarom in de opslag, per uur,
   en save() is write-behind dus het kost geen schrijfactie per verzoek.

   WAAROM PER TENANT EN NIET PER IP. De rem op de deur (middleware/remmen.js)
   telt per IP en beschermt de server; die zegt niets over wie er te veel
   gebruikt. Honderd medewerkers van een klant komen van honderd adressen, en
   een klant achter een kantoorproxy met honderd man van één. Pas per tenant is
   "u zit aan uw grens" een zin die klopt en die iemand kan oplossen -- en gaat
   iemand eroverheen, dan merkt hij het zelf en niet zijn buurman.
   ========================================================================== */
'use strict';
const { nu: klokNu, datum: klokDatum } = require('../../lib/klok');

const UUR = 3600000;

/* De pakketten. Bewust een KORTE lijst met ronde getallen: een prijslijst met
   veertien varianten is een prijslijst die niemand meer kan uitleggen, en elke
   variant hier is een gedragsverschil dat ergens moet worden afgedwongen. */
const PAKKETTEN = {
  proef: { naam: 'Proef', werkruimtes: 1, apiPerUur: 2000 },
  zakelijk: { naam: 'Zakelijk', werkruimtes: 5, apiPerUur: 20000 },
  concern: { naam: 'Concern', werkruimtes: 50, apiPerUur: 200000 }
};

/* Wat een verkooptekst ook belooft, hier wordt het niet gemeten. Met naam en
   reden, want een lege lijst leest als volledige dekking. */
const NIET_AFGEDWONGEN = [
  { grens: 'opslag', reden: 'Bijlagen en media van een werkruimte worden nergens per tenant opgeteld.' },
  { grens: 'aantal leden', reden: 'Toelaten gebeurt in de werkruimte zelf; die laag kent het contract niet en krijgt er geen tweede poort bij.' },
  { grens: 'supportvenster', reden: 'Er is geen ticketsysteem dat een reactietijd meet, dus een venster zou een belofte zonder meter zijn.' },
  { grens: 'hersteltijd (RPO/RTO)', reden: 'De backups draaien en zijn getoetst, maar niet per tenant en niet tegen een afgesproken tijd.' }
];

module.exports = ({ db, save, schoon }) => {
  const nu = () => klokDatum().toISOString();
  const eigen = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, String(k)) ? o[String(k)] : null);
  const haal = (org) => eigen(db.data.tenants || {}, String(org || '').trim().toUpperCase());

  function pot(t) {
    if (!t.contract) t.contract = { pakket: 'proef', ingegaan: t.bij || nu(), tot: null, door: null };
    return t.contract;
  }
  const loopt = (c) => !c.tot || Date.parse(c.tot) > klokNu();
  const grenzenVan = (c) => {
    const p = PAKKETTEN[c.pakket] || PAKKETTEN.proef;
    return { werkruimtes: c.werkruimtes != null ? c.werkruimtes : p.werkruimtes,
      apiPerUur: c.apiPerUur != null ? c.apiPerUur : p.apiPerUur };
  };

  /* ---------- lezen ---------- */
  function van(org) {
    const t = haal(org);
    if (!t) return null;
    const c = pot(t);
    const g = grenzenVan(c);
    return {
      org: t.org, pakket: c.pakket, naam: (PAKKETTEN[c.pakket] || PAKKETTEN.proef).naam,
      ingegaan: c.ingegaan, tot: c.tot || null, loopt: loopt(c),
      grenzen: g,
      verbruik: { werkruimtes: t.werkruimtes.length, apiDitUur: uurteller(t).n, uurGrens: g.apiPerUur },
      nietAfgedwongen: NIET_AFGEDWONGEN,
      let: loopt(c) ? null
        : 'Dit contract is verlopen. Er komt geen nieuwe inrichting meer bij; wie er werkt blijft werken en de uitvoer blijft open. ' +
          'Toegang sluiten is een handeling in de levensloop en geen gevolg van een factuur.'
    };
  }

  /* ---------- zetten (de eigenaar) ---------- */
  function zet(org, opdracht) {
    const o = opdracht || {};
    const t = haal(org);
    if (!t) return { error: 'Die tenant kennen we niet.', status: 404 };
    const c = pot(t);
    if (o.pakket != null) {
      const p = String(o.pakket);
      if (!PAKKETTEN[p]) return { error: 'Een pakket is: ' + Object.keys(PAKKETTEN).join(', ') + '.', status: 400 };
      c.pakket = p;
      /* Een pakketwissel zet de handmatige uitzonderingen terug. Anders blijft
         een ruimere grens die ooit bij een groter pakket hoorde stilletjes
         staan na een downgrade -- en dan klopt de factuur niet meer bij wat de
         klant kan. */
      delete c.werkruimtes; delete c.apiPerUur;
    }
    if (o.tot !== undefined) {
      if (o.tot === null || o.tot === '') c.tot = null;
      else {
        const d = schoon(o.tot, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: 'Een einddatum is jjjj-mm-dd, of leeg voor onbepaalde tijd.', status: 400 };
        c.tot = d;
      }
    }
    /* Een uitzondering op een grens mag, maar alleen omhoog en met een reden --
       een grens die stil naar beneden gaat, valt pas op als een klant vastloopt. */
    for (const veld of ['werkruimtes', 'apiPerUur']) {
      if (o[veld] == null) continue;
      const n = Number(o[veld]);
      const standaard = (PAKKETTEN[c.pakket] || PAKKETTEN.proef)[veld];
      if (!Number.isFinite(n) || n < standaard)
        return { error: 'Een uitzondering op "' + veld + '" gaat alleen omhoog; het pakket geeft al ' + standaard + '.', status: 400 };
      if (!schoon(o.reden, 200)) return { error: 'Noteer waarom deze tenant meer krijgt dan zijn pakket.', status: 400 };
      c[veld] = n;
    }
    c.door = schoon(o.door, 80) || 'eigenaar';
    c.reden = schoon(o.reden, 200) || c.reden || null;
    c.bij = nu();
    save();
    return { ok: true, contract: van(org) };
  }

  /* ---------- de grens op de inrichting ----------
     Wordt aangeroepen vanuit register.bind(), zodat de regel geldt waar de
     handeling is en niet alleen waar de route is. */
  function magWerkruimteErbij(org) {
    const t = haal(org);
    if (!t) return { ok: true };                       // geen tenant: geen contractgrens
    const c = pot(t);
    const g = grenzenVan(c);
    if (!loopt(c))
      return { ok: false, reden: 'Het contract van ' + t.org + ' is verlopen op ' + c.tot + '. Er komt geen inrichting meer bij tot het is verlengd; wat er draait blijft draaien.' };
    if (t.werkruimtes.length >= g.werkruimtes)
      return { ok: false, reden: 'Het pakket "' + c.pakket + '" geeft ' + g.werkruimtes + ' werkruimte(s), en die zijn in gebruik.' };
    return { ok: true };
  }

  /* ---------- het quotum ---------- */
  function uurteller(t) {
    const c = pot(t);
    const uur = Math.floor(klokNu() / UUR);
    if (!c.teller || c.teller.uur !== uur) c.teller = { uur, n: 0, geweigerd: 0 };
    return c.teller;
  }

  /* Hoe vaak de teller naar de SCHIJF gaat. De teller staat altijd in db.data
     en klopt dus binnen het proces tot op het verzoek; save() is de weg naar
     schijf, en die loopt bij SQLite langs een JSON.stringify van ELKE
     collectie. Per verzoek save() aanroepen maakt van elke LEESactie in een
     werkruimte een schrijfactie op het hele bestand.

     Dus: eerste verzoek van een uur, elke VLOEDLIJN verzoeken, en elke
     weigering. De prijs staat erbij: bij een herstart gaan hooguit
     VLOEDLIJN-1 tellingen verloren. Dit is een eerlijkheidsgrens en geen
     betaalmeter -- wie er structureel doorheen loopt haalt de grens ook met
     vierentwintig verzoeken minder. Zie TENANT.md. */
  const VLOEDLIJN = 25;

  /* Eén verzoek meetellen. Geeft terug of het nog mag. */
  function tel(org) {
    const t = haal(org);
    if (!t) return { ok: true, buitenContract: true };
    const c = pot(t);
    const g = grenzenVan(c);
    const teller = uurteller(t);
    if (teller.n >= g.apiPerUur) {
      teller.geweigerd++;
      save();                                   // een weigering is zeldzaam en telt zwaar
      return { ok: false, gebruikt: teller.n, grens: g.apiPerUur,
        reden: 'Deze organisatie zit aan haar uurgrens van ' + g.apiPerUur + ' verzoeken (pakket "' + c.pakket + '"). ' +
          'Over een uur telt hij opnieuw. Uitvoer van uw gegevens wordt nooit geweigerd.' };
    }
    teller.n++;
    if (teller.n === 1 || teller.n % VLOEDLIJN === 0) save();
    return { ok: true, gebruikt: teller.n, grens: g.apiPerUur };
  }

  return { van, zet, magWerkruimteErbij, tel, PAKKETTEN, NIET_AFGEDWONGEN, VLOEDLIJN };
};
