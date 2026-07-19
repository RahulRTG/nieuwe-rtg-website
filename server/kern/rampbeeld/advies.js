/* Het gezamenlijke rampbeeld, deelbestand "advies": de AI-coordinator. Leest het
   gedeelde beeld en doet CONCRETE inzetvoorstellen (welke vrije eenheid naar welke
   melding, welk ziekenhuis met ruimte, wanneer op te schalen). Nadrukkelijk
   adviserend: de coordinator voert nooit zelf iets uit; een mens wijst de eenheid
   daadwerkelijk toe. Krijgt de gedeelde ctx van kern/rampbeeld/index.js. */
module.exports = (ctx) => {
  const { anthropic, lijst, hulp, beeld } = ctx;

  function regelAdvies(b) {
    const adviezen = [];
    const h = hulp();
    const codesInBeeld = new Set([...(b.korpsen || []).map(k => k.code), ...(b.defensie || []).map(d => d.code)]);
    const vrijeZiekenhuizen = (b.ziekenhuizen || []).filter(z => z.beddenVrij > 0).sort((a, c) => c.beddenVrij - a.beddenVrij);
    // open meldingen zonder toegewezen eenheid -> stel een vrije eenheid voor
    const open = lijst(h.meldingen).filter(m => m.status !== 'afgerond' && !m.eenheidId && codesInBeeld.has(m.korps));
    for (const m of open.slice(0, 6)) {
      const eigen = (h.eenheden || {})[m.korps] || [];
      let e = eigen.find(x => x.status === 'vrij');
      let van = m.korps;
      if (!e) { // geen eigen eenheid vrij: kijk of een partner er een heeft
        for (const k of b.korpsen || []) {
          const kv = ((h.eenheden || {})[k.code] || []).find(x => x.status === 'vrij');
          if (kv) { e = kv; van = k.code; break; }
        }
      }
      const zk = vrijeZiekenhuizen[0];
      adviezen.push('Prio ' + m.prio + ' "' + String(m.tekst).slice(0, 50) + '"' + (m.plek ? ' (' + m.plek + ')' : '') +
        (e ? ': stuur ' + e.naam + ' (' + e.soort + ', ' + van + ')' : ': GEEN vrije eenheid; overweeg op te schalen of bijstand te vragen') +
        (zk ? '; dichtstbijzijnde ziekenhuis met ruimte is ' + zk.naam + ' (' + zk.beddenVrij + ' bedden)' : '') + '.');
    }
    // ziekenhuizen die vollopen
    for (const z of (b.ziekenhuizen || [])) if (z.beddenTotaal > 0 && z.beddenVrij === 0) adviezen.push(z.naam + ' zit vol; leid nieuwe gewonden om naar een ziekenhuis met ruimte.');
    // korpsen zonder vrije eenheden
    for (const k of (b.korpsen || [])) if (k.totaal > 0 && k.vrij === 0) adviezen.push(k.naam + ' heeft geen vrije eenheid meer; vraag bijstand of schaal op.');
    if (!adviezen.length) adviezen.push('Op dit moment geen knelpunten: open meldingen zijn bemand en er zijn vrije bedden. Houd het beeld in de gaten.');
    return adviezen;
  }
  async function coordinatorAi(viewerCode, vraag) {
    const b = beeld(viewerCode);
    if (b.error) return b;
    const regels = regelAdvies(b);
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (anthropic) {
      try {
        const beeldTekst = 'Niveau: ' + b.ramp.niveau + '. Totalen: ' + JSON.stringify(b.totalen) +
          '. Korpsen: ' + (b.korpsen || []).map(k => k.naam + ' (' + k.vrij + ' vrij: ' + k.perSoort.map(p => p.vrij + ' ' + p.soort).join(',') + ')').join('; ') +
          '. Ziekenhuizen: ' + (b.ziekenhuizen || []).map(z => z.naam + ' ' + z.beddenVrij + ' bedden').join('; ') +
          '. Defensie: ' + (b.defensie || []).map(d => d.naam + ' ' + d.gevechtsgereed + ' gereed').join('; ') +
          '. Voorlopige voorstellen: ' + regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 450,
          system: require('../rahul').RAHUL_LEAD + 'je bent de coordinator-assistent van het gezamenlijke rampbeeld (hulpdiensten, zorg en defensie). Je doet KORTE, concrete inzetvoorstellen: welke vrije eenheid naar welke melding, welk ziekenhuis met ruimte, wanneer op te schalen. ' +
            'Je BESLIST NOOIT en voert niets uit: je adviseert, de meldkamer beslist. Wees eerlijk als iets krap is en verzin geen eenheden of bedden die er niet zijn. Dit is een demonstratie- en oefenomgeving; bij echt levensgevaar geldt altijd 112 en het eigen protocol. Situatie: ' + beeldTekst,
          messages: [{ role: 'user', content: v || 'Geef je belangrijkste inzetvoorstellen op dit moment.' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t, voorstellen: regels, niveau: b.ramp.niveau };
      } catch (e) { /* de regelgebaseerde terugval hieronder */ }
    }
    return { ok: true, antwoord: 'Voorstellen (u beslist zelf): ' + regels.join(' '), voorstellen: regels, niveau: b.ramp.niveau };
  }

  return { coordinatorAi };
};
