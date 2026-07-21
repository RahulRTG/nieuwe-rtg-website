/* Luchthaven, deelbestand "grond": het platform (de draai per vertrekkende
   kist), de toren (baanklaring: de mens in de toren beslist), de bagagekelder
   (de kofferketen met vermist en gevonden), de security-filters met live
   wachttijden, de cockpit met signalen en de AI-operations (adviseert alleen).
   Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { save, anthropic, nu, schoon, vandaag, L, seed, vluchten, vind, actief, catVan,
    draaiTakenVoor, draaiRond, vipRond, publiek,
    GATES, STANDS, HELIPADS, BANEN, CATEGORIEEN, DRAAI_TAKEN, KOFFER_KETEN, VIP_SOORTEN, VIP_PROTOCOL } = ctx;

  /* ---------- het platform: de draai per vertrekkende kist ---------- */
  function draaiTaak(actor, vid, taak) {
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!draaiTakenVoor(v).includes(taak)) return { status: 400, error: 'Deze platformtaak hoort niet bij een ' + catVan(v) + ' (' + draaiTakenVoor(v).join(', ') + ').' };
    if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
    if (v.draai[taak]) return { status: 409, error: 'Deze taak is al afgevinkt.' };
    v.draai[taak] = { door: actor || 'platform', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v), rond: draaiRond(v) };
  }

  /* ---------- de toren: baanklaring (de mens in de toren beslist) ---------- */
  function torenKlaring(actor, vid, baan) {
    const v = vind(vid);
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (v.klaring) return { status: 409, error: 'Deze vlucht heeft al klaring (baan ' + v.klaring.baan + ').' };
    if (v.status !== 'boarding') return { status: 409, error: 'Klaring volgt pas als de kist aan het boarden is.' };
    // een helikopter krijgt klaring op een helipad, al het andere op een baan
    const keuze = catVan(v) === 'helikopter' ? HELIPADS : BANEN;
    if (!keuze.includes(baan)) return { status: 400, error: 'Kies voor een ' + catVan(v) + ' een klaring op: ' + keuze.join(', ') + '.' };
    v.klaring = { baan, door: actor || 'toren', at: nu() };
    save();
    return { ok: true, vlucht: publiek(v) };
  }

  /* ---------- de bagagekelder: de kofferketen ---------- */
  function bagage(filter) {
    seed(); filter = filter || {};
    let lijst = L().koffers;
    if (KOFFER_KETEN.includes(filter.status) || filter.status === 'vermist') lijst = lijst.filter(k => k.status === filter.status);
    return { ok: true, keten: KOFFER_KETEN, koffers: lijst.slice(0, 200).map(k => {
      const v = vind(k.vluchtId);
      return { tag: k.tag, vlucht: v ? v.nummer : '?', codenaam: k.codenaam, status: k.status, band: k.band };
    }) };
  }
  function bagageZet(actor, tag, status) {
    const k = L().koffers.find(x => x.tag === String(tag || '').toUpperCase());
    if (!k) return { status: 404, error: 'Koffer niet gevonden.' };
    if (status === 'vermist') {
      if (k.status === 'opgehaald') return { status: 409, error: 'Deze koffer is al opgehaald.' };
      k.status = 'vermist'; save();
      return { ok: true, koffer: { tag: k.tag, status: k.status } };
    }
    if (k.status === 'vermist' && status === 'op-band') { k.status = 'op-band'; save(); return { ok: true, koffer: { tag: k.tag, status: k.status }, gevonden: true }; }
    if (!KOFFER_KETEN.includes(status)) return { status: 400, error: 'Onbekende kofferstatus.' };
    const van = KOFFER_KETEN.indexOf(k.status), naar = KOFFER_KETEN.indexOf(status);
    if (naar <= van) return { status: 409, error: 'De bagageketen draait niet achteruit.' };
    if (naar > van + 1) return { status: 409, error: 'Stap voor stap: na ' + k.status + ' komt ' + KOFFER_KETEN[van + 1] + '.' };
    k.status = status;
    save();
    return { ok: true, koffer: { tag: k.tag, status: k.status } };
  }

  /* ---------- security: de filters met live wachttijden ---------- */
  function securityZet(actor, fid, data) {
    data = data || {};
    const f = L().security.find(x => x.id === String(fid || ''));
    if (!f) return { status: 404, error: 'Filter niet gevonden.' };
    if (typeof data.open === 'boolean') f.open = data.open;
    if (data.wachtMinuten != null) {
      const w = Math.round(Number(data.wachtMinuten));
      if (!Number.isFinite(w) || w < 0 || w > 180) return { status: 400, error: 'Wachttijd in minuten (0-180).' };
      f.wachtMinuten = w;
    }
    save();
    return { ok: true, filter: { id: f.id, naam: f.naam, open: f.open, wachtMinuten: f.wachtMinuten } };
  }

  /* ---------- de cockpit + AI-operations ---------- */
  function cockpit() {
    seed();
    const d = vandaag();
    const vandaagV = vluchten().filter(v => v.datum === d);
    const signalen = [];
    for (const v of vandaagV) {
      if (v.soort === 'vertrek' && ['inchecken', 'boarding'].includes(v.status) && !draaiRond(v)) {
        const open = DRAAI_TAKEN.filter(t => !v.draai[t]);
        signalen.push({ soort: 'draai', vlucht: v.nummer, tekst: v.nummer + ' (' + v.tijd + '): de draai is niet rond; open: ' + open.join(', ') + '.' });
      }
      if (v.status === 'boarding' && !v.klaring)
        signalen.push({ soort: 'toren', vlucht: v.nummer, tekst: v.nummer + ' boardt maar heeft nog geen baanklaring van de toren.' });
      if (v.vertraging && v.vertraging.minuten >= 60)
        signalen.push({ soort: 'vertraging', vlucht: v.nummer, tekst: v.nummer + ' heeft ' + v.vertraging.minuten + ' minuten vertraging (' + v.vertraging.reden + ').' });
    }
    const dichteFilters = L().security.filter(f => !f.open).length;
    const drukte = L().security.filter(f => f.open && f.wachtMinuten > 20);
    for (const f of drukte) signalen.push({ soort: 'security', vlucht: '', tekst: f.naam + ': ' + f.wachtMinuten + ' minuten wachten; overweeg een extra filter te openen.' });
    for (const c of L().charters.filter(x => x.status === 'aangevraagd').slice(0, 5))
      signalen.push({ soort: 'charter', vlucht: c.code, tekst: 'Charteraanvraag ' + c.code + ' (' + c.soort + ' naar ' + c.bestemming + ') wacht op een besluit van operations.' });
    for (const vip of L().vips) {
      const v = vind(vip.vluchtId);
      if (v && actief(v) && ['inchecken', 'boarding'].includes(v.status) && !vipRond(vip))
        signalen.push({ soort: 'vip', vlucht: v.nummer, tekst: v.nummer + ': het vip-protocol (' + vip.soort + ', ' + vip.suite + ') is nog niet rond.' });
    }
    return { ok: true,
      vluchtenVandaag: vandaagV.length,
      vertrokken: vandaagV.filter(v => v.status === 'vertrokken').length,
      geland: vandaagV.filter(v => ['geland', 'bagage-op-band', 'afgerond'].includes(v.status)).length,
      vertraagd: vandaagV.filter(v => v.vertraging).length,
      ingecheckt: L().boekingen.filter(b => b.status === 'ingecheckt').length,
      koffersInSysteem: L().koffers.filter(k => !['opgehaald'].includes(k.status)).length,
      koffersVermist: L().koffers.filter(k => k.status === 'vermist').length,
      chartersWachtend: L().charters.filter(x => x.status === 'aangevraagd').length,
      vipsActief: L().vips.filter(vip => { const v = vind(vip.vluchtId); return v && actief(v); }).length,
      loungeGasten: L().lounge.filter(g => !g.uit).length,
      dichteFilters, signalen: signalen.slice(0, 40),
      gates: GATES, stands: STANDS, helipads: HELIPADS, banen: BANEN,
      categorieen: CATEGORIEEN, draaiTaken: DRAAI_TAKEN, vipProtocol: VIP_PROTOCOL, vipSoorten: VIP_SOORTEN };
  }
  async function luchtAI(vraag) {
    const c = cockpit();
    const beeld = c.vluchtenVandaag + ' vluchten vandaag (' + c.vertrokken + ' vertrokken, ' + c.geland + ' geland, ' + c.vertraagd + ' vertraagd), ' +
      c.ingecheckt + ' passagiers ingecheckt, ' + c.koffersInSysteem + ' koffers in het systeem (' + c.koffersVermist + ' vermist), ' +
      c.dichteFilters + ' security-filter(s) dicht. Signalen: ' +
      (c.signalen.length ? c.signalen.slice(0, 5).map(s => s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-operations van RTG Airport. Je adviseert de vluchtleiding, het platform, de toren, ' +
            'de bagagekelder en security over de operatie van vandaag, kort en beslist. Je adviseert ALLEEN: elke schakeling (status, klaring, ' +
            'vertraging, filter) doet een mens. Veiligheid gaat altijd voor snelheid. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld van nu: ' + beeld + ' Mijn advies: werk eerst de open draai-taken van de eerstvolgende vertrekker af, dan de klaringen. Veiligheid voor snelheid; schakelen doet u zelf.' };
  }

  return { draaiTaak, torenKlaring, bagage, bagageZet, securityZet, cockpit, luchtAI };
};
