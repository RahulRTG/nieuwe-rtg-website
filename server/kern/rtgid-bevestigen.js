/* RTG iD, deel "bevestigen": de app-kant. De code opzoeken, bevestigen met een
   passkey, of weigeren.

   Derde afsplitsing van rtgid.js, om dezelfde reden als ./rtgid-regie.js en
   ./rtgid-claims.js: dat bestand ging door de 10 KB van keuringsregel 13, en
   die grens zegt dat er een tweede onderwerp in zit. De naad loopt hier waar
   routes/rtgid.js hem ook al trekt: de DIENST-kant (een inlog starten, de
   uitkomst ophalen) tegenover de APP-kant (het lid dat kijkt en beslist).

   HIER STAAT DE PASSKEY-EIS, en dat is de reden dat dit deel bestaat en niet in
   de route is opgelost. Bevestigen is de enige plek waar een identiteit de deur
   uit gaat; die plek draagt de eis. Zou hij in de route staan, dan hoort hij
   bij de deur en niet bij de handeling, en heeft de eerstvolgende die een
   tweede weg naar bevestigen bouwt (een scanknop, een sneltoets, een AI-actie)
   hem stilletjes niet.

   De gedeelde staat en helpers komen via het context-object binnen, zoals bij
   de andere twee delen. */

'use strict';

const { NIVEAUS, voldoet } = require('./betrouwbaarheid');

module.exports = (ctx) => {
  const { metStaat, toegang, nu, iso, cap, logVan, codenaamUit, accountVanKey,
    niveauVoor, stapOp, passkeysVan, MAX_LOG, MAX_SESSIES, SESSIE_TTL_MS } = ctx;

  /* ---- de app-kant: de code opzoeken, bevestigen of weigeren ---- */
  function koppelZoek(key, code) {
    return metStaat(s => {
      const k = toegang.zoekCode(s, code);
      if (k && k.status === 'wacht' && nu() > k.verloopt) {
        k.status = 'verlopen';
        toegang.sluitCode(k, 'rtgid', 'koppelcode verlopen');
      }
      if (!k || k.status !== 'wacht' || toegang.codeReden(k))
        return { status: 404, error: 'Geen wachtende inlog met die code; codes leven twee minuten.' };
      toegang.noteerKijker(k, key);
      const machtigingen = s.machtigingen.filter(m => m.naarKey === key && !m.ingetrokken && nu() <= m.tot)
        .map(m => ({ id: m.id, van: codenaamUit(m.vanKey), dienst: m.dienst }));
      const u = accountVanKey(key);
      const mijn = niveauVoor(key);
      return { status: 200, koppelId: k.id, dienst: k.dienst, attributen: k.attributen, machtigingen,
        passkeys: typeof passkeysVan === 'function' ? passkeysVan(u) : 0, eigenAccount: !!u,
        minBetrouwbaarheid: k.eis || null, betrouwbaarheid: mijn, haaltEis: voldoet(mijn, k.eis) };
    });
  }
  /* Bevestigen vraagt ALTIJD een passkey, en die eis staat HIER en niet in de
     route.

     Waarom hier: dit is de enige plek waar een iD-inlog wordt bevestigd. Zou de
     eis in routes/rtgid.js staan, dan draagt hij de deur en niet de handeling
     -- en de eerstvolgende die een tweede weg naar bevestigen bouwt (een
     scan-knop, een sneltoets, een AI-actie) heeft de eis stilletjes niet.

     Waarom een tik in de app niet genoeg was: die tik bewijst dat iemand het
     TOESTEL heeft waarop de sessie leeft. Een gestolen of geleende telefoon met
     een openstaande app kon dus een identiteit weggeven. De passkey bewijst de
     PERSOON, en de ceremonie is aan deze koppel gebonden (zie
     kern/webauthn.js), dus een assertie van elders past er niet op.

     Wat dit kost, en dat is bewust: een demo-persona of gast heeft geen eigen
     account en kan dus geen passkey maken. Die kan met RTG iD niet meer
     bevestigen, en krijgt dat met zoveel woorden te horen in plaats van een
     vage weigering. */
  async function bevestig(key, koppelId, machtigingId, bewijs) {
    const controle = s => {
      const k = s.koppels.find(x => x.id === String(koppelId || ''));
      if (!k || k.status !== 'wacht' || !toegang.gezienDoor(k, key))
        return { fout: { status: 404, error: 'Deze inlog wacht niet (meer).' } };
      if (nu() > k.verloopt || toegang.codeReden(k)) {
        k.status = 'verlopen';
        toegang.sluitCode(k, 'rtgid', 'koppelcode verlopen');
        return { fout: { status: 410, error: 'De code is verlopen; laat de dienst een nieuwe tonen.' } };
      }
      let voorKey = key, namens = null;
      if (machtigingId) {
        const m = s.machtigingen.find(x => x.id === String(machtigingId));
        if (!m || m.naarKey !== key || m.ingetrokken || nu() > m.tot)
          return { fout: { status: 403, error: 'Deze machtiging is niet (meer) geldig.' } };
        if (m.dienst !== k.dienst)
          return { fout: { status: 403, error: 'Deze machtiging geldt voor ' + m.dienst + ', niet voor ' + k.dienst + '.' } };
        voorKey = m.vanKey;
        namens = codenaamUit(key);
      }
      return { k, voorKey, namens };
    };
    const vooraf = await metStaat(s => {
      const c = controle(s);
      return c.fout ? c : { k: { id: c.k.id, dienst: c.k.dienst, eis: c.k.eis },
        voorKey: c.voorKey, namens: c.namens };
    });
    if (vooraf.fout) return vooraf.fout;
    /* De passkey van wie er STAAT, niet van wie hij vertegenwoordigt: bij een
       machtiging tekent de gemachtigde met zijn eigen sleutel. Anders zou een
       machtiging betekenen dat iemand met de biometrie van een ander bevestigt,
       en dat kan niet bestaan. */
    /* Het niveau van wie er GEDEELD wordt, niet van wie er staat: bij een
       machtiging vraagt de dienst zekerheid over de persoon wiens identiteit
       hij krijgt. En deze controle staat VOOR de passkey, want om iemands
       gezicht vragen voor een bevestiging die toch afvalt, is onbeleefd. */
    if (vooraf.k.eis) {
      const n = niveauVoor(vooraf.voorKey);
      if (!voldoet(n, vooraf.k.eis)) {
        const eisNaam = (NIVEAUS.find(x => x.id === vooraf.k.eis) || {}).naam || vooraf.k.eis;
        return { status: 403, error: vooraf.k.dienst + ' vraagt betrouwbaarheidsniveau ' + vooraf.k.eis + ' (' + eisNaam +
          ')' + (vooraf.namens ? ' voor de persoon namens wie u inlogt' : '') + '; u staat op ' + n.id + ' (' + n.naam + ').' };
      }
    }
    const ik = accountVanKey(key);
    if (!ik) return { status: 403, error: 'Bevestigen met RTG iD vraagt een passkey, en die hoort bij een eigen RTG-account. Een demo-persona of gast heeft er geen.' };
    if (typeof stapOp !== 'function') return { status: 500, error: 'De passkey-controle is niet aangesloten; bevestigen kan nu niet.' };
    const bewijsUit = await stapOp({ user: ik, doel: vooraf.k.id, bewijs: bewijs || {} });
    if (!bewijsUit || bewijsUit.error) return bewijsUit || { status: 401, error: 'De passkey kon niet worden geverifieerd.' };
    /* De koppel kan tijdens de ceremonie zijn verlopen of door een tweede
       tabblad zijn afgehandeld; na een await is de eerdere controle een
       momentopname van daarnet. */
    return metStaat(s => {
      const c = controle(s);
      if (c.fout) return c.fout.status === 404
        ? { status: 409, error: 'Deze inlog is inmiddels afgehandeld.' } : c.fout;
      if (c.k.eis) {
        const n = niveauVoor(c.voorKey);
        if (!voldoet(n, c.k.eis)) return { status: 403,
          error: 'Het vereiste betrouwbaarheidsniveau is tijdens het bevestigen gewijzigd.' };
      }
      if (toegang.statusReden(c.k) || !toegang.gebruikCode(c.k, key))
        return { status: 409, error: 'Deze inlog is inmiddels afgehandeld.' };
      const sess = { tokenHash: c.k.status_toegang.code_hash, dienst: c.k.dienst,
        memberKey: c.voorKey, attributen: c.k.attributen,
        namens: c.namens, machtigingId: machtigingId ? String(machtigingId) : null,
        gemaakt: iso(), verloopt: nu() + SESSIE_TTL_MS, ingetrokken: false };
      s.sessies.unshift(sess);
      cap(s.sessies, MAX_SESSIES);
      c.k.status = 'bevestigd';
      c.k.bevestigd_at = iso();
      c.k.bevestigd_lid_hash = toegang.kijkerHash(key);
      const log = logVan(c.voorKey, s);
      log.unshift({ om: iso(), dienst: c.k.dienst, attributen: c.k.attributen, met: 'passkey',
        soort: c.namens ? 'inlog door gemachtigde ' + c.namens : 'inlog' });
      cap(log, MAX_LOG);
      return { status: 200, ok: true, dienst: c.k.dienst, namens: c.namens || undefined };
    });
  }
  function weiger(key, koppelId) {
    return metStaat(s => {
      const k = s.koppels.find(x => x.id === String(koppelId || ''));
      if (!k || k.status !== 'wacht' || !toegang.gezienDoor(k, key))
        return { status: 404, error: 'Deze inlog wacht niet (meer).' };
      k.status = 'geweigerd';
      k.geweigerd_at = iso();
      toegang.sluitCode(k, toegang.kijkerHash(key), 'lid heeft koppeling geweigerd');
      return { status: 200, ok: true };
    });
  }

  return { koppelZoek, bevestig, weiger };
};
