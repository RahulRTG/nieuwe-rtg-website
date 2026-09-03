/* ============================================================================
   DE HANDELING -- wat heeft dit verzoek werkelijk veranderd?

   WAAROM DIT ER IS. `server/opzet/envelop.js` legt bij de poortwachter vast WIE
   er handelt. Wat daar niet in staat -- en niet in kan staan -- is WAT er
   verandert: `doel` en `wijzigingen` kent een poortwachter niet, want die
   ontstaan pas als de handeling gebeurd is. Zonder die twee is er geen blast
   radius te berekenen, en zonder blast radius geen risicobudget en geen
   bewijsbonnetje. Dit bestand is de tweede helft van die brug.

   HET SCHRIJFPAD BLIJFT ONGEMOEID, en dat is de belangrijkste ontwerpkeuze. De
   voor de hand liggende plek was `save()` in server/db/index.js -- de ene functie
   waar 2700 aanroepen doorheen gaan. Daar zou de meting per SCHRIJFACTIE
   gebeuren (vaak meerdere per verzoek), op het heetste pad van het huis, in een
   functie die geld vastlegt. Maar blast radius vraagt iets anders: wat heeft DIT
   VERZOEK veranderd. Dus meten we aan het begin en het eind van het verzoek --
   een meting per verzoek, en nul risico op de weg waar het geld loopt.

   HOE HET VERZOEK EN DE OPSLAG ELKAAR VINDEN. Via AsyncLocalStorage, precies
   zoals server/db/bijeen.js dat al doet voor de save-bundel. Dat is geen nieuwe
   truc maar een bestaande, en hem hier nabouwen zou een tweede contextmechanisme
   geven dat het eerste niet kent (LAT.md regel 4).

   EN DIE CONTEXT OVERLEEFT HET LEZEN VAN DE BODY NIET: server/web/body.js leest
   met req.on('end'), en die luisteraar hangt aan een async-bron van voor
   context.run(). Elke POST met een body raakte de winkel dus kwijt -- en dat is
   elke mutatie. hervat() zet de keten na de lijfpoort terug; het verhaal staat
   in test/begrotingroute.test.js, die hem vond.

   Er staat dus geen "alles is gedekt" onder. Er staat: dit is de vorm van
   handeling die we WEL kunnen zien, en de rest is opgeschreven in plaats van
   weggemiddeld.

   ========================================================================== */
'use strict';

const { AsyncLocalStorage } = require('async_hooks');
/* De rij-telling staat apart in ./handelingtelling.js, met de kop over WAT er
   gemeten wordt, wat die meting NIET ziet en wat hij kost erbij. */
const { tel, verschil } = require('./handelingtelling');
const context = new AsyncLocalStorage();

/* De grens waarboven een handeling het vermelden waard is. Bewust geen blokkade:
   dit is een MELDER en geen poort. Een grens die tegenhoudt hoort bij een besluit
   over wat een actor mag, en die staat er nog niet -- er iets van maken dat stil
   dingen weigert zou erger zijn dan geen grens. */
const GRENS = (() => {
  const n = Number(process.env.RTG_HANDELING_GRENS);
  return Number.isFinite(n) && n > 0 ? n : 250;
})();

/* De huidige handeling, of null buiten een verzoek. Bewust null en geen leeg
   object: wie null krijgt weet dat hij buiten een verzoek draait en kan dat
   melden, in plaats van een handeling met nul wijzigingen te lezen die er nooit
   was (LAT.md regel 3 -- stilvallen is geen uitkomst). */
function huidige() {
  return context.getStore() || null;
}

/* Een handeling laten zeggen wat hij aanraakt, voor wat een rij-telling niet
   ziet (een wijziging BINNEN een rij). HIJ MELDT EN HIJ WEIGERT NIET: buiten een
   verzoek geeft hij false, en een aanroeper mag dat nooit als toestemming lezen
   -- anders liep een loonrun vast op een meting. */
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
function sluit(h, data, klasse) {
  if (!h || h.gesloten) return h || null;
  h.gesloten = true;
  /* WAT VOOR HANDELING DIT WAS (TAKEN.md 4.71). `risicoklasse` en
     `omkeerbaarheid` waren twee van de drie dakloze envelopvelden; ze horen
     hier en niet op de envelop, want de kop daar zegt met recht dat een
     poortwachter ze niet kent. kern/handelingsklasse.js leidt ze af uit vier
     bronnen die dit huis AL heeft, met een bron en een bewijsgraad per waarde
     en `onbekend` als eersteklas uitslag. Meegegeven en niet hier gerequired:
     zo is deze meting los te draaien zonder de registers. */
  if (typeof klasse === 'function') {
    try { Object.assign(h, klasse(h.methode, h.pad)); } catch (e) { h.klassefout = true; }
  }
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
  const klasse = deps && deps.klasse;
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
      sluit(h, laatste, klasse);
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

/* De herstelpoort. Het waarom staat in de kop; hier de keuze en de rest-gaten.

   Bewust context.run() en niet enterWith(): die tweede verandert de OMLIGGENDE
   context, en op een keep-alive-verbinding kan dat de handeling van het ene
   verzoek in het volgende laten doorlekken.

   WAT ER BUITEN VALT: routes die de body ZELF rauw lezen. De betaal-webhooks
   staan met opzet VOOR het ontleden (een handtekening gaat over de rauwe body)
   en komen hier nooit langs; de theater-upload leest zijn eigen stroom erna.
   Voor allebei geldt: de begroting ziet ze niet. Een tweede express.json() op
   een route is geen gat -- die ziet req._body al gezet en leest niets. */
function hervat() {
  return function handelingHervat(req, res, next) {
    const h = req && req.handeling;
    if (!h || context.getStore() === h) return next();
    return context.run(h, () => next());
  };
}

module.exports = { middleware, hervat, huidige, raakt, sluit, tel, verschil, GRENS };
