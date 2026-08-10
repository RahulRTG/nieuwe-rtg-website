/* De dagcheck-in: hoe zit u erbij. Een knop, en daarna een keuze die er echt
   toe doet -- wilt u er iets over kwijt, of wilt u gewoon iets doen.

   DAT ONDERSCHEID IS DE HELE FUNCTIE. Iemand die moe is, wil niet altijd een
   gesprek; soms wil hij tien minuten rust en verder niets. Een app die op elk
   gevoel met een vraag reageert, wordt iets dat je gaat vermijden.

   ELKE VRIJE TEKST GAAT LANGS DE GRENS (kern/zorgniveau.js) VOORDAT ER IETS
   TERUGKOMT. Slaat die aan, dan is er geen tip, geen oefening en geen
   bemoediging -- alleen de weg naar echte hulp. Dat is geen nette toevoeging
   maar de volgorde zelf: de grens staat er eerder dan de functie.

   WAT HIER STAAT, GAAT NERGENS HEEN. Er is geen deelknop, geen partner en geen
   coach die dit kan opvragen; het staat op de sessiesleutel en verlaat het
   account niet. Daarom staat deze laag ook niet in het Consent Center als iets
   dat u kunt delen -- er valt niets te delen -- maar wel in de lijst met wat
   dat scherm NIET dekt, zodat het niet lijkt of we hem vergeten zijn.

   GEEN REEKSEN EN GEEN SCORE. Er is geen gemiddelde stemming, geen grafiekje
   dat omhoog moet en geen streak. Wie zich een week niet meldt, mist niets. */

const { niveauVan, aanhoudendZwaar } = require('./zorgniveau');

const STEMMINGEN = [
  { id: 'goed', label: 'Goed' },
  { id: 'gemiddeld', label: 'Gemiddeld' },
  { id: 'zwaar', label: 'Zwaar' },
  { id: 'gespannen', label: 'Gespannen' },
  { id: 'angstig', label: 'Angstig' },
  { id: 'leeg', label: 'Leeg' }
];

/* Wat u kunt DOEN, zonder er iets over te hoeven zeggen. Alles hier is klein,
   af te maken en zonder scherm-af-vinkje: RTG kijkt niet of u het gedaan hebt. */
const DOEN = [
  { id: 'adem', naam: 'Rustig ademen', hoe: 'Vier tellen in, zes tellen uit. Twee minuten is genoeg.' },
  { id: 'wandel', naam: 'Even naar buiten', hoe: 'Tien minuten lopen, zonder doel en zonder telefoon.' },
  { id: 'scherm', naam: 'Schermpauze', hoe: 'Leg dit weg en doe een kwartier iets met uw handen.' },
  { id: 'muziek', naam: 'Iets rustigs opzetten', hoe: 'RTG Sound heeft er een hoek voor.' },
  { id: 'schrijf', naam: 'Het opschrijven', hoe: 'Voor uzelf. Het hoeft nergens heen en niemand leest mee.' }
];

const MAX_DAGEN = 400;
const dagVan = d => new Date(d).toISOString().slice(0, 10);

module.exports = ({ db, save, schoon }) => {
  const bak = () => { if (!db.data.gemoed) db.data.gemoed = {}; return db.data.gemoed; };
  const rijenVan = key => { const b = bak(); if (!b[key]) b[key] = []; return b[key]; };

  /* Nieuwste eerst; dat is de volgorde die aanhoudendZwaar verwacht en de
     volgorde waarin een scherm het toont. */
  const recent = (key, n) => rijenVan(key).slice(-n).reverse();

  function gemoedVan(key, nu = new Date()) {
    const vandaag = dagVan(nu);
    const lijst = recent(key, 14);
    const vanVandaag = lijst.find(c => c.op === vandaag) || null;
    return {
      ok: true, vandaag, stemmingen: STEMMINGEN, doen: DOEN,
      vandaagIngevuld: vanVandaag ? { stemming: vanVandaag.stemming, notitie: vanVandaag.notitie || '' } : null,
      recent: lijst.map(c => ({ op: c.op, stemming: c.stemming })),
      /* Aanhoudend zwaar is geen crisis en geen diagnose. Het staat er omdat
         vijf dagen op rij lang genoeg is om een mens te noemen. */
      aanhoudend: aanhoudendZwaar(lijst)
    };
  }

  function gemoedZet(key, body, nu = new Date()) {
    const stemming = String(body.stemming || '');
    if (!STEMMINGEN.some(s => s.id === stemming)) return { status: 400, error: 'Kies hoe u erbij zit.' };
    const notitie = schoon(body.notitie, 1000);

    /* De grens, VOOR er iets wordt bewaard of teruggegeven. Wat er ook in de
       notitie staat: slaat de grens aan, dan komt er geen tip terug. */
    const grens = niveauVan(notitie);

    const op = dagVan(nu);
    const rijen = rijenVan(key);
    const bestaat = rijen.find(c => c.op === op);
    if (bestaat) { bestaat.stemming = stemming; bestaat.notitie = notitie; bestaat.at = nu.toISOString(); }
    else {
      rijen.push({ op, stemming, notitie, at: nu.toISOString() });
      if (rijen.length > MAX_DAGEN) rijen.splice(0, rijen.length - MAX_DAGEN);
    }
    save();

    const lijst = recent(key, 14);
    if (!grens.mag) {
      /* Geen tip, geen oefening, geen "sterkte". Alleen de weg naar hulp, en
         het staat er ook bij dat RTG hier ophoudt. */
      return { ok: true, niveau: grens.niveau, mag: false, escalatie: grens.escalatie,
        uitleg: grens.uitleg, doen: [], aanhoudend: null };
    }
    return { ok: true, niveau: grens.niveau, mag: true, escalatie: null,
      doen: DOEN, aanhoudend: aanhoudendZwaar(lijst) };
  }

  /* Weghalen hoort erbij: wat u opschreef is van u, en van u alleen. */
  function gemoedWeg(key, body, nu = new Date()) {
    const op = /^\d{4}-\d{2}-\d{2}$/.test(String(body.op || '')) ? String(body.op) : dagVan(nu);
    const rijen = rijenVan(key);
    const i = rijen.findIndex(c => c.op === op);
    if (i < 0) return { status: 404, error: 'Voor die dag staat er niets.' };
    rijen.splice(i, 1); save();
    return { ok: true, gewist: op };
  }

  return { gemoedVan, gemoedZet, gemoedWeg };
};

module.exports.STEMMINGEN = STEMMINGEN;
module.exports.DOEN = DOEN;
