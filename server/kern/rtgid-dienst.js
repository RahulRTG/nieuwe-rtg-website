/* RTG-iD aan de kant van de vragende dienst: een koppeling uitgeven, de
   uitkomst ophalen en binnen een bevestigde sessie precies de toegestane
   attributen lezen. Alle staatsovergangen lopen door het rtgid-collectieslot. */
'use strict';

const { canoniek } = require('../lib/dubbeltik');
const { bestaat } = require('./betrouwbaarheid');

module.exports = (ctx) => {
  const { metStaat, nu, iso, crypto, schoon, toegang, magVragen, attributenVoor,
    logVan, cap, MAX_LOG, MAX_KOPPELS } = ctx;
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const veiligGelijk = (a, b) => {
    if (!/^[a-f0-9]{64}$/i.test(String(a || '')) || !/^[a-f0-9]{64}$/i.test(String(b || ''))) return false;
    return crypto.timingSafeEqual(Buffer.from(String(a), 'hex'), Buffer.from(String(b), 'hex'));
  };
  const idemVan = b => {
    const s = String((b && (b.idem || b.idempotentieSleutel)) || '').trim();
    return s.length >= 16 && s.length <= 200 ? s : null;
  };

  function start(b, bron) {
    b = b || {};
    const dienst = schoon(b.dienst, 60);
    if (!dienst) return { status: 400, error: 'Welke dienst vraagt de inlog?' };
    const idem = idemVan(b);
    if (!idem) return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om een RTG-iD-inlog te starten.' };
    const gevraagd = (Array.isArray(b.attributen) ? b.attributen : []).filter(magVragen);
    if (!gevraagd.length) gevraagd.push('codenaam');
    const eis = b.minBetrouwbaarheid ? String(b.minBetrouwbaarheid) : null;
    if (eis && !bestaat(eis)) return { status: 400, error: 'Onbekend betrouwbaarheidsniveau: ' + eis + '.' };
    const actor = afdruk('rtgid-uitgever-v1|' + String(bron || 'onbekend'));
    const idemHash = afdruk('rtgid-start-v1|' + actor + '|' + idem);
    const fingerprint = afdruk('rtgid-start-invoer-v1|' + canoniek({ dienst, attributen: gevraagd, eis }));
    return metStaat(s => {
      const al = s.koppels.find(k => k && k.uitgifte && veiligGelijk(k.uitgifte.idem_hash, idemHash));
      if (al) return veiligGelijk(al.uitgifte.fingerprint_hash, fingerprint)
        ? { status: 409, herhaald: true,
          error: 'Deze koppeling is al gestart; de eenmalige credentials worden niet herhaald. Start met een nieuwe sleutel.' }
        : { status: 409, error: 'Deze idempotentiesleutel hoort al bij een andere RTG-iD-vraag.' };
      const gemaakt = toegang.nieuw(s, { dienst, attributen: gevraagd, eis,
        uitgifte: { idem_hash: idemHash, fingerprint_hash: fingerprint, issuer_hash: actor, at: iso() } });
      s.koppels.unshift(gemaakt.koppel);
      cap(s.koppels, MAX_KOPPELS);
      return { status: 200, koppelId: gemaakt.statusToken, code: gemaakt.code,
        eenmalig: true, dienst, attributen: gevraagd, minBetrouwbaarheid: eis,
        verloopt: iso(gemaakt.koppel.verloopt) };
    });
  }

  function statusVan(statusToken) {
    const kale = String(statusToken || '').trim();
    if (!kale) return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
    return metStaat(s => {
      const k = toegang.zoekStatus(s, kale);
      if (!k || toegang.statusReden(k) || !toegang.gebruikStatus(k))
        return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
      if (k.status === 'wacht' && nu() > k.verloopt) {
        k.status = 'verlopen';
        toegang.sluitCode(k, 'rtgid', 'koppelcode verlopen');
      }
      const uit = { status: 200, stand: k.status, dienst: k.dienst };
      /* De dienst bezit deze kale statuscredential al. Na bevestiging wordt
         exact die waarde het id-token; er hoeft dus nooit een tweede kale
         credential in de database te wachten op aflevering. */
      if (k.status === 'bevestigd' && !k.token_opgehaald_at) {
        uit.idToken = kale;
        k.token_opgehaald_at = iso();
      }
      return uit;
    });
  }

  function roteer(statusToken, idem, bron) {
    const kale = String(statusToken || '').trim();
    const sleutel = String(idem || '').trim();
    if (!kale) return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
    if (sleutel.length < 16 || sleutel.length > 200)
      return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om RTG-iD-credentials te roteren.' };
    const actor = afdruk('rtgid-uitgever-v1|' + String(bron || 'onbekend'));
    const idemHash = afdruk('rtgid-roteer-v1|' + actor + '|' + sleutel);
    return metStaat(s => {
      const k = toegang.zoekStatusOoit(s, kale);
      if (!k) return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
      if (k.laatste_rotatie && veiligGelijk(k.laatste_rotatie.idem_hash, idemHash))
        return { status: 409, herhaald: true,
          error: 'De nieuwe credentials zijn al eenmalig getoond en worden niet herhaald. Roteer opnieuw met een nieuwe sleutel.' };
      if (toegang.zoekStatus(s, kale) !== k || toegang.statusReden(k) || k.status !== 'wacht')
        return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
      const gemaakt = toegang.roteer(s, k, k.dienst,
        { idem_hash: idemHash, issuer_hash: actor, at: iso() });
      return { status: 200, koppelId: gemaakt.statusToken, code: gemaakt.code,
        eenmalig: true, dienst: k.dienst, attributen: k.attributen,
        minBetrouwbaarheid: k.eis || null, verloopt: iso(k.verloopt) };
    });
  }

  function annuleer(statusToken, idem, bron) {
    const kale = String(statusToken || '').trim();
    const sleutel = String(idem || '').trim();
    if (!kale) return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
    if (sleutel.length < 16 || sleutel.length > 200)
      return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om een RTG-iD-inlog te annuleren.' };
    const actor = afdruk('rtgid-uitgever-v1|' + String(bron || 'onbekend'));
    const idemHash = afdruk('rtgid-annuleer-v1|' + actor + '|' + sleutel);
    return metStaat(s => {
      const k = toegang.zoekStatus(s, kale);
      if (!k) return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
      if (k.annulering && veiligGelijk(k.annulering.idem_hash, idemHash))
        return { status: 200, ok: true, herhaald: true };
      if (toegang.statusReden(k) || k.status !== 'wacht')
        return { status: 404, error: 'Deze inlog bestaat niet of is niet meer geldig.' };
      k.status = 'geannuleerd';
      k.annulering = { idem_hash: idemHash, issuer_hash: actor, at: iso() };
      toegang.trekAllesIn(k, 'rtgid-dienst', 'dienst heeft koppeling geannuleerd');
      return { status: 200, ok: true };
    });
  }

  function wie(idToken) {
    const kale = String(idToken || '');
    const modern = toegang.statusHash(kale);
    const legacy = afdruk(kale);
    return metStaat(s => {
      let sess = null;
      for (const rij of s.sessies) {
        if (veiligGelijk(rij && rij.tokenHash, modern) || veiligGelijk(rij && rij.tokenHash, legacy)) sess = rij;
      }
      if (!sess || sess.ingetrokken || nu() > sess.verloopt)
        return { status: 403, error: 'Deze iD-sessie is niet (meer) geldig.' };
      sess.opgehaald = (sess.opgehaald || 0) + 1;
      if (sess.opgehaald === 2) {
        const log = logVan(sess.memberKey, s);
        log.unshift({ om: iso(), dienst: sess.dienst, attributen: sess.attributen,
          soort: 'haalde uw gegevens opnieuw op binnen dezelfde inlog' });
        cap(log, MAX_LOG);
      }
      return { status: 200, dienst: sess.dienst,
        attributen: attributenVoor(sess.memberKey, sess.attributen),
        namens: sess.namens || undefined, verloopt: iso(sess.verloopt), opgehaald: sess.opgehaald };
    });
  }

  return { start, statusVan, roteer, annuleer, wie };
};
