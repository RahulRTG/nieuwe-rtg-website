/* Het medicatieschema: wat u gebruikt, wanneer, en hoeveel er nog in huis is.

   DE HARDE REGEL, EN HIJ IS DE HELE REDEN DAT DIT BESTAND ZO SAAI IS: RTG
   BEPAALT NOOIT EEN DOSERING. Er is geen middelenlijst om uit te kiezen, geen
   aanvulling op de naam, geen voorgestelde sterkte, geen maximum, geen
   interactiecontrole en geen bijwerkingentekst. Alles wat hier staat heeft het
   lid zelf overgetikt van het doosje of van de apotheek. RTG is de agenda, niet
   de apotheker.

   Voor wie hier iets aan wil bouwen: een interactiecheck ("mag dit samen met
   dat?") hoort NIET in dit bestand -- dat is klinisch werk met een databank en
   een beroepsgroep eromheen, en een half werkende versie is gevaarlijker dan
   geen. Er staat ook nergens "neem dit nu in": dat is een doseerinstructie. De
   grens uit kern/zorgniveau.js staat hier permanent op het scherm en niet als
   reactie op een woord; bij een gesprek is de grens een alarm, bij een schema
   een bordje aan de muur. Zie docs/life.md.

   Waarom de crisisregel er wel doorheen loopt en de medische niet: het
   medicatiefilter van zorgniveau.js slaat per definitie aan op elk woord dat
   hier hoort te staan ("medicijn", "mg", "innemen"). Dat filter beschermt een
   GESPREK; dit is geen gesprek maar een kaartenbak die het lid over zichzelf
   bijhoudt. De crisisregel loopt er wel doorheen: wat iemand in een notitieveld
   schrijft, schrijft hij ergens. */

const { niveauVan } = require('./zorgniveau');
/* `rtgKlok` en niet `klok`: dit bestand gebruikt de naam `klok` al voor iets
   anders, en een import die daardoor wordt overschaduwd geeft geen foutmelding
   bij het laden maar pas als de regel wordt uitgevoerd -- hier was dat
   `klok.nu is not a function`, midden in de economische runtime. */
const rtgKlok = require('../lib/klok');
const { GRENS, dag, momentenVan, voorraadVan, waarschuwing } = require('./medicatie-regels');

module.exports = ({ db, save, schoon, crypto }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/medicatie', bezit: { medicatie: 'kaart' } });
  const bak = () => {
    return eigen.bak('medicatie');
  };
  const mijn = key => {
    const b = bak();
    if (!b[key]) b[key] = { middelen: [], afgetekend: {} };
    if (!b[key].afgetekend) b[key].afgetekend = {};
    return b[key];
  };

  function beeld(key, nu = rtgKlok.datum()) {
    const m = mijn(key);
    const vandaag = dag(nu);
    const af = m.afgetekend[vandaag] || {};
    /* Uit dezelfde bron als de dag hierboven. Met toTimeString() zou de klok
       lokaal zijn en de dag in UTC: rond middernacht zeggen die twee dan iets
       anders, en dan staat er "komt nog" bij een moment dat op de dag van
       gisteren wordt afgetekend. De rest van de lagen (metingen, gewoonten,
       gemoed) rekent ook in ISO. */
    const klok = nu.toISOString().slice(11, 16);

    const middelen = m.middelen.map(x => ({
      id: x.id, naam: x.naam, sterkte: x.sterkte, notitie: x.notitie,
      momenten: x.momenten, begonnenOp: x.begonnenOp,
      voorraad: voorraadVan(m, x)
    }));

    /* Vandaag, op volgorde van de klok. "Geweest en niet afgetekend" is een
       constatering en geen verwijt: geen rood, geen uitroepteken, geen teller
       die bijhoudt hoe vaak het al is gebeurd. En er staat NERGENS "neem het
       alsnog in" -- dat zou een doseerinstructie zijn. */
    const punten = [];
    for (const x of m.middelen) {
      for (const t of x.momenten) {
        punten.push({
          id: x.id, naam: x.naam, sterkte: x.sterkte, moment: t,
          afgetekend: !!af[x.id + '@' + t],
          geweest: t <= klok
        });
      }
    }
    punten.sort((a, b) => (a.moment < b.moment ? -1 : a.moment > b.moment ? 1 : 0));

    return {
      ok: true, middelen, vandaag: punten, grens: GRENS,
      uitleg: 'Dit schema is van u. RTG vult niets aan, stelt niets voor en '
        + 'controleert geen combinaties; wat hier staat heeft u zelf ingevoerd.'
    };
  }

  function zet(key, body) {
    const m = mijn(key);
    const naam = schoon(body.naam, 60);
    if (!naam) return { status: 400, error: 'Vul in hoe het middel heet, precies zoals op het doosje.' };
    const mom = momentenVan(body.momenten);

    /* De crisisregel loopt over het notitieveld. Slaat hij aan, dan wordt er
       niets bewaard en komt de weg naar hulp terug -- ook al ging dit verzoek
       over een doosje pillen. */
    const notitie = schoon(body.notitie, 200);
    const grens = niveauVan(notitie);
    if (grens.reden === 'crisis') {
      return { status: 200, ok: false, mag: false, escalatie: grens.escalatie, uitleg: grens.uitleg };
    }

    const bestaand = body.id ? m.middelen.find(x => x.id === String(body.id)) : null;
    if (body.id && !bestaand) return { status: 404, error: 'Dat middel staat niet in uw schema.' };

    const mid = bestaand || {
      id: crypto.randomBytes(4).toString('hex'),
      begonnenOp: rtgKlok.datum().toISOString(), voorraad: null, voorraadOp: null
    };
    mid.naam = naam;
    mid.sterkte = schoon(body.sterkte, 40);
    mid.notitie = notitie;
    mid.momenten = mom.goed;
    if (!bestaand) {
      if (m.middelen.length >= 40) return { status: 400, error: 'Er staan er al veertig in uw schema.' };
      m.middelen.push(mid);
    }
    save();
    const uit = beeld(key);
    const waar = waarschuwing(mom);
    if (waar) uit.gewaarschuwd = waar;
    return uit;
  }

  function weg(key, id) {
    const m = mijn(key);
    const i = m.middelen.findIndex(x => x.id === String(id));
    if (i < 0) return { status: 404, error: 'Dat middel staat niet in uw schema.' };
    m.middelen.splice(i, 1);
    save();
    return beeld(key);
  }

  /* Aftekenen kan alleen voor VANDAAG. Een schema dat je met terugwerkende
     kracht kunt bijwerken, is geen verslag meer van wat er is gebeurd. */
  function afvinken(key, id, moment, aan) {
    const m = mijn(key);
    const mid = m.middelen.find(x => x.id === String(id));
    if (!mid) return { status: 404, error: 'Dat middel staat niet in uw schema.' };
    if (!mid.momenten.includes(String(moment))) {
      return { status: 400, error: 'Dat moment staat niet bij dit middel.' };
    }
    const d = dag(rtgKlok.datum());
    if (!m.afgetekend[d]) m.afgetekend[d] = {};
    const sleutel = mid.id + '@' + moment;
    if (aan) m.afgetekend[d][sleutel] = rtgKlok.datum().toISOString();
    else delete m.afgetekend[d][sleutel];
    /* Oude dagen opruimen: dit is een agenda en geen dossier. */
    const grens = dag(new Date(rtgKlok.nu() - 120 * 86400000));
    for (const oud of Object.keys(m.afgetekend)) if (oud < grens) delete m.afgetekend[oud];
    save();
    return beeld(key);
  }

  function voorraadZet(key, id, aantal) {
    const m = mijn(key);
    const mid = m.middelen.find(x => x.id === String(id));
    if (!mid) return { status: 404, error: 'Dat middel staat niet in uw schema.' };
    if (aantal === null || aantal === '' || aantal === undefined) {
      mid.voorraad = null; mid.voorraadOp = null;   // terug naar "niet ingevuld"
    } else {
      const n = Number(aantal);
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        return { status: 400, error: 'Vul in hoeveel er in huis zijn, als getal.' };
      }
      mid.voorraad = Math.round(n);
      mid.voorraadOp = rtgKlok.datum().toISOString();
    }
    save();
    return beeld(key);
  }

  /* Wat de noodkaart mag lezen. Net als bij het zorgprofiel: LEZEN, nooit
     kopieren, en alleen als het lid dat op de kaart heeft aangezet. */
  function voorNoodkaart(key) {
    const m = mijn(key);
    return m.middelen.map(x => (x.naam + (x.sterkte ? ' ' + x.sterkte : '')).trim());
  }

  return {
    medicatieVan: beeld, medicatieZet: zet, medicatieWeg: weg,
    medicatieAf: afvinken, medicatieVoorraad: voorraadZet,
    medicatieVoorNoodkaart: voorNoodkaart, MEDICATIE_GRENS: GRENS
  };
};
