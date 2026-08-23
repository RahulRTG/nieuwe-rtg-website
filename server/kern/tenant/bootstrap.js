/* ============================================================================
   DE TENANT BOOTSTRAP -- één antwoord waarmee een scherm weet wie het bedient.

   Het Werk OS haalde zijn beeld uit losse endpoints: de rollenkaart hier, het
   startscherm daar, en het merk nergens. Elke module leidde daaruit zijn eigen
   antwoord af op dezelfde vier vragen -- van welke klant is dit, hoe heet die,
   wat mag deze persoon, en wat zit er in het pakket. Vier interpretaties van
   dezelfde waarheid is precies hoe een merk half doorwerkt en een recht ergens
   net iets anders uitpakt.

   WAT HIER NIET IN STAAT, EN WAAROM DAT MET NAME WORDT OPGESOMD

   Een bootstrap met de velden `entitlements`, `quotas` en `trust` erin, gevuld
   met een plausibele waarde, is de duurste vorm van de belofte-zonder-code uit
   LAT-regel 6: elk scherm dat hem leest, gaat zich ernaar gedragen. Er bestaat
   in dit huis geen abonnement per werkruimte, geen quotum per tenant en geen
   bewijsstand per tenantvariant. Die velden staan daarom NIET met een nul of
   een lege lijst in het antwoord, maar in `nietGebouwd`, met de reden. Een
   ontbrekend veld leest als "nog niet opgehaald"; een genoemd veld met een
   reden leest als een besluit.

   WAAROM DIT ANTWOORD NIET IS ONDERTEKEND, TERWIJL HET MERK ERIN DAT WEL IS

   Een handtekening is er om een ONTVANGER iets te laten controleren dat hij niet
   zelf kan afleiden. Dit antwoord wordt per verzoek uit de sessie opgebouwd en
   door niemand anders dan het eigen scherm gelezen; wij zouden onze eigen
   handtekening controleren, en dat bewijst niets. Het MERK ligt wel in de
   opslag en wordt daar door meerdere processen aangeraakt -- daar bewaakt de
   handtekening iets echts (zie merkkern.js). Zodra een tweede proces deze
   bootstrap doorkrijgt in plaats van hem zelf op te bouwen, hoort hij
   ondertekend te worden; dat staat als open punt in TAKEN.md. */
'use strict';

const { RECHTEN, ROLLEN } = require('../../bedrijf/rollen-register');
const pkg = require('../../../package.json');

const NIET_GEBOUWD = [
  { veld: 'entitlements', reden: 'Er bestaat geen abonnement per werkruimte. Toegang volgt nu uit rollen, niet uit een contract.' },
  { veld: 'quotas', reden: 'De rem telt per IP en niet per tenant; er is geen verbruik per klant om tegen af te zetten.' },
  { veld: 'policies', reden: 'Datalocatie, sleutelmodel en bewaartermijn zijn platformbreed geregeld, niet per tenant instelbaar.' },
  { veld: 'trust', reden: 'De bewijslaag meet het platform, niet een tenantvariant. Er is dus geen bewijsstand voor deze klant.' },
  { veld: 'lifecycle', reden: 'Proef, opzegging, bewaring en vernietiging bestaan als begrip in de plannen en niet als toestand in de code.' }
];

module.exports = ({ db, register, brug, merkVan, bedrijf }) => {
  function ruimte(code) {
    const w = db.data.werkruimtes || {};
    return Object.prototype.hasOwnProperty.call(w, String(code)) ? w[String(code)] : null;
  }

  /* Welke rollen tellen vandaag, en welke rechten volgen daaruit: die vraag
     wordt door bedrijf/rollen.js beantwoord en hier NIET overgedaan. Een tweede
     lezing van een rollenvenster is een tweede antwoord op een toegangsvraag. */
  function rechten(l) {
    const b = bedrijf && bedrijf();
    if (!b || !b.rollenVan) return null;
    return { rollen: b.rollenVan(l), rechten: b.rechtenVan(l) };
  }

  function bouw(code, lid, via) {
    const w = ruimte(code);
    if (!w) return null;
    const t = register.vanWerkruimte(code);
    const r = rechten(lid);

    return {
      versie: 1,
      release: pkg.version || null,
      tenant: t ? { org: t.org, naam: t.naam, modus: t.modus, actief: t.actief !== false }
        : { org: null, naam: null, modus: 'powered', actief: true,
            let: 'Deze werkruimte hoort bij geen enkele tenant. Zij draait onder de RTG-huisstijl en zonder contractgrens.' },
      werkruimte: { code: w.code, naam: w.naam, land: w.land, valuta: w.valuta, taal: w.taal, moeder: w.moeder || null },
      merk: t ? merkVan(t.org) : null,
      identiteit: {
        via,                                            // 'lid-token' of 'rtg-sessie'
        lidId: lid.id, naam: lid.naam, functie: lid.functie || null,
        extern: !!lid.extern, status: lid.status,
        beheerdDoorProvider: lid.bron === 'idp',
        rtgGekoppeld: !!lid.rtgKey
      },
      rollen: r ? r.rollen : [],
      rechten: r ? r.rechten : [],
      rechtenkaart: { alle: RECHTEN, rollen: ROLLEN.map(x => ({ id: x.id, naam: x.naam })) },
      nietGebouwd: NIET_GEBOUWD,
      let: 'Dit is het volledige beeld dat het Werk OS van u en uw organisatie heeft. Wat er niet in staat, staat in nietGebouwd.'
    };
  }

  /* De weg via het lid-token: één werkruimte, want dat token hoort bij één. */
  function voorLid(code, lid) { return bouw(code, lid, 'lid-token'); }

  /* De weg via de RTG-sessie: alle werkruimtes waar dit account aan hangt.
     Hier komt het LID-TOKEN mee naar buiten, en dat is met opzet: wie via zijn
     eigen provider is binnengekomen, heeft geen tweede sleutel gekregen om in
     te typen. Het gaat over een POST achter de gewone auth-poort en dus niet
     via een URL -- dezelfde reden waarom routes/sso.js geen sessietoken in de
     terugkeer-URL zet. */
  function voorRtg(rtgKey) {
    return brug.werkruimtesVan(rtgKey).map(({ werkruimte, lid }) => {
      const b = bouw(werkruimte, lid, 'rtg-sessie');
      if (b && lid.status === 'actief' && lid.token) b.lidToken = lid.token;
      return b;
    }).filter(Boolean);
  }

  return { voorLid, voorRtg, NIET_GEBOUWD };
};
