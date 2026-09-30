/* RTG Link: DE BAK VAN DE CAPABILITY-DRAGER (credential link.capability_aanvaarden,
   besluit B15 van de eigenaar, 29 september 2026).

   Tot die dag: 72 bits, kaal als sleutel in een Map in het procesgeheugen.
   Nu, volgens het releasebeleid in CODECREDENTIALS.json:
   - 128 bits (../bearercode.js), zonder prefix: de dyncode-envelop haalt
     punten weg, en zo past het geheim ongeschonden in het ondertekende token;
   - in de opslag alleen `toegang.code_hash`; zoeken loopt ALLE rijen af met
     timingSafeEqual (bearer.vind);
   - issuer (`rtg.link.<rol van de uitgever>`), doel `link.capability`, scope de
     handeling, onderwerp de uitgever die hem maakte; minuten geldig (de ttl
     van de handeling, nooit boven de vijf minuten van de ondertekenaar);
   - elke overgang in EEN collectietransactie (PostgreSQL: advisory lock plus
     FOR UPDATE): claimen, afronden, teruggeven, intrekken.

   DE OPDRACHT IS VERSLEUTELD MET DE CODE ZELF. Een opdracht kan een ander
   geheim dragen (de kascode onder geld.kassa). Die staat daarom niet kaal in
   de opslag maar in AES-256-GCM onder een sleutel die uit de kale code wordt
   afgeleid -- en die code staat nergens op schijf. Leesbaar blijft alleen de
   beschrijving (wat, bedrag, waarom) voor "mijn koppelingen"; geen geheim.

   DE BEZEM: tien minuten na het verval gaat een rij weg bij de volgende
   uitgifte (een lopende claim pas na een dag: die hoort afgemaakt te worden).

   OUDE DRAGERS (72 bits, in het geheugen van een proces dat niet meer draait)
   openen niets: hun verwijzing heeft de vorm niet en staat in geen hash. */
'use strict';

const COL = 'linkCapToegang';
const DOEL = 'link.capability';
const VORM = /^[0-9A-F]{32}$/;
const LEASE_MS = 60000;
const BEWAAR_MS = 10 * 60000;
const CLAIM_BEWAAR_MS = 86400000;

module.exports = ({ db, crypto, bewerkCollectie, nu }) => {
  const klok = typeof nu === 'function' ? nu : () => Date.now();
  const iso = (ms) => new Date(ms == null ? klok() : ms).toISOString();
  let _b = null;
  const bearer = () => _b || (_b = require('../bearercode')({ crypto, namespace: DOEL, nu: () => iso() }));
  const kaal = (c) => String(c == null ? '' : c).trim().toUpperCase();
  const vormKlopt = (c) => VORM.test(kaal(c));
  const kopie = (v) => JSON.parse(JSON.stringify(v));

  /* Fail-closed: zonder collectietransactie geen drager (pas bij gebruik). */
  function transactie(werk) {
    if (typeof bewerkCollectie !== 'function') throw new Error(COL + ' vraagt een collectietransactie.');
    return bewerkCollectie(COL, (bron) => {
      if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error(COL + ' hoort een kaart te zijn');
      return werk(bron);
    });
  }
  let _e = null;
  const kijk = () => (_e || (_e = require('../eigencollectie')({ db, domein: 'kern/link/cap-bak',
    bezit: { linkCapToegang: 'kaart' } }))).kijk(COL);

  const sleutel = (code) => crypto.createHash('sha256').update('rtg-linkcap-inhoud-v1|' + kaal(code)).digest();
  function sluit(code, id, waarde) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', sleutel(code), iv);
    c.setAAD(Buffer.from(id));
    const data = Buffer.concat([c.update(JSON.stringify(waarde), 'utf8'), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
  }
  function open(code, rij) {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', sleutel(code), Buffer.from(rij.inhoud.iv, 'base64'));
      d.setAAD(Buffer.from(rij.id));
      d.setAuthTag(Buffer.from(rij.inhoud.tag, 'base64'));
      return JSON.parse(Buffer.concat([d.update(Buffer.from(rij.inhoud.data, 'base64')), d.final()]).toString('utf8'));
    } catch (e) { return null; }
  }

  const zoek = (bron, code) => vormKlopt(code)
    ? bearer().vind(Object.values(bron), kaal(code), r => r && r.toegang && r.toegang.code_hash) : null;
  const reden = (r) => bearer().reden(r && r.toegang, { doel: DOEL, scope: [r && r.handeling] });
  const leeft = (r) => !!r && r.stand === 'open' && !reden(r);

  function ruim(bron) {
    const t = klok();
    for (const [id, r] of Object.entries(bron)) {
      const tot = Date.parse(r && r.toegang && r.toegang.expires_at);
      const marge = r && r.stand === 'claimend' ? CLAIM_BEWAAR_MS : BEWAAR_MS;
      if (!r || !Number.isFinite(tot) || tot + marge < t) delete bron[id];
    }
  }

  /* Uitgeven. De kale code gaat EEN keer terug, naar de dyncode-envelop van de
     uitgever; hier blijft de hash en de versleutelde opdracht. */
  function uitgeven({ handeling, ttlMs, eenmalig, uitgever, opdracht, beschrijving }) {
    return transactie(bron => {
      ruim(bron);
      const id = crypto.randomBytes(9).toString('base64url');
      const g = bearer().maak({ issuer: 'rtg.link.' + uitgever.soort, doel: DOEL, scope: [handeling],
        onderwerp: { uitgeverId: uitgever.id, soort: uitgever.soort }, geldigMs: ttlMs,
        maxGebruik: eenmalig ? 1 : 10000 });
      bron[id] = { id, handeling, toegang: g.toegang, uitgeverId: uitgever.id, uitgeverKey: uitgever.key || null,
        uitgeverSoort: uitgever.soort, beschrijving: kopie(beschrijving || {}), inhoud: sluit(g.code, id, opdracht),
        stand: 'open', claim: null, bijgewerkt_at: iso() };
      return { code: g.code, id, vervalt: Date.parse(g.toegang.expires_at) };
    });
  }

  /* Opzoeken zonder te consumeren: een smalle rij (geen hash, geen inhoud) en de
     ontsleutelde opdracht. Een lopende claim telt als "weg" voor wie kijkt. */
  const smal = (r, opdracht) => ({ id: r.id, handeling: r.handeling, uitgeverId: r.uitgeverId,
    uitgeverKey: r.uitgeverKey, beschrijving: kopie(r.beschrijving || {}),
    vervalt: Date.parse(r.toegang.expires_at), opdracht });
  function haal(code) {
    return transactie(bron => {
      const r = zoek(bron, code);
      const opdracht = leeft(r) ? open(code, r) : null;
      return opdracht ? smal(r, opdracht) : null;
    });
  }

  /* DE CLAIM: eenmalig en atomair. Dezelfde aanvaarder mag een claim hervatten
     na zijn lease (een crash midden in de handeling); iemand anders krijgt
     `weg`. De invoer wordt bij de claim BEVROREN en bij een hervatting
     hergebruikt, zodat een tweede poging niet stil een ander bedrag doet. */
  function claim(code, { door, invoer, alleenHervat }) {
    return transactie(bron => {
      const r = zoek(bron, code);
      const opdracht = r ? open(code, r) : null;
      if (!r || !opdracht) return { fout: 'weg' };
      if (r.stand === 'claimend' && r.claim) {
        if (r.claim.door !== door) return { fout: 'weg' };
        if (Date.parse(r.claim.lease_tot) > klok()) return { fout: 'bezig' };
        r.claim.lease_tot = iso(klok() + LEASE_MS); r.bijgewerkt_at = iso();
        return Object.assign(smal(r, opdracht), { claimId: r.claim.id, invoer: kopie(r.claim.invoer), hervat: true });
      }
      if (alleenHervat || !leeft(r)) return { fout: 'weg' };
      if (r.uitgeverId === door) return { fout: 'eigen' };
      bearer().gebruik(r.toegang);
      r.stand = 'claimend';
      r.claim = { id: crypto.randomBytes(8).toString('hex'), door, invoer: invoer == null ? null : kopie(invoer),
        at: iso(), lease_tot: iso(klok() + LEASE_MS) };
      r.bijgewerkt_at = iso();
      return Object.assign(smal(r, opdracht), { claimId: r.claim.id, invoer: kopie(r.claim.invoer), hervat: false });
    });
  }
  const opClaim = (c, werk) => transactie(bron => {
    const r = bron[c.id];
    if (!r || r.stand !== 'claimend' || !r.claim || r.claim.id !== c.claimId) return false;
    werk(r); r.bijgewerkt_at = iso();
    return true;
  });
  /* Gelukt: eenmalig is op (gebruik blijft 1); herbruikbaar gaat weer open. */
  const afronden = (c, eenmalig) => opClaim(c, r => { r.stand = eenmalig ? 'gebruikt' : 'open'; r.claim = null; });
  /* Geweigerd door het domein (4xx): de code gaat terug, zoals een kassa met te
     weinig saldo nooit een code verbrandde. */
  const teruggeven = (c) => opClaim(c, r => { r.stand = 'open'; r.claim = null; r.toegang.gebruik = Math.max(0, r.toegang.gebruik - 1); });

  /* Intrekken zolang ongebruikt: alleen een OPEN code, alleen door de uitgever. */
  function intrekken({ code, id, door }) {
    return transactie(bron => {
      const r = id ? bron[String(id)] : zoek(bron, code);
      if (!leeft(r)) return { fout: 'weg' };
      if (!door || r.uitgeverId !== door) return { fout: 'niet-van-u' };
      bearer().intrekken(r.toegang, door, 'ingetrokken door de uitgever');
      r.stand = 'ingetrokken'; r.bijgewerkt_at = iso();
      return { ok: true };
    });
  }

  /* Wat er van deze uitgever nog openstaat (voor "mijn koppelingen"): uit de
     lokale werkkopie, zonder inhoud en zonder hash. */
  const openVan = (wie) => Object.values(kijk()).filter(r => r && r.uitgeverId === wie && leeft(r))
    .map(r => ({ id: r.id, handeling: r.handeling, uitgeverKey: r.uitgeverKey, beschrijving: r.beschrijving,
      vervalt: Date.parse(r.toegang.expires_at) }));
  const aantalOpen = () => Object.values(kijk()).filter(leeft).length;

  return { COL, DOEL, LEASE_MS, vormKlopt, uitgeven, haal, claim, afronden, teruggeven, intrekken, openVan, aantalOpen };
};

module.exports.COL = COL;
module.exports.DOEL = DOEL;
module.exports.LEASE_MS = LEASE_MS;
