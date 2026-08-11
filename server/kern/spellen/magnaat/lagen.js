/* Magnaat: DE LAGEN VAN FASE B -- contracten, veilingen, belangen, bank, verzekering.

   Afgesplitst van ./economie.js. Dat bestand gaat over de KLOK en de levensloop
   van een partij, en dat is af. Deze lijst groeit juist met elke fase mee: fase
   B zette er vijf lagen in, fase C zet er gebeurtenissen en AI-beheer bij.

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
  const belangen = require('./aandeel-acties')({ wieHeeft,
    uitgegeven: aandeel.uitgegeven, MAX_DEEL: aandeel.MAX_DEEL });
  return {
    ACTIES: Object.assign({}, handel.ACTIES, veilen.ACTIES, belangen.ACTIES, bank.ACTIES, verzekering.ACTIES),
    VRIJE_ACTIES: [].concat(handel.VRIJE_ACTIES, veilen.VRIJE_ACTIES, belangen.VRIJE_ACTIES,
      bank.VRIJE_ACTIES, verzekering.VRIJE_ACTIES),
    hameren: veiling.hameren, verdeel: aandeel.verdeel, bankmaand, onthoud: bp.onthoud,
    verzekering, liquideer,
    zichtdelen: {
      veilingbeeld: (st, h) => veiling.beeld(st, h, codenaamVan),
      belangbeeld: (st, h) => aandeel.beeld(st, h, codenaamVan),
      belangwaarde: aandeel.belangwaarde, eigenDeel: aandeel.eigenDeel,
      bankbeeld: (st, h) => bank.beeld(st, h), kredietprofiel: bp.beeld,
      verzekerbeeld: (st, h) => verzekering.beeld(st, h)
    }
  };
};
