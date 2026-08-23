/* ============================================================================
   DE TENANTSTATUS -- en de poort waar elke enterprisebewering doorheen moet.

   DIT IS DE LAAG DIE DE DODE ENTERPRISE-SCHIL ONMOGELIJK MAAKT. Die schil
   (public/shared/enterprise-shell.js, inmiddels weg) zette "Enterprise
   beveiligd · versleutelde werkruimte · audit gereed · Commercial" op het
   scherm, en er was geen enkele bron die een van die vier kon dragen. Het
   probleem was niet die ene schil maar dat er geen MECHANISME was: een
   bewering was een stuk tekst, en tekst kun je altijd typen.

   Hier is een bewering een OBJECT met een bron. `stand()` geeft per bewering
   terug of hij vandaag waar is en waarom (of waarom niet), en een scherm mag
   alleen tonen wat hier op `mag: true` staat. Een nieuwe bewering zonder bron
   kun je nog steeds intypen -- maar niet meer uit deze lijst halen, en dat is
   het verschil tussen een afspraak en een gewoonte.

   DE CIJFERS ZIJN PLATFORMBREED EN DAT STAAT ERBIJ. De SLO's meten de hele
   server en niet deze klant. Een statuspagina die platformcijfers als "uw
   beschikbaarheid" presenteert, is preciezer dan de meting en dus onwaar.
   Sinds server/meting-capaciteit.js is er wel een meting per CAPABILITY, en
   die staat er ook: daarmee is te zien of een storing zat in een onderdeel dat
   deze klant gebruikt. Een cijfer per ORGANISATIE is er nog steeds niet, en
   dus staat er ook geen. Wat we per tenant WEL weten -- zijn contract, zijn
   levensloop, zijn verbruik -- staat apart.

   ER IS GEEN SLA, en dat is hier een berekening en geen mening: vier
   voorwaarden, en zolang er een van vier ontbreekt komt hij niet op `mag`.
   SLO.md zegt hetzelfde in woorden; dit is dezelfde zin in code.
   ========================================================================== */
'use strict';

const kluis = require('../../kluis');

/* Wat de OMGEVING levert (back-ups, meting, een incidentproces) staat in
   ./bewijs-sla.js. Dat is een andere vraag dan "welke bewering mag er op een
   scherm", en de twee lopen alleen bij de SLA samen. */
const sla = require('./bewijs-sla');
const laatsteBackup = sla.laatsteBackup;
const BACKUP_DAGEN = sla.BACKUP_DAGEN;

/* De meting per capability. LUI geladen en in een try: deze module wordt ook
   los getoetst, zonder server en zonder functiecatalogus, en dan hoort er geen
   crash te komen maar een eerlijke `null` met de reden -- een meter zonder
   invoer zakt, hij gokt niet (LAT-regel 3). */
function perCapability() {
  try {
    const meting = require('../../meting');
    const functies = require('../../functies');
    return require('../../meting-capaciteit').stand(meting, functies);
  } catch (e) {
    return { nietBeschikbaar: 'De meting per capability is hier niet te lezen (' + e.message + ').' };
  }
}

module.exports = ({ register, contract, levensloop, ssoKoppelingen, db, herstelproef }) => {
  function werkruimtesVan(t) {
    const w = db.data.werkruimtes || {};
    return t.werkruimtes.map(c => (Object.prototype.hasOwnProperty.call(w, c) ? w[c] : null)).filter(Boolean);
  }

  const slaVoorwaarden = sla.maak({ contract, herstelproef });

  /* ---------- de beweringen ----------
     Elke regel: wat er op een scherm zou mogen staan, en waaraan je vandaag
     ziet of dat waar is. Wie er een bijzet zonder `bron`, krijgt hem niet
     getoond -- dat is het hele punt van deze vorm. */
  function beweringen(t) {
    const c = contract.van(t.org);
    const hp = herstelproef ? herstelproef.laatsteGeslaagde(t.org) : null;
    const l = levensloop.stand(t.org);
    const ruimtes = werkruimtesVan(t);
    const journaalregels = ruimtes.reduce((n, w) => n + ((w.journaal || []).length), 0);
    const sso = ssoKoppelingen ? ssoKoppelingen.vind(t.org) : null;
    const back = laatsteBackup();
    const backVers = back && (Date.now() - Date.parse(back)) / 86400000 < BACKUP_DAGEN;
    const sla = slaVoorwaarden(t);
    const slaMist = sla.filter(v => !v.ja);

    return [
      { id: 'versleutelde-opslag', tekst: 'Versleutelde opslag', mag: kluis.AAN,
        bron: kluis.AAN ? 'RTG_ENC_KEY is gezet; opgeslagen gegevens gaan versleuteld naar schijf (AES-256-GCM)' : null,
        reden: kluis.AAN ? null : 'RTG_ENC_KEY staat niet gezet, dus de opslag is niet versleuteld. Dit is een omgevingsinstelling en geen productbelofte.' },

      { id: 'audit-spoor', tekst: 'Auditspoor', mag: journaalregels > 0,
        bron: journaalregels > 0 ? journaalregels + ' journaalregels over ' + ruimtes.length + ' werkruimte(s); wie het journaal leest staat er zelf in' : null,
        reden: journaalregels > 0 ? null : 'Er staat nog geen enkele journaalregel voor deze organisatie.' },

      { id: 'eigen-identiteitsprovider', tekst: 'Eigen identiteitsprovider (SSO)', mag: !!(sso && sso.actief),
        bron: sso && sso.actief ? 'een actieve OIDC-koppeling op ' + (sso.domeinen || []).length + ' domein(en)' : null,
        reden: sso ? (sso.actief ? null : 'de koppeling staat uit') : 'er is geen SSO-koppeling voor deze organisatie' },

      { id: 'lopend-contract', tekst: 'Commercieel contract', mag: !!(c && c.loopt),
        bron: c && c.loopt ? 'pakket ' + c.pakket + (c.tot ? ', tot ' + c.tot : ', voor onbepaalde tijd') : null,
        reden: c && c.loopt ? null : 'het contract is verlopen of nog niet gezet' },

      { id: 'dagelijkse-backup', tekst: 'Dagelijkse back-up', mag: !!backVers,
        bron: backVers ? 'laatste dagback-up: ' + back : null,
        reden: backVers ? null : (back ? 'de laatste back-up is van ' + back + ' en dus ouder dan ' + BACKUP_DAGEN + ' dagen' : 'er is geen dagback-up gevonden') },

      /* DE UITVOER IS BEPROEFD, of hij is dat niet -- en dan staat er wat er
         ontbreekt. Dit is de enige bewering hier die een klant zelf kan laten
         ontstaan: hij drukt op de knop, de uitvoer wordt teruggelezen in een
         tijdelijke werkruimte en de catalogus gaat per soort naast de eerste.
         Wat het NIET is, staat in de bron: dit gaat over het exit-pad en niet
         over het terugzetten van de dagback-up van het platform. */
      { id: 'uitvoer-beproefd', tekst: 'Uitvoer teruggelezen en gecontroleerd', mag: !!(hp && hp.ok),
        bron: hp && hp.ok ? 'op ' + hp.proef.at.slice(0, 10) + ' teruggelezen: ' + hp.proef.soorten +
          ' soorten, ' + hp.proef.objecten + ' objecten, geen verschil. Dit bewijst het exit-pad, niet de platform-back-up.' : null,
        reden: hp && hp.ok ? null : (hp ? hp.reden : 'de herstelproef is hier niet beschikbaar') },

      /* Twee beweringen die met opzet ALTIJD nee zijn. Ze staan er juist
         daarom: weglaten leest als vergeten, en dan typt iemand ze een keer
         met de hand op een scherm. */
      { id: 'eigen-domein', tekst: 'Eigen domein', mag: false, bron: null,
        reden: 'Dit huis heeft geen externe hosting, geen certificaat-machinerie voor domeinen van derden en geen routering op hostnaam. Zie TAKEN.md 4.21.' },

      { id: 'sla', tekst: 'SLA met een boete', mag: slaMist.length === 0, bron: null,
        reden: slaMist.length === 0 ? null
          : 'Er is geen SLA. Er ontbreekt nog: ' + slaMist.map(v => v.wat).join(' en ') + '.',
        voorwaarden: sla }
    ];
  }

  function stand(org) {
    const t = register.haal(org);
    if (!t) return null;
    const rijen = beweringen(t);
    const l = levensloop.stand(t.org);
    return {
      org: t.org, naam: t.naam, modus: t.modus,
      levensloop: { stand: l.stand, sinds: l.sinds, bewaarTot: l.bewaarTot },
      contract: contract.van(t.org),
      beweringen: rijen,
      toonbaar: rijen.filter(r => r.mag).map(r => r.id),
      platformbreed: Object.assign({
        wat: 'De SLO-doelen en de beschikbaarheidscijfers gaan over de hele server en niet over deze organisatie.',
        waar: 'SLO.md en /api/metrics',
        nietGemeten: 'Er is geen meting per ORGANISATIE: de telling gaat per routepatroon en draagt geen tenant. Er staat hier daarom geen beschikbaarheidscijfer voor u. Wat er wel is, is de meting per CAPABILITY hieronder -- daarmee is te zien of een storing zat in een onderdeel dat u gebruikt.'
      }, { perCapability: perCapability() }),
      let: 'Een scherm mag alleen tonen wat hierboven op mag:true staat. Wat op false staat, staat er met de reden -- ' +
        'weglaten leest als vergeten, en dan typt iemand het een keer met de hand.'
    };
  }

  return { stand, beweringen, slaVoorwaarden, laatsteBackup, BACKUP_DAGEN };
};
