/* Een Salon-aanbieding geeft een lid een bearer aan de kassa. De oude vorm
   was 24 bits en stond kaal in `posts`. Deze kern serialiseert uitgifte,
   rotatie, intrekking en verzilvering in de autoritatieve posts-collectie. */
'use strict';

const { canoniek } = require('../lib/dubbeltik');

module.exports = ({ db, save, bewerkCollectie, crypto, nu = () => Date.now() }) => {
  const t = require('./salon-claimtoegang')({ crypto, nu });
  const { iso, bearer, afdruk, gelijk, lidHash, rijen, claims, historie, idem,
    aanbiedingGeldig, onderwerpKlopt, vindPost, vindVanLid, maakToegang,
    stand, publiek, migreerLegacy, DOEL, SCOPE } = t;

  function metPosts(werk) {
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('posts', bron => {
      const posts = rijen(bron), gemigreerd = migreerLegacy(posts);
      return werk(posts, gemigreerd);
    });
    const oud = db.data.posts;
    const concept = JSON.parse(JSON.stringify(rijen(oud)));
    const gemigreerd = migreerLegacy(concept);
    let antwoord;
    try {
      antwoord = werk(concept, gemigreerd);
      if (antwoord && typeof antwoord.then === 'function')
        throw new Error('Een Salon-claimtransactie mag niet asynchroon zijn.');
      db.data.posts = concept; save();
    } catch (e) { db.data.posts = oud; throw e; }
    return antwoord;
  }

  function uitgeven({ postId, key, codename, idempotentieSleutel }) {
    const sleutel = idem(idempotentieSleutel);
    if (!sleutel) return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om de aanbieding te claimen.' };
    const idemHash = afdruk('salon-claim-uitgifte-v1|' + lidHash(key) + '|' + sleutel);
    const fingerprint = afdruk('salon-claim-uitgifte-invoer-v1|' + canoniek({ postId: Number(postId) }));
    return metPosts(posts => {
      const p = vindPost(posts, postId);
      if (!p || !p.deal) return { status: 404, error: 'Aanbieding niet gevonden.' };
      if (!aanbiedingGeldig(p)) return { status: 410, error: 'Deze aanbieding is verlopen.' };
      const al = vindVanLid(p, key);
      if (al) {
        const zelfde = al.uitgifte && gelijk(al.uitgifte.idem_hash, idemHash);
        if (zelfde && !gelijk(al.uitgifte.fingerprint_hash, fingerprint))
          return { status: 409, error: 'Deze idempotentiesleutel hoort bij een andere aanbieding.' };
        return { status: 409, herhaald: !!zelfde, alGeclaimd: true,
          claim: publiek(p, al), error: 'Deze aanbieding is al geclaimd. Een eenmalige code wordt nooit opnieuw getoond; roteer haar als u een nieuwe nodig heeft.' };
      }
      const c = { id: null, key, codename: String(codename || '').slice(0, 80),
        at: iso(), status: 'actief', toegang: null, historie: [],
        uitgifte: { idem_hash: idemHash, fingerprint_hash: fingerprint, at: iso() } };
      const gemaakt = maakToegang(posts, p, c);
      c.toegang = gemaakt.toegang;
      if (!Array.isArray(p.deal.claims)) p.deal.claims = [];
      p.deal.claims.push(c);
      return { status: 200, ok: true, code: gemaakt.code, eenmalig: true,
        claim: publiek(p, c), partnerCode: p.partnerCode,
        titel: p.deal.titel, aantal: p.deal.claims.length };
    });
  }

  function roteer({ postId, key, idempotentieSleutel }) {
    const sleutel = idem(idempotentieSleutel);
    if (!sleutel) return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om de claimcode te roteren.' };
    const idemHash = afdruk('salon-claim-rotatie-v1|' + lidHash(key) + '|' + sleutel);
    return metPosts(posts => {
      const p = vindPost(posts, postId), c = p && p.deal ? vindVanLid(p, key) : null;
      if (!p || !c) return { status: 404, error: 'Claim niet gevonden.' };
      if (!aanbiedingGeldig(p)) return { status: 410, error: 'Deze aanbieding is verlopen.' };
      if (c.laatste_rotatie && gelijk(c.laatste_rotatie.idem_hash, idemHash))
        return { status: 409, herhaald: true, error: 'De nieuwe code is al eenmalig getoond en wordt niet herhaald.' };
      if (stand(p, c) === 'verzilverd') return { status: 409, error: 'Een verzilverde claim kan niet worden geroteerd.' };
      if (!c.toegang || !onderwerpKlopt(p, c)) return { status: 409, error: 'Deze oude claim is veilig gesloten.' };
      bearer.intrekken(c.toegang, lidHash(key), 'claimcode geroteerd');
      c.historie = historie(c); c.historie.push(c.toegang);
      if (c.historie.length > 12) c.historie.splice(0, c.historie.length - 12);
      c.toegang = null;
      const gemaakt = maakToegang(posts, p, c);
      gemaakt.toegang.rotatie = Math.max(1, Number(c.historie.at(-1).rotatie) || 1) + 1;
      c.toegang = gemaakt.toegang; c.status = 'actief';
      c.laatste_rotatie = { idem_hash: idemHash, at: iso() };
      return { status: 200, ok: true, code: gemaakt.code, eenmalig: true, claim: publiek(p, c) };
    });
  }

  function intrekken({ postId, key, idempotentieSleutel }) {
    const sleutel = idem(idempotentieSleutel);
    if (!sleutel) return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om de claimcode in te trekken.' };
    const idemHash = afdruk('salon-claim-intrek-v1|' + lidHash(key) + '|' + sleutel);
    return metPosts(posts => {
      const p = vindPost(posts, postId), c = p && p.deal ? vindVanLid(p, key) : null;
      if (!p || !c) return { status: 404, error: 'Claim niet gevonden.' };
      if (c.intrekking && gelijk(c.intrekking.idem_hash, idemHash))
        return { status: 200, ok: true, herhaald: true, claim: publiek(p, c) };
      if (stand(p, c) === 'verzilverd') return { status: 409, error: 'Deze claim is al verzilverd.' };
      if (!c.toegang || !onderwerpKlopt(p, c)) return { status: 409, error: 'Deze oude claim is veilig gesloten.' };
      bearer.intrekken(c.toegang, lidHash(key), 'lid heeft claimcode ingetrokken');
      c.status = 'ingetrokken'; c.intrekking = { idem_hash: idemHash, at: iso() };
      return { status: 200, ok: true, claim: publiek(p, c) };
    });
  }

  function verzilver({ code, partnerCode, actor, idempotentieSleutel }) {
    const kale = String(code || '').trim().toUpperCase().slice(0, 80);
    const sleutel = idem(idempotentieSleutel);
    if (!sleutel) return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om de claimcode te verzilveren.' };
    const codeHash = bearer.hash(kale);
    const actorHash = afdruk('salon-kassa-v1|' + String(partnerCode || '') + '|' + String(actor || ''));
    const idemHash = afdruk('salon-claim-verzilver-v1|' + actorHash + '|' + sleutel);
    const fingerprint = afdruk('salon-claim-verzilver-invoer-v1|' + codeHash);
    return metPosts(posts => {
      let gevonden = null, post = null, idemBotsing = null;
      for (const p of posts) for (const c of claims(p)) {
        const zelfde = gelijk(c && c.toegang && c.toegang.code_hash, codeHash);
        for (const oud of historie(c)) gelijk(oud && oud.code_hash, codeHash);
        if (zelfde && p.partnerCode === partnerCode) { gevonden = c; post = p; }
        if (c && c.verzilvering && gelijk(c.verzilvering.idem_hash, idemHash)) idemBotsing = { c, p };
      }
      if (idemBotsing) {
        if (!gelijk(idemBotsing.c.verzilvering.fingerprint_hash, fingerprint))
          return { status: 409, error: 'Deze idempotentiesleutel hoort bij een andere claimcode.' };
        return { status: 200, ok: true, herhaald: true,
          titel: idemBotsing.p.deal.titel, codename: idemBotsing.c.codename };
      }
      if (!gevonden || !post || !onderwerpKlopt(post, gevonden))
        return { status: 404, error: 'Deze code kennen we hier niet.' };
      const reden = bearer.reden(gevonden.toegang, { doel: DOEL, scope: SCOPE });
      if (reden === 'opgebruikt' || gevonden.verzilvering)
        return { status: 409, error: 'Deze code is al verzilverd.' };
      if (reden) return { status: 404, error: 'Deze code kennen we hier niet.' };
      if (!aanbiedingGeldig(post)) return { status: 410, error: 'Deze aanbieding is verlopen.' };
      bearer.gebruik(gevonden.toegang); gevonden.status = 'verzilverd';
      gevonden.verzilvering = { idem_hash: idemHash, fingerprint_hash: fingerprint,
        actor_hash: actorHash, at: iso() };
      return { status: 200, ok: true, titel: post.deal.titel,
        codename: gevonden.codename, partnerCode: post.partnerCode };
    });
  }

  /* Bij een upgrade mogen oude kale codes niet blijven wachten tot iemand de
     bijbehorende aanbieding toevallig opent. De startup roept dit na het laden
     van de autoritatieve opslag aan; dezelfde collectietransactie die de
     routes gebruiken maakt de omzetting duurzaam en veilig herhaalbaar. */
  function migreerAlles() {
    return metPosts((_posts, gewijzigd) => ({ gewijzigd }));
  }

  return { uitgeven, roteer, intrekken, verzilver, vindVanLid, publiek,
    migreerAlles, migreerLegacy, lidHash, DOEL };
};
