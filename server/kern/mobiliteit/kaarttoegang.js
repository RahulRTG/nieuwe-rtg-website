/* Mobility OS (deelmodule): de CODE van een vervoerbewijs
   (travelos.mobility_transport_ticket) -- los kaartje en abonnement.

   De oude code was 9 random bytes, base64url en daarna hoofdletters (door die
   case-folding ~60 bits), stond kaal op het kaartje, werd lineair opgezocht en
   bij elke Mijn kaartjes opnieuw getoond. Het kaartje draagt nu geen code meer.

   - toon() IS roteren (POST /api/mob/kaart/toon): een 128-bit code, kaal
     alleen in dat antwoord, op schijf de SHA-256 in `mobKaartToegang` (per
     kaartje-id); de vorige gaat ingetrokken de historie in.
   - issuer/doel/scope, vervalt met het kaartje (geldigTot), max_gebruik is
     het aantal ritten van het product (een abonnement: het plafond van de
     bearerlaag, want onbeperkt reizen wordt geteld en niet begrensd). De
     gebruiksteller hoort bij het KAARTJE: een rotatie neemt hem mee, anders
     speelt een retourhouder zijn gebruikte rit vrij door opnieuw te tonen.
   - constant-time zoeken over elke hash, ook historische; een treffer bij een
     andere vervoerder telt niet (404, de scope is de vervoerder).
   - claim() telt de rit in DEZELFDE collectietransactie (PostgreSQL: advisory
     lock + FOR UPDATE): twee conducteurs die tegelijk scannen tellen een
     enkeltje een keer. `validaties` op het kaartje is daarna de projectie.
   - ruimLegacy() haalt oude kale codes van kaartjes en reizen en honoreert ze
     niet. Het kaartje houdt zijn waarde: de reiziger tikt Toon. */
'use strict';

const DOEL = 'ov-vervoerbewijs';
const SCOPE = Object.freeze(['vervoerder.kaart.controle']);

module.exports = (ctx) => {
  const { crypto, nu, save, opslag, bewerkCollectie, KAART_PRODUCTEN: PRODUCTEN } = ctx;
  if (typeof bewerkCollectie !== 'function') throw new Error('Het vervoerbewijs vereist een collectietransactie.');
  const bearer = require('../bearercode')({ crypto, namespace: 'travelos.mobility_transport_ticket', nu });
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const houder = k => afdruk('rtg-ovkaart-houder-v1|' + String(k.key || ''));
  const ritten = k => (k.product === 'abonnement' ? 10000 : ((PRODUCTEN[k.product] || {}).ritten || 1));

  const transactie = werk => bewerkCollectie('mobKaartToegang', bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('mobKaartToegang hoort een kaart te zijn');
    return werk(bron);
  });

  let legacyKlaar = false;
  function ruimLegacy() {
    if (legacyKlaar) return 0;
    const kaartjes = opslag.bak('mobKaartjes');
    const perCode = new Map(kaartjes.filter(k => k && k.code).map(k => [k.code, k.id]));
    let n = 0;
    for (const r of opslag.bak('mobReizen'))
      for (const e of (r && r.etappes) || [])
        if (e && e.kaartje && perCode.has(e.kaartje)) { e.kaartje = perCode.get(e.kaartje); n++; }
    for (const k of kaartjes)
      if (k && Object.prototype.hasOwnProperty.call(k, 'code')) { delete k.code; k.codeLegacy = true; n++; }
    if (n) save();
    legacyKlaar = true;
    return n;
  }

  /* `stand` komt van kaartStand(): alleen een geldig (of nog-niet-geldig)
     kaartje krijgt een code. */
  function toon({ kaartje: k, key, stand }) {
    if (!k || !key || k.key !== key) return { status: 404, error: 'Dit vervoerbewijs kennen wij niet.' };
    if (!['geldig', 'nog-niet-geldig'].includes(stand && stand.stand))
      return { status: 409, error: 'Dit vervoerbewijs is niet meer geldig' + (stand && stand.reden ? ': ' + stand.reden : '') + '.' };
    const tot = Date.parse(k.geldigTot) - Date.parse(nu());
    if (!(tot > 0)) return { status: 409, error: 'Dit vervoerbewijs is verlopen.' };
    return transactie(bron => {
      const oud = bron[k.id];
      if (oud && (oud.vervoerder !== k.vervoerder || oud.houder_hash !== houder(k)))
        return { status: 409, error: 'Deze code hoort niet bij dit vervoerbewijs.' };
      const r = oud || (bron[k.id] = { id: k.id, vervoerder: k.vervoerder, houder_hash: houder(k),
        gebruik: (k.validaties || []).length, toegang: null, historie: [], bijgewerkt_at: nu() });
      const rotatie = Math.max(0, ...[r.toegang, ...r.historie].filter(Boolean).map(t => Number(t.rotatie) || 0)) + 1;
      if (r.toegang) {
        bearer.intrekken(r.toegang, r.houder_hash, 'vervoerbewijs opnieuw getoond');
        r.historie.push(r.toegang);
        if (r.historie.length > 12) r.historie.splice(0, r.historie.length - 12);
      }
      const g = bearer.maak({ prefix: 'OV', issuer: 'rtg.lid.vervoerbewijs', doel: DOEL, scope: SCOPE,
        onderwerp: { soort: 'vervoerbewijs', id: k.id, vervoerder: k.vervoerder, houder_hash: r.houder_hash },
        geldigMs: tot, maxGebruik: ritten(k) });
      g.toegang.rotatie = rotatie;
      g.toegang.gebruik = Math.min(g.toegang.max_gebruik, Math.max(0, Number(r.gebruik) || 0));
      r.toegang = g.toegang;
      r.bijgewerkt_at = nu();
      return { status: 200, ok: true, eenmalig: true, code: g.code, toegang: bearer.publiek(r.toegang) };
    });
  }

  /* De conducteur scant. `controleer(id)` draait BINNEN de transactie en
     geeft een weigering ({ status, error, ... }) of null. */
  function claim({ code, vervoerder, controleer }) {
    const kale = String(code || '').trim().slice(0, 80);
    if (!kale) return { status: 400, error: 'Geen code.' };
    const gezocht = bearer.hash(kale);
    return transactie(bron => {
      let r = null, oud = null;
      for (const x of Object.values(bron)) {
        if (bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash, gezocht)) r = x;
        for (const t of (x && x.historie) || []) if (bearer.zelfdeHash(t && t.code_hash, gezocht)) oud = x;
      }
      if (!r && oud && oud.vervoerder === vervoerder)
        return { status: 409, error: 'Deze code is vervangen door een nieuwere; vraag de reiziger het kaartje opnieuw te tonen.' };
      if (!r || r.vervoerder !== vervoerder) return { status: 404, error: 'Dit vervoerbewijs kennen wij niet.' };
      const ow = (r.toegang && r.toegang.onderwerp) || {};
      if (ow.id !== r.id || ow.vervoerder !== vervoerder || ow.houder_hash !== r.houder_hash)
        return { status: 404, error: 'Dit vervoerbewijs kennen wij niet.' };
      const reden = bearer.reden(r.toegang, { doel: DOEL, scope: SCOPE });
      if (reden === 'opgebruikt') return { status: 409, error: 'Niet geldig: volledig gebruikt.', stand: 'gebruikt', id: r.id };
      if (reden === 'verlopen') return { status: 409, error: 'Niet geldig: deze code is verlopen.', stand: 'verlopen', id: r.id };
      if (reden) return { status: 409, error: 'Niet geldig: deze code is ingetrokken.', id: r.id };
      const fout = controleer(r.id);
      if (fout) return Object.assign({ id: r.id }, fout);
      bearer.gebruik(r.toegang);
      r.gebruik = r.toegang.gebruik;
      r.bijgewerkt_at = nu();
      return { status: 200, ok: true, id: r.id, gebruik: r.gebruik };
    });
  }

  // de route: het eigen kaartje (op id) tonen
  function toonVoor(session, body = {}) {
    ruimLegacy();
    const k = ctx.kaartMet(String((body && body.id) || '').slice(0, 40));
    return toon({ kaartje: k, key: session && session.key, stand: k ? ctx.kaartStand(k) : null });
  }

  return { kaartToonVoor: toonVoor, kaartToon: toon, kaartClaim: claim, kaartLegacyRuim: ruimLegacy,
    KAART_DOEL: DOEL, KAART_SCOPE: SCOPE };
};
