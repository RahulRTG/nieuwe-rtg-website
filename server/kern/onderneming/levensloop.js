/* Onderneming-deelmodule "levensloop": het object aanmaken en bijwerken.

   Los van ./index.js omdat dat bestand over de 10 kB van het modulebeleid
   ging. De naad loopt langs de vraag wie er SCHRIJFT: hier de vier handelingen
   die het ondernemingsobject zelf veranderen (aanmaken, rechtsvorm kiezen, de
   zaak koppelen, de inschrijving vastleggen), daar het samenstellen en lezen.

   Krijgt de gedeelde context een keer bij het opstarten mee, zoals de andere
   opgeknipte kernmodules. */
'use strict';

const RV = require('./rechtsvorm');

module.exports = ({ bak, vanZaak, findSupplier, crypto, scho, save, nu, ondernemingBeeld, ondernemingNaam, aanmeldingen }) => {

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

  /* De zaak die RTG uit de eigen aanvraag van deze onderneming heeft gemaakt,
     of null. Gelezen uit de aanmeldingslaag en niet hier bijgehouden: die laag
     is de waarheid over wat er uit een aanvraag is voortgekomen. */
  function zaakVanAanvraag(o) {
    if (!o.aanmeldingId || !aanmeldingen || !aanmeldingen.een) return null;
    const r = aanmeldingen.een(o.aanmeldingId);
    const a = r && r.ok ? r.aanmelding : null;
    return (a && a.gezaakt && a.gezaakt.code) || null;
  }

  /* ---- de naad dicht: de onderneming wijst de bestaande zaak aan ----
     Idempotent voor dezelfde zaak. Een zaak hoort bij precies één onderneming;
     twee ondernemingen op dezelfde zaak zou de tweede waarheid terugzetten die
     deze module juist opruimt.

     KOPPELEN VRAAGT BEWIJS DAT DE ZAAK VAN U IS. Dat stond hier eerst NIET, en
     dat was een gat waar het hele OS doorheen lekte: er werd alleen gekeken of
     de zaak bestaat en nog vrij is. Elk ingelogd lid kan codes opvragen
     (POST /api/suppliers geeft ze), dus wie een vrije code vond, koppelde hem
     aan zijn eigen onderneming en las daarna via precies dezelfde
     eigendomscontrole het klantenboek, de debiteuren, de kas, de belasting en
     het dagbeeld van die zaak -- en schreef via /relaties/notitie zelfs in het
     klantenboek van een ander.

     Er zijn precies TWEE bewijzen, en allebei bestonden ze al:

       1. DE EIGEN AANVRAAG. RTG heeft deze zaak gemaakt uit de aanmelding die
          bij deze onderneming hoort (a.gezaakt.code). Dat is de normale weg.
       2. EEN BEHEERPLEK OP DIE ZAAK. De aanvrager staat als actieve manager in
          het personeelsregister van die zaak. Dat is de weg voor een zaak die
          al bestond voordat de onderneming werd aangemaakt.

     Geen bewijs betekent 403 en niet 404: hier verklapt een eerlijke weigering
     niets: dat de zaak bestaat, wist de aanvrager al -- hij typte de code. */
  function ondernemingKoppel(o, code, bewijs) {
    const s = findSupplier(code);
    if (!s) return { status: 404, error: 'Deze zaak bestaat niet.' };
    if (o.supplierCode === s.code) return { ok: true, onderneming: ondernemingBeeld(o) };
    if (o.supplierCode) return { status: 409, error: 'Deze onderneming is al aan een zaak gekoppeld.' };
    const bezet = vanZaak(s.code);
    if (bezet) return { status: 409, error: 'Deze zaak hoort al bij een andere onderneming.' };

    const uitAanvraag = zaakVanAanvraag(o) === s.code;
    const alsBeheerder = typeof bewijs === 'function' ? bewijs(s.code) === true : false;
    if (!uitAanvraag && !alsBeheerder) {
      return { status: 403,
        error: 'Deze zaak is niet van u.',
        uitleg: 'Koppelen kan met een zaak die RTG uit uw eigen aanvraag heeft gemaakt, of met een zaak waar u als beheerder in het personeelsregister staat. Anders zou iedereen die een code kent de boekhouding van een ander kunnen openen.' };
    }
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
