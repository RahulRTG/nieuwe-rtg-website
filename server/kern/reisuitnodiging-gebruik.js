/* Gebruikskant van de reisuitnodiging. Elke credentialbeslissing gebeurt in de
   reisUitnodigingen-transactie uit ./reisuitnodiging.js. */
'use strict';

const DUBBELTIK_MS = 5000;

module.exports = ({ transactie, vindCode, statusReden, publiek, bearer, invoer,
  idGeverifieerd, nu, crypto, DOEL, SCOPE, vasteAppBasis }) => {
  const fout = reden => ({ status: reden === 'onbekend' ? 404 : 409,
    error: reden === 'onbekend'
      ? 'Deze uitnodiging kennen we niet. Controleer de link.'
      : 'Deze uitnodiging is niet meer geldig. Vraag om een nieuwe.', reden });

  function open(code) {
    return transactie(bron => {
      const u = vindCode(bron, code);
      if (!u) return fout('onbekend');
      const reden = statusReden(u) || (u.claim
        ? (u.claim.status === 'voltooid' ? 'opgebruikt' : 'geclaimd') : null);
      /* Intrekking betekent ook intrekking van het beperkte voorbeeldbeeld.
         Anders blijft een verlopen of gelekte link bestemming/periode tonen. */
      if (reden) return fout(reden);
      const telling = {};
      for (const o of (u.onderdelen || [])) telling[o.soort] = (telling[o.soort] || 0) + 1;
      return { ok: true, uitnodiging: { soort: u.soort, bestemming: u.bestemming, venster: u.venster,
        aantal: u.onderdelen.length, soorten: telling,
        van: u.soort === 'klaargezet' ? 'het RTG-reisbureau' : (u.doorCodenaam || 'een RTG-lid'),
        geldigTot: u.toegang.expires_at, idNodig: u.soort === 'reisgenoot',
        open: true, reden: null } };
    });
  }

  function beginClaim(sess, code) {
    return transactie(bron => {
      const u = vindCode(bron, code);
      if (!u) return fout('onbekend');
      if (u.door === sess.key) return { status: 409, error: 'Dit is uw eigen uitnodiging; die is voor iemand anders bedoeld.' };
      if (u.soort === 'reisgenoot' && !(idGeverifieerd && idGeverifieerd(sess)))
        return { status: 403, error: 'Een medereiziger komt in de reisgegevens van iemand anders. Rond eerst de identiteitscontrole van uw account af.' };
      if (u.claim) {
        if (u.claim.key !== sess.key) return fout(u.claim.status === 'voltooid' ? 'opgebruikt' : 'geclaimd');
        if (u.claim.status === 'voltooid') return fout('opgebruikt');
        return { ok: true, hervat: true, id: u.id, uitnodiging: publiek(u, true) };
      }
      const reden = statusReden(u);
      if (reden) return fout(reden);
      bearer.gebruik(u.toegang);
      u.claim = { id: 'claim-' + crypto.randomBytes(8).toString('hex'), key: sess.key,
        status: 'bezig', at: nu() };
      return { ok: true, id: u.id, uitnodiging: publiek(u, true) };
    });
  }

  function voltooiClaim(id, sessKey, onderdelen) {
    return transactie(bron => {
      const u = bron[String(id || '')];
      if (!u || !u.claim || u.claim.key !== sessKey || u.claim.status !== 'bezig')
        return { status: 409, error: 'De uitnodiging kon niet veilig worden voltooid.' };
      u.claim.status = 'voltooid';
      u.claim.voltooid_at = nu();
      u.opgeeist = { key: sessKey, at: u.claim.voltooid_at, onderdelen: (onderdelen || []).map(x => x.id) };
      return { ok: true, bestemming: u.bestemming, venster: u.venster };
    });
  }

  async function eisOp(sess, code) {
    const claim = await Promise.resolve(beginClaim(sess, code));
    if (!claim || claim.error) return claim;
    const u = claim.uitnodiging;
    const herkomst = u.soort === 'reisgenoot' ? 'gedeeld' : null;
    const r = await Promise.resolve(invoer.neemOver(sess.key, {
      onderdelen: u.onderdelen, herkomst, uitnodigingId: claim.id,
      bron: u.soort === 'reisgenoot' ? ('gedeeld door ' + (u.doorCodenaam || 'een RTG-lid')) : 'klaargezet door het RTG-reisbureau'
    }));
    if (!r || r.error) return r || { status: 500, error: 'De reis kon niet veilig worden overgenomen.' };
    const klaar = await Promise.resolve(voltooiClaim(claim.id, sess.key, r.onderdelen));
    if (!klaar || klaar.error) return klaar;
    return { ok: true, overgenomen: r.onderdelen.length, onderdelen: r.onderdelen,
      bestemming: klaar.bestemming, venster: klaar.venster, hervat: !!claim.hervat || !!r.herhaald };
  }

  function trekIn(door, id, actor, redenTekst) {
    return transactie(bron => {
      const u = bron[String(id || '')];
      if (!u || u.door !== door) return { status: 404, error: 'Deze uitnodiging staat niet op uw naam.' };
      if (u.claim) return { status: 409, error: 'Deze uitnodiging is al geclaimd; intrekken kan niet meer.' };
      bearer.intrekken(u.toegang, actor || door, redenTekst || 'ingetrokken door uitgever');
      return { ok: true, uitnodiging: publiek(u) };
    });
  }

  function roteer(door, id, actor, idem) {
    const app = vasteAppBasis();
    if (!app.ok) return { status: 503, error: 'Reisuitnodigingen zijn tijdelijk niet veilig geconfigureerd.' };
    const idemWaarde = String(idem || '').trim().slice(0, 200);
    return transactie(bron => {
      const u = bron[String(id || '')];
      if (!u || u.door !== door) return { status: 404, error: 'Deze uitnodiging staat niet op uw naam.' };
      if (u.claim) return { status: 409, error: 'Een geclaimde uitnodiging kan niet worden geroteerd.' };
      const hash = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
      const idemHash = idemWaarde
        ? hash('reisuitnodiging-roteer-idem|' + door + '|' + idemWaarde) : null;
      const tikHash = hash('reisuitnodiging-roteer-dubbeltik|' + door + '|' + u.id);
      const laatst = u.laatste_rotatie;
      if (laatst && ((idemHash && laatst.idem_hash === idemHash) ||
          (!idemHash && laatst.dubbeltik_hash === tikHash &&
            Date.now() - Date.parse(laatst.at) >= 0 &&
            Date.now() - Date.parse(laatst.at) < DUBBELTIK_MS)))
        return { status: 409, herhaald: true,
          error: 'De nieuwe reislink is al eenmalig getoond en wordt niet herhaald.',
          uitnodiging: publiek(u) };
      bearer.intrekken(u.toegang, actor || door, 'geroteerd');
      u.code_historie = Array.isArray(u.code_historie) ? u.code_historie : [];
      u.code_historie.push({ code_hash: u.toegang.code_hash, ingetrokken_at: u.toegang.ingetrokken_at,
        rotatie: u.toegang.rotatie });
      const gemaakt = bearer.maak({ prefix: 'REIS', issuer: actor || door, doel: DOEL,
        scope: SCOPE, onderwerp: { soort: 'reisuitnodiging', id: u.id },
        geldigMs: 30 * 86400000, maxGebruik: 1 });
      gemaakt.toegang.rotatie = (u.toegang.rotatie || 1) + 1;
      u.toegang = gemaakt.toegang;
      u.laatste_rotatie = { idem_hash: idemHash,
        dubbeltik_hash: idemHash ? null : tikHash, at: nu() };
      return { ok: true, uitnodiging: publiek(u),
        link: app.basis + '/apps/reisuitnodiging.html#code=' + encodeURIComponent(gemaakt.code) };
    });
  }

  function lijst(door) {
    return transactie(bron => ({ ok: true, uitnodigingen: Object.values(bron)
      .filter(u => u.door === door)
      .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 100)
      .map(u => publiek(u)) }));
  }

  return { open, eisOp, trekIn, roteer, lijst };
};
