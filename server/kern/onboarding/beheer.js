/* Onboarding (deelmodule): het beheer: de publieke configuratie, velden
   normaliseren en zetten, de AI-aanpassing in gewone taal (met ingebouwde
   terugval) en de lijst van ondertekenaars. Krijgt de gedeelde context een
   keer bij het opstarten vanuit kern/onboarding.js. */
module.exports = (ctx) => {
  const { db, save, crypto, accounts, anthropic, schoon,
    ALLE_WIE, PAS_WIE, VELD_TYPES, DEFAULT_CONTRACT,
    nu, standaardVelden, standaardScope, store, scopeVan, profielVan, profielId } = ctx;
  function publiekeConfig(sc) {
    return { velden: sc.velden.map(v => ({ id: v.id, label: v.label, type: v.type, voorWie: [...(v.voorWie || [])] })),
      contract: { versie: sc.contract.versie, titel: sc.contract.titel, tekst: sc.contract.tekst, bijgewerkt: sc.contract.bijgewerkt } };
  }
  function config(scope) { return publiekeConfig(scopeVan(scope)); }

  // Een voorgestelde config valideren/normaliseren voordat we hem toepassen.
  function normaliseerVelden(lijst) {
    const uit = [];
    const gezien = new Set();
    for (const v of (Array.isArray(lijst) ? lijst : []).slice(0, 40)) {
      if (!v || typeof v !== 'object') continue;
      let id = schoon(String(v.id || v.label || ''), 40).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (!id || gezien.has(id)) continue;
      gezien.add(id);
      const type = VELD_TYPES.includes(v.type) ? v.type : 'text';
      let voorWie = Array.isArray(v.voorWie) ? v.voorWie.filter(w => ALLE_WIE.includes(w)) : [...ALLE_WIE];
      if (!voorWie.length) voorWie = [...ALLE_WIE];
      uit.push({ id, label: schoon(String(v.label || id), 60) || id, type, voorWie });
    }
    return uit.length ? uit : null;
  }
  // De config (deels) overschrijven; contracttekst-wijziging = nieuwe versie.
  function zetConfig(scope, voorstel) {
    const sc = scopeVan(scope);
    if (voorstel && voorstel.velden) { const v = normaliseerVelden(voorstel.velden); if (v) sc.velden = v; }
    if (voorstel && voorstel.contract) {
      const c = voorstel.contract;
      if (c.titel != null) sc.contract.titel = schoon(String(c.titel), 100) || sc.contract.titel;
      if (c.tekst != null) {
        const tekst = String(c.tekst).slice(0, 20000);
        if (tekst.trim().length >= 20 && tekst !== sc.contract.tekst) { sc.contract.tekst = tekst; sc.contract.versie += 1; }
      }
    }
    sc.contract.bijgewerkt = nu();
    save();
    return config(scope);
  }

  /* Aanpassen met AI in gewone taal. Met een sleutel stelt Claude een volledige
     nieuwe config voor; zonder sleutel doet een ingebouwde regel-parser het
     eenvoudige werk (veld toevoegen/weghalen, verplichten voor gasten, een regel
     aan het contract toevoegen). We passen het voorstel meteen toe (de eigenaar/
     leverancier is de bevoegde) en geven een uitleg terug. */
  async function aiPasAan(scope, opdracht, aiAan) {
    const sc = scopeVan(scope);
    const huidig = publiekeConfig(sc);
    let voorstel = null, uitleg = '', bron = 'ingebouwd';
    if (anthropic && aiAan !== false) {
      try {
        const sys = 'Je beheert de verplichte intake (vereiste velden) en het contract van een reisplatform. ' +
          'Pas de config aan volgens de opdracht van de beheerder. Veldtypes: ' + VELD_TYPES.join(', ') + '. ' +
          'voorWie is een deelverzameling van ' + ALLE_WIE.join(', ') + ' (guest = gratis gast). ' +
          'Antwoord met een korte uitleg in het Nederlands en DAARNA exact EEN codeblok:\n' +
          '```json\n{"velden":[{"id":"..","label":"..","type":"..","voorWie":["guest","rtg"]}],"contract":{"titel":"..","tekst":".."}}\n```';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 2000, system: sys,
          messages: [{ role: 'user', content: 'Huidige config:\n' + JSON.stringify(huidig) + '\n\nOpdracht: ' + String(opdracht || '') }] });
        const txt = (r && r.content && r.content[0] && r.content[0].text) || '';
        const m = txt.match(/```json\s*([\s\S]*?)```/);
        if (m) { try { voorstel = JSON.parse(m[1]); } catch (e) {} }
        uitleg = txt.replace(/```json[\s\S]*?```/, '').trim();
        bron = 'claude';
      } catch (e) { voorstel = null; }
    }
    if (!voorstel) { const c = cannedVoorstel(sc, String(opdracht || '')); voorstel = c.voorstel; if (!uitleg) uitleg = c.uitleg; }
    zetConfig(scope, voorstel);
    return { ok: true, uitleg: uitleg || 'Aangepast.', bron, config: config(scope) };
  }

  // Ingebouwde regel-parser (zonder AI-sleutel): dekt de meest gevraagde acties.
  function cannedVoorstel(sc, opdracht) {
    const t = opdracht.toLowerCase();
    const velden = sc.velden.map(v => ({ id: v.id, label: v.label, type: v.type, voorWie: [...(v.voorWie || [])] }));
    const contract = { titel: sc.contract.titel, tekst: sc.contract.tekst };
    let uitleg = 'Aangepast op basis van uw instructie.';
    const noemt = (w) => t.includes(w);
    // paspoort (of een genoemd veld) ook voor gasten verplichten
    if ((noemt('paspoort') || noemt('gast')) && (noemt('gast') || noemt('iedereen'))) {
      const p = velden.find(v => v.id === 'paspoort');
      if (p && !p.voorWie.includes('guest')) { p.voorWie.push('guest'); uitleg = 'Paspoort is nu ook voor gratis gasten verplicht.'; }
    }
    // veld verwijderen (een enkele veldnaam)
    let m = t.match(/(?:verwijder|haal weg|schrap|weg met)\s+(?:het\s+veld\s+)?"?([a-z][a-z0-9_]{1,30})"?/);
    if (m) { const doel = m[1].trim(); const i = velden.findIndex(v => v.id === doel || v.label.toLowerCase().includes(doel)); if (i >= 0) { uitleg = 'Veld "' + velden[i].label + '" verwijderd.'; velden.splice(i, 1); } }
    // veld toevoegen (een enkele veldnaam, met of zonder "toe")
    m = t.match(/(?:voeg|vraag|extra)\s+(?:het\s+veld\s+|ook\s+|veld\s+)?"?([a-z][a-z0-9_]{1,30})"?(?:\s+toe)?/);
    if (m) {
      const id = m[1].trim();
      if (id && !velden.some(v => v.id === id)) { velden.push({ id, label: id.charAt(0).toUpperCase() + id.slice(1), type: 'text', voorWie: [...ALLE_WIE] }); uitleg = 'Veld "' + id + '" toegevoegd voor iedereen.'; }
    }
    // een regel aan het contract toevoegen
    m = opdracht.match(/(?:zet in het contract(?: dat)?|voeg aan het contract toe|contractregel)[:\s]+(.{5,300})/i);
    if (m) { contract.tekst = sc.contract.tekst.trimEnd() + '\n\n' + m[1].trim(); uitleg = 'Regel aan het contract toegevoegd (nieuwe versie).'; }
    // contracttitel wijzigen
    m = opdracht.match(/(?:contract)?titel\s+(?:wordt|naar|is)\s+(.{3,80})/i);
    if (m) { contract.titel = m[1].trim(); }
    return { voorstel: { velden, contract }, uitleg };
  }

  // Wie tekende er binnen een scope (voor de leverancier/eigenaar): overzicht.
  function ondertekenaars(scope) {
    const s = store();
    const uit = [];
    for (const [pid, p] of Object.entries(s.profielen)) {
      const o = (p.ondertekend || {})[scope];
      if (o) uit.push({ wie: pid, naam: o.naam, versie: o.versie, at: o.at });
    }
    return uit.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  return { publiekeConfig, config, normaliseerVelden, zetConfig, aiPasAan, cannedVoorstel, ondertekenaars };
};
