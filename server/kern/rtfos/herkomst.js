/* Foundation OS, deel "herkomst": de controle op grote en contante giften.

   EEN STICHTING IS EEN AANTREKKELIJK VAT. Geld dat er via een goed doel doorheen
   loopt, komt er schoon uit -- dat is niet cynisch maar de reden dat de Wwft
   bestaat en dat toezichthouders naar juist deze sector kijken. En de tweede
   kant is even echt: een grote gever die iets terugverwacht (een opdracht, een
   bestuurszetel, zijn logo op elke gevel) koopt geen goed doel maar invloed.

   DRIE DINGEN, EN ALLE DRIE MET OPZET SAAI:

   1. BOVEN DE DREMPEL STAAT HET GELD STIL. Een bron boven de tienduizend euro,
      of contant boven vijfhonderd, krijgt bij binnenkomst een OPEN controle --
      en zolang die open staat, kan er niets uit worden uitgegeven. Dat is de
      hele grendel: niet een waarschuwing, niet een vinkje op een lijst, maar
      geld dat niet beweegt. De controle zit op de BRON en niet op de aanvrager
      (LAT.md regel 7): wie het geld ook wil aanspreken, hij stuit op hetzelfde.

   2. EEN GIFT MET TEGENPRESTATIE IS GEEN GIFT. Staat er iets tegenover, dan is
      het sponsoring -- ander fiscaal regime, andere verantwoording, en een
      andere vraag aan het bestuur. Het systeem weigert de gift dan als donatie
      en zegt waar hij wel thuishoort.

   3. DE SANCTIELIJST DOET DIT SYSTEEM NIET. Er is geen koppeling met de EU- of
      VN-lijsten, en die er niet is moet ook niet worden gesuggereerd. Het veld
      vraagt of iemand het HANDMATIG heeft gecontroleerd en wie dat was. Een
      knop die "gecontroleerd" zegt zonder iets te controleren is gevaarlijker
      dan geen knop -- dan denkt het bestuur dat het geregeld is.

   WAT DIT NIET IS: geen melding aan de FIU. Een ongebruikelijke transactie
   melden is mensenwerk met een eigen route; dit systeem legt vast dat er is
   gekeken, en door wie. */

const DREMPEL_CENTEN = 1000000;        // tienduizend euro
const CONTANT_DREMPEL_CENTEN = 50000;  // vijfhonderd euro contant
const UITKOMSTEN = ['akkoord', 'akkoord_met_voorwaarde', 'geweigerd'];
// de bronsoorten die een GIFT zijn; subsidie en eigen_middelen horen er niet bij
const GIFTEN = ['donatie', 'maandelijkse_donatie', 'sponsoring', 'goederen'];

module.exports = (ctx) => {
  const { nu, schoon, euro, S, audit, wie, save } = ctx;

  /* Wordt aangeroepen door geld.js zodra een bron ontstaat. Hier en nergens
     anders wordt bepaald of er gekeken moet worden; twee plekken die dat
     zouden beslissen, gaan uiteen (LAT.md regel 4). */
  function bepaal(bron) {
    /* ALLEEN GIFTEN. Een subsidie is geen gift maar een verplichting met geld
       eraan, en zijn herkomst staat per definitie vast: verstrekker, beschikking,
       voorwaarden en rapportagemomenten staan al in subsidies.js. Zou hij hier
       ook blijven hangen, dan bevriest elke gemeentesubsidie -- en een controle
       die bij elke normale betaling afgaat, wordt weggeklikt zonder lezen. Dan
       is de grendel er nog wel en het toezicht niet meer. Eigen middelen vallen
       er om dezelfde reden buiten: dat is geld dat de stichting al had. */
    if (!GIFTEN.includes(bron.soort)) return null;
    const contant = bron.kenmerk === 'contant' || bron.contant === true;
    const reden = contant && bron.centen >= CONTANT_DREMPEL_CENTEN
      ? 'contante gift boven ' + euro(CONTANT_DREMPEL_CENTEN) + ' euro'
      : (bron.centen >= DREMPEL_CENTEN ? 'gift boven ' + euro(DREMPEL_CENTEN) + ' euro' : null);
    if (!reden) return null;
    bron.herkomst = { status: 'open', reden, at: nu() };
    return bron.herkomst;
  }

  const nodig = bron => !!(bron && bron.herkomst && bron.herkomst.status === 'open');

  function beeld(b) {
    const h = b.herkomst || null;
    return { bronId: b.id, stad: b.stad, gever: b.gever, soort: b.soort, bedrag: euro(b.centen),
      status: h ? h.status : 'niet_nodig', reden: h ? h.reden : null,
      gemeld: h && h.gemeld ? h.gemeld : null, at: h ? h.at : b.at };
  }

  function lijst(req, filter) {
    const f = filter || {};
    const w = wie(req);
    const mijn = w.landelijk ? null : [...new Set(w.zetels.map(z => z.stad))];
    let bronnen = S().bronnen.filter(b => b.herkomst);
    if (mijn) bronnen = bronnen.filter(b => mijn.includes(b.stad));
    if (f.stad) bronnen = bronnen.filter(b => b.stad === String(f.stad));
    if (f.open) bronnen = bronnen.filter(b => b.herkomst.status === 'open');
    const zicht = bronnen.map(beeld);
    return { ok: true, aantal: zicht.length, open: zicht.filter(x => x.status === 'open').length,
      drempel: euro(DREMPEL_CENTEN), contantDrempel: euro(CONTANT_DREMPEL_CENTEN),
      uitkomsten: UITKOMSTEN, controles: zicht.slice(0, 200) };
  }

  /* De controle afronden. Landelijk werk: een stad die haar eigen grote gift
     goedkeurt, controleert zichzelf -- en juist bij dit onderwerp is dat het
     probleem en niet de oplossing. */
  function beoordeel(req, bronId, b) {
    b = b || {};
    const w = wie(req);
    if (!w.landelijk) {
      return { status: 403, error: 'Een grote of contante gift beoordeelt het landelijke bestuur. Een stad die haar eigen ' +
        'gift goedkeurt, controleert zichzelf.' };
    }
    const bron = S().bronnen.find(x => x.id === String(bronId || ''));
    if (!bron) return { status: 404, error: 'Deze bron bestaat niet.' };
    if (!bron.herkomst) return { status: 400, error: 'Deze bron valt onder geen van de drempels; er is niets te beoordelen.' };
    if (bron.herkomst.status !== 'open') {
      return { status: 400, error: 'Deze controle is al afgerond op ' + String(bron.herkomst.beoordeeldOp || '').slice(0, 10) + '.' };
    }
    const uitkomst = UITKOMSTEN.includes(b.uitkomst) ? b.uitkomst : null;
    if (!uitkomst) return { status: 400, error: 'Wat is de uitkomst? ' + UITKOMSTEN.join(', ') + '.' };

    const bekend = schoon(b.herkomstGeld, 400);
    if (bekend.length < 10) {
      return { status: 400, error: 'Waar komt dit geld vandaan? Zonder antwoord op die vraag is de controle niet gedaan, ' +
        'alleen afgevinkt.' };
    }
    const tegenprestatie = b.tegenprestatie === true;
    /* GRENDEL 2. Een gift met tegenprestatie is sponsoring. */
    if (tegenprestatie && (bron.soort === 'donatie' || bron.soort === 'maandelijkse_donatie')) {
      return { status: 400, error: 'Er staat iets tegenover deze gift, dus het is geen donatie maar sponsoring. ' +
        'Boek hem als sponsoring: ander fiscaal regime, andere verantwoording.' };
    }
    const sanctieDoor = schoon(b.sanctielijstDoor, 60);
    if (b.sanctielijstGecontroleerd === true && !sanctieDoor) {
      return { status: 400, error: 'Wie heeft de sanctielijst gecontroleerd? Dit systeem doet die controle niet, ' +
        'dus er hoort een naam bij.' };
    }

    bron.herkomst = {
      status: uitkomst === 'geweigerd' ? 'geweigerd' : 'afgerond',
      reden: bron.herkomst.reden, at: bron.herkomst.at,
      uitkomst, herkomstGeld: bekend, tegenprestatie,
      voorwaarde: schoon(b.voorwaarde, 300) || null,
      sanctielijst: b.sanctielijstGecontroleerd === true ? { door: sanctieDoor, at: nu() } : null,
      beoordeeldDoor: w.key, beoordeeldOp: nu()
    };
    audit(w.key, 'herkomst.beoordeeld', bron.id, bron.gever + ': ' + uitkomst);
    save();
    return { ok: true, controle: beeld(bron),
      melding: uitkomst === 'geweigerd'
        ? 'Geweigerd. Het geld blijft geblokkeerd; teruggeven is een handeling van de penningmeester, geen knop hier.'
        : 'Afgerond. Deze bron kan nu worden besteed.' };
  }

  return { bepaal, nodig, lijst, beoordeel, beeld, DREMPEL_CENTEN, CONTANT_DREMPEL_CENTEN, UITKOMSTEN };
};
module.exports.DREMPEL_CENTEN = DREMPEL_CENTEN;
module.exports.CONTANT_DREMPEL_CENTEN = CONTANT_DREMPEL_CENTEN;
