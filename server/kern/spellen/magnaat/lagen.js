/* Magnaat: DE LAGEN VAN FASE B -- contracten, veilingen, belangen, bank, verzekering.

   Afgesplitst van ./economie.js. Dat bestand gaat over de KLOK en de levensloop
   van een partij, en dat is af. Deze lijst groeit juist met elke fase mee: fase
   B zette er zes lagen in (contracten, veilingen, belangen, bank, verzekering,
   onderzoek) plus de AI-manager; fase C zet er gebeurtenissen bij.

   WAT HIER GEBEURT IS BEDRADING EN GEEN SPELREGEL. Elke laag krijgt wat hij
   nodig heeft en geeft terug wat hij aanbiedt; staat hier ooit een regel over
   hoe de economie werkt, dan hoort die in de laag zelf. */
const H = require('./handel');

module.exports = ({ K, mijnVestiging, vrijKavel, wieHeeft, waarde, rond, codenaamVan }) => {
  const { liquideer } = require('./afscheid')({ mijnVestiging, afkoopsom: H.afkoopsom, rond });
  const handel = require('./handel-acties')({ K, mijnVestiging, rond });
  const veiling = require('./veiling')({ K, wieHeeft, afkoopsom: H.afkoopsom });
  const veilen = require('./veiling-acties')(Object.assign({ K, mijnVestiging, vrijKavel }, veiling));
  const aandeel = require('./aandeel')({ wieHeeft, waarde });
  /* DE BANK, in vier stukken op de naden die deze map overal aanhoudt: het
     profiel (wat een speler waard is in de ogen van een geldschieter), de
     acties, wat de KLOK met een lening doet, en hoe een vestiging het spel
     verlaat als een onderpand wordt uitgewonnen. */
  const bp = require('./bankprofiel')({ waarde });
  const bank = require('./bank-acties')({ mijnVestiging, waarde, liquideer,
    profiel: bp.profiel, cijfers: bp.cijfers });
  const bankmaand = require('./bank-maand')({ mijne: bank.mijne, cijfers: bp.cijfers, liquideer });
  const verzekering = require('./verzekering')({ mijnVestiging });
  const rnd = require('./onderzoek-acties')({ mijnVestiging });
  /* De actietabel van alle lagen samen. Hij staat hier los omdat de AI-manager
     hem nodig heeft VOORDAT hij zelf een actie toevoegt -- zie hieronder. */
  const alleActies = Object.assign({}, handel.ACTIES, veilen.ACTIES, bank.ACTIES,
    verzekering.ACTIES, rnd.ACTIES);
  const belangen = require('./aandeel-acties')({ wieHeeft,
    uitgegeven: aandeel.uitgegeven, MAX_DEEL: aandeel.MAX_DEEL });
  /* DE BEURS: dezelfde belangen, maar openbaar te koop. Hij deelt de
     administratie met de deelnemingen -- een tweede boekhouding van hetzelfde
     loopt uiteen zodra er ergens een pad bijkomt. */
  const beurs = require('./beurs')({ wieHeeft, waarde, eigenDeel: aandeel.eigenDeel,
    uitgegeven: aandeel.uitgegeven, MAX_DEEL: aandeel.MAX_DEEL });
  const handelen = require('./beurs-acties')({ beurs, wieHeeft, mijnVestiging,
    uitgegeven: aandeel.uitgegeven, MAX_DEEL: aandeel.MAX_DEEL });
  /* DE AI-MANAGER krijgt de hele actietabel mee en niets anders: hij doet niets
     wat een speler niet ook kan (./beheer.js, wet 1). Daarom wordt hij HIER
     samengesteld, nadat alle lagen hun acties hebben afgegeven -- een manager
     die een deel van de tabel mist, kan een deel van het bedrijf niet beheren
     en dat zou stil misgaan. */
  Object.assign(alleActies, belangen.ACTIES, handelen.ACTIES);
  /* DE MANAGER KRIJGT ZIJN TABEL PAS ALS HIJ COMPLEET IS, en dat is een fout die
     hier echt gemaakt is. Hij werd hier samengesteld met de actietabel van de
     LAGEN -- en die mist juist de basisacties (`beleid`, `open`, `uitbreiden`),
     want die worden pas in ../economie.js bijgeschoven. Gevolg: de manager
     draaide, rekende zijn tarief, schreef netjes niets in zijn log, en keek acht
     maanden lang toe hoe het onderhoud van 72 naar 44 zakte. Elke `beleid`-zet
     die hij deed viel op een `undefined` in de tabel.

     Het stond nog in de opmerking hierboven ook: een manager die een deel van de
     tabel mist, kan een deel van het bedrijf niet beheren en dat gaat STIL mis.
     Daarom is hij nu een FABRIEK: wie hem maakt, moet eerst de hele tabel
     hebben, en ../economie.js is de enige plek waar die compleet is. Zijn ACTIES
     (aan, uit, regels) kunnen wel meteen -- die lezen alleen de staat. */
  const beheren = require('./beheer-acties')();
  const maakBeheer = (ACTIES) => require('./beheer')({ ACTIES });

  return {
    ACTIES: Object.assign(alleActies, beheren.ACTIES),
    VRIJE_ACTIES: [].concat(handel.VRIJE_ACTIES, veilen.VRIJE_ACTIES, belangen.VRIJE_ACTIES,
      bank.VRIJE_ACTIES, verzekering.VRIJE_ACTIES, rnd.VRIJE_ACTIES, beheren.VRIJE_ACTIES,
      handelen.VRIJE_ACTIES),
    hameren: veiling.hameren, verdeel: aandeel.verdeel, beurs, bankmaand, onthoud: bp.onthoud,
    verzekering, rnd, maakBeheer, liquideer,
    zichtdelen: {
      veilingbeeld: (st, h) => veiling.beeld(st, h, codenaamVan),
      belangbeeld: (st, h) => aandeel.beeld(st, h, codenaamVan),
      belangwaarde: aandeel.belangwaarde, eigenDeel: aandeel.eigenDeel,
      bankbeeld: (st, h) => bank.beeld(st, h), kredietprofiel: bp.beeld,
      verzekerbeeld: (st, h) => verzekering.beeld(st, h),
      rndbeeld: (st, h) => rnd.beeld(st, h),
      beheerbeeld: (st, h) => beheren.beeld(st, h),
      beursbeeld: (st, h) => handelen.beeld(st, h, codenaamVan)
    }
  };
};
