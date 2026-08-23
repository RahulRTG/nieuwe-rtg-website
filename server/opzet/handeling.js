/* ============================================================================
   DE HANDELING -- wat heeft dit verzoek werkelijk veranderd?

   WAAROM DIT ER IS. `server/opzet/envelop.js` legt bij de poortwachter vast WIE
   er handelt. Wat daar niet in staat -- en niet in kan staan -- is WAT er
   verandert: `doel` en `wijzigingen` kent een poortwachter niet, want die
   ontstaan pas als de handeling gebeurd is. Zonder die twee is er geen blast
   radius te berekenen, en zonder blast radius geen risicobudget en geen
   bewijsbonnetje. Dit bestand is de tweede helft van die brug.

   HET SCHRIJFPAD BLIJFT ONGEMOEID, en dat is de belangrijkste ontwerpkeuze.
   De voor de hand liggende plek was `save()` in server/db/index.js -- de ene
   functie waar 2700 aanroepen doorheen gaan. Maar daar zou de meting per
   SCHRIJFACTIE gebeuren (vaak meerdere per verzoek), op het heetste pad van het
   huis, in een functie die geld vastlegt. De vraag die blast radius stelt is een
   andere: wat heeft DIT VERZOEK veranderd. Dus meten we bij het begin en het
   eind van het verzoek, en raakt save() niets aan. Eén meting per verzoek in
   plaats van een per schrijfactie, en nul risico op de weg waar het geld loopt.

   HOE HET VERZOEK EN DE OPSLAG ELKAAR VINDEN. Via AsyncLocalStorage, precies
   zoals server/db/bijeen.js dat al doet voor de save-bundel. Dat is geen nieuwe
   truc maar een bestaande, en hem hier nabouwen zou een tweede contextmechanisme
   geven dat het eerste niet kent (LAT.md regel 4).

   WAT ER GEMETEN WORDT, en waarom juist dat. Per top-level collectie in db.data
   het AANTAL RIJEN, bij het begin en aan het eind. Het verschil is de
   handeling: `+1 boekingen` bij een normale reservering, `-4280 medewerkers` bij
   een massaverwijdering. Dat tweede getal is precies waar een blast-radius-grens
   op hoort te staan, en het is er nu.

   WAT DEZE METING NIET ZIET, en dat hoort er hard bij te staan:

   - EEN WIJZIGING BINNEN EEN RIJ. Vierduizend medewerkers op non-actief zetten
     verandert geen enkel rij-aantal en is hier onzichtbaar. Dat is de grootste
     blinde vlek en hij is bewust geaccepteerd: het alternatief is een diep diff
     over de hele database bij elk verzoek, en dat kost meer dan het waard is.
     Wie die klasse wil vangen, hoort de handeling zelf te laten zeggen wat hij
     aanraakt -- daar is `raakt()` voor, en die is vandaag nog nergens aangeroepen.
   - VERVANGING MET GELIJK AANTAL. Vijf rijen weg en vijf erbij is delta nul.
   - WAT ER NIET DOOR EEN VERZOEK KOMT. Een cronjob, de onderhoudsveger of een
     migratie draait buiten deze context; die zijn hier onzichtbaar en horen dat
     ook te zijn -- een actor die geen verzoek is, is een andere vraag.

   Er staat dus geen "alles is gedekt" onder. Er staat: dit is de vorm van
   handeling die we WEL kunnen zien, en de rest is opgeschreven in plaats van
   weggemiddeld.

   WAT HET KOST, gemeten en niet geschat. Op een db.data met 450 top-level
   sleutels (300 arrays) duurt een telling 60 microseconden; twee per verzoek plus
   het verschil is ~0,13 ms. De lat in BEPROEVING.json staat op p50 13 ms, dus dat
   is ongeveer een procent van een mediaan verzoek. Een snellere vorm (twee losse
   arrays in plaats van een Map) scheelde 14 microseconden -- een tiende procent
   van p50 -- en dat is hier de leesbaarheid niet waard.
   ========================================================================== */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const context = new AsyncLocalStorage();

/* De grens waarboven een handeling het vermelden waard is. Bewust geen blokkade:
   dit is een MELDER en geen poort. Een grens die tegenhoudt hoort bij een besluit
   over wat een actor mag, en die staat er nog niet -- er iets van maken dat stil
   dingen weigert zou erger zijn dan geen grens. */
const GRENS = (() => {
  const n = Number(process.env.RTG_HANDELING_GRENS);
  return Number.isFinite(n) && n > 0 ? n : 250;
})();

/* Alleen top-level arrays tellen. Een object of een getal in db.data is geen
   collectie met rijen, en meetellen zou het getal betekenisloos maken. */
function tel(data) {
  const uit = new Map();
  if (!data || typeof data !== 'object') return uit;
  for (const sleutel of Object.keys(data)) {
    const v = data[sleutel];
    if (Array.isArray(v)) uit.set(sleutel, v.length);
  }
  return uit;
}

/* Het verschil tussen twee tellingen. Een collectie die nieuw is telt als groei
   vanaf nul; een die verdwenen is als krimp naar nul -- allebei zijn het echte
   gebeurtenissen en geen meetruis. */
function verschil(voor, na) {
  const wijzigingen = [];
  const sleutels = new Set([...voor.keys(), ...na.keys()]);
  for (const s of sleutels) {
    const van = voor.has(s) ? voor.get(s) : 0;
    const naar = na.has(s) ? na.get(s) : 0;
    if (van !== naar) wijzigingen.push({ collectie: s, van, naar, delta: naar - van });
  }
  // grootste beweging eerst: wie dit leest wil weten wat er het meest gebeurde
  wijzigingen.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return wijzigingen;
}

/* De huidige handeling, of null buiten een verzoek. Bewust null en geen leeg
   object: wie null krijgt weet dat hij buiten een verzoek draait en kan dat
   melden, in plaats van een handeling met nul wijzigingen te lezen die er nooit
   was (LAT.md regel 3 -- stilvallen is geen uitkomst). */
function huidige() {
  return context.getStore() || null;
}

/* Een handeling laten zeggen wat hij aanraakt, voor de gevallen die een
   rij-telling niet ziet (een wijziging BINNEN een rij). Vandaag nog nergens
   aangeroepen, en dat staat zo in de kop -- een functie die er is en niets doet
   is een voornemen, geen dekking. */
function raakt(soort, aantal) {
  const h = huidige();
  if (!h) return false;
  const n = Number(aantal);
  h.gemeld.push({ soort: String(soort || 'onbekend').slice(0, 60), aantal: Number.isFinite(n) ? n : 1 });
  return true;
}

/* De meting afsluiten en de uitslag teruggeven. Apart van de middleware zodat
   een toets hem kan aanroepen zonder een server op te zetten -- en zodat de
   optelling die op het scherm komt dezelfde is als die een toets ijkt. */
function sluit(h, data) {
  if (!h || h.gesloten) return h || null;
  h.gesloten = true;
  try {
    h.wijzigingen = verschil(h.voor, tel(data));
    h.geraakt = h.wijzigingen.reduce((n, w) => n + Math.abs(w.delta), 0)
      + h.gemeld.reduce((n, g) => n + Math.abs(g.aantal), 0);
    h.doel = h.wijzigingen.map(w => w.collectie);
  } catch (e) {
    /* Niets slaat stil over (LAT.md regel 5). Een meting die niet af kwam is een
       meting met een reden, en nooit een stille nul -- die zou als "dit verzoek
       veranderde niets" gelezen worden. */
    h.fout = String((e && e.message) || e).slice(0, 200);
    h.geraakt = null;
  }
  h.voor = null;   // de grondtelling hoeft niet mee het geheugen in na afloop
  return h;
}

/* De middleware. Hij hangt de handeling om het HELE verzoek: alles wat de routes
   daarna doen valt binnen deze context, inclusief timers die zij zetten. */
function middleware(deps) {
  const geefData = (deps && deps.data) || (() => {
    try { return require('../db').db.data; } catch (e) { return null; }
  });
  const meld = (deps && deps.log) || ((niveau, bericht, velden) => {
    try { require('../log').log[niveau](bericht, velden); } catch (e) {}
  });

  return function handelingMiddleware(req, res, next) {
    let data = null;
    try { data = geefData(); } catch (e) { data = null; }
    const h = {
      correlatie: (req && req.id) || null,
      pad: (req && req.path) || null,
      methode: (req && req.method) || null,
      voor: tel(data),
      gemeld: [],
      wijzigingen: [],
      geraakt: 0,
      doel: [],
      gesloten: false
    };
    try { if (req) req.handeling = h; } catch (e) { /* bevroren req: dan alleen in de context */ }

    res.on('finish', () => {
      let laatste = null;
      try { laatste = geefData(); } catch (e) { laatste = null; }
      sluit(h, laatste);
      /* DE MELDING. Boven de grens is dit het enige spoor dat zegt "dit ene
         verzoek raakte zoveel rijen" -- de eerste vorm van blast radius die dit
         huis kent. Onder de grens gebeurt er niets, want een regel per verzoek
         is geen signaal maar ruis. */
      if (h.geraakt != null && h.geraakt >= GRENS) {
        meld('warn', 'grote handeling', {
          id: h.correlatie, m: h.methode, p: h.pad, rijen: h.geraakt,
          waar: h.wijzigingen.slice(0, 5).map(w => w.collectie + (w.delta > 0 ? '+' : '') + w.delta).join(' ')
        });
      }
      if (h.fout) meld('warn', 'handelingsmeting mislukt', { id: h.correlatie, p: h.pad, fout: h.fout });
    });

    context.run(h, () => next());
  };
}

module.exports = { middleware, huidige, raakt, sluit, tel, verschil, GRENS };
