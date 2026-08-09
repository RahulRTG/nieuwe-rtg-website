/* DE PIJPLIJN: wat er nog kan worden, en wat het waard is.

   ER KOMT GEEN TWEEDE OFFERTESTROOM. Offertes bestaan al: db.data.vakOffertes,
   gevuld door kern/vakwerk/pro.js, met vijf standen die daar hun betekenis
   krijgen (aangevraagd -> aangeboden -> akkoord | afgewezen | ingetrokken).
   Deze laag SCHRIJFT NIETS in die stroom; hij leest hem, groepeert hem in
   stadia en rekent uit wat er echt openstaat. Een eigen pijplijn-tabel ernaast
   zou binnen een maand uiteenlopen met de stroom die de klant werkelijk ziet
   (lat-regel 4).

   TWEE STADIA ZIJN OPEN, EN ZE ZIJN NIET HETZELFDE:

     aangevraagd -> de bal ligt BIJ U. De klant wacht op een prijs. En omdat
                    die prijs er nog niet is, heeft dit stadium GEEN BEDRAG.
                    Er staat hier dus geen euro bij, ook geen schatting op
                    basis van eerdere klussen -- dat zou een omzetverwachting
                    zijn die de ondernemer zelf nooit heeft uitgesproken.
     aangeboden  -> de bal ligt BIJ DE KLANT. Hier staat wel een prijs op, en
                    dit is dus het enige bedrag dat de pijplijn kent.

   DE FORECAST IS EEN METING OF HIJ IS ER NIET (lat-regel 10). De gewogen
   verwachting is `openBedrag x scoringskans`, en die scoringskans komt uit de
   eigen beslissingsgeschiedenis van deze zaak. Onder MIN_BESLIST afgeronde
   offertes is er geen kans en dus geen verwachting: dan staat er `null` met de
   reden erbij, en niet een brancheaanname of een vrolijke 50%. Een getal met
   een slag om de arm wordt een getal zodra iemand het overtypt.

   VERLOREN IS NIET EEN DING. Een offerte die de zaak zelf afwees, en een
   offerte die de klant introk, zijn twee verschillende gebeurtenissen -- de
   eerste is een keuze, de tweede een verlies. Ze worden hier apart geteld,
   want opgeteld leest een volle agenda als een slecht verkoopjaar. */
'use strict';

const DAG = 86400000;

/* Vanaf hier ligt een uitgebrachte offerte te lang bij de klant zonder besluit.
   Tien dagen: ruim genoeg voor iemand die erover nadenkt, kort genoeg dat een
   belletje nog ergens over gaat. */
const STIL_DAGEN = 10;
/* Onder dit aantal afgeronde offertes geen scoringskans. Vijf: bij minder is
   elke uitkomst een sprong van twintig procentpunt of meer. */
const MIN_BESLIST = 5;

const OPEN = ['aangevraagd', 'aangeboden'];
const GEWONNEN = 'akkoord';
/* Alleen wat de KLANT liet lopen. Wat de zaak zelf afwees telt niet als
   verloren verkoop; zie de kop. */
const KLANT_WEG = 'ingetrokken';

const STADIA = {
  aangevraagd: { label: 'Bij u', wat: 'De klant wacht op een prijs.', bal: 'zaak' },
  aangeboden: { label: 'Bij de klant', wat: 'De prijs ligt er; de klant moet beslissen.', bal: 'klant' },
  akkoord: { label: 'Gewonnen', wat: 'Akkoord, en als bevestigde klus ingeboekt.', bal: null },
  afgewezen: { label: 'Zelf afgewezen', wat: 'U kon de klus niet aannemen.', bal: null },
  ingetrokken: { label: 'Ingetrokken', wat: 'De klant trok de aanvraag in.', bal: null }
};

const dagenGeleden = (iso, nuMs) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? Math.floor((nuMs - t) / DAG) : null;
};

/* De mediaan en niet het gemiddelde: één offerte die een half jaar bleef
   liggen, trekt een gemiddelde scheef en dan lijkt de hele zaak traag. */
function mediaan(reeks) {
  const r = reeks.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (!r.length) return null;
  const m = Math.floor(r.length / 2);
  return r.length % 2 ? r[m] : Math.round((r[m - 1] + r[m]) / 2);
}

module.exports = ({ db }) => {

  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  const offertesVan = (code) => (Array.isArray(db.data.vakOffertes) ? db.data.vakOffertes : [])
    .filter(x => x && x.supplierCode === code);

  /* Een rij voor het scherm. Op codenaam, net als het klantenboek: een
     verkooppijplijn is precies de plek waar de codenaam-regel stilletjes zou
     sneuvelen. `bedrag` is null zolang er geen prijs is -- niet 0, want nul
     euro is een gemeten waarde en die betekent hier iets anders. */
  const rij = (x, nuT) => ({
    id: x.id, klant: x.customerCodename || null,
    omschrijving: String(x.omschrijving || '').slice(0, 80),
    stadium: x.status, bedrag: Number.isFinite(Number(x.prijs)) ? Number(x.prijs) : null,
    dagen: dagenGeleden(x.status === 'aangeboden' ? (x.antwoordAt || x.at) : x.at, nuT),
    wens: x.wens || null,
    /* Hoeveel regels de prijs dragen. Null en niet 0 als er geen opbouw is: een
       offerte met alleen een bedrag is niet hetzelfde als een offerte die uit
       nul regels is opgebouwd. Zie kern/onderneming/offertebouw.js. */
    opgebouwd: Array.isArray(x.regels) && x.regels.length ? x.regels.length : null
  });

  /* De scoringskans uit de eigen geschiedenis. Alleen offertes die de zaak
     ook echt heeft uitgebracht tellen mee: een aanvraag die de zaak zelf
     afwees, is geen verloren verkoop maar een niet-gevoerde. */
  function scoringskans(alle) {
    const gewonnen = alle.filter(x => x.status === GEWONNEN);
    const verloren = alle.filter(x => x.status === KLANT_WEG);
    const beslist = gewonnen.length + verloren.length;
    if (beslist < MIN_BESLIST) {
      return { percentage: null, beslist, minimum: MIN_BESLIST,
        reden: 'Er zijn ' + beslist + ' offertes afgerond en wij rekenen pas vanaf ' + MIN_BESLIST +
          '. Een scoringskans op minder is eerder een indruk dan een meting.' };
    }
    return { percentage: Math.round((gewonnen.length / beslist) * 100),
      beslist, gewonnen: gewonnen.length,
      grondslag: 'Uitgebrachte offertes die de klant heeft beslist. Aanvragen die u zelf afwees tellen niet mee: dat is geen verloren verkoop.' };
  }

  function pijplijn(o, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();
    const alle = offertesVan(s.code);

    const per = {};
    for (const id of Object.keys(STADIA)) {
      const lijst = alle.filter(x => x.status === id);
      const metPrijs = lijst.filter(x => Number(x.prijs) > 0);
      per[id] = Object.assign({ aantal: lijst.length }, STADIA[id], {
        /* Alleen waar er prijzen zijn. Zie de kop: het stadium 'aangevraagd'
           heeft er per definitie geen. */
        bedrag: metPrijs.length ? Math.round(metPrijs.reduce((n, x) => n + Number(x.prijs), 0)) : null,
        bedragUitleg: metPrijs.length ? null
          : (id === 'aangevraagd'
            ? 'Op een aanvraag staat nog geen prijs. Wij verzinnen er geen: dat zou een omzetverwachting zijn die u nooit heeft uitgesproken.'
            : 'Geen van deze offertes draagt een bedrag.')
      });
    }

    const uitgebracht = alle.filter(x => x.status === 'aangeboden');
    const openBedrag = Math.round(uitgebracht.reduce((n, x) => n + (Number(x.prijs) || 0), 0));
    const kans = scoringskans(alle);

    /* De doorlooptijd van aanvraag tot prijs. Alleen over offertes waar de
       zaak ook echt heeft geantwoord; `antwoordAt` bestaat pas sinds de
       offertestroom hem schrijft, dus oudere rijen tellen gewoon niet mee in
       plaats van als nul door te rekenen. */
    const antwoordDagen = mediaan(alle
      .filter(x => x.antwoordAt && x.at)
      .map(x => Math.floor((Date.parse(x.antwoordAt) - Date.parse(x.at)) / DAG)));

    const stil = uitgebracht
      .map(x => ({ id: x.id, dagen: dagenGeleden(x.antwoordAt || x.at, nuT), bedrag: Number(x.prijs) || 0 }))
      .filter(x => x.dagen !== null && x.dagen >= STIL_DAGEN)
      .sort((a, b) => b.dagen - a.dagen);

    return {
      zaak: s.code,
      stadia: Object.entries(per).map(([id, x]) => Object.assign({ id }, x)),
      open: {
        aanvragen: per.aangevraagd.aantal,
        uitgebracht: uitgebracht.length,
        bedrag: uitgebracht.length ? openBedrag : null,
        eenheid: 'euro',
        uitleg: 'Alleen offertes waar een prijs op staat en waar de klant nog over moet beslissen.'
      },
      scoringskans: kans,
      /* De gewogen verwachting. Bestaat alleen als er een gemeten kans is;
         zonder die kans staat hier null en niet het hele openstaande bedrag,
         want dat zou lezen als "dit komt binnen". */
      verwacht: kans.percentage === null
        ? { bedrag: null, reden: kans.reden }
        : { bedrag: Math.round(openBedrag * kans.percentage / 100),
            over: openBedrag, percentage: kans.percentage,
            let: 'Dit is het openstaande bedrag maal uw eigen scoringskans, en geen toezegging. Eén grote offerte kan het in zijn eentje kantelen.' },
      doorlooptijd: {
        naarPrijs: antwoordDagen,
        uitleg: antwoordDagen === null
          ? 'Nog geen beantwoorde offerte om aan te meten.'
          : 'Mediaan aantal dagen tussen aanvraag en uw prijs.'
      },
      stil: { drempel: STIL_DAGEN, aantal: stil.length, rijen: stil.slice(0, 10) },
      rijen: alle.filter(x => OPEN.includes(x.status))
        .map(x => rij(x, nuT))
        .sort((a, b) => (b.dagen || 0) - (a.dagen || 0))
        .slice(0, 25),
      nietGemeten: 'Alleen offertes die via RTG lopen. Wat u buiten RTG uitbrengt of mondeling afspreekt, ziet deze pijplijn niet -- en telt dus ook niet mee in uw scoringskans.'
    };
  }

  return { PIJPLIJN_STIL_DAGEN: STIL_DAGEN, PIJPLIJN_MIN_BESLIST: MIN_BESLIST, pijplijn };
};

/* De opvolging staat in ./pijplijn-opvolging.js -- dit bestand ging over de
   10 kB van het modulebeleid. Hier doorgegeven zodat er maar een ingang is. */
module.exports.pijplijnOpvolging = require('./pijplijn-opvolging').pijplijnOpvolging;
module.exports.STIL_DAGEN = STIL_DAGEN;
module.exports.MIN_BESLIST = MIN_BESLIST;
module.exports.STADIA = STADIA;
