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

module.exports = ({ db, save, crypto, schoon, findSupplier, ordersVanZaak, boekingenVanZaak }) => {

  const bak = () => {
    if (!Array.isArray(db.data.ondernemingen)) db.data.ondernemingen = [];
    return db.data.ondernemingen;
  };
  const nu = () => new Date().toISOString();
  const scho = (v, n) => schoon(v, n);

  const vind = (id) => bak().find(o => o.id === id) || null;
  const vanEigenaar = (key) => bak().filter(o => o.eigenaar === key);
  const vanZaak = (code) => bak().find(o => o.supplierCode === code) || null;

  /* De zaak achter deze onderneming, of null zolang zij nog niet is opgericht. */
  const zaakVan = (o) => (o && o.supplierCode ? (findSupplier(o.supplierCode) || null) : null);

  /* De naam: de zaak wint altijd zodra hij bestaat. Zie de kop. */
  function ondernemingNaam(o) {
    const s = zaakVan(o);
    return (s && s.name) || (o && o.naam) || null;
  }

  /* ---- de feiten waar de fase op rust ----
     Precies de sleutels uit FASE.FEITEN. Een ontbrekende collectie telt hier
     als nul en niet als "onbekend", en dat is geen stilte maar de waarheid:
     een verse database heeft geen boekingen omdat er geen boekingen zijn.
     Het geval dat WEL moet zakken -- een onderneming die niet bestaat -- geeft
     null, en dat is de enige weg waarlangs de fase onbekend kan zijn. */
  function ondernemingFeiten(o) {
    if (!o) return null;
    const s = zaakVan(o);
    let klanten = 0, personeel = 0, vestigingen = 0;
    if (s) {
      /* Klanten tellen op codenaam, want dat is de identiteit waarop de rest
         van het huis ook rekent (kern/vakwerk/pro2.js). Boekingen en bonnen
         van dezelfde klant zijn één klant. */
      const kn = new Set();
      for (const b of (boekingenVanZaak(s.code) || [])) {
        if (b && b.customerCodename && b.status !== 'wacht-op-betaling') kn.add(b.customerCodename);
      }
      for (const b of (ordersVanZaak(s.code) || [])) {
        if (b && b.customerCodename) kn.add(b.customerCodename);
      }
      klanten = kn.size;
      // de eigenaar is geen personeel; werkvormen.js trekt dezelfde grens
      personeel = Math.max(0, (s.staff || []).length - 1);
      vestigingen = (s.vestigingen || []).length;
    }
    return {
      plan: !!(o.plan && o.plan.vastgelegd),
      ingeschreven: !!o.kvk,
      klanten,
      personeel,
      vestigingen,
      // een groep is twee of meer ondernemingen van dezelfde eigenaar
      entiteiten: o.eigenaar ? vanEigenaar(o.eigenaar).length : 1
    };
  }

  /* ---- het beeld: de drie assen samengevoegd ---- */
  function ondernemingBeeld(o) {
    if (!o) return null;
    const s = zaakVan(o);
    const feiten = ondernemingFeiten(o);
    const fb = FASE.faseBeeld(feiten);
    const rv = RV.rechtsvormVan(o.rechtsvorm);
    /* De werkvormen komen van de zaak; zolang die er niet is, doet die as
       niet mee -- niet met een lege lijst omdat we hem "toch nodig hebben",
       maar omdat een onderneming zonder zaak nog niets DOET. */
    const werkcaps = s ? db.capsVan(s) : [];
    const samen = RV.capsSamen(
      [werkcaps, RV.capsVanRechtsvorm(o.rechtsvorm), fb.ontgrendeld],
      RV.verbodenVanRechtsvorm(o.rechtsvorm)
    );
    return {
      id: o.id,
      naam: ondernemingNaam(o),
      eigenaar: o.eigenaar,
      zaak: s ? { code: s.code, type: s.type } : null,
      kvk: o.kvk || null,
      rechtsvorm: rv ? {
        id: rv.id, label: rv.label, kort: rv.kort, rechtspersoon: rv.rechtspersoon,
        notarieel: rv.notarieel, aansprakelijk: rv.aansprakelijk, oprichting: rv.oprichting
      } : null,
      fase: fb.fase,
      ladder: fb.ladder,
      volgende: fb.volgende,
      feiten,
      caps: samen.caps,
      /* Wat de rechtsvorm heeft weggehouden, mét reden. Een knop die zonder
         uitleg ontbreekt leest als een storing; dit is het verschil tussen
         "kan niet" en "mag niet". */
      geweerd: samen.geweerd.map(c => ({ cap: c, reden: rv
        ? 'Een ' + rv.label.toLowerCase() + ' mag dit niet.'
        : 'Niet toegestaan bij deze rechtsvorm.' })),
      werkvormen: s ? db.vormenVan(s).map(v => ({ id: v.id, label: v.label })) : []
    };
  }

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
    ondernemingIngeschreven
  };
};

module.exports.rechtsvorm = RV;
module.exports.fase = FASE;
