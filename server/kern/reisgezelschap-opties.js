/* DE GROEPSBEREKENING VAN EEN REISGEZELSCHAP -- past een optie voor iedereen?

   Stap 2 van "Five People. Five Private Contexts. One Shared Outcome". De
   reiziger zet een paar opties klaar (een titel, een prijs per persoon, data,
   kenmerken). Deze module legt elke optie naast de PRIVE OPGAVEN van alle
   deelnemers (./reisgezelschap-opgave.js) en geeft een uitkomst die niemand
   iets over een ander vertelt:

     voor de groep   past voor iedereen / past niet voor iedereen /
                     nog niet vast te stellen
     voor jou        past wel of niet, en ALLEEN JOUW eigen reden

   Er staat nergens hoeveel mensen een optie niet past, en nergens wie. Met vijf
   mensen is "een persoon past niet" al bijna een naam.

   DE BEREKENING IS DETERMINISTISCH en kent geen model. Rahul mag later opties
   VOORSTELLEN, maar of een optie past wordt hier uitgerekend en niet geraden.

   DE AANVAL WAAR DIT BESTAND TEGEN BESTAAT. Een uitkomst "past voor iedereen" is
   een orakel over het laagste plafond van de groep: wie dezelfde optie steeds
   met een iets andere prijs laat toetsen, zoekt die grens binnen een handvol
   pogingen op. Drie remmen, en ze staan er alle drie:

     1 GROVE PRIJSSTAPPEN. Er wordt vergeleken in stappen van EUR 50: een plafond
       telt naar beneden, een prijs naar boven. Fijner dan dat leert niemand
       iets, en de uitkomst blijft aan de veilige kant.
     2 EEN TOETSBUDGET PER REIS. Hoogstens MAX_TOETSEN nieuwe of gewijzigde
       opties per 24 uur, voor de hele reis samen. Daarboven wordt er niet
       getoetst maar geweigerd, met het moment waarop het weer kan.
     3 DE TELLER IS VOOR IEDEREEN ZICHTBAAR. Elke deelnemer ziet hoeveel opties
       er het afgelopen etmaal zijn getoetst. Wie zijn reisgenoten probeert uit
       te horen, doet dat niet onzichtbaar.

   WAT DIT NIET DICHT, en dat staat er even groot bij (`grens` in het antwoord):
   wie over meerdere dagen blijft toetsen, leert het laagste plafond van de
   groep tot op EUR 50 nauwkeurig. Hij leert niet van wie het is. Een volledige
   bescherming daartegen vraagt een andere techniek (ruis, of een berekening
   die de server zelf niet kan lezen), en die is er niet.

   EN EEN DREMPEL. Onder MIN_DEELNEMERS deelnemers, of zolang niet iedereen iets
   heeft opgegeven, is er geen groepsuitkomst: met twee mensen weet de een na
   een "past" meteen iets over de ander. Iedereen krijgt dan wel zijn eigen
   "past voor jou".

   VOORLOPIG IS GEEN BESLUIT. Alles wat hier uitkomt heet `voorlopig`. Een
   gezamenlijk besluit is een vaste versie waar ieder apart mee instemt, en dat
   is stap 4 -- niet deze module. */
'use strict';

const { BAND, MAX_OPTIES, MAX_TOETSEN, DAG_MS, MIN_DEELNEMERS, GRENS, NIET_GEZEGD, pastBij, gedeeldVenster, keurOptie } =
  require('./reisgezelschap-opties-reken');
const { projectie } = require('./reisgezelschap-werkruimte');

module.exports.maakGezelschapOpties = ({ db, save, klok, crypto, reisVan, opgave }) => {
  const nuMs = () => klok.datum().getTime();
  const eigen = require('./eigencollectie')({ db, domein: 'kern/reisgezelschap-opties', bezit: { reisOpties: 'kaart' } });
  /* Op de sleutel van de EIGENAAR, zodat vergeten hem meeneemt. */
  const vak = (eigenaar, reisId, maak) => {
    const k = eigen.bak('reisOpties');
    if (!k[eigenaar]) { if (!maak) return null; k[eigenaar] = {}; }
    if (!k[eigenaar][reisId]) { if (!maak) return null; k[eigenaar][reisId] = { opties: [], toetsen: [] }; }
    return k[eigenaar][reisId];
  };
  const NIET = { status: 404, error: 'U reist niet mee met deze reis.' };
  const recent = (v) => (v ? v.toetsen.filter(t => nuMs() - t < DAG_MS) : []);

  /* Een optie zetten of wijzigen. Alleen de reiziger zelf; hij is degene die
     voorstelt, de rest zegt straks ja of nee. Een ongewijzigde optie opnieuw
     zetten kost geen toetsing: dat is een dubbeltik, geen proef. */
  function zetOptie(key, reisId, invoer, id) {
    if (!reisVan(key, reisId)) return { status: 404, error: 'Alleen de reiziger zet opties klaar.' };
    const k = keurOptie(invoer, opgave.VOORKEUREN);
    if (k.fout) return { status: 400, error: k.fout };
    const v = vak(key, reisId, true);
    const inhoud = (o) => JSON.stringify([o.titel, o.prijsPP, o.van, o.tot, o.kenmerken]);
    const bestaand = id ? v.opties.find(o => o.id === id) : null;
    if (id && !bestaand) return { status: 404, error: 'Die optie bestaat niet.' };
    /* Ongewijzigd, of een nieuwe optie die er al precies zo staat: geen tweede
       optie en geen toetsing. */
    const gelijk = bestaand ? (inhoud(bestaand) === inhoud(k.optie) ? bestaand : null)
      : v.opties.find(o => inhoud(o) === inhoud(k.optie));
    if (gelijk) return { status: 200, ok: true, optie: gelijk, getoetst: false };
    if (!bestaand && v.opties.length >= MAX_OPTIES) {
      return { status: 409, error: 'Er staan al ' + MAX_OPTIES + ' opties klaar. Haal er een weg voor u een nieuwe toevoegt.' };
    }
    const gebruikt = recent(v);
    if (gebruikt.length >= MAX_TOETSEN) {
      const weer = new Date(Math.min(...gebruikt) + DAG_MS).toISOString();
      return { status: 429, error: 'Er zijn het afgelopen etmaal al ' + MAX_TOETSEN + ' opties getoetst. Dat is de grens, ' +
        'zodat niemand de plafonds van anderen kan uithoren. Het kan weer vanaf ' + weer + '.', weerVanaf: weer };
    }
    v.toetsen = gebruikt.concat([nuMs()]);
    let optie;
    if (bestaand) { Object.assign(bestaand, k.optie); optie = bestaand; }
    else { optie = Object.assign({ id: 'O-' + crypto.randomBytes(4).toString('hex') }, k.optie); v.opties.push(optie); }
    save();
    return { status: 200, ok: true, optie, getoetst: true };
  }

  function wisOptie(key, reisId, id) {
    if (!reisVan(key, reisId)) return { status: 404, error: 'Alleen de reiziger haalt opties weg.' };
    const v = vak(key, reisId, false);
    if (v && v.opties.some(o => o.id === id)) { v.opties = v.opties.filter(o => o.id !== id); save(); }
    return { status: 200, ok: true };
  }

  /* HET GROEPSBEELD, voor elke deelnemer hetzelfde op een punt na: `voorJou`
     gaat over de lezer en over niemand anders. Leest alleen; de teller loopt
     bij het ZETTEN, niet bij het kijken. */
  function groepsbeeld(key, reisId) {
    const d = opgave.deelnameVan(key, reisId);
    if (!d) return NIET;
    const v = vak(d.eigenaar, reisId, false);
    const rijen = opgave.voorDeBerekening(d.eigenaar, reisId);
    const allemaal = rijen.every(r => r.opgave);
    const vast = allemaal && rijen.length >= MIN_DEELNEMERS;
    const mijn = (rijen.find(r => r.key === key) || {}).opgave || null;
    const waaromNiet = vast ? null : rijen.length < MIN_DEELNEMERS
      ? 'Een groepsuitkomst komt er vanaf ' + MIN_DEELNEMERS + ' deelnemers; met minder zegt hij iets over een ander.'
      : 'Nog niet iedereen heeft iets opgegeven.';
    const opties = (v ? v.opties : []).map(o => ({
      id: o.id, titel: o.titel, prijsPP: o.prijsPP, van: o.van, tot: o.tot, kenmerken: o.kenmerken,
      voorIedereen: vast ? rijen.every(r => pastBij(o, r.opgave).past) : null,
      voorJou: mijn ? pastBij(o, mijn) : null
    }));
    /* Per lezer een projectie (./reisgezelschap-werkruimte.js): de server kiest
       blokken, gegevens en handelingen bij de rol, het scherm tekent alleen. */
    return projectie(d.eigenaar === key ? 'eigenaar' : 'reisgenoot', {
      deelnemers: rijen.length, ingevuld: rijen.filter(r => r.opgave).length,
      vastTeStellen: vast, waaromNiet, mijn,
      venster: vast ? gedeeldVenster(rijen.map(r => r.opgave)) : null,
      opties, berekendOp: new Date(nuMs()).toISOString(),
      toetsingen: { afgelopenEtmaal: recent(v).length, max: MAX_TOETSEN },
      nietGezegd: NIET_GEZEGD, grens: GRENS });
  }

  return { zetOptie, wisOptie, groepsbeeld };
};
Object.assign(module.exports, { pastBij, gedeeldVenster, keurOptie, BAND, MAX_TOETSEN, MIN_DEELNEMERS });
