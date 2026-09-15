/* ============================================================================
   HET LEERDOSSIER -- zeven treden, chronologisch, en met opzet geen niveau.

   Foundation Connect wil onderscheid maken tussen gezien, gelezen, begrepen,
   geoefend, toegepast, gemaakt en onderwezen. Vijftig video's over
   programmeren bekijken is geen programmeren; een werkende applicatie bouwen
   is veel sterker bewijs. Dat klopt, en het is ook precies de plek waar zo'n
   laag omslaat in het tegenovergestelde van wat hij belooft.

   WAT HIER NIET KOMT, EN WAAROM DAT GEEN SMAAK IS. Een "Career Score", een
   talentladder, een bijdragegrafiek per persoon: CARRIERE.md, HDI.md,
   ONTMOETEN.md, STAGE.md en INT-04 zeggen alle vijf hetzelfde -- de
   meeteenheid is nooit de mens, ook niet intern als sorteersleutel. De vorm
   die daar overleeft is het LEDGER: chronologisch, per regel bewijsbaar. Die
   grens had tot nu toe vier documenten en nul handhavers; dit bestand is er
   een, en `test/connect.test.js` de tweede.

   DE TREDEN ZIJN GEEN TRAP. Iemand staat niet OP een trede -- hij heeft regels
   die er een dragen, per ONDERWERP. Voor koken kan `onderwezen` er staan en
   voor breuken `gezien`, en dat zijn geen twee standen van dezelfde mens. De
   hoogste trede wordt daarom AFGELEID per onderwerp en nooit bewaard, en
   nergens over onderwerpen heen opgeteld: een getal over alle onderwerpen IS
   een niveau, hoe je het ook noemt.

   HET BESLUIT WAAR DIT ONDER VALT is dat van 14 september 2026 (CLAUDE.md,
   FOUNDATION.md par. 5.5): een leerdossier mag op elke leeftijd bestaan --
   ook onder de 18, waar `progressieMag` alles tegenhoudt -- MITS het aan vier
   dingen voldoet. Ze staan hier niet als belofte maar als code:

     1. het gaat over de persoon zelf en vergelijkt nooit  -> `vergelijk` bestaat
        niet, en er is geen functie die twee dossiers samen kan lezen;
     2. geen blijvend niveau-label                         -> `hoogste()` rekent
        per onderwerp en levert geen totaal;
     3. alleen leesbaar voor de leerling en wie al een rechtmatige verhouding
        tot hem heeft                                      -> `lees()` neemt een
        sleutel en geeft nooit een lijst over mensen heen;
     4. het hangt aan de codenaam                          -> `sleutel`, nooit
        een naam, nooit een geboortedatum.

   Valt er een van de vier weg, dan geldt de progressiegrens van
   kern/spellen/grens.js weer -- en dan is dit een scorebord.

   DE TREDEN ZELF STAAN IN ./tredenlijst.js, met hun grond, hun bewijsgraad en
   de vraag wie ze mag schrijven. Dit bestand is de motor: het dwingt af wat
   daar verklaard staat.

   De noodrem `MAX` telt wat hij wegsnijdt en zegt dat in `afgekapt`
   (MENSNETWERK.md par. 0.6a: verjaren en afgekapt worden gaan nooit op een
   hoop) -- een dossier dat stil korter wordt, is een dossier dat liegt.
   ========================================================================== */
'use strict';

const { TREDEN } = require('./tredenlijst');

const OP_ID = new Map(TREDEN.map(t => [t.id, t]));
const trede = (id) => OP_ID.get(String(id == null ? '' : id)) || null;

/* De noodrem, niet de bewaartermijn. 2000 regels is ruim boven wat een mens in
   jaren maakt; bijt hij toch, dan hoort dat te KLINKEN en niet te gebeuren. */
const MAX = 2000;

module.exports = ({ db, save, crypto }) => {
  const bak = () => {
    const d = db.data || (db.data = {});
    if (!d.connect) d.connect = {};
    if (!d.connect.dossier) d.connect.dossier = {};
    return d.connect.dossier;
  };
  const lijstVan = (sleutel) => {
    const b = bak(), s = String(sleutel || '');
    if (!s) return null;
    if (!Array.isArray(b[s])) b[s] = [];
    return b[s];
  };
  /* De LEZER maakt niets aan -- zie dezelfde correctie in ./horizon.js. Een
     dossier dat ontstaat doordat iemand ernaar kijkt, is een dossier dat bij
     iedereen bestaat zodra een scherm een keer is geopend. */
  const peil = (sleutel) => {
    const s = String(sleutel || '');
    const rij = s ? (db.data && db.data.connect && db.data.connect.dossier || {})[s] : null;
    return Array.isArray(rij) ? rij : [];
  };

  /* EEN REGEL ERBIJ. Geeft altijd een uitkomst en gooit nooit -- een scherm dat
     een trede niet mag zetten, hoort de reden te kunnen tonen. */
  function noteer(sleutel, rec) {
    const r = rec || {};
    const t = trede(r.trede);
    if (!String(sleutel || '')) return { ok: false, reden: 'Een leerdossier hangt aan een codenaam; die ontbreekt.' };
    if (!t) return { ok: false, reden: 'Die trede bestaat niet. Kies uit: ' + TREDEN.map(x => x.id).join(', ') + '.' };

    const door = String(r.door || 'zelf');
    if (door !== t.doorWie) {
      return { ok: false, reden: t.doorWie === 'eenAnder'
        ? 'Deze trede zet een ander. "' + t.naam + '" ontstaat doordat iemand zegt dat hij door u geholpen is, en niet doordat u dat zelf opschrijft.'
        : 'Deze trede wordt door ' + (t.doorWie === 'zelf' ? 'de mens zelf' : 'het systeem') + ' gezet, niet door "' + door + '".' };
    }
    /* DE BRON-EIS KOMT UIT DE TABEL EN NIET UIT EEN NAAM. Hier stond
       `t.id === 'gemaakt'`, en toen de ladder van zeven naar tien treden ging
       waren er vijf treden die een verwijzing nodig hebben -- een hardgecodeerde
       naam dekt er dan een. Een bewering zonder onderwerp is precies wat een
       portfolio waardeloos maakt. */
    if (t.bronNodig && !String(r.bron || '')) {
      return { ok: false, reden: 'Een regel "' + t.naam + '" verwijst naar het werk waar hij over gaat. ' +
        'Zonder die verwijzing is er niets aan te tonen.' };
    }
    const onderwerp = String(r.onderwerp || '').trim().slice(0, 80);
    if (!onderwerp) return { ok: false, reden: 'Een regel hoort bij een onderwerp.' };

    const lijst = lijstVan(sleutel);

    /* TWEE TREDEN ZIJN EENMALIG PER DING, en dat is geen optimalisatie maar de
       bescherming van de eerste zin van dit bestand. `gezien` twee keer
       schrijven maakt van het dossier een KIJKLOG -- precies waar de eerste
       trede voor waarschuwt -- en `begrepen` is geen tweede feit als iemand het
       nog eens zegt. De andere vijf herhalen wel: twee keer oefenen zijn twee
       oefeningen, en twee mensen die zeggen dat u hen hielp zijn twee mensen.

       De herhaling is dus geen FOUT: `ok: true` met `nieuw: false`. Een tweede
       tik hoort niets kapot te maken en ook niet te klagen (kern/mutatie.js). */
    if (t.eenmalig) {
      const bestaat = lijst.some(x => x.trede === t.id && x.onderwerp === onderwerp &&
        String(x.bron || '') === String(r.bron || ''));
      if (bestaat) return { ok: true, nieuw: false, afgekapt: 0,
        reden: 'Dit stond er al. "' + t.naam + '" is een feit en geen teller.' };
    }

    const regel = {
      id: (crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).slice(0, 36),
      at: new Date().toISOString(),
      onderwerp, trede: t.id, graad: t.graad,
      /* DE ASPRAAK REIST MEE EN WORDT NIET BIJ HET LEZEN AFGELEID. Zou hij
         alleen uit de tabel komen, dan verandert de betekenis van een regel uit
         2026 zodra iemand in 2028 een trede anders indeelt -- en een ledger
         waarvan de oude regels meebewegen, is geen ledger. */
      aanspraak: t.aanspraak,
      /* Welk werkwoord van de lus hier is uitgevoerd. Dat is de vraag "welk
         vermogen werd gebruikt" -- en met opzet niet het woord `capability`,
         dat in OS.md al platformvermogen betekent. */
      werkwoord: String(r.werkwoord || '') || null,
      bron: String(r.bron || '') || null,
      herkomst: String(r.herkomst || '') || null
    };
    lijst.push(regel);
    let afgekapt = 0;
    if (lijst.length > MAX) { afgekapt = lijst.length - MAX; lijst.splice(0, afgekapt); }
    if (save) save();
    return { ok: true, nieuw: true, regel, afgekapt };
  }

  /* LEZEN. Een sleutel in, de regels van DIE mens uit. Er is met opzet geen
     functie die over sleutels heen leest: dat zou de route zijn die HDI.md par.
     5.1 verbiedt -- "alles over deze mens" zonder dat de mens zelf aanroept,
     en in de vorm van een lijst mensen nog erger. */
  function lees(sleutel, opties) {
    const o = opties || {};
    const lijst = peil(sleutel);
    const gefilterd = o.onderwerp ? lijst.filter(r => r.onderwerp === String(o.onderwerp)) : lijst;
    return {
      regels: gefilterd.slice().reverse().slice(0, Math.min(Number(o.max) || 200, 500)),
      totaal: gefilterd.length,
      /* Per ONDERWERP de hoogste trede, afgeleid en niet bewaard. En bewust
         geen getal eroverheen: een totaal over onderwerpen is een niveau. */
      perOnderwerp: hoogste(sleutel),
      nietGemeten: 'Dit dossier zegt wat er is gebeurd, niet hoe goed het ging. Er staat geen cijfer in, ' +
        'geen niveau en geen vergelijking met iemand anders -- ook niet verborgen als sorteervolgorde.'
    };
  }

  /* De hoogste trede PER ONDERWERP, met de graad van die trede erbij. Twee
     onderwerpen worden nooit opgeteld en nooit gesorteerd op trap: een lijst
     die op hoogte staat, is een ranglijst van je eigen leven. */
  function hoogste(sleutel) {
    const lijst = peil(sleutel);
    const per = new Map();
    for (const r of lijst) {
      const t = trede(r.trede);
      if (!t) continue;
      const nu = per.get(r.onderwerp);
      if (!nu || t.trap > nu.trap) per.set(r.onderwerp, { trap: t.trap, trede: t.id, naam: t.naam, graad: t.graad });
    }
    return [...per.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([onderwerp, v]) => ({ onderwerp, trede: v.trede, naam: v.naam, graad: v.graad }));
  }

  /* Het portfolio is een LEZER op deze opslag en woont apart: zie de kop van
     ./portfolio.js voor de regel die hem van `lees()` onderscheidt. Hij krijgt
     `peil` en `trede` mee en kan dus per constructie niet schrijven. */
  const { portfolio } = require('./portfolio')({ peil, trede });

  return { noteer, lees, hoogste, portfolio, TREDEN, MAX };
};
