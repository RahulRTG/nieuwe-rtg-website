/* Luchthaven, deelbestand "cockpit": de signalen en de AI-operations.

   ./grond.js doet het WERK op de grond -- de draai per kist, de baanklaring,
   de kofferketen, de filters. Dit bestand kijkt eroverheen en verandert niets.

   WAT EEN SIGNAAL HIER IS, en waarom een cockpit meer is dan een teller: elk
   signaal hieronder komt uit TWEE dingen tegelijk, en is daarom nergens te zien
   zolang je de lijsten los bekijkt. Een kist die boardt terwijl de toren nog
   geen klaring gaf. Een draai die niet rond is terwijl het inchecken al loopt.
   Een vip-protocol dat nog openstaat op een vlucht die zo vertrekt. Wie alleen
   naar de vluchtlijst kijkt ziet vier keer "normaal".

   EN DE AI ADVISEERT ALLEEN. Deze module heeft geen enkele weg naar opslaan;
   dat is de grens, niet de zin in de systeemprompt. Boarden, klaren en
   vrijgeven doet de mens in de toren -- zoals ./grond.js ook vastlegt.

   Krijgt dezelfde ctx als ./grond.js. */
'use strict';

module.exports = (ctx) => {
  const { anthropic, schoon, vandaag, L, seed, vluchten, vind, actief,
    draaiRond, vipRond,
    GATES, STANDS, HELIPADS, BANEN, CATEGORIEEN, DRAAI_TAKEN, VIP_SOORTEN, VIP_PROTOCOL } = ctx;

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

  return { cockpit, luchtAI };
};
