/* De voedingslaag: wat u van plan bent te eten. Een PLAN, geen meting.

   HET VERSCHIL IS DE HELE OPZET. Een lid kan zijn voeding niet in een eerlijk
   getal zetten -- niemand weet hoeveel gram er in zijn pan zat, en wie het toch
   vraagt krijgt een verzonnen cijfer terug dat daarna als feit door het systeem
   reist (docs/life.md). Er wordt hier dus niets geteld: geen calorieen, geen
   macro's, geen "u at te veel". Wat u opschrijft is wat u van plan was, in uw
   eigen woorden, en dat is precies zo veel waard als het is.

   WAT ER DAAROM NIET IS:
   - Een voedingswaardetabel. Die maakt van "twee boterhammen" een getal met
     twee decimalen, en dat getal is niet waar.
   - Een oordeel over wat u eet. Gezond en ongezond zijn geen eigenschappen van
     een maaltijd maar van een heel leven, en RTG kent dat leven niet.
   - Een allergenenfilter dat zegt welk gerecht veilig is. Dat is de gevaarlijkste
     van de drie: alleen de keuken weet wat er in de pan ging, en een scherm dat
     "veilig" zegt op gegevens die het niet heeft gecontroleerd, is erger dan
     geen scherm. Uw allergenen REIZEN al mee naar de zaak waar u bestelt
     (kern/gastzorg.js) -- dat is de weg die werkt, want daar staat een mens.

   WAT ER WEL IS: een weekplan dat u zelf vult, en dat u kunt uitprinten met uw
   ogen. Meer hoeft het niet te zijn. */

const dagVan = d => new Date(d).toISOString().slice(0, 10);
const DAG = 86400000;

/* De momenten van een dag. Vaste lijst, want een vrij veld levert twintig
   spellingen van "tussendoor" op en dan valt er niets meer te ordenen. */
const MOMENTEN = [
  { id: 'ontbijt', label: 'Ontbijt', rang: 1 },
  { id: 'lunch', label: 'Lunch', rang: 2 },
  { id: 'diner', label: 'Diner', rang: 3 },
  { id: 'tussendoor', label: 'Tussendoor', rang: 4 }
];
const OP_ID = Object.fromEntries(MOMENTEN.map(m => [m.id, m]));
const DAGEN = 7;
const MAX_PER_DAG = 8;

const GRENS = {
  kop: 'RTG telt uw eten niet',
  tekst: 'Hier staat wat u van plan was, in uw eigen woorden. Er wordt niets '
    + 'geteld en er komt geen oordeel over wat u eet: RTG kent uw leven niet en '
    + 'een maaltijd op zichzelf is niet gezond of ongezond.',
  wegen: [
    { naam: 'Een dietist', hoe: 'Voor een plan dat bij uw lichaam en uw doel past' },
    { naam: 'Uw huisarts', hoe: 'Bij klachten, een dieet op voorschrift of twijfel' }
  ]
};

module.exports = ({ db, save, schoon, crypto, zorgVan }) => {
  const bak = () => {
    if (!db.data.voeding) db.data.voeding = {};
    return db.data.voeding;
  };
  const mijn = key => {
    const b = bak();
    if (!Array.isArray(b[key])) b[key] = [];
    return b[key];
  };
  const toon = m => ({ id: m.id, op: m.op, wanneer: m.wanneer,
    label: (OP_ID[m.wanneer] || {}).label || m.wanneer, wat: m.wat, notitie: m.notitie });

  function beeld(key, nu = new Date()) {
    const rijen = mijn(key);
    const vandaag = dagVan(nu);
    const week = [];
    for (let i = 0; i < DAGEN; i++) {
      const op = dagVan(new Date(nu.getTime() + i * DAG));
      const erop = rijen.filter(m => m.op === op)
        .sort((a, b) => ((OP_ID[a.wanneer] || {}).rang || 9) - ((OP_ID[b.wanneer] || {}).rang || 9));
      week.push({ op, vandaag: op === vandaag, maaltijden: erop.map(toon) });
    }

    /* Uw allergenen staan erbij als GEHEUGENSTEUN voor uzelf, gelezen uit het
       zorgprofiel en niet gekopieerd -- niet als filter en niet als oordeel over
       wat u opschrijft. RTG kijkt niet mee of uw plan er iets van bevat: dat zou
       een controle beweren die er niet is. */
    const zorg = typeof zorgVan === 'function' ? zorgVan(key) : null;
    return {
      ok: true, vandaag, week, momenten: MOMENTEN, grens: GRENS,
      allergenen: (zorg && zorg.allergenen) || [],
      dieet: (zorg && zorg.dieet) || '',
      allergenenUitleg: 'Uit uw zorgprofiel, als geheugensteun. RTG kijkt niet na of uw plan '
        + 'ze bevat, en beoordeelt niet wat u opschrijft.',
      uitleg: 'Dit is een plan en geen meting. Er wordt niets geteld en er komt geen '
        + 'oordeel over wat u eet.'
    };
  }

  function zet(key, body, nu = new Date()) {
    const rijen = mijn(key);
    const wanneer = String(body.wanneer || '');
    if (!OP_ID[wanneer]) return { status: 400, error: 'Kies een moment van de dag.' };
    const op = String(body.op || dagVan(nu));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(op)) return { status: 400, error: 'Voor welke dag is dit?' };
    /* Alleen binnen het venster dat het scherm toont. Een maaltijd op een dag
       die nergens te zien is, is een regel die het lid nooit meer terugvindt. */
    const eerste = dagVan(nu);
    const laatste = dagVan(new Date(nu.getTime() + (DAGEN - 1) * DAG));
    if (op < eerste || op > laatste) {
      return { status: 400, error: 'U kunt plannen voor vandaag en de zes dagen erna.' };
    }
    const wat = schoon(body.wat, 200);
    if (!wat) return { status: 400, error: 'Wat wilt u eten?' };

    const bestaand = body.id ? rijen.find(m => m.id === String(body.id)) : null;
    if (body.id && !bestaand) return { status: 404, error: 'Die maaltijd staat niet in uw plan.' };
    if (!bestaand && rijen.filter(m => m.op === op).length >= MAX_PER_DAG) {
      return { status: 400, error: 'Er staan er al ' + MAX_PER_DAG + ' op die dag.' };
    }

    const m = bestaand || { id: crypto.randomBytes(4).toString('hex') };
    m.op = op; m.wanneer = wanneer; m.wat = wat;
    m.notitie = schoon(body.notitie, 200);
    if (!bestaand) rijen.push(m);

    /* Opruimen wat achter het venster valt. Dit is een plan voor de komende
       week en geen eetdagboek: bewaren wat voorbij is, maakt er stilletjes toch
       een registratie van. */
    const grens = dagVan(new Date(nu.getTime() - DAG));
    bak()[key] = rijen.filter(x => x.op >= grens);
    save();
    return beeld(key, nu);
  }

  function weg(key, id, nu = new Date()) {
    const rijen = mijn(key);
    const i = rijen.findIndex(m => m.id === String(id));
    if (i < 0) return { status: 404, error: 'Die maaltijd staat niet in uw plan.' };
    rijen.splice(i, 1);
    save();
    return beeld(key, nu);
  }

  return { voedingVan: beeld, voedingZet: zet, voedingWeg: weg };
};

module.exports.MOMENTEN = MOMENTEN;
module.exports.DAGEN = DAGEN;
module.exports.MAX_PER_DAG = MAX_PER_DAG;
