/* Magnaat World: GELD IS EEN GEHEEL AANTAL EUROCENTEN (ronde A2.1).

   DE ENE PLEK waar World een economisch bedrag tot geld maakt. Daarvoor rekende
   World in euro's met drijvende komma, en rondde op zes plekken op zijn eigen
   manier af -- of niet: een contractbetaling werd bij de afnemer niet en bij de
   leverancier wel afgerond, dus betaalde de een een fractie meer dan de ander
   ontving. Sinds A2.1:

     - wat geld HOUDT of VERPLAATST staat in hele eurocenten (MONETAIR hieronder)
     - een economisch bedrag wordt EEN keer omgezet (`naarCenten`), voordat het
       op een rekening komt, en beide kanten krijgen datzelfde getal
     - PARAMETERS blijven wat ze zijn: tarieven, marktprijzen, sectortabellen en
       afgesproken bedragen in hele euro's (een lening, een contract, een bod).
       Die worden pas geld als ze door `naarCenten` gaan.
     - de buitenkant blijft in euro's: wat een speler intikt en wat hij op het
       scherm ziet. Omzetten gebeurt aan die rand, en nergens anders.

   DE AFRONDINGSREGEL: rekenkundig, de helft van nul af (0,5 cent wordt 1 cent,
   -0,5 cent wordt -1 cent). Een binaire breuk als 1,005 * 100 = 100,4999...
   wordt eerst op zes decimalen gezet, zodat een bedrag dat in euro's op een halve
   cent eindigt ook zo wordt afgerond.

   Waarom afronden hier gebeurt en niet in het grootboek: afronden is
   DOMEINBELEID (MAGNAAT.md). Het grootboek registreert alleen bedragen die al
   bepaald zijn, en weigert elk ander bedrag. */
'use strict';

/* De regelversie van een NIEUWE partij; een lopende partij houdt de hare.
   1: euro's met drijvende komma. 2: hele eurocenten (A2.1). 3: de stad en de
   spelers betalen de Foundation-afdracht (A2.9, ./foundation.js). */
const WORLD_REGELVERSIE = '3';
const CENTEN_VERSIE = '2';
const EENHEID = 'eurocent';

function naarCenten(euro) {
  const x = Number(euro);
  if (typeof euro !== 'number' || !Number.isFinite(x)) throw new Error('Geen geldbedrag: ' + String(euro) + '.');
  const cent = Math.abs(x) * 100;
  const uit = Math.round(Number(cent.toFixed(6)));
  if (!Number.isSafeInteger(uit)) throw new Error('Te groot geldbedrag: ' + String(euro) + '.');
  return x < 0 && uit !== 0 ? -uit : uit;
}

/* Eurocenten terug naar euro's, om MEE TE REKENEN (een rente over een saldo, een
   verhouding) of om te tonen. Het resultaat is nooit zelf geld: wat eruit komt
   gaat weer door `naarCenten` voordat het ergens op een rekening staat. */
const uitCenten = (cent) => (Number(cent) || 0) / 100;
/* Wat een scherm of verslag ziet: hele euro's, zoals voor A2.1. */
const euroTonen = (cent) => Math.round(uitCenten(cent));

/* DE CONTRACTOMZET VAN EEN LEVERANCIER (./stap.js): als de maand het bedrag
   per contract al in centen heeft vastgesteld (./maand-contracten.js), precies
   die som -- dan ontvangt hij tot op de cent wat zijn afnemers betalen. `null`
   als er niets is vastgesteld; dan rekent de stap zoals voor A2.1. */
const contractCenten = (contract) =>
  (contract && Number.isSafeInteger(contract.betalingCenten) ? contract.betalingCenten : null);
/* Dezelfde omzet in beide eenheden: `centen` is wat er betaald is, `euro` rekent
   de stap mee. Zonder vastgesteld bedrag rekent hij zoals voor A2.1 en wordt dat
   een keer afgerond. */
function contractOmzet(contract, leverDeel) {
  const c = contractCenten(contract);
  if (c !== null) return { centen: c, euro: uitCenten(c) };
  const euro = ((contract && contract.bedrag) || 0) * leverDeel;
  return { centen: naarCenten(euro), euro };
}

/* HET MAANDRESULTAAT ALS GELD. Het zijn acht gebeurtenissen (de geldkaart, G12)
   en elk wordt EEN keer afgerond: de verkoop, de contractomzet zoals hij is
   betaald, en de zes kostenposten. Het resultaat is hun som, zodat het straks
   exact hetzelfde is als acht losse boekingen in het grootboek. Bedragen in
   euro's, behalve `contract`, dat al in centen is. */
function maandDelen({ verkoop, contract, inkoop, lonen, vast, huur, marketing, onderhoud }) {
  const d = {
    VERKOOP: naarCenten(verkoop), CONTRACT_BETALING: contract, INKOOP: naarCenten(inkoop),
    LOON: naarCenten(lonen), VASTE_LASTEN: naarCenten(vast), HUUR: naarCenten(huur),
    MARKETING: naarCenten(marketing), ONDERHOUD: naarCenten(onderhoud)
  };
  d.resultaat = d.VERKOOP + d.CONTRACT_BETALING - d.INKOOP - d.LOON - d.VASTE_LASTEN - d.HUUR - d.MARKETING - d.ONDERHOUD;
  return d;
}

/* DE MONETAIRE VELDEN van een World-partij. Een lijst op een plek, voor twee
   dingen die nooit uit elkaar mogen lopen: de eenmalige omzetting van een
   partij van voor A2.1 (`zorgEenheid`), en de toets dat elk van deze velden na
   elke stap een geheel aantal centen is (test/magnaat-world-geld.test.js). */
const MONETAIR = {
  staat: ['geld'],
  foundation: ['lokaal', 'centraal'],
  leningen: ['restant', 'betaaldRente', 'betaaldAflossing', 'opbrengst'],
  contracten: ['betaald', 'ontvangen', 'boetes', 'afkoop'],
  deelnemingen: ['ontvangen'],
  polissen: ['betaald', 'uitgekeerd']
};

/* Loopt over elk monetair veld van een partij; `doe(houder, veld)`. */
function elkMonetairVeld(st, doe) {
  for (const h of Object.keys(st.geld || {})) doe(st.geld, h);
  if (st.foundation) for (const v of MONETAIR.foundation) doe(st.foundation, v);
  for (const lijst of ['leningen', 'contracten', 'deelnemingen', 'polissen']) {
    for (const x of st[lijst] || []) for (const v of MONETAIR[lijst]) if (x[v] !== undefined && x[v] !== null) doe(x, v);
  }
}

/* EENMALIG: een partij van voor A2.1 rekende in euro's. Hij wordt een keer
   omgezet en krijgt de eenheid en regelversie 2 mee (alleen de centen, de rest
   van zijn regels blijft), zodat hij nooit twee keer wordt omgezet. Een partij
   die al in centen rekent, blijft onaangeroerd. */
function zorgEenheid(st) {
  if (!st || st.eenheid === EENHEID) return false;
  elkMonetairVeld(st, (houder, veld) => { houder[veld] = naarCenten(Number(houder[veld]) || 0); });
  st.eenheid = EENHEID;
  st.regelversie = CENTEN_VERSIE;
  return true;
}

module.exports = { naarCenten, uitCenten, euroTonen, contractCenten, contractOmzet, maandDelen, MONETAIR, elkMonetairVeld, zorgEenheid, WORLD_REGELVERSIE, CENTEN_VERSIE, EENHEID };
