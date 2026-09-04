/* ============================================================================
   DE CORRECTIE OP EEN REKENINGREGEL -- de weg die de foutmelding al beloofde.

   WAAR DIT UIT KOMT, EN HET IS EEN DOOD SPOOR IN DE ZUIVERSTE VORM. Wie een
   regel van een rekening haalde waar de keuken al aan begonnen was, kreeg:

       "De keuken is hier al aan begonnen. Haal hem eraf via derving, met een
        reden."                        (routes/supplier/horeca/rekening.js)

   Die derving bestaat -- maar in een ANDER domein. `/api/supplier/kassa/derving`
   schrijft in `kassaDerving`, neemt losse items met een prijs en een aantal,
   boekt voorraad af, en kent geen rekening, geen regel en geen gast. Je kunt er
   dus niet mee doen waar de melding je heen stuurde. De horecalaag zei dat zelf
   al, op een plek waar niemand het zocht: kern/horeca/dienstmeting.js meldt bij
   meetpunt 9 dat "de kassa derving met een soort kent; de rekening niet".

   Het gevolg was niet administratief. Een gerecht dat verkeerd bereid was, kon
   alleen van de rekening met KORTING (op de hele bon, zonder te zeggen wat er
   misging) of met ONINBAAR (de hele rekening afboeken). Alles of niets, en in
   geen van beide gevallen staat er wat er met dat ene gerecht gebeurde.

   ================== WAT HIER VASTLIGT, EN WAAROM ==================

   1. DE REGEL BLIJFT STAAN. Een correctie haalt de regel niet weg maar zet er
      `gecorrigeerd` op; hij telt daarna nul. Dat is dezelfde keuze als bij het
      weghalen van een stoel (kern/horeca/gezelschap.js grens 3): laat je een
      regel verdampen, dan ziet de keuken zijn werk verdwijnen, verliest de gast
      het spoor van wat hij bestelde, en kan niemand later nagaan wat er misging.
      Precies daarom telt hij nul via `regelSom` in kern/horeca.js -- één plek,
      zodat de totalen, het splitsen, het samenvoegen en de verdeling per stoel
      allemaal vanzelf meebewegen en de somcontrole blijft kloppen.

   2. EEN GROND EN EEN REDEN, ALLEBEI VERPLICHT. De grond komt uit een gesloten
      lijst (waarop hoort dit thuis in de dagcijfers), de reden is vrije tekst
      (wat gebeurde er precies). Zonder grond is elke correctie "iets met eten"
      en zegt de dagstaat niets; zonder reden is het een knop waarmee omzet
      verdwijnt. Dezelfde eis stelt `korting` al, en `keuken/stand` bij het
      terugzetten.

   3. GELD WORDT KLAARGEZET, NOOIT VERPLAATST. Is er nog niet betaald, dan zakt
      het te betalen bedrag en is er verder niets. Is er AL betaald, dan ontstaat
      er een TERUGGAVERECHT met een bevroren bedrag -- en daar houdt deze laag
      op. Een mens voert het uit langs kern/pay, met de bevoegdheid die daarvoor
      bestaat. Dat is GELD.md par. 3, en dezelfde afweging die
      kern/commerce/retour.js en kern/appstore/teruggave.js maken.

   4. EEN NEGATIEF `openstaand` IS HET SPIEGELBEELD VAN DE TERUGGAVE, EN DAT
      BLIJFT ZO. Corrigeer je nadat er betaald is, dan zakt `teBetalen` terwijl
      `betaald` staat, en `openstaand` wordt negatief. Dat is niet netjes
      wegwerken door hem op nul af te kappen: dan is het bedrag dat de zaak te
      veel heeft stil verdwenen uit de enige plek waar een scherm het leest. Het
      is de waarheid, en hij hoort te kloppen met de som van de nog niet
      uitgevoerde teruggaven -- een invariant die scripts/tafelproef.js meet.

   5. HET BEDRAG WORDT BEVROREN. Wat de regel kostte op het moment van
      corrigeren, staat vast in de correctie. Verandert de kaart later, dan
      verandert een teruggave uit vorige week niet mee. Zelfde reden als in
      kern/commerce/retour.js.

   ================== WAAROM DIT GEEN kern/commerce/retour.js IS ==============

   Die laag is er voor een KOPER die goederen terugstuurt naar een VERKOPER:
   verzendstanden, een `orderRef` naar een order in een vreemd domein die RTG
   niet kan nakijken, en een verkoper die nog moet beslissen. Een gast aan tafel
   stuurt niets terug, de order is van DIT domein en staat een functie verderop,
   en de medewerker die de correctie boekt IS de verkoper. COMMERCE.md had die
   vraag al gemeten: van de 100 domeinen kenden er zes iets dat op een retour
   leek en geen ervan was een goederenretour. Wat hier WEL uit die laag komt is
   de VORM -- gesloten gronden, een bevroren bedrag, een geldbesluit dat wordt
   klaargezet.

   De gronden en de niet-gebouwd-lijst staan in ./correctielijst.js.
   ========================================================================== */
'use strict';

const { GRONDEN, GROND, NIET_GEBOUWD } = require('./correctielijst');
module.exports = ({ horeca, schoon }) => {
  const { regelSom, nu, id, heleCenten } = horeca;

  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 200);

  /* Wat er al betaald is, telt mee voor de vraag of er geld TERUG moet. Het
     staat hier en niet in horeca.js omdat het een vraag van deze laag is:
     `totaal()` weet wat er betaald is, maar niet of dat na een correctie te
     veel is geworden. */
  function betaaldCenten(rek) {
    return (rek.betalingen || []).reduce((t, b) => t + heleCenten(b.centen || 0), 0);
  }

  /* De regels die nog meetellen -- dus zonder de al gecorrigeerde. */
  const levend = (rek) => (rek.regels || []).filter(r => !r.gecorrigeerd);

  function corrigeer(rek, { regelId, grond, reden, door }) {
    const regel = (rek.regels || []).find(x => x.id === String(regelId || ''));
    if (!regel) return { status: 404, error: 'Die regel staat niet op deze rekening.' };
    if (regel.gecorrigeerd) return { status: 409, error: 'Deze regel is al gecorrigeerd.', correctie: regel.gecorrigeerd };

    const g = GROND.get(tekst(grond, 40));
    if (!g) return { status: 400, error: 'Kies een grond: ' + GRONDEN.map(x => x.id).join(', ') + '.' };
    const waarom = schoon ? schoon(reden, 160) : tekst(reden, 160);
    if (!waarom) return { status: 400, error: 'Noteer wat er misging. Dat blijft bij de correctie staan.' };

    /* HET BEDRAG WORDT NU BEVROREN, niet later uitgerekend -- zie de kop. Het
       is de waarde die de regel op DIT moment had, inclusief wat er destijds
       aan happy hour op zat (die zit al in `regel.centen`). */
    const centen = regelSom(regel);

    /* Was de rekening al (deels) betaald, dan is er meer binnen dan er nu nog
       te betalen valt. Het VERSCHIL is wat er terug hoort; meer dan de
       correctie zelf kan het nooit zijn, want de rest van de bon staat nog. */
    const teBetalenNa = levend(rek).reduce((t, r) => t + regelSom(r), 0) - centen;
    const betaald = betaaldCenten(rek);
    const teveel = Math.max(0, Math.min(centen, betaald - teBetalenNa));

    const c = {
      id: id ? id(4) : Math.random().toString(36).slice(2, 10),
      regelId: regel.id, naam: regel.naam, aantal: regel.aantal,
      grond: g.id, grondLabel: g.label, meldingVan: g.wie,
      reden: waarom,
      centen,
      stand: regel.stand || null,          // hoe ver de keuken was toen het misging
      door: tekst(door, 60) || null,
      at: nu(),
      /* Het geldbesluit. `uitgevoerd: false` reist altijd mee: een klaargezet
         bedrag dat eruitziet als een uitbetaald bedrag is precies de verwarring
         die kern/pay/bewijs.js met drie standen en geen groen probeert te
         voorkomen. */
      teruggave: teveel > 0
        ? { centen: teveel, uitgevoerd: false,
            let: 'Dit bedrag staat KLAAR. Een medewerker betaalt het terug langs RTG Pay; deze laag verplaatst geen geld.' }
        : null
    };
    regel.gecorrigeerd = c;
    if (!Array.isArray(rek.correcties)) rek.correcties = [];
    rek.correcties.push(c);
    return { ok: true, correctie: c };
  }

  /* Wat een scherm van de correcties te zien krijgt. De gastkant leest dit ook,
     en daar hoort `door` NIET bij: welke medewerker een fout heeft
     rechtgezet, is niets voor de gast (HORECA.md: geen ranglijst op mensen). */
  function voorGast(rek) {
    return (rek.correcties || []).map(c => ({
      naam: c.naam, aantal: c.aantal, grondLabel: c.grondLabel, reden: c.reden,
      centen: c.centen, at: c.at,
      teruggave: c.teruggave ? { centen: c.teruggave.centen, uitgevoerd: c.teruggave.uitgevoerd, let: c.teruggave.let } : null
    }));
  }

  return { corrigeer, voorGast, GRONDEN, GROND, NIET_GEBOUWD, betaaldCenten, levend };
};
module.exports.GRONDEN = GRONDEN;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
