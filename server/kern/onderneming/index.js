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

module.exports = ({ db, save, crypto, schoon, findSupplier, ordersVanZaak, boekingenVanZaak, aanmeldingen, ondernemerpoort, staffLijst, anthropic, magAi }) => {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/onderneming', bezit: { ondernemingen: 'lijst' } });

  /* De verkenningslaag: intake -> kansverkenning -> simulatie -> stress test ->
     ondernemingsplan. Vier modules die op elkaar leunen in precies die
     volgorde, en die hier één keer worden opgebouwd. */
  /* Alle deellagen worden in ./lagen.js opgebouwd -- dit bestand ging over de
     10 kB van het modulebeleid, en dat is de goede naad: daar de
     gereedschapskist, hier het object zelf. */
  const { intake, kans, sim, stress, plan, dag, opr, ek, mp, boek, rel, deb, cred, con, bel, kas, cap, wrv, pij, vrd, klu, tgn, ontw, regie } =
    require('./lagen')({ db, save, schoon, ordersVanZaak, boekingenVanZaak, ondernemerpoort, staffLijst, anthropic, magAi });

  const bak = () => {
    return eigen.bak('ondernemingen');
  };
  const nu = () => new Date().toISOString();
  const scho = (v, n) => schoon(v, n);

  const vind = (id) => bak().find(o => o.id === id) || null;
  const vanEigenaar = (key) => bak().filter(o => o.eigenaar === key);
  const vanZaak = (code) => bak().find(o => o.supplierCode === code) || null;

  /* Het leesdeel (feiten + beeld) staat in ./beeld.js: dit bestand ging over
     de 10 kB-grens, en dat is de natuurlijke naad -- hier de levensloop van het
     object, daar het lezen ervan. */
  const { ondernemingNaam, ondernemingFeiten, ondernemingCaps, ondernemingBeeld } =
    require('./beeld')({ db, findSupplier, ordersVanZaak, boekingenVanZaak, vanEigenaar });

  /* Het bestuur hangt aan de ONDERNEMING en niet aan de zaak: wie beslist en
     wie bezit is een juridisch feit, geen operationeel. Hij staat hier en niet
     in ./lagen.js omdat hij de samengevoegde capslijst van ./beeld.js leest, en
     die wordt hierboven pas gemaakt. */
  const bst = require('./bestuur')({ save, schoon, ondernemingCaps });

  /* De vier handelingen die het object zelf veranderen staan in
     ./levensloop.js -- dit bestand ging over de 10 kB van het modulebeleid, en
     de naad loopt langs de vraag wie er SCHRIJFT. */
  const { ondernemingNieuw, ondernemingRechtsvorm, ondernemingKoppel, ondernemingIngeschreven } =
    require('./levensloop')({ bak, vanZaak, findSupplier, crypto, scho, save, nu,
      ondernemingBeeld, ondernemingNaam, aanmeldingen });

  /* De overgang naar een echte zaak staat in ./aanvraag.js -- dit bestand ging
     over de 10 kB van het modulebeleid. Hij loopt langs de BESTAANDE
     aanmeldingsstroom, zodat er geen tweede deur ontstaat naast de deur waar
     een mens voor staat. */
  const { ondernemingAanvraag, ondernemingAanvraagStand } = require('./aanvraag')({
    save, scho, aanmeldingen, oprichtingsproject: opr.oprichtingsproject,
    ondernemingNaam, ondernemingKoppel, provisioningStand: regie.provisioningStand });

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

  const draaiend = require('./draaiend')(
    { rel, deb, cred, con, bel, kas, cap, pij, vrd, klu, tgn, ontw, bst, regie, wrv, boek, opr, mp },
    { save, ondernemingBeeld, ondernemingVerkenning });

  return Object.assign({
    /* Het levende register: Nederland en het buitenland samen. Bewust de
       tabel zelf en geen kopie -- de Rechtsvormwacht werkt hem in place bij,
       en een kopie zou de oude stand blijven tonen. */
    ONDERNEMING_RECHTSVORMEN: RV.RECHTSVORMEN,
    ondernemingRechtsvormenVanLand: RV.rechtsvormenVanLand,
    ondernemingRechtsvormLanden: RV.LANDEN_MET_VORMEN,
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
    /* `nu` is optioneel en in milliseconden. Hij bestaat omdat het dagbeeld
       vier lagen draagt die op de klok leunen (relaties, debiteuren,
       crediteuren, contracten): zonder een te zetten moment is dat scherm niet
       te toetsen, en een klok die je niet kunt zetten is een klok die je niet
       kunt toetsen. In productie geeft niemand hem mee en geldt gewoon nu. */
    ondernemingDagbeeld: (o, nu) => {
      const t = Number.isFinite(nu) ? nu : Date.now();
      const vandaag = new Date(t).toISOString().slice(0, 10);
      /* De drie geldbeelden worden EEN keer gemaakt en daarna doorgegeven aan
         de kasvooruitblik. Zou die ze zelf opnieuw opvragen, dan kunnen er
         twee antwoorden op dezelfde vraag ontstaan. */
      const d = deb.debiteuren(o, t), c = cred.crediteuren(o, t), b = bel.belasting(o, t);
      const cp = cap.capaciteit(o, t);
      return dag.dagbeeld(o, ondernemingBeeld(o), ondernemingVerkenning(o),
        opr.oprichtingsproject(o), ek.eersteKlant(o), mp.ondernemingMallProfiel(o),
        rel.relaties(o, t), d, c, con.contracten(o, vandaag), b, kas.kas(o, d, c, b, t), cp, wrv.werving(o, cp, t),
        pij.pijplijn(o, t), bst.bestuur(o), vrd.voorraad(o), klu.klussen(o, t), tgn.toegang(o, t));
    },
    ondernemingEersteKlant: ek.eersteKlant,
    ondernemingMallProfiel: mp.ondernemingMallProfiel,
    /* De ingangen van een bedrijf dat AL DRAAIT staan in ./draaiend.js -- dit
       bestand ging over de 10 kB van het modulebeleid, en de naad loopt langs
       de levensfase. */
    ondernemingAanvraag,
    ondernemingAanvraagStand
  }, draaiend);
};

module.exports.rechtsvorm = RV;
module.exports.fase = FASE;
