/* Foundation OS, deel "meldcode": huiselijk geweld en kindermishandeling.

   DIT IS EEN WETTELIJKE VERPLICHTING EN GEEN EXTRA. Een organisatie die met
   kinderen werkt moet een meldcode hebben en die kunnen laten zien. RTF werkt
   met jongerenprojecten, huiswerkklassen en gezinnen -- dus dit hoort erbij,
   niet als beleidsstuk in een map maar als route die iemand kan lopen op het
   moment dat hij iets ziet en het niet weet.

   DE VIJF STAPPEN ZIJN DE WETTELIJKE STAPPEN, in deze volgorde:
     1 signaleren   -- wat zie je, feitelijk
     2 overleggen   -- met de aandachtsfunctionaris, en zo nodig Veilig Thuis
     3 gesprek      -- met de betrokkene, tenzij dat de veiligheid schaadt
     4 wegen        -- ernst en veiligheid, met het afwegingskader
     5 beslissen    -- hulp organiseren of melden, en meestal allebei

   DE GRENDELS:

   - STAP 4 EN 5 KUNNEN NIET ZONDER STAP 2. Wegen en beslissen doe je niet
     alleen. Dat is precies de fout die de meldcode moet voorkomen: een
     welwillende medewerker die in zijn eentje concludeert dat het wel meevalt.
   - STAP 3 MAG WORDEN OVERGESLAGEN, MAAR NIET STIL. Er zijn situaties waarin
     een gesprek de veiligheid van het kind verslechtert; dan hoort er te staan
     WAAROM het gesprek niet is gevoerd.
   - STAP 5 VRAAGT EEN AFWEGING IN WOORDEN. Een keuze zonder motivering is geen
     afweging maar een uitkomst.
   - NIEMAND KAN EEN DOSSIER VERWIJDEREN. Er is in dit bestand geen functie die
     iets weghaalt -- net als bij het incidentenregister. Een dossier dat de
     organisatie kan laten verdwijnen, beschermt de organisatie en niet het kind.

   PRIVACY: het dossier hangt aan de CODENAAM van een hulpvraag of aan een vrije
   omschrijving, nooit aan een naam. De naam staat in de kluis (accounts/kluis),
   en wie hem nodig heeft opent hem daar -- met een auditregel. */

const STAPPEN = ['signaleren', 'overleggen', 'gesprek', 'wegen', 'beslissen'];

/* Het afwegingskader van stap 5 staat in ./meldcode-afweging.js: de twee
   beslissingen, de grendel ertussen, en de afleiding van de uitkomst. Zie de
   kop daar voor waarom dat geen keuzelijst mag zijn. */
const AFW = require('./meldcode-afweging');
const UITKOMSTEN = AFW.UITKOMSTEN;

/* WAARVOOR EEN MELDCODE-DOSSIER IS, EN WAARVOOR NIET.

   De wettelijke meldcode gaat over huiselijk geweld en kindermishandeling.
   "Huiselijk geweld" is daarbij niet beperkt tot kinderen: partnergeweld,
   ouderenmishandeling en eergerelateerd geweld vallen eronder, en een volwassen
   slachtoffer hoort hier dus gewoon thuis.

   Wat er NIET onder valt is geweld en uitbuiting buiten de huiselijke kring:
   een werkgever die iemands paspoort houdt, mensenhandel, een stalker die geen
   familie is. Daar geldt geen meldplicht, gaat de route niet via Veilig Thuis,
   en past deze vijfstappenketen niet. Daarvoor is er sinds september 2026 de
   BESCHERMZAAK (server/kern/beschermzaak/), met een eigen keten en een eigen
   dataklasse.

   Deze lijst weigert dus niet om iemand weg te sturen maar om hem op de
   verkeerde rails te zetten -- en de weigering noemt de goede rails. Dat is het
   verschil met "dit is niets voor u" (FOUNDATION.md par. 5.3). */
const AARD = ['huiselijk-geweld', 'kindermishandeling'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;

  const vind = id => S().meldcodes.find(m => m.id === String(id || '')) || null;
  const gezet = (m, stap) => (m.stappen || []).some(s => s.stap === stap);

  const beeld = m => ({ id: m.id, stad: m.stad, betreft: m.betreft, aard: m.aard || null,
    casusCodenaam: m.casusCodenaam || null,
    status: m.status, geopendOp: m.at, aandachtsfunctionaris: m.aandachtsfunctionaris || null,
    stappen: (m.stappen || []).map(s => ({ stap: s.stap, tekst: s.tekst, door: s.door, at: s.at,
      overgeslagen: !!s.overgeslagen })),
    volgende: STAPPEN.find(s => !gezet(m, s)) || null,
    weging: m.weging || null, besluit: m.besluit || null,
    uitkomst: m.uitkomst || null, gesloten: m.gesloten || null });

  function open(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    const betreft = schoon(b.betreft, 200);
    if (betreft.length < 5) return { status: 400, error: 'Wie of wat betreft het? Een codenaam of een korte, feitelijke aanduiding.' };
    /* De aard bepaalt of dit uberhaupt een meldcode-dossier is. Zie AARD boven:
       de weigering stuurt niemand weg maar wijst de goede rails aan. */
    const aard = String(b.aard || '');
    if (!AARD.includes(aard)) {
      return { status: 400, error: 'Waar gaat dit over: huiselijk-geweld of kindermishandeling? De meldcode geldt ' +
        'voor die twee. Gaat het om uitbuiting, mensenhandel, stalking door iemand buiten de huiselijke kring, of ' +
        'geweld dat daar niet onder valt, open dan een BESCHERMZAAK (/api/rtfos/bescherming/open): daar loopt de ' +
        'route niet via Veilig Thuis en past deze vijfstappenketen niet.' };
    }
    /* Aan een bestaande hulpvraag hangen mag, en dan gaat de CODENAAM mee en
       niet het dossier: een meldcode-dossier is geen onderdeel van het
       hulpverleningsdossier en hoort er ook niet in te lekken. */
    let codenaam = null;
    if (b.casusId) {
      const c = S().casussen.find(x => x.id === String(b.casusId));
      if (!c || c.stad !== g.stad.id) return { status: 404, error: 'Die hulpvraag hoort niet bij deze stad.' };
      codenaam = c.codenaam;
    }
    const m = { id: rid(), stad: g.stad.id, betreft, aard, casusCodenaam: codenaam,
      aandachtsfunctionaris: schoon(b.aandachtsfunctionaris, 60) || null,
      status: 'open', stappen: [], weging: null, besluit: null,
      uitkomst: null, gesloten: null, door: w.key, at: nu() };
    S().meldcodes.push(m);
    audit(w.key, 'meldcode.geopend', m.id, betreft);
    save();
    return { ok: true, dossier: beeld(m),
      melding: 'Dossier geopend. Stap 1 is signaleren: schrijf feitelijk op wat u ziet, zonder duiding.' };
  }

  function stap(req, id, b) {
    b = b || {};
    const m = vind(id);
    if (!m) return { status: 404, error: 'Dit meldcode-dossier bestaat niet.' };
    if (m.gesloten) return { status: 400, error: 'Dit dossier is afgesloten. Een nieuwe zorg is een nieuw dossier.' };
    const w = wie(req);
    const g = poort(w, m.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;

    const naam = STAPPEN.includes(b.stap) ? b.stap : null;
    if (!naam) return { status: 400, error: 'Welke stap? ' + STAPPEN.join(', ') + '.' };
    if (gezet(m, naam)) return { status: 400, error: 'Stap "' + naam + '" staat al in dit dossier.' };

    const overgeslagen = b.overgeslagen === true;
    const tekst = schoon(b.tekst, 1200);

    /* GRENDEL 1: wegen en beslissen kan niet zonder overleg. */
    if ((naam === 'wegen' || naam === 'beslissen') && !gezet(m, 'overleggen')) {
      return { status: 400, error: 'Stap 2 (overleggen) staat nog niet in dit dossier. Wegen en beslissen doet u niet alleen -- ' +
        'dat is precies de fout die de meldcode moet voorkomen.' };
    }
    /* GRENDEL 2: overslaan mag alleen bij het gesprek, en niet zonder reden. */
    if (overgeslagen) {
      if (naam !== 'gesprek') return { status: 400, error: 'Alleen het gesprek met de betrokkene mag worden overgeslagen, en dan met een reden.' };
      if (tekst.length < 15) {
        return { status: 400, error: 'Waarom is het gesprek niet gevoerd? Een gesprek overslaan kan legitiem zijn ' +
          '(als het de veiligheid verslechtert), maar niet stilzwijgend.' };
      }
    } else if (tekst.length < 10) {
      return { status: 400, error: 'Schrijf op wat er bij deze stap is gebeurd. Een stap zonder inhoud is een vinkje.' };
    }
    /* STAP 4 EN 5 DRAGEN NU HET AFWEGINGSKADER (./meldcode-afweging.js). Ze
       staan hier voor de tekstcontrole hieronder, want een dossier waarin de
       weging ontbreekt hoort niet eerst op een tekstlengte te struikelen. */
    if (naam === 'wegen') {
      const stuk = AFW.keurWeging(b); if (stuk) return stuk;
    }
    if (naam === 'beslissen') {
      const stuk = AFW.keurBesluit(b, m.weging); if (stuk) return stuk;
    }
    if (naam === 'overleggen' && !m.aandachtsfunctionaris && !schoon(b.metWie, 60)) {
      return { status: 400, error: 'Met wie is overlegd? Een overleg zonder tegenpartij is geen overleg.' };
    }
    if (naam === 'overleggen' && schoon(b.metWie, 60)) m.aandachtsfunctionaris = schoon(b.metWie, 60);

    if (naam === 'wegen') m.weging = { acuut: b.acuut, structureel: b.structureel, door: w.key, at: nu() };
    if (naam === 'beslissen') {
      m.besluit = { meldenNoodzakelijk: b.meldenNoodzakelijk, hulpMogelijk: b.hulpMogelijk,
        hulpToelichting: schoon(b.hulpToelichting, 600) || null, door: w.key, at: nu() };
      /* De uitkomst wordt hier AFGELEID en bij het sluiten niet opnieuw
         gevraagd: twee plekken die hetzelfde zeggen lopen uiteen, en hier zou
         dat betekenen dat een dossier een uitkomst draagt die niet volgt uit de
         afweging eronder. */
      m.uitkomst = AFW.uitkomstVan(b.meldenNoodzakelijk, b.hulpMogelijk);
    }
    if (!Array.isArray(m.stappen)) m.stappen = [];
    m.stappen.push({ stap: naam, tekst, overgeslagen, door: w.key, at: nu() });
    m.status = naam === 'beslissen' ? 'afgewogen' : 'in_behandeling';
    audit(w.key, 'meldcode.stap', m.id, naam + (overgeslagen ? ' (overgeslagen)' : ''));
    save();
    return { ok: true, dossier: beeld(m) };
  }

  /* Sluiten en de lijst staan in ./meldcode-sluiten.js -- dit bestand liep over
     de 10 KB van keuringsregel 13 toen het afwegingskader erbij kwam. */
  const s = require('./meldcode-sluiten')(ctx, { vind, beeld, gezet, STAPPEN, UITKOMSTEN });

  return { open, stap, sluit: s.sluit, lijst: s.lijst, vind, beeld, STAPPEN, UITKOMSTEN, AARD };
};
module.exports.STAPPEN = STAPPEN;
module.exports.UITKOMSTEN = UITKOMSTEN;
