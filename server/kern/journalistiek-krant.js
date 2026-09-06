/* DE KRANT ZOALS EEN BEZOEKER HEM ZIET.

   Deze drie functies horen bij journalistiek.js maar hebben een andere lezer:
   de redactie schrijft, het publiek leest. /api/krant/* vraagt geen sessie, dus
   dit is de enige kant van dit domein die een vreemde kan aanroepen -- en juist
   daarom moet hij lezen zonder te scheppen (zie kijk() in kern/eigencollectie.js):
   met bak() zou een onbekende code een redactie laten ontstaan, aangemaakt door
   iemand die geen krant heeft.

   Ze staan hier en niet daar omdat journalistiek.js op zijn omvangsgrens zat
   (keuringsregel 13) en dit de naad is die er al lag: de kop in dat bestand
   heette letterlijk "publiek: de krant lezen". Wat ze delen -- de opslag, scho()
   en kortArt() -- komt via ctx mee; er ontstaat geen tweede waarheid. */
module.exports = ({ lees, kijk, save, scho, kortArt }) => {
  /* De gids: alle kranten met minstens een gepubliceerd artikel. Leest de hele
     kaart, dus met kijk() -- een bezoeker die langskomt terwijl er nog geen
     enkele redactie bestaat, mag die kaart niet aanleggen. */
  function krantGids() {
    const alles = kijk();
    return Object.keys(alles).map(code => {
      const r = alles[code]; const live = r.artikelen.filter(a => a.status === 'live');
      return { code, naam: r.huisstijl.naam, payoff: r.huisstijl.payoff, accent: r.huisstijl.accent, artikelen: live.length };
    }).filter(x => x.artikelen > 0).sort((a, b) => b.artikelen - a.artikelen).slice(0, 200);
  }

  function krant(code) {
    const r = lees(code);
    if (!r) return { error: 'Geen krant op dit adres.', status: 404 };
    const live = r.artikelen.filter(a => a.status === 'live')
      .sort((a, b) => String(b.gepubliceerd || b.bij).localeCompare(String(a.gepubliceerd || a.bij)));
    return { ok: true, huisstijl: r.huisstijl, site: r.site, rubrieken: r.rubrieken, artikelen: live.map(kortArt) };
  }

  /* De teller loopt op de ECHTE redactie, want lees() geeft die terug zodra hij
     bestaat -- en hier is hij er altijd, anders was de 404 hierboven gevallen. */
  function leesArtikel(code, artId) {
    const r = lees(code);
    if (!r) return { error: 'Geen krant op dit adres.', status: 404 };
    const a = r.artikelen.find(x => x.id === scho(artId, 20) && x.status === 'live');
    if (!a) return { error: 'Artikel niet gevonden.', status: 404 };
    a.gelezen = (a.gelezen || 0) + 1; save();
    return { ok: true, artikel: { id: a.id, titel: a.titel, chapo: a.chapo, inhoud: a.inhoud, rubriek: a.rubriek, beeld: a.beeld || '', auteur: a.auteur, bij: a.gepubliceerd || a.bij, naam: r.huisstijl.naam, accent: r.huisstijl.accent, thema: r.huisstijl.thema } };
  }

  return { krantGids, krant, leesArtikel };
};
