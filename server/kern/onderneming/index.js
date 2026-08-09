/* DE ONDERNEMING: één object, van "ik denk erover na" tot een groep met
   vestigingen in meerdere landen.

   WAAROM DIT ER MOEST KOMEN. Een bedrijf bestond hier in twee gedaanten. Vóór
   de oprichting was het een `aanmelding` (kern/aanmeldingen/bedrijf.js), daarna
   een `supplier` -- en `provisioneer()` maakte die tweede op het moment dat het
   personeel de eerste termijn aftekende. Twee objecten voor één bedrijf is
   lat-regel 4, en de naad zat op de slechtst denkbare plek: alles wat vóór de
   oprichting gebeurt (het idee, de verkenning, het plan, de rechtsvormkeuze)
   had geen enkel object om aan te hangen, en alles daarna had geen geheugen van
   wat er vooraf was bedacht.

   Deze module zet daar één ding neer dat vanaf het begin bestaat en dat later
   de bestaande zaak AANWIJST in plaats van hem over te schrijven. De supplier
   blijft dus wat hij is -- de operationele zaak, met zijn menu, zijn vloot en
   zijn personeel -- en de onderneming is wie hij juridisch en in zijn leven is.

   DE NAAM WOONT MAAR OP ÉÉN PLEK, EN DIE PLEK VERHUIST. Zolang er geen zaak is,
   staat de naam op de onderneming (er is nergens anders). Zodra er gekoppeld
   wordt, is de zaak de waarheid en wordt de lokale naam WEGGEGOOID -- niet
   gekopieerd en niet stil laten staan, want een tweede naam die niemand meer
   bijwerkt is precies waar regel 4 over gaat. ondernemingNaam() leest daarom
   altijd eerst de zaak.

   DRIE ASSEN, ÉÉN CAPSLIJST. ./rechtsvorm.js (wat is zij), ./fase.js (waar staat
   zij) en kern/werkvormen.js (wat doet zij) worden in beeld() samengevoegd tot
   één lijst van wat deze onderneming NU mag zien, met de verboden van de
   rechtsvorm er na afgetrokken. Dat is de hele "RTG groeit mee": niemand zet
   iets aan, en er zijn geen pakketten. */
'use strict';

const RV = require('./rechtsvorm');
const FASE = require('./fase');

module.exports = ({ db, save, crypto, schoon, findSupplier, ordersVanZaak, boekingenVanZaak, aanmeldingen, ondernemerpoort }) => {

  /* De verkenningslaag: intake -> kansverkenning -> simulatie -> stress test ->
     ondernemingsplan. Vier modules die op elkaar leunen in precies die
     volgorde, en die hier één keer worden opgebouwd. */
  const intake = require('./intake')({ schoon });
  const kans = require('./kans')({ db, ordersVanZaak, boekingenVanZaak });
  const sim = require('./simulatie')({ intakeOntbreekt: intake.intakeOntbreekt });
  const stress = require('./stress')();
  const plan = require('./plan')({ intakeOntbreekt: intake.intakeOntbreekt, save });
  const dag = require('./dagbeeld')({ db, boekingenVanZaak, ordersVanZaak,
    intakeOntbreekt: intake.intakeOntbreekt });
  const opr = require('./oprichting')({ save });
  const ek = require('./eersteklant')({ db, ondernemerpoort, boekingenVanZaak, ordersVanZaak });
  const mp = require('./mallprofiel')({ db });
  /* Het gedeelde klantenboek, hetzelfde dat Vakwerk gebruikt. Twee boeken
     naast elkaar lopen uiteen (lat-regel 4). */
  /* `schoon` en niet `scho`: die laatste wordt verderop in dit bestand pas
     verklaard, en een const lezen voor zijn declaratie gooit. Zelfde functie. */
  const boek = require('../klantenboek')({ db, save, scho: schoon, boekingenVanZaak, ordersVanZaak });
  const rel = require('./relaties')({ db, klantenboek: boek.klantenboek, boekingenVanZaak });
  const deb = require('./debiteuren')({ db });
  const cred = require('./crediteuren')({ db });

  const bak = () => {
    if (!Array.isArray(db.data.ondernemingen)) db.data.ondernemingen = [];
    return db.data.ondernemingen;
  };
  const nu = () => new Date().toISOString();
  const scho = (v, n) => schoon(v, n);

  const vind = (id) => bak().find(o => o.id === id) || null;
  const vanEigenaar = (key) => bak().filter(o => o.eigenaar === key);
  const vanZaak = (code) => bak().find(o => o.supplierCode === code) || null;

  /* Het leesdeel (feiten + beeld) staat in ./beeld.js: dit bestand ging over
     de 10 kB-grens, en dat is de natuurlijke naad -- hier de levensloop van het
     object, daar het lezen ervan. */
  const { ondernemingNaam, ondernemingFeiten, ondernemingBeeld } =
    require('./beeld')({ db, findSupplier, ordersVanZaak, boekingenVanZaak, vanEigenaar });

  /* ---- aanmaken: de onderneming bestaat vanaf "misschien" ----
     Rechtsvorm mag leeg blijven. "Ik weet nog niet wat ik word" is een echte
     stand in de ideefase en krijgt hier geen standaardwaarde aangemeten. */
  function ondernemingNieuw(eigenaar, body) {
    if (!eigenaar) return { status: 401, error: 'Log in om een onderneming te beginnen.' };
    const naam = scho((body || {}).naam, 80);
    if (!naam) return { status: 400, error: 'Hoe zou de onderneming heten? Een werktitel is genoeg.' };
    const rvIn = (body || {}).rechtsvorm;
    if (rvIn && !RV.isRechtsvorm(rvIn)) return { status: 400, error: 'Deze rechtsvorm kennen we niet.' };
    const o = {
      id: 'ond_' + crypto.randomBytes(6).toString('hex'),
      eigenaar, naam,
      rechtsvorm: rvIn || null,
      supplierCode: null, kvk: null, plan: null,
      gestart: nu()
    };
    bak().push(o);
    save();
    return { ok: true, onderneming: ondernemingBeeld(o) };
  }

  /* De rechtsvorm zetten of wijzigen. Wijzigen mag: een eenmanszaak die een
     B.V. wordt is een normale stap, geen fout. Wat er niet mag is een vorm
     verzinnen. */
  function ondernemingRechtsvorm(o, id) {
    if (!RV.isRechtsvorm(id)) return { status: 400, error: 'Deze rechtsvorm kennen we niet.' };
    o.rechtsvorm = id;
    save();
    return { ok: true, onderneming: ondernemingBeeld(o) };
  }

  /* ---- de naad dicht: de onderneming wijst de bestaande zaak aan ----
     Idempotent voor dezelfde zaak. Een zaak hoort bij precies één onderneming;
     twee ondernemingen op dezelfde zaak zou de tweede waarheid terugzetten die
     deze module juist opruimt. */
  function ondernemingKoppel(o, code) {
    const s = findSupplier(code);
    if (!s) return { status: 404, error: 'Deze zaak bestaat niet.' };
    if (o.supplierCode === s.code) return { ok: true, onderneming: ondernemingBeeld(o) };
    if (o.supplierCode) return { status: 409, error: 'Deze onderneming is al aan een zaak gekoppeld.' };
    const bezet = vanZaak(s.code);
    if (bezet) return { status: 409, error: 'Deze zaak hoort al bij een andere onderneming.' };
    o.supplierCode = s.code;
    /* De lokale naam gaat WEG en wordt niet gekopieerd: vanaf nu is de zaak
       de waarheid over hoe dit bedrijf heet. Zie de kop. */
    delete o.naam;
    o.gekoppeld = nu();
    save();
    return { ok: true, onderneming: ondernemingBeeld(o) };
  }

  /* De KvK-inschrijving vastleggen. Alleen het feit -- het inschrijven zelf
     loopt via kern/overheid/onderneming.js, en die blijft de plek waar dat
     gebeurt. */
  function ondernemingIngeschreven(o, kvk) {
    const n = scho(kvk, 20);
    if (!n) return { status: 400, error: 'Welk KvK-nummer hoort bij deze onderneming?' };
    o.kvk = n;
    save();
    return { ok: true, onderneming: ondernemingBeeld(o) };
  }

  /* De overgang naar een echte zaak staat in ./aanvraag.js -- dit bestand ging
     over de 10 kB van het modulebeleid. Hij loopt langs de BESTAANDE
     aanmeldingsstroom, zodat er geen tweede deur ontstaat naast de deur waar
     een mens voor staat. */
  const { ondernemingAanvraag, ondernemingAanvraagStand } = require('./aanvraag')({
    save, scho, aanmeldingen, oprichtingsproject: opr.oprichtingsproject,
    ondernemingNaam, ondernemingKoppel });

  /* ---- de verkenning in één keer ----
     De vier stappen leunen op elkaar (de stress test kan niets zonder de
     simulatie, het plan niets zonder allebei), en dat is precies waarom ze hier
     samen staan en niet los in de route. Een scherm dat ze zelf in de goede
     volgorde moet aanroepen, roept ze vroeg of laat in de verkeerde aan.

     Elke stap mag mislukken zonder de rest mee te nemen: een simulatie die niet
     kan rekenen levert een plan met een gat op die plek, en niet een leeg plan
     of een verzonnen getal. */
  function ondernemingVerkenning(o, over) {
    const i = o.intake || { persoon: {}, idee: {} };
    const branche = i.idee && i.idee.branche;
    const k = branche ? kans.kansVerkenning(branche, i.idee.plaats) : null;
    const s = sim.simuleer(o, over);
    const st = stress.stresstest(o, s, k && k.ok ? k : null);
    const p = plan.planBouw(o, k && k.ok ? k : null, s, st && st.ok ? st : null);
    return {
      ok: true,
      kans: k, simulatie: s, stress: st, plan: p,
      onderneming: ondernemingBeeld(o)
    };
  }

  return {
    ONDERNEMING_RECHTSVORMEN: RV.RECHTSVORMEN,
    ondernemingVind: vind,
    ondernemingVanEigenaar: vanEigenaar,
    ondernemingVanZaak: vanZaak,
    ondernemingNaam,
    ondernemingFeiten,
    ondernemingBeeld,
    ondernemingNieuw,
    ondernemingRechtsvorm,
    ondernemingKoppel,
    ondernemingIngeschreven,
    ondernemingVerkenning,
    ondernemingIntakeZet: intake.intakeZet,
    ondernemingIntakeBeeld: intake.intakeBeeld,
    ondernemingKans: kans.kansVerkenning,
    ondernemingSimuleer: (o, over) => sim.simuleer(o, over),
    ondernemingStress: (o, s, k) => stress.stresstest(o, s, k),
    ondernemingPlan: plan.planBouw,
    ondernemingPlanVastleggen: plan.planVastleggen,
    /* Het dagbeeld krijgt de verkenning MEE en draait hem niet zelf: de route
       heeft hem toch al, en twee keer rekenen kan twee antwoorden geven op
       dezelfde vraag. */
    ondernemingDagbeeld: (o) => dag.dagbeeld(o, ondernemingBeeld(o), ondernemingVerkenning(o),
      opr.oprichtingsproject(o), ek.eersteKlant(o), mp.ondernemingMallProfiel(o), rel.relaties(o), deb.debiteuren(o), cred.crediteuren(o)),
    ondernemingEersteKlant: ek.eersteKlant,
    ondernemingMallProfiel: mp.ondernemingMallProfiel,
    ondernemingRelaties: rel.relaties,
    ondernemingDebiteuren: deb.debiteuren,
    ondernemingCrediteuren: cred.crediteuren,
    ondernemingKlantNotitie: boek.klantNotitie,
    ondernemingOprichting: opr.oprichtingsproject,
    ondernemingOprichtingZet: opr.oprichtingZet,
    ondernemingAanvraag,
    ondernemingAanvraagStand
  };
};

module.exports.rechtsvorm = RV;
module.exports.fase = FASE;
