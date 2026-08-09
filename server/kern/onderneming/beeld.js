/* Onderneming-deelmodule "beeld": de feiten en het samengevoegde beeld.

   Los van ./index.js omdat dat bestand over de 10 kB-grens van het
   modulebeleid ging, en dit de natuurlijke naad is: index.js gaat over de
   LEVENSLOOP van het object (aanmaken, koppelen, rechtsvorm zetten), dit gaat
   over het LEZEN ervan (welke feiten gelden er, en wat volgt daaruit).

   Krijgt de gedeelde context één keer bij het opstarten mee, zoals de andere
   opgeknipte kernmodules. */
'use strict';

const RV = require('./rechtsvorm');
const FASE = require('./fase');

module.exports = ({ db, findSupplier, ordersVanZaak, boekingenVanZaak, vanEigenaar }) => {

  /* De zaak achter deze onderneming, of null zolang zij nog niet is opgericht. */
  const zaakVan = (o) => (o && o.supplierCode ? (findSupplier(o.supplierCode) || null) : null);

  /* De naam: de zaak wint altijd zodra hij bestaat. Zie de kop van index.js --
     zolang er geen zaak is staat de naam op de onderneming, en bij het
     koppelen verhuist die waarheid. */
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

  return { zaakVan, ondernemingNaam, ondernemingFeiten, ondernemingBeeld };
};
