/* DE KANSVERKENNING: wat de eigen data over dit idee zegt, en wat niet.

   DEZE MODULE IS EEN METER, EN LAT-REGEL 10 GAAT OVER METERS. Een score van
   87/100 ziet eruit als een feit, wordt overgeschreven in een ondernemingsplan
   en daarna aan een bank getoond. Niemand vraagt dan nog waar hij op rustte.
   Daarom zijn hier drie dingen hard:

   1. NIET GEMETEN IS NIET NUL. Een bron waarvoor geen data bestaat levert geen
      punten en telt ook niet mee in de noemer. Zou hij als nul meetellen, dan
      krijgt een leeg platform automatisch een lage score en leest een gebrek
      aan meting als een gebrek aan kans. Dit is dezelfde regel die het
      gemeentenportaal van de RTFoundation al hanteert.
   2. ONDER TWEE GEMETEN BRONNEN GEEN CIJFER. Dan is de uitkomst `null` met de
      reden erbij, en niet een getal met een slag om de arm. Een cijfer met een
      voorbehoud eronder wordt een cijfer zodra iemand het overtypt.
   3. DE GRONDSLAG GAAT MEE. Elk antwoord draagt per bron of hij gemeten is,
      welke waarde eruit kwam en hoeveel punten dat gaf. Wie het cijfer wil
      wantrouwen, kan dat.

   De bronnen zijn bestaande RTG-data en er komt geen nieuw register bij: de
   zaken zelf, hun boekingen en bonnen, hun vacatures, en de leegstand uit het
   stadsweefsel als een stad die heeft ingevuld. */
'use strict';

const meter = require('./meter');

/* Onder dit aantal gemeten bronnen geven we geen cijfer. Twee is laag, en
   bewust: het is het punt waarop een cijfer nog íets zegt. */
const MIN_BRONNEN = 2;
const MAX_PUNTEN = 25;

/* De concurrentiecurve. Geen concurrentie is NIET de beste stand -- een markt
   waar niemand zit, is vaker een markt die niet bestaat dan een gat. Matige
   dichtheid scoort daarom het hoogst, en dat staat ook in de uitleg, want een
   ondernemer die 'weinig concurrentie = goed' verwacht moet kunnen zien dat wij
   dat niet vinden. */
function concurrentiePunten(n) {
  if (n === 0) return { punten: 12, uitleg: 'Niemand in deze plaats doet dit binnen RTG. Dat kan een gat zijn, maar even vaak een markt die er niet is -- zoek uit waarom er niemand zit.' };
  if (n <= 3) return { punten: 25, uitleg: 'Een handvol aanbieders: er is vraag, en er is nog ruimte.' };
  if (n <= 8) return { punten: 17, uitleg: 'Een gevulde markt. U heeft een duidelijk onderscheid nodig.' };
  if (n <= 15) return { punten: 9, uitleg: 'Druk. Zonder scherp verschil wordt dit een prijzenslag.' };
  return { punten: 3, uitleg: 'Zeer druk. Toetreden zonder eigen niche is hier riskant.' };
}

module.exports = ({ db, ordersVanZaak, boekingenVanZaak }) => {

  const zaken = () => (Array.isArray(db.data.suppliers) ? db.data.suppliers : []);
  const gelijk = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

  /* ---- bron 1: hoeveel doen dit al, hier ---- */
  function bronConcurrentie(branche, plaats) {
    const alle = zaken();
    // zonder enige zaak in het systeem valt er niets te tellen -- dat is een
    // ontbrekende bron en geen antwoord van nul
    if (!alle.length) return { id: 'concurrentie', label: 'Concurrentie', gemeten: false,
      reden: 'Er staan nog geen zaken in dit systeem om mee te vergelijken.' };
    const n = alle.filter(s => s.type === branche && gelijk(s.city, plaats)).length;
    const p = concurrentiePunten(n);
    return { id: 'concurrentie', label: 'Concurrentie', gemeten: true, waarde: n,
      eenheid: 'zaken in deze plaats', punten: p.punten, max: MAX_PUNTEN, uitleg: p.uitleg };
  }

  /* ---- bron 2: wordt hier daadwerkelijk gekocht ----
     Boekingen en bonnen bij zaken van deze branche. Landelijk en niet alleen
     in deze plaats: één plaats levert bij een jong platform te weinig om iets
     over te zeggen, en dat zou een echte vraag als afwezig laten lezen. */
  function bronVraag(branche) {
    const inBranche = zaken().filter(s => s.type === branche);
    if (!inBranche.length) return { id: 'vraag', label: 'Vraag', gemeten: false,
      reden: 'Er is nog geen enkele zaak in deze branche, dus er valt geen vraag aan af te lezen.' };
    let n = 0;
    for (const s of inBranche) {
      n += (boekingenVanZaak(s.code) || []).filter(b => b && b.status !== 'wacht-op-betaling').length;
      n += (ordersVanZaak(s.code) || []).length;
    }
    const perZaak = n / inBranche.length;
    let punten, uitleg;
    if (perZaak >= 40) { punten = 25; uitleg = 'Zaken in deze branche draaien duidelijk: er wordt echt gekocht.'; }
    else if (perZaak >= 12) { punten = 18; uitleg = 'Er is aantoonbare vraag in deze branche.'; }
    else if (perZaak >= 3) { punten = 11; uitleg = 'Bescheiden vraag. Reken op een lange aanloop.'; }
    else { punten = 4; uitleg = 'Nauwelijks transacties in deze branche. Toon eerst aan dat iemand hiervoor betaalt.'; }
    return { id: 'vraag', label: 'Vraag', gemeten: true, waarde: Math.round(perZaak * 10) / 10,
      eenheid: 'transacties per zaak', punten, max: MAX_PUNTEN, uitleg };
  }

  /* ---- bron 3: is er aan personeel te komen ----
     Veel openstaande vacatures in een branche is een tekort, en een tekort is
     voor een starter een risico en geen kans: hij concurreert straks om
     dezelfde mensen. */
  function bronPersoneel(branche) {
    const inBranche = zaken().filter(s => s.type === branche);
    const bak = db.data.vacatures;
    if (!inBranche.length || !bak || typeof bak !== 'object') {
      return { id: 'personeel', label: 'Personeel', gemeten: false,
        reden: 'Er zijn nog geen vacatures in dit systeem om een tekort aan af te lezen.' };
    }
    let open = 0;
    for (const s of inBranche) open += ((bak[s.code] || []).filter(v => v && v.open !== false)).length;
    const perZaak = open / inBranche.length;
    let punten, uitleg;
    if (perZaak >= 2) { punten = 6; uitleg = 'Deze branche staat vol openstaande vacatures: personeel vinden wordt uw knelpunt.'; }
    else if (perZaak >= 0.5) { punten = 15; uitleg = 'Er is enige krapte op personeel.'; }
    else { punten = 25; uitleg = 'Geen zichtbaar personeelstekort in deze branche.'; }
    return { id: 'personeel', label: 'Personeel', gemeten: true, waarde: Math.round(perZaak * 10) / 10,
      eenheid: 'open vacatures per zaak', punten, max: MAX_PUNTEN, uitleg };
  }

  /* ---- bron 4: is er ruimte ----
     De leegstand uit het stadsweefsel. Die is er alleen als een stad hem heeft
     ingevuld, en dat is meestal niet zo -- dit is de bron die in de praktijk
     het vaakst eerlijk 'niet gemeten' meldt. */
  function bronRuimte(plaats) {
    const panden = db.data.weefselPanden;
    if (!panden || typeof panden !== 'object' || !Object.keys(panden).length) {
      return { id: 'ruimte', label: 'Bedrijfsruimte', gemeten: false,
        reden: 'Voor deze plaats is geen leegstand vastgelegd in het stadsweefsel.' };
    }
    const leeg = Object.values(panden).filter(p => p && p.leeg).length;
    let punten, uitleg;
    if (leeg >= 5) { punten = 25; uitleg = 'Ruime keuze aan leegstaande panden; dat drukt de huur.'; }
    else if (leeg >= 1) { punten = 15; uitleg = 'Er staat iets leeg, maar de keuze is beperkt.'; }
    else { punten = 6; uitleg = 'Niets staat leeg. Reken op wachten of op een hogere huur.'; }
    return { id: 'ruimte', label: 'Bedrijfsruimte', gemeten: true, waarde: leeg,
      eenheid: 'leegstaande panden', punten, max: MAX_PUNTEN, uitleg };
  }

  /* ---- de score ---- */
  function kansVerkenning(branche, plaats) {
    if (!branche) return { status: 400, error: 'Voor welke branche wilt u de kans verkennen?' };
    const bronnen = [bronConcurrentie(branche, plaats), bronVraag(branche),
      bronPersoneel(branche), bronRuimte(plaats)];

    /* De rekenwijze staat in ./meter.js, gedeeld met de gezondheidsscore van
       het dagbeeld: hoe je met ontbrekende bronnen omgaat is precies het stuk
       dat je twee keer net anders opschrijft. */
    const uit = meter.scoreUit(bronnen, MIN_BRONNEN);
    if (uit.score === null) {
      return Object.assign({ ok: true, branche, plaats: plaats || null, bronnen,
        oordeel: 'Te weinig gegevens voor een kansscore.' }, uit);
    }
    const score = uit.score;
    const oordeel = score >= 75 ? 'Kansrijk op wat wij kunnen meten.'
      : score >= 50 ? 'Redelijk, met aandachtspunten.'
      : score >= 30 ? 'Moeilijk. Er is een scherp onderscheid nodig.'
      : 'Ongunstig op wat wij kunnen meten.';

    return {
      ok: true, branche, plaats: plaats || null, score, bronnen,
      grondslag: uit.grondslag, oordeel,
      /* Wat dit cijfer NIET is. Het staat in het antwoord en niet alleen in de
         documentatie, want het reist mee naar elk scherm dat de score toont. */
      voorbehoud: uit.voorbehoud + ' Het weet niets van de markt daarbuiten en is geen voorspelling.'
    };
  }

  return { KANS_MIN_BRONNEN: MIN_BRONNEN, kansVerkenning };
};

module.exports.MIN_BRONNEN = MIN_BRONNEN;
module.exports.concurrentiePunten = concurrentiePunten;
