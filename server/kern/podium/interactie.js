/* RTG Podium, deelbestand "interactie": de zaal. De kanaalchat, de cadeautjes (vaste
   bescheiden stappen via RTG Pay, geen vrij veld dus geen opjaagmechaniek), het
   maandabonnement, en de veiligheid in de zaal (blokkeren gooit de kijker er direct
   uit, en melden bij RTG-kantoor). Krijgt de gedeelde ctx van kern/podium/index.js. */
module.exports = (ctx) => {
  const { db, save, schoon, id, nu, mag, lijsten, kanaalMet, isAbonnee, stuurRond, metIdem,
    codenaamVan, sseToCustomer, sseToOffice, pay, herstelBoom, CADEAUS, CHAT_MAX, ABB_DAGEN,
    zones, poort } = ctx;

  function chat(key, kid, tekst) {
    const k = kanaalMet(kid); if (!k || !k.live) return { status: 409, error: 'Dit kanaal is nu niet live.' };
    const m = poort.magKanaal(key, k); if (!m.ok) return { status: 403, error: m.reden };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    if (k.key !== key && !(k.kijkers || {})[key]) return { status: 403, error: 'Kijk eerst mee met dit kanaal.' };
    tekst = schoon(tekst, 300); if (!tekst) return { status: 400, error: 'Leeg bericht.' };
    const regel = { van: key, codenaam: codenaamVan(key), tekst, abonnee: isAbonnee(k, key), maker: k.key === key, at: nu() };
    const lijst = db.data.podiumChat[k.id] = db.data.podiumChat[k.id] || [];
    lijst.push(regel); if (lijst.length > CHAT_MAX) db.data.podiumChat[k.id] = lijst.slice(-CHAT_MAX);
    save(); stuurRond(k, { kind: 'chat', kanaalId: k.id, regel });
    return { status: 200, ok: true, regel };
  }
  async function cadeau(key, kid, cadeauId, idem) {
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    const m = poort.magKanaal(key, k); if (!m.ok) return { status: 403, error: m.reden };
    /* Niet elke wereld neemt fooien aan. Een town hall of een training hoort
       geen cadeautjes te kennen; dat staat in de zonetabel en wordt hier
       gevraagd, zodat de regel in de code zit en niet in een tekst. */
    if (!poort.geldMag(k, 'cadeau')) return { status: 409, error: 'In deze zone gaan geen cadeaus.' };
    if (k.key === key) return { status: 400, error: 'Uzelf een cadeau geven kan niet.' };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    const c = CADEAUS.find(x => x.id === cadeauId); if (!c) return { status: 400, error: 'Onbekend cadeau.' };
    return metIdem(k, idem ? 'c:' + key + ':' + idem : null, async () => {
      const r = await pay.stuur({ van: codenaamVan(key), aanCodenaam: codenaamVan(k.key), centen: c.centen,
        oms: 'Podium · ' + c.naam + ' voor ' + k.naam, idem: idem ? 'podium:' + idem : undefined, soort: 'podium' });
      if (r.error) return { status: r.status || 400, error: r.error };
      k.verdiend = Math.round((k.verdiend || 0) + c.centen);
      const regel = { van: key, codenaam: codenaamVan(key), cadeau: { id: c.id, naam: c.naam, icoon: c.icoon, centen: c.centen }, abonnee: isAbonnee(k, key), at: nu() };
      const lijst = db.data.podiumChat[k.id] = db.data.podiumChat[k.id] || [];
      lijst.push(regel); if (lijst.length > CHAT_MAX) db.data.podiumChat[k.id] = lijst.slice(-CHAT_MAX);
      save(); stuurRond(k, { kind: 'cadeau', kanaalId: k.id, regel });
      return { status: 200, ok: true, regel, saldo: r.saldo };
    });
  }
  async function abonneer(key, kid, idem) {
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    const m = poort.magKanaal(key, k); if (!m.ok) return { status: 403, error: m.reden };
    if (!poort.geldMag(k, 'abonnement')) return { status: 409, error: 'In deze zone bestaat geen abonnement.' };
    if (k.key === key) return { status: 400, error: 'Dit is uw eigen kanaal.' };
    if ((k.geblokkeerd || []).includes(key)) return { status: 403, error: 'Dit kanaal is niet beschikbaar.' };
    if (!(k.abbCenten > 0)) return { status: 409, error: 'Dit kanaal heeft geen abonnement.' };
    return metIdem(k, idem ? 'a:' + key + ':' + idem : null, async () => {
      const r = await pay.stuur({ van: codenaamVan(key), aanCodenaam: codenaamVan(k.key), centen: k.abbCenten,
        oms: 'Podium · abonnement ' + k.naam, idem: idem ? 'podiumabb:' + idem : undefined, soort: 'podium' });
      if (r.error) return { status: r.status || 400, error: r.error };
      const basis = isAbonnee(k, key) ? new Date(k.abonnees[key]).getTime() : Date.now();
      k.abonnees[key] = new Date(basis + ABB_DAGEN * 24 * 3600 * 1000).toISOString();
      k.verdiend = Math.round((k.verdiend || 0) + k.abbCenten);
      save(); sseToCustomer(k.key, 'podium', { kind: 'abonnee', kanaalId: k.id, codenaam: codenaamVan(key) });
      return { status: 200, ok: true, tot: k.abonnees[key], saldo: r.saldo };
    });
  }

  /* Het kaartje (zone 'evenement') en de uitnodiging (zone 'besloten') staan in
     ./toegang.js: twee manieren om binnen te komen die niets met de zaal zelf
     te maken hebben, en dit bestand blijft er onder de omvangregel mee. */
  const toegang = require('./toegang')(ctx);

  /* ---- veiligheid in de zaal: blokkeren en melden ---- */
  function blokkeer(key, kid, doelKey, aan) {
    const k = kanaalMet(kid); if (!k || k.key !== key) return { status: 403, error: 'Alleen de maker beheert het kanaal.' };
    doelKey = String(doelKey || ''); if (!doelKey || doelKey === key) return { status: 400, error: 'Kies een kijker.' };
    k.geblokkeerd = (k.geblokkeerd || []).filter(x => x !== doelKey);
    if (aan !== false) { k.geblokkeerd.push(doelKey); delete (k.kijkers || {})[doelKey]; if (k.boom) delete k.boom[doelKey]; herstelBoom(k); sseToCustomer(doelKey, 'podium', { kind: 'einde', kanaalId: k.id }); }
    save(); return { status: 200, ok: true, geblokkeerd: k.geblokkeerd.length };
  }
  function meld(key, kid, reden) {
    const k = kanaalMet(kid); if (!k) return { status: 404, error: 'Kanaal niet gevonden.' };
    const m = poort.magKanaal(key, k); if (!m.ok) return { status: 403, error: m.reden };
    lijsten();
    /* De melding draagt de ZONE mee, want hij hoort in de wachtrij van die
       wereld. Een melding over een 18+-kanaal tussen de schoolstreams zetten,
       is precies de vermenging die deze hele indeling moet voorkomen. */
    db.data.podiumMeldingen.push({ id: id(), kanaalId: k.id, kanaal: k.naam, zone: zones.zoneVan(k),
      van: codenaamVan(key), reden: schoon(reden, 300) || 'Geen reden opgegeven', at: nu() });
    db.data.podiumMeldingen = db.data.podiumMeldingen.slice(-200);
    save(); sseToOffice('sync', { scope: 'podium' });
    return { status: 200, ok: true };
  }

  return { podiumChatStuur: chat, podiumCadeau: cadeau, podiumAbonneer: abonneer, podiumBlokkeer: blokkeer,
    podiumMeld: meld, podiumKaartje: toegang.kaartje, podiumNodig: toegang.nodig };
};
