/* DE FISCALE JAARGANGEN: welke regels golden er OP DIE DAG.

   Dit bestand bestaat omdat de Regelwacht zijn eigen geheugen wegschreef. Hij
   bewaarde zijn overlay met `Object.assign(eerder, wijz)` -- per veld alleen de
   LAATSTE waarde. Wat het Nederlandse eten-tarief op 15 maart 2026 was, stond
   daarna nergens meer: niet moeilijk te achterhalen, weg. Daarmee was een hele
   klasse vragen onbeantwoordbaar, en het zijn precies de vragen die een
   administratie jaren later krijgt -- herbouw dit bedrag uit de regels die toen
   golden, wat veranderde er sinds vorig kwartaal, laat de onderneming zien
   zoals hij op 31 december 2027 stond.

   DE OPLOSSING IS GELEEND EN NIET VERZONNEN: payroll doet dit al met jaargangen
   (kern/payroll/regelpakket.js) -- een tarief is daar nooit een constante maar
   een VERSIE met een geldigheidsperiode en een herkomst. Twee regelmotoren in
   een huis is wat LAT.md regel 4 verbiedt, dus de fiscale kant krijgt hetzelfde
   model. Het verschil: payroll krijgt hele pakketten binnen, de Regelwacht
   losse velden, en de basis staat hier in code. Dus:

     de basis (peiljaar) + de wijzigingen tot een datum
     = de tabel zoals hij op die datum was

   EEN STORE PER TABEL: de landentabel en de zzp-tabel hebben elk een eigen bak,
   een eigen basis en eigen GENESTE velden. Wat ze delen is het mechaniek, en dat
   hoort een keer te bestaan -- zie ./regelwacht.js en ./zzpwacht.js.

   Het opbouwen zelf staat in ./jaargangen-tijdlijn.js (puur); hier staat hoe je
   een wijziging bewaart, terugvindt en op de gedeelde tabel zet.

   DE BASIS WORDT BIJ HET OPBOUWEN VASTGELEGD, en dat is het scharnier van dit
   bestand. De projectie schrijft namelijk IN de gedeelde LANDEN-tabel (dat moet,
   anders zou elke lezer in huis moeten veranderen), dus na een projectie is
   LANDEN de huidige stand en niet meer het peiljaar. Wie dan nog wil
   terugrekenen heeft geen beginpunt. Daarom staat hier een diepe kopie van de
   tabel zoals hij uit ./landen.js kwam, gemaakt voordat er iets overheen ging.

   WAT DIT NIET DOET: iets blokkeren. Een wijziging draagt een `stand`
   (ongecontroleerd / goedgekeurd), maar wordt ook ongecontroleerd geprojecteerd
   -- zoals de Regelwacht het altijd deed. Aan die projectie een goedkeuring
   hangen bevriest bij de eerste de beste bronstoring de tarieven van het hele
   huis; dat is een eigen besluit met een eigen zichtbare schakelaar. De stand
   wordt hier alleen VASTGELEGD, zodat dat besluit later te nemen is. */
'use strict';

const { datum: klokDatum } = require('../../lib/klok');
const { isDatum, diep, opVolgorde, maakTijdlijn } = require('./jaargangen-tijdlijn');
const { uitTabel } = require('./tarief');

function maakJaargangen({ db, save, LANDEN, tabel, peiljaar, nu, bak: bakNaam, genest }) {
  const tijd = nu || (() => klokDatum().toISOString());
  const vandaag = () => tijd().slice(0, 10);
  // `LANDEN` is de oorspronkelijke naam en blijft werken; `tabel` zegt wat het is
  const TABEL = tabel || LANDEN;
  const SLEUTEL = bakNaam || 'fiscaalJaargangen';
  const { voegSamen, lichtUit, bouwOp } = maakTijdlijn(genest);

  /* DE BASIS. Een diepe kopie van de tabel zoals ./landen.js hem oplevert,
     gemaakt VOOR de eerste projectie. Vanaf hier is LANDEN een levend beeld en
     dit de vaste grond eronder. */
  const BASIS = diep(TABEL);

  function bak() {
    if (!db.data[SLEUTEL] || typeof db.data[SLEUTEL] !== 'object') db.data[SLEUTEL] = {};
    return db.data[SLEUTEL];
  }
  const lijstVan = (land) => {
    const b = bak();
    const l = String(land || '').toUpperCase();
    if (!Array.isArray(b[l])) b[l] = [];
    return b[l];
  };

  /* ---------- terugrekenen ---------- */
  /* DE REGELS VAN EEN LAND OP EEN DATUM. Zonder datum: vandaag. */
  function regelsOp(land, datum) {
    const l = String(land || '').toUpperCase();
    if (!BASIS[l]) return null;
    return bouwOp(BASIS[l], lijstVan(l), isDatum(datum) ? String(datum).slice(0, 10) : vandaag());
  }

  /* EEN TARIEF OP EEN DATUM -- de vraag die het vaakst gesteld wordt. De keuze
     zelf (categorie, anders standaard) komt uit ./tarief.js, DEZELFDE routine
     waarmee de lopende tabel wordt gelezen: een herbouwd bedrag dat net anders
     terugvalt dan het oorspronkelijke bedrag, is geen herbouw. */
  function tariefOp(land, cat, datum) {
    const r = regelsOp(land, datum);
    return r ? uitTabel(r.tarieven, cat) : null;
  }

  /* ---------- projecteren ---------- */
  /* De huidige stand op de GEDEELDE tabel zetten. Dit is wat de Regelwacht
     voorheen `herstelOverlay` noemde, met een verschil dat ertoe doet: een
     wijziging die pas volgende maand ingaat, ligt klaar en doet nog niets --
     dezelfde eigenschap als een payroll-jaargang 2027 die in november binnenkomt.
     Dat was voorheen onmogelijk: de overlay kende geen ingangsdatum, dus alles
     wat binnenkwam gold meteen. */
  function projecteer(datum) {
    const d = isDatum(datum) ? String(datum).slice(0, 10) : vandaag();
    let landen = 0, wachtend = 0;
    for (const l of Object.keys(bak())) {
      if (!TABEL[l] || !BASIS[l]) continue;
      const lijst = opVolgorde(lijstVan(l));
      const actief = lijst.filter(j => j.geldigVanaf <= d);
      wachtend += lijst.length - actief.length;
      /* Terug naar de basis en opnieuw opbouwen, en niet "het verschil erbij".
         Een wijziging die is ingetrokken of een ingangsdatum die is verzet, moet
         ook echt kunnen VERDWIJNEN uit het beeld; stapelen op wat er staat laat
         een teruggedraaide wijziging voor altijd staan.

         Daarom wordt een land met NUL actieve wijzigingen hier niet
         overgeslagen. Dat deed dit blok wel, en dan bleef juist het geval waar
         het om gaat -- de laatste wijziging valt weg -- op de oude stand staan.
         Gevonden door test/fiscaal-jaargangen.test.js, die precies dat doet. */
      voegSamen(TABEL[l], diep(BASIS[l]));
      for (const j of actief) voegSamen(TABEL[l], j.wijzigingen);
      if (actief.length) landen++;
    }
    return { landen, wachtend, op: d };
  }

  /* ---------- opnemen ---------- */
  /* Een gevalideerde wijzigingenset vastleggen. De VALIDATIE staat niet hier
     maar in ./regelwacht.js: dat bestand weet wat een bron mag leveren en welke
     waardes zinnig zijn, dit bestand weet hoe je een wijziging bewaart.

     `vorige` is wat er gold op de ingangsdatum TOEN DEZE WIJZIGING WERD
     OPGENOMEN. Wordt er later een wijziging vóór deze gezet, dan klopt die
     notitie niet meer -- bewust niet herberekend: het antwoord op "wat gold er"
     komt altijd uit regelsOp(). `vorige` is de leesbare notitie, niet de bron;
     wie dat omdraait, houdt dezelfde waarheid op twee plekken vast. */
  function neemOp({ land, wijzigingen, geldigVanaf, bron, versie, rechtsgrond, bekendgemaaktOp, door }) {
    const l = String(land || '').toUpperCase();
    if (!BASIS[l]) return { status: 404, error: 'Dit land kennen we niet: ' + l };
    if (!wijzigingen || !Object.keys(wijzigingen).length) return { status: 400, error: 'Er is niets gewijzigd.' };
    const vanaf = isDatum(geldigVanaf) ? String(geldigVanaf).slice(0, 10) : vandaag();
    const kantoor = (bron && bron.soort) === 'kantoor';

    const j = {
      id: 'fj_' + l + '_' + String(lijstVan(l).length + 1).padStart(4, '0') + '_' + vanaf,
      land: l,
      versie: versie ? String(versie).slice(0, 60) : null,
      geldigVanaf: vanaf,
      bekendgemaaktOp: isDatum(bekendgemaaktOp) ? String(bekendgemaaktOp).slice(0, 10) : null,
      wijzigingen: diep(wijzigingen),
      vorige: lichtUit(regelsOp(l, vanaf), wijzigingen),
      rechtsgrond: rechtsgrond ? String(rechtsgrond).replace(/[<>]/g, '').slice(0, 300) : null,
      /* `gezag` reist mee: een tarief uit de instantie zelf en een tarief uit
         een spiegel zijn niet even hard (kern/fiscaal/bronnen/). */
      bron: { soort: (bron && bron.soort) || 'handmatig', naam: (bron && bron.naam) || null,
        url: (bron && bron.url) || null, gezag: (bron && bron.gezag) || null, opgehaaldOp: tijd() },
      /* Wie het KANTOOR doorvoert, heeft een mens gezien; wat een automatische
         bron levert niet. Beide gaan de projectie in (zie de kop), maar ze zijn
         daarna uit elkaar te houden. */
      stand: kantoor ? 'goedgekeurd' : 'ongecontroleerd',
      goedgekeurdDoor: kantoor ? (door || 'kantoor') : null,
      goedgekeurdOp: kantoor ? tijd() : null,
      opgenomenOp: tijd()
    };
    lijstVan(l).push(j);
    save();
    return { ok: true, jaargang: j };
  }

  /* Aanmerken door een mens. */
  function merkAan(land, id, door) {
    const j = lijstVan(land).find(x => x.id === id);
    if (!j) return { status: 404, error: 'Deze wijziging kennen we niet.' };
    if (j.stand === 'goedgekeurd') return { ok: true, ongewijzigd: true, id };
    if (!door) return { status: 400, error: 'Noteer wie deze wijziging goedkeurt.' };
    j.stand = 'goedgekeurd'; j.goedgekeurdDoor = door; j.goedgekeurdOp = tijd();
    save();
    return { ok: true, id, stand: j.stand };
  }

  /* ---------- teruglezen ---------- */
  /* WAT VERANDERDE ER. Nieuwste eerst, en desgewenst op een enkel veld
     ('uurloonMin') of een genest veld ('tarieven.eten'). */
  function geschiedenis(land, veld) {
    const pad = String(veld || '').split('.');
    return opVolgorde(lijstVan(land)).reverse().filter(j => {
      if (!veld) return true;
      const w = j.wijzigingen[pad[0]];
      if (w === undefined) return false;
      return pad.length < 2 || (w && typeof w === 'object' && pad[1] in w);
    });
  }

  const stand = () => {
    const alle = Object.values(bak()).flat();
    const d = vandaag();
    return { peiljaar, landen: Object.keys(bak()).length, wijzigingen: alle.length,
      ongecontroleerd: alle.filter(j => j.stand !== 'goedgekeurd').length,
      wachtend: alle.filter(j => j.geldigVanaf > d).map(j => ({ id: j.id, land: j.land, geldigVanaf: j.geldigVanaf })) };
  };

  return { jaargangen: { neemOp, merkAan, regelsOp, tariefOp, projecteer, geschiedenis, stand,
    basisVan: (l) => (BASIS[String(l || '').toUpperCase()] ? diep(BASIS[String(l).toUpperCase()]) : null) } };
}

module.exports = { maakJaargangen };
