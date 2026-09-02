/* ============================================================================
   MIJN RTG blok 3: TOESTELBINDING -- wat een toestel werkelijk bewijst.

   DE VRAAG DIE DIT BESTAND BEANTWOORDT. Een cookie, een opgeslagen id of een
   browservingerafdruk HERKENNEN een toestel; ze bewijzen er niets over. Wie op
   zoiets `bewezen` schrijft, heeft de bewijsladder van BESTUUR.md tot een
   sierlijst gemaakt. Het enige dat hier `bewezen` verdient, is bezit van een
   geheim dat het toestel niet kan verlaten.

   Vandaar een sleutelpaar dat de BROWSER maakt met `extractable: false`: de
   private helft is daarna ook voor de eigen pagina niet meer uitleesbaar, en
   RTG krijgt alleen de publieke helft. Bij elke binding tekent het toestel een
   uitdaging van ons, en die handtekening controleren wij. Dat is bezit, en
   bezit is het enige waarop deze laag `cryptografisch` mag schrijven.

   DRIE GRENZEN, EN DE EERSTE IS DE BELANGRIJKSTE.

   1. EEN TOESTELSLEUTEL IS GEEN INLOG. Hij bindt een sessie die er al is; hij
      opent er nooit een. Zou hij dat wel doen, dan hebben wij per ongeluk een
      wachtwoordloze inlog gebouwd waarbij nooit een mens is gecontroleerd --
      wie de laptop openklapt, is dan binnen. Daarom staat er in dit bestand
      geen enkele functie die een gebruiker teruggeeft, en loopt alles via een
      lidKey die de AANROEPER al kende uit een geldige sessie.

   2. DIT IS GEEN VINGERAFDRUK. Wij meten niets aan de browser en herkennen
      niemand passief: de sleutel wordt op verzoek gemaakt, staat zichtbaar in
      het overzicht, en verdwijnt als het lid hem intrekt of zijn browsergegevens
      wist. Het verschil met fingerprinting is niet de techniek maar de
      toestemming, en die is hier een handeling.

   3. DE NAAM WOONT HIER EN NIET IN DE SESSIE. `toestelnaam` staat op de
      verbodenlijst van kern/identiteit/sessievelden.js, omdat een sessie over
      een bus repliceert en een naam presentatie is. Diezelfde regel zegt waar
      hij dan wel hoort: bij het toestel. De sessie draagt de toestelId, dit
      register draagt de naam, en het scherm brengt ze samen.
   ========================================================================== */
'use strict';

const { randomBytes } = require('crypto');
const { createHash } = require('crypto');
const { idVan, schoneJwk, klopt } = require('./toestelsleutels');
const klok = require('../../lib/klok');

/* Een uitdaging leeft kort. Hij hoeft alleen de reis naar de browser en terug te
   overleven; alles daarboven is een venster waarin een onderschepte handtekening
   opnieuw bruikbaar is. */
const UITDAGING_MS = 2 * 60 * 1000;
const MAX_PER_LID = 25;

function maakToestellen({ db, save }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/identiteit',
    bezit: { toestelregister: 'kaart', toesteluitdaging: 'kaart' } });
  const bak = () => eigen.bak('toestelregister');
  const uitdagingen = () => eigen.bak('toesteluitdaging');

  const sleutelVan = (lidKey, toestelId) => String(lidKey) + '|' + String(toestelId);
  const geldigeId = (v) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);



  /* De naam is invoer van een mens en gaat naar een scherm. Stuurtekens eruit,
     lengte begrensd; het ontsnappen zelf doet de laag die toont. */
  const STUURTEKENS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');
  const schoneNaam = (n) => {
    const s = String(n == null ? '' : n).replace(STUURTEKENS, '').trim().slice(0, 40);
    return s || null;
  };

  /* ---- de uitdaging ---- */
  function uitdaging(lidKey) {
    if (!lidKey) return { error: 'Geen sessie.' };
    const nonce = randomBytes(24).toString('base64url');
    const kast = uitdagingen();
    kast[String(lidKey)] = { nonce, tot: klok.nu() + UITDAGING_MS };
    for (const [k, v] of Object.entries(kast)) if (!v || Number(v.tot) < klok.nu()) delete kast[k];
    save();
    return { nonce, geldigMs: UITDAGING_MS };
  }

  function pakUitdaging(lidKey) {
    const kast = uitdagingen();
    const u = kast[String(lidKey)];
    if (!u || Number(u.tot) < klok.nu()) { delete kast[String(lidKey)]; save(); return null; }
    delete kast[String(lidKey)];   // een uitdaging is voor EEN keer
    save();
    return u.nonce;
  }

  /* ---- binden: de handtekening controleren ---- */
  async function bind(lidKey, jwkRuw, handtekeningB64, naam) {
    if (!lidKey) return { error: 'Geen sessie.' };
    const jwk = schoneJwk(jwkRuw);
    if (!jwk) return { error: 'Die sleutel herkennen wij niet als een P-256 publieke sleutel.' };
    const nonce = pakUitdaging(lidKey);
    if (!nonce) return { error: 'De uitdaging is verlopen. Probeer het opnieuw.' };
    let handtekening;
    try { handtekening = Buffer.from(String(handtekeningB64 || ''), 'base64url'); }
    catch (e) { return { error: 'Onleesbare handtekening.' }; }
    if (!handtekening.length || handtekening.length > 256) return { error: 'Onleesbare handtekening.' };

    const ok = await klopt(jwk, nonce, handtekening);
    if (!ok) return { error: 'De handtekening klopt niet bij deze sleutel.' };

    const toestelId = idVan(jwk);
    const k = sleutelVan(lidKey, toestelId);
    const nu = klok.datum().toISOString();
    const bestaand = bak()[k];
    /* Een INGETROKKEN toestel komt niet stilletjes terug. Het lid heeft dit
       toestel bewust weggezet; opnieuw binden zonder dat te zeggen zou die
       handeling ongedaan maken zonder dat iemand het ziet. */
    if (bestaand && bestaand.ingetrokkenOp) {
      return { error: 'Dit toestel heeft u eerder ingetrokken. Neem het bewust opnieuw op als u het weer wilt vertrouwen.',
        ingetrokken: true, toestelId };
    }
    bak()[k] = {
      lidKey: String(lidKey), toestelId, jwk,
      naam: schoneNaam(naam) || (bestaand && bestaand.naam) || null,
      gebondenOp: (bestaand && bestaand.gebondenOp) || nu,
      laatstBewezenOp: nu,
      ingetrokkenOp: null
    };
    ruim(lidKey, k);
    save();
    /* De bindingId hoort bij dit BEWIJS en niet bij het toestel: hij zegt "deze
       handtekening, op dit moment". Zo kan een sessie later laten zien met welk
       bewijs zij gebonden werd, en niet alleen aan welk toestel. */
    const bindingId = createHash('sha256').update(toestelId + '|' + nonce).digest('hex').slice(0, 32);
    return { ok: true, toestelId, bindingId, nieuw: !bestaand, naam: bak()[k].naam };
  }

  function noem(lidKey, toestelId, naam) {
    if (!geldigeId(toestelId)) return { error: 'Onbekend toestel.' };
    const r = bak()[sleutelVan(lidKey, toestelId)];
    if (!r || r.ingetrokkenOp) return { error: 'Onbekend toestel.' };
    const n = schoneNaam(naam);
    if (!n) return { error: 'Geef het toestel een naam van maximaal 40 tekens.' };
    r.naam = n;
    save();
    return { ok: true, naam: n };
  }

  /* HET INTREKKEN VAN EEN TOESTEL SLUIT GEEN SESSIE. Dat is met opzet: de twee
     horen bij elkaar maar zijn niet hetzelfde, en de route die dit aanroept
     sluit de sessies er zelf bij. Zou dit bestand dat doen, dan zat er een
     sessie-intrekking verstopt in een naamloos registerbestand. */
  function trekIn(lidKey, toestelId) {
    if (!geldigeId(toestelId)) return { error: 'Onbekend toestel.' };
    const r = bak()[sleutelVan(lidKey, toestelId)];
    if (!r || r.ingetrokkenOp) return { error: 'Onbekend toestel.' };
    r.ingetrokkenOp = klok.datum().toISOString();
    save();
    return { ok: true, toestelId };
  }

  /* De naam die het scherm toont. Geeft null bij een onbekend of ingetrokken
     toestel -- nooit een gok, want dan staat er "MacBook" bij iets anders. */
  function naamVan(lidKey, toestelId) {
    if (!geldigeId(toestelId)) return null;
    const r = bak()[sleutelVan(lidKey, toestelId)];
    return r && !r.ingetrokkenOp ? (r.naam || null) : null;
  }

  /* De publieke sleutel van een toestel, voor het controleren van een
     bezitsbewijs. Alleen de PUBLIEKE helft -- er is er ook maar een, want de
     private helft heeft dit huis nooit gezien en kan het toestel niet verlaten.
     Per lid, zodat hetzelfde toestel bij een ander lid niets oplevert, en null
     bij een ingetrokken toestel: dan hoort een bewijs juist te falen. */
  function publiekeSleutelVan(lidKey, toestelId) {
    if (!geldigeId(toestelId)) return null;
    const r = bak()[sleutelVan(lidKey, toestelId)];
    return r && !r.ingetrokkenOp ? r.jwk : null;
  }

  function lijst(lidKey) {
    return Object.values(bak())
      .filter(r => r.lidKey === String(lidKey) && !r.ingetrokkenOp)
      .map(r => ({ toestelId: r.toestelId, naam: r.naam, gebondenOp: r.gebondenOp, laatstBewezenOp: r.laatstBewezenOp }))
      .sort((a, b) => new Date(b.laatstBewezenOp) - new Date(a.laatstBewezenOp));
  }

  function ruim(lidKey, behoud) {
    const mijne = Object.entries(bak())
      .filter(([k, r]) => r.lidKey === String(lidKey) && k !== behoud)
      .sort((a, b) => new Date(a[1].laatstBewezenOp || 0) - new Date(b[1].laatstBewezenOp || 0));
    const teveel = mijne.length + 1 - MAX_PER_LID;
    for (let i = 0; i < teveel; i++) delete bak()[mijne[i][0]];
  }

  return { uitdaging, bind, noem, trekIn, naamVan, publiekeSleutelVan, lijst, idVan, UITDAGING_MS, MAX_PER_LID };
}

module.exports = { maakToestellen };
