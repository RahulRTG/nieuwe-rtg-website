/* ============================================================================
   DE MANDAATSIMULATOR -- wat verandert er als ik dit aanvaard?

   HET GAT DAT DIT DICHT. Een machtiging aanvaarden is vandaag overal in de
   wereld hetzelfde: een lap tekst, een vinkje, en daarna weet niemand meer wat
   er precies openging. Software lost dat al twintig jaar anders op -- een
   app-installatie toont een permissions-diff -- maar op MENSELIJK niveau
   bestaat dat nauwelijks. Dit bestand is die diff.

   DRIE REGELS, EN DE TWEEDE IS DE ENIGE DIE ECHT NIEUW IS.

   1. HIJ TOONT WAT ER VERANDERT, NIET WAT ER IS. Staat er al een machtiging
      voor deze persoon, dan is de uitkomst een verschil: erbij, eraf, gelijk.
      Een lijst die elke keer alles opsomt, leest niemand een tweede keer.

   2. HIJ TOONT WAT ER NIET OPENGAAT, EVEN GROOT. Dat is de helft die overal
      ontbreekt en die de cliënt het hardst nodig heeft: niet "hij mag twaalf
      dingen" maar "hij mag deze twaalf en met zekerheid deze zeven niet". De
      NOOIT-lijst komt uit ./bevoegdheden.js en niet uit een tekst op een
      scherm, zodat wat hier staat afdwingbaar is en niet geruststellend.

   3. HIJ SIMULEERT EN HIJ SCHRIJFT NIETS. Geen db in dit bestand -- dezelfde
      vorm als kern/commercie/voornemen.js, dat uitrekent wat er ZOU gebeuren en
      niets boekt. Wie hem laat schrijven, heeft van een voorbeschouwing een
      handeling gemaakt.

   WAT HIJ MET OPZET NIET DOET: een cijfer geven. Geen risicoscore, geen "deze
   machtiging is 80% veilig". CARRIERE.md CAR-05 -- er komt geen cijfer op een
   mens, en een cijfer op wat een mens weggeeft is dat langs een omweg. De
   cliënt krijgt de opbouw en trekt zelf zijn conclusie. */
'use strict';

const { BEVOEGDHEDEN, NOOIT } = require('./bevoegdheden');
const { stand, versmalMachtiging, MAX_MAANDEN } = require('./machtiging');

const toon = (k) => Object.assign({ sleutel: k }, BEVOEGDHEDEN[k]);

/* Hoeveel hele dagen loopt dit nog? Naar beneden afgerond, want een machtiging
   die "nog 1 dag" zegt terwijl hij over een uur stopt, liegt in uw voordeel --
   en dat is de verkeerde kant om te liegen. */
function dagenTot(tot, nu) {
  const eind = Date.parse(tot);
  if (!Number.isFinite(eind)) return null;
  return Math.max(0, Math.floor((eind - (nu == null ? Date.now() : nu)) / 86400000));
}

/* De simulatie. `huidig` mag ontbreken (een eerste machtiging); `magClient` is
   wat de cliënt zelf heeft, zodat de versmalling zichtbaar wordt VOORDAT hij
   aanvaardt in plaats van erna. */
function simuleer({ voorstel, huidig, magClient, nu }) {
  if (!voorstel || typeof voorstel !== 'object') {
    return { error: 'Er is geen voorstel om te bekijken.' };
  }
  const t = nu == null ? Date.now() : nu;
  const smal = versmalMachtiging(magClient, voorstel);
  const straks = smal.bevoegdheden;

  const nuActief = huidig && stand(huidig, t) === 'actief'
    ? (huidig.bevoegdheden || []).slice()
    : [];

  const erbij = straks.filter(k => !nuActief.includes(k));
  const eraf = nuActief.filter(k => !straks.includes(k));
  const gelijk = straks.filter(k => nuActief.includes(k));

  /* Klaarzetten apart, want dat is de vraag die een cliënt werkelijk stelt:
     kan hij iets DOEN, of alleen iets voorleggen? */
  const doet = straks.filter(k => !BEVOEGDHEDEN[k].klaarzetten);
  const legtVoor = straks.filter(k => BEVOEGDHEDEN[k].klaarzetten);

  return {
    hoedanigheid: voorstel.hoedanigheid,
    eersteMachtiging: !nuActief.length,
    kan: straks.map(toon),
    kanNiet: NOOIT.slice(),
    verandering: { erbij: erbij.map(toon), eraf: eraf.map(toon), gelijk: gelijk.map(toon) },
    zelfstandig: doet.map(toon),
    legtVoor: legtVoor.map(toon),
    afgevallen: smal.buiten.map(toon),
    afgevallenReden: smal.buiten.length ? smal.reden : null,
    looptijd: { van: voorstel.van, tot: voorstel.tot, nogDagen: dagenTot(voorstel.tot, t), maxMaanden: MAX_MAANDEN },
    plafondCenten: voorstel.plafondCenten,
    plafondUitleg: voorstel.plafondCenten == null
      ? 'Deze machtiging noemt geen plafond. Er wordt dan namens u niet over bedragen gesproken -- ' +
        'dat is strenger dan een plafond van nul, want nul leest als "gratis mag wel".'
      : 'Tot dit bedrag mag er namens u over een aanbod gesproken worden. Erboven beslist u zelf, ' +
        'en vastleggen doet u altijd zelf.',
    intrekken: 'U kunt deze machtiging op elk moment intrekken, per direct en zonder reden. ' +
      'Hij stopt daarnaast vanzelf op de einddatum; daar hoeft u niets voor te doen.',
    grens: 'Dit is een DOORSNEDE en geen toekenning: alles hierin had u zelf al. Een machtiging ' +
      'versmalt bestaand vermogen en voegt er nooit iets aan toe.',
    /* WAT DEZE SIMULATIE NIET WEET, en dat staat er even groot bij -- een leeg
       vak wordt gevuld met iemands eigen indruk (SERVICE.md par. 12). */
    nietGewogen: [
      'Of deze persoon betrouwbaar is. RTG kent hem niet; dit toont alleen wat hij zou mogen.',
      'Wat er buiten RTG wordt afgesproken. Een machtiging hier bindt niemand daarbuiten.',
      'Of dit een goed idee is. Daar gaat u over, en er komt geen cijfer op.'
    ]
  };
}

module.exports = { simuleer, dagenTot };
