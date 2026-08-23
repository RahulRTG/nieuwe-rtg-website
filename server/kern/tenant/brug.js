/* ============================================================================
   DE IDENTITEITSBRUG -- van een groep bij de klant naar een rol in de werkruimte.

   Dit was het gat. OIDC, SCIM en WebAuthn lagen er al, maar ze leverden een
   RTG-ACCOUNT af, en het Werk OS werkt met een WERKRUIMTELID: een eigen rij met
   een eigen token. Er liep geen draad tussen die twee. Een klant kon dus zijn
   eigen identiteitsprovider gebruiken om bij RTG binnen te komen, en moest zijn
   mensen daarna met de hand nog eens in de werkruimte zetten -- inclusief het
   met de hand weer weghalen, wat bij uitdiensttreding de stap is die overslaat.

   DE KETEN, EN ER ZIT GEEN NIEUW IDENTITEITSMODEL IN:

     IdP-groep -> tenant (org) -> werkruimte (W...) -> rol -> de 18 werkwoordrechten

   WIE MAG WAT, EN WAAROM DAAR

   De werkruimte aan de tenant hangen doet de EIGENAAR (register.js): dat is de
   contractgrens. De IdP aan de org hangen doet ook de eigenaar (techniek/sso.js):
   dat is domeinbezit. De GROEPSAFBEELDING doet de beheerder van de werkruimte
   zelf, en alleen voor zijn eigen werkruimte -- dat is een personeelsbesluit en
   hoort bij de klant, niet bij ons.

   Daarmee blijft de huisregel van de werkruimte overeind: aanmelden is niet
   binnen zijn. Er komt niemand binnen door in te loggen; er komt iemand binnen
   omdat een mens met het beheer-token heeft opgeschreven dat groep X rol Y
   krijgt. Zonder afbeelding gebeurt er hier NIETS -- ook niet voor iemand die
   perfect inlogt bij een perfect gekoppelde provider.

   TWEE REGELS DIE HIER NIET TE OMZEILEN ZIJN

   1. EEN IdP-ROL IS BEHEERD, EEN HANDMATIGE ROL NIET. Rollen die uit een groep
      komen dragen bron:'idp' en worden bij elke inlog opnieuw gezet -- valt de
      groep weg, dan valt de rol weg. Rollen die een mens gaf blijven staan.
      Zonder dat onderscheid wist de eerste synchronisatie het handwerk van de
      beheerder, of bleef een ingetrokken groep eeuwig hangen.
   2. EEN IdP HERSTELT GEEN ONTSLAG. Is een lid door een mens uit dienst gezet,
      dan brengt een groepslidmaatschap hem niet terug. Anders is "uit dienst"
      een stand die de volgende synchronisatie ongedaan maakt, en dat is de
      gevaarlijkste soort stille toegang. */
'use strict';

const crypto = require('crypto');
const { ROLLEN } = require('../../bedrijf/rollen-register');

const REDEN_UIT = 'Identiteitsprovider: groepslidmaatschap vervallen.';
const REDEN_SCIM = 'Identiteitsprovider: account gedeactiveerd (SCIM).';

module.exports = ({ db, save, register }) => {
  const nu = () => new Date().toISOString();
  const dag = () => nu().slice(0, 10);
  const bestaatRol = (id) => ROLLEN.some(r => r.id === id);

  function ruimtes() { return db.data.werkruimtes || {}; }
  function ruimte(code) {
    const w = ruimtes();
    return Object.prototype.hasOwnProperty.call(w, String(code)) ? w[String(code)] : null;
  }
  /* Het journaal van de werkruimte, in dezelfde vorm als bedrijf/rollen.js hem
     schrijft. Buitenom een rij toevoegen zou een tweede vorm opleveren in
     hetzelfde journaal, en dan leest de auditor twee soorten regels. */
  function journaal(w, wat, waarover, reden) {
    w.journaal = w.journaal || [];
    w.journaal.unshift({ id: crypto.randomBytes(4).toString('hex'), wie: 'identiteitsprovider',
      wieId: null, wat, waarover: waarover || null, reden: reden || null, at: nu() });
    w.journaal = w.journaal.slice(0, 20000);
  }

  const lidVanKey = (w, rtgKey) => Object.values(w.leden || {}).find(l => l.rtgKey === rtgKey) || null;
  const handmatig = (l) => (l.rollen || []).filter(r => r.bron !== 'idp');

  /* ---------- de synchronisatie bij het inloggen ----------
     `groepen` komt uit de claim van de provider. Wat er niet in staat, bestaat
     voor deze ronde niet: een lege lijst is een geldig antwoord ("deze persoon
     zit in geen enkele gemapte groep") en geen reden om niets te doen. */
  function uitClaims(org, groepen, rtgKey, naam) {
    const t = register.haal(org);
    if (!t || t.actief === false) return { ok: false, reden: 'geen actieve tenant', werkruimtes: [] };
    const heeft = new Set((Array.isArray(groepen) ? groepen : []).map(g => String(g)));
    const uit = [];
    let veranderd = false;

    for (const code of t.werkruimtes) {
      const w = ruimte(code);
      if (!w) continue;                                   // weggehaalde werkruimte: overslaan, niet crashen
      const afb = t.groepen.filter(g => g.werkruimte === code);
      const gewenst = [...new Set(afb.filter(g => heeft.has(g.groep)).map(g => g.rol))].filter(bestaatRol);
      let l = lidVanKey(w, rtgKey);

      if (!gewenst.length) {
        if (!l || !(l.rollen || []).some(r => r.bron === 'idp')) continue;
        l.rollen = handmatig(l);
        journaal(w, 'idp-rollen-ingetrokken', l.id, REDEN_UIT);
        if (l.bron === 'idp' && !l.rollen.length && l.status === 'actief') {
          l.status = 'uit dienst'; l.token = null; l.uitReden = REDEN_UIT;
          l.uitAt = nu(); l.laatsteDag = dag();
          journaal(w, 'idp-uit-dienst', l.id, REDEN_UIT);
        }
        veranderd = true;
        uit.push({ werkruimte: code, rollen: [], lidId: l.id, status: l.status });
        continue;
      }

      if (!l) {
        l = { id: crypto.randomBytes(4).toString('hex'), naam: naam || 'Onbekend', functie: null,
          afdeling: null, extern: false, rollen: [], status: 'actief',
          token: crypto.randomBytes(24).toString('hex'), bron: 'idp', rtgKey,
          at: nu(), toegelatenAt: nu() };
        w.leden = w.leden || {};
        w.leden[l.id] = l;
        journaal(w, 'idp-lid-aangemaakt', l.id, 'Groepsafbeelding van de tenant ' + t.org + '.');
      } else if (l.status !== 'actief') {
        /* Regel 2: alleen wat de brug zelf heeft ingetrokken, mag de brug
           herstellen. Een mens die iemand uit dienst zette, houdt het laatste
           woord. */
        if (l.bron !== 'idp' || l.uitReden !== REDEN_UIT) {
          uit.push({ werkruimte: code, rollen: [], lidId: l.id, status: l.status, geblokkeerd: true });
          continue;
        }
        l.status = 'actief'; l.token = crypto.randomBytes(24).toString('hex');
        delete l.uitReden; delete l.uitAt; delete l.laatsteDag;
        journaal(w, 'idp-lid-hersteld', l.id, 'Groepslidmaatschap opnieuw vastgesteld.');
      }

      const nieuw = handmatig(l).concat(gewenst.map(id => ({ id, van: null, tot: null, bron: 'idp', at: nu() })));
      const was = (l.rollen || []).map(r => r.id + ':' + (r.bron || 'mens')).sort().join(',');
      const wordt = nieuw.map(r => r.id + ':' + (r.bron || 'mens')).sort().join(',');
      if (was !== wordt) {
        l.rollen = nieuw;
        journaal(w, 'idp-rollen-gezet', l.id, gewenst.join(', '));
        veranderd = true;
      } else {
        l.rollen = nieuw;
      }
      uit.push({ werkruimte: code, rollen: gewenst, lidId: l.id, status: l.status });
    }

    if (veranderd || uit.length) save();
    return { ok: true, org: t.org, werkruimtes: uit };
  }

  /* ---------- intrekken ----------
     Draait SYNCHROON binnen het SCIM-verzoek, en dat is de hele belofte: als de
     IdP een 204 terugkrijgt, is de toegang in elke werkruimte van deze tenant
     al weg. Een wachtrij zou hier betekenen dat "uit dienst" een tijdvenster
     krijgt waarin iemand nog kan werken, en dat venster is bij een ontslag om
     dringende reden precies het probleem. */
  function deprovisioneer(org, rtgKey, reden) {
    const t = register.haal(org);
    if (!t) return { ok: false, reden: 'geen tenant', geraakt: [] };
    const geraakt = [];
    for (const code of t.werkruimtes) {
      const w = ruimte(code);
      if (!w) continue;
      const l = lidVanKey(w, rtgKey);
      if (!l || l.status === 'uit dienst') continue;
      l.status = 'uit dienst'; l.token = null;
      l.uitReden = reden || REDEN_SCIM; l.uitAt = nu(); l.laatsteDag = dag();
      l.rollen = handmatig(l);
      journaal(w, 'idp-deprovisioning', l.id, l.uitReden);
      geraakt.push({ werkruimte: code, lidId: l.id });
    }
    if (geraakt.length) save();
    return { ok: true, org: t.org, geraakt };
  }

  /* Bij welke werkruimtes van welke tenant hoort dit RTG-account? De bootstrap
     leest dit; de brug is de enige die de koppeling rtgKey -> lid kent. */
  function werkruimtesVan(rtgKey) {
    const uit = [];
    for (const t of Object.values(db.data.tenants || {})) {
      for (const code of t.werkruimtes) {
        const w = ruimte(code);
        const l = w ? lidVanKey(w, rtgKey) : null;
        if (l) uit.push({ tenant: t.org, werkruimte: code, lid: l });
      }
    }
    return uit;
  }

  return { uitClaims, deprovisioneer, werkruimtesVan, REDEN_UIT, REDEN_SCIM };
};
