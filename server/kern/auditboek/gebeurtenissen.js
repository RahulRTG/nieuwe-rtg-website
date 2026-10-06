/* ============================================================================
   DE GEBEURTENISSEN VAN HET AUDITBOEK -- een GESLOTEN lijst.

   Wat hier niet staat, kan het boek niet in. Dat is de hele bescherming tegen
   geheimen in een auditrecord: er is geen vrij tekstveld. Elke waarde in een
   record heeft een TYPE met een vorm (een digest, een commit, een padzonder
   querystring, een reden-code), en een waarde die die vorm niet heeft, wordt
   geweigerd -- niet geschoond. Een wachtwoord, een token, een e-mailadres of een
   PEM-sleutel past in geen van de vormen.

   ACTOREN. De actor komt uit de SESSIE of uit de CI-run en nooit uit het verzoek
   (zie AUTHORITY.md, P0b); het boek kent alleen een codenaam, een rol of een
   run-id. Een e-mailadres (`@`) is geen actor.

   VIJF CATEGORIEEN. security, beheer, release, promotie, rollback. De lijst
   staat in GEBEURTENISSEN; AUDITBOEK.md legt per type uit waarom hij erin zit.
   ========================================================================== */
'use strict';

const VORMEN = Object.freeze({
  digest: /^sha256:[a-f0-9]{64}$/,
  hex64: /^[a-f0-9]{64}$/,
  commit: /^[a-f0-9]{40,64}$/,
  ref: /^[A-Za-z0-9_.:-]{1,128}$/,
  pad: /^\/[A-Za-z0-9_\/.-]{0,255}$/,
  code: /^[a-z][a-z0-9.-]{1,63}$/,
  methode: /^(POST|PUT|PATCH|DELETE)$/,
  omgeving: /^(staging|pilot|productie)$/,
  run: /^[A-Za-z0-9_.-]{1,64}$/
});
const GETAL = 'getal';
const BOOL = 'bool';

const T = (categorie, wat, verplicht, extra) =>
  Object.freeze({ categorie, wat, verplicht: Object.freeze(verplicht), toegestaan: Object.freeze({ ...verplicht, ...(extra || {}) }) });

const GEBEURTENISSEN = Object.freeze({
  /* ---------- security ---------- */
  'kritiek.toegestaan': T('security', 'een kritieke schrijfhandeling is VERLEEND (nooit "uitgevoerd")',
    { methode: 'methode', pad: 'pad' }, { status: GETAL }),
  'kritiek.geweigerd': T('security', 'een kritieke handeling is geweigerd',
    { methode: 'methode', pad: 'pad', reden: 'code' }),
  'bezitsbewijs.geweigerd': T('security', 'een sessie zonder gebonden toestel is op een zwaar pad geweigerd',
    { pad: 'pad', reden: 'code' }),
  'sessie.ingetrokken': T('security', 'een sessie is ingetrokken', { reden: 'code' }, { doelRef: 'ref' }),
  'inzage.kluis': T('security', 'de identiteitskluis is geopend', { doelRef: 'ref', reden: 'code' }),
  /* ---------- beheer ---------- */
  'beheer.rol.gewijzigd': T('beheer', 'een rol of bevoegdheid is gewijzigd',
    { doelRef: 'ref', besluitRef: 'ref' }, { rolVan: 'code', rolNaar: 'code' }),
  'beheer.sleutel.gewisseld': T('beheer', 'een vertrouwenssleutel is gewisseld',
    { sleutelRol: 'code', vingerafdruk: 'hex64' }, { besluitRef: 'ref' }),
  'beheer.config.gewijzigd': T('beheer', 'een beveiligingsrelevante instelling is gewijzigd',
    { instelling: 'code', waardeSha256: 'hex64' }, { besluitRef: 'ref' }),
  'auditboek.init': T('beheer', 'het auditboek is aangemaakt', { schema: GETAL }),
  'auditboek.verificatie': T('beheer', 'de keten en de verankering zijn gecontroleerd',
    { uitslag: 'code', fataal: GETAL, waarschuwingen: GETAL }),
  'auditboek.retentie': T('beheer', 'verjaarde regels zijn verwijderd achter een checkpoint',
    { totNr: GETAL, aantal: GETAL, dagen: GETAL, checkpointHash: 'hex64' }),
  /* ---------- release ---------- */
  'release.kandidaat.gebouwd': T('release', 'een kandidaat-artefact is gebouwd en heeft een digest',
    { commit: 'commit', digest: 'digest', run: 'run' }, { image: 'ref' }),
  'release.kandidaat.getest': T('release', 'de tests draaiden tegen exact dit digest',
    { commit: 'commit', digest: 'digest', testBewijsSha256: 'hex64', geslaagd: BOOL }),
  'release.gate': T('release', 'de releasepoort heeft een oordeel gegeven',
    { commit: 'commit', uitslag: 'code', blokkers: GETAL }),
  /* ---------- promotie ---------- */
  'promotie.aangevraagd': T('promotie', 'promotie van een digest is aangevraagd',
    { digest: 'digest', naarOmgeving: 'omgeving', besluitRef: 'ref' }),
  'promotie.geweigerd': T('promotie', 'promotie is geweigerd (artefact niet bewezen)',
    { digest: 'digest', naarOmgeving: 'omgeving', reden: 'code' }),
  'promotie.uitgevoerd': T('promotie', 'een digest is gepromoveerd, zonder nieuwe build',
    { digest: 'digest', naarOmgeving: 'omgeving', besluitRef: 'ref', testBewijsSha256: 'hex64' }),
  /* ---------- rollback ---------- */
  'rollback.aangevraagd': T('rollback', 'terugdraaien naar een eerder goedgekeurd digest is aangevraagd',
    { vanDigest: 'digest', naarDigest: 'digest', naarOmgeving: 'omgeving', besluitRef: 'ref' }),
  'rollback.geweigerd': T('rollback', 'rollback is geweigerd (doel niet eerder goedgekeurd)',
    { naarDigest: 'digest', naarOmgeving: 'omgeving', reden: 'code' }),
  'rollback.uitgevoerd': T('rollback', 'er is teruggedraaid naar een eerder goedgekeurd digest',
    { vanDigest: 'digest', naarDigest: 'digest', naarOmgeving: 'omgeving', besluitRef: 'ref' })
});

const CATEGORIEEN = Object.freeze(['security', 'beheer', 'release', 'promotie', 'rollback']);
const UITKOMSTEN = Object.freeze(['toegestaan', 'geweigerd', 'uitgevoerd', 'mislukt', 'vastgelegd']);
const ACTOR_SOORTEN = Object.freeze(['lid', 'kantoor', 'zaak', 'systeem', 'ci', 'release-authority']);

function waardeGeldig(vorm, v) {
  if (vorm === GETAL) return Number.isSafeInteger(v) && v >= 0;
  if (vorm === BOOL) return typeof v === 'boolean';
  return typeof v === 'string' && VORMEN[vorm] instanceof RegExp && VORMEN[vorm].test(v);
}

/* Geeft de klachten terug; een lege lijst betekent dat het type, de verplichte
   en de toegestane sleutels en elke waarde kloppen. Onbekende sleutels zijn een
   klacht en worden niet stil weggelaten. */
function controleerContext(type, context) {
  const spec = GEBEURTENISSEN[type];
  if (!spec) return ['onbekend gebeurtenistype'];
  const klachten = [];
  const c = context && typeof context === 'object' && !Array.isArray(context) ? context : null;
  if (!c) return ['context ontbreekt'];
  for (const sleutel of Object.keys(spec.verplicht)) if (!(sleutel in c)) klachten.push('verplicht veld ontbreekt: ' + sleutel);
  for (const [sleutel, waarde] of Object.entries(c)) {
    if (!Object.hasOwn(spec.toegestaan, sleutel)) { klachten.push('veld niet toegestaan: ' + sleutel); continue; }
    if (!waardeGeldig(spec.toegestaan[sleutel], waarde)) klachten.push('veld heeft niet de vorm ' + spec.toegestaan[sleutel] + ': ' + sleutel);
  }
  return klachten;
}

function controleerActor(actor) {
  if (!actor || typeof actor !== 'object') return ['actor ontbreekt'];
  const k = [];
  if (!ACTOR_SOORTEN.includes(actor.soort)) k.push('actorsoort onbekend');
  if (typeof actor.ref !== 'string' || !VORMEN.ref.test(actor.ref)) k.push('actor.ref is geen codenaam, rol of run-id');
  return k;
}

module.exports = { GEBEURTENISSEN, CATEGORIEEN, UITKOMSTEN, ACTOR_SOORTEN, VORMEN,
  controleerContext, controleerActor, waardeGeldig };
