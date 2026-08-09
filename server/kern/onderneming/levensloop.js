/* Onderneming-deelmodule "levensloop": het object aanmaken en bijwerken.

   Los van ./index.js omdat dat bestand over de 10 kB van het modulebeleid
   ging. De naad loopt langs de vraag wie er SCHRIJFT: hier de vier handelingen
   die het ondernemingsobject zelf veranderen (aanmaken, rechtsvorm kiezen, de
   zaak koppelen, de inschrijving vastleggen), daar het samenstellen en lezen.

   Krijgt de gedeelde context een keer bij het opstarten mee, zoals de andere
   opgeknipte kernmodules. */
'use strict';

const RV = require('./rechtsvorm');

module.exports = ({ bak, vanZaak, findSupplier, crypto, scho, save, nu, ondernemingBeeld, ondernemingNaam }) => {

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

  return { ondernemingNieuw, ondernemingRechtsvorm, ondernemingKoppel, ondernemingIngeschreven };
};
