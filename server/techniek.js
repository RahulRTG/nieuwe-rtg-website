/* Techniek-motor voor het beveiligde Backoffice-statusbord.

   Twee dingen:
   1. Gezondheidschecks: een lijst subsystemen die elk een status teruggeven
      (ok / waarschuwing / fout) met een korte uitleg en een vaste code. Zo zie
      je in één oogopslag een groen of rood bolletje, en bij rood meteen wat er
      speelt.
   2. Zekeringen ("circuit breakers"): per subsysteem een schakelaar. Springt er
      een (automatisch bij een fout, of met de hand), dan staat de stroom eraf en
      kan de eigenaar hem er weer in doen. Sommige zekeringen gaten echt gedrag
      (onderhoudsstand, registratie).

   De checks krijgen alles via een ctx-object, zodat deze module zuiver en
   testbaar is (geen verborgen globals). */

const kluis = require('./kluis');

// Elke check geeft { status, detail } terug. status: 'ok' | 'waarschuwing' | 'fout'.
const CHECKS = [
  {
    id: 'opslag', naam: 'Gedeelde opslag', code: 'STO-01', categorie: 'Data',
    run: (c) => {
      if (!c.db || !c.db.data || typeof c.db.data !== 'object') return { status: 'fout', detail: 'db.data ontbreekt of heeft een verkeerde vorm.' };
      const soort = c.STORE === 'postgres' ? 'PostgreSQL' : c.STORE === 'sqlite' ? 'SQLite' : 'lokaal bestand (json)';
      return { status: 'ok', detail: `Opslag: ${soort}. Rol: ${c.db.writable ? 'schrijver' : 'lezer'}. Collecties: ${Object.keys(c.db.data).length}.` };
    }
  },
  {
    id: 'postgres', naam: 'PostgreSQL-verbinding', code: 'PG-01', categorie: 'Data',
    run: async (c) => {
      if (c.STORE !== 'postgres') return { status: 'waarschuwing', detail: 'Niet actief: draait op lokale opslag (zet DATABASE_URL voor productie/meerdere instances).' };
      if (!c.pgPing) return { status: 'waarschuwing', detail: 'Postgres geconfigureerd maar geen ping beschikbaar.' };
      try { const ms = await c.pgPing(); return { status: 'ok', detail: `Verbonden. Antwoordtijd ${ms} ms.` }; }
      catch (e) { return { status: 'fout', detail: 'Kan de database niet bereiken: ' + (e.message || e) }; }
    }
  },
  {
    id: 'versleuteling', naam: 'Versleuteling-at-rest', code: 'ENC-01', categorie: 'Beveiliging',
    run: () => kluis.AAN
      ? { status: 'ok', detail: 'Gegevens worden versleuteld opgeslagen (RTG_ENC_KEY actief).' }
      : { status: 'waarschuwing', detail: 'Uit: gegevens staan onversleuteld op schijf. Zet RTG_ENC_KEY in productie.' }
  },
  {
    id: 'accounts', naam: 'Accounts', code: 'ACC-01', categorie: 'Data',
    run: (c) => { const n = c.accounts ? c.accounts.count() : 0; return { status: 'ok', detail: `${n} account(s) geregistreerd.` }; }
  },
  {
    id: 'sessies', naam: 'Actieve sessies', code: 'SES-01', categorie: 'Runtime',
    run: (c) => ({ status: 'ok', detail: `${(c.sessions && c.sessions.size) || 0} actieve sessie(s) in het geheugen.` })
  },
  {
    id: 'ai', naam: 'Persoonlijke AI (Claude)', code: 'AI-01', categorie: 'Integraties',
    run: (c) => c.anthropic
      ? { status: 'ok', detail: 'Claude API actief.' }
      : { status: 'waarschuwing', detail: 'Demo-antwoorden: geen ANTHROPIC_API_KEY.' }
  },
  {
    id: 'betalingen', naam: 'Betalingen', code: 'PAY-01', categorie: 'Integraties',
    run: (c) => (c.betaal && c.betaal.AANBIEDER === 'stripe')
      ? { status: 'ok', detail: 'Stripe actief (echte betalingen).' }
      : { status: 'waarschuwing', detail: 'Demo-betalingen: geen STRIPE_SECRET_KEY (geen echt geld).' }
  },
  {
    id: 'email', naam: 'E-mail (SMTP)', code: 'MAIL-01', categorie: 'Integraties',
    run: (c) => c.mailGeconfigureerd
      ? { status: 'ok', detail: 'SMTP ingesteld; e-mail wordt echt verstuurd.' }
      : { status: 'waarschuwing', detail: 'Geen SMTP: e-mail gaat naar de outbox in plaats van naar klanten.' }
  },
  {
    id: 'schijf', naam: 'Schijfruimte', code: 'DSK-01', categorie: 'Runtime',
    run: (c) => {
      try {
        const st = c.fs.statfsSync(c.DATA_DIR);
        const vrijGB = (st.bavail * st.bsize) / 1e9;
        const status = vrijGB < 0.5 ? 'fout' : vrijGB < 2 ? 'waarschuwing' : 'ok';
        return { status, detail: `${vrijGB.toFixed(1)} GB vrij op de datamap.` };
      } catch (e) { return { status: 'waarschuwing', detail: 'Kon schijfruimte niet bepalen.' }; }
    }
  },
  {
    id: 'backups', naam: 'Back-ups', code: 'BAK-01', categorie: 'Data',
    run: (c) => {
      try {
        const bdir = c.path.join(c.DATA_DIR, 'backups');
        if (!c.fs.existsSync(bdir)) return { status: 'waarschuwing', detail: 'Nog geen back-up gemaakt (wordt dagelijks aangemaakt).' };
        const dagen = c.fs.readdirSync(bdir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
        if (!dagen.length) return { status: 'waarschuwing', detail: 'Geen dagback-up gevonden.' };
        const laatste = dagen[dagen.length - 1];
        const ouderdomDagen = Math.floor((Date.now() - new Date(laatste).getTime()) / 86400000);
        return { status: ouderdomDagen > 1 ? 'waarschuwing' : 'ok', detail: `Laatste back-up: ${laatste} (${ouderdomDagen} dag(en) geleden). ${dagen.length} bewaard.` };
      } catch (e) { return { status: 'waarschuwing', detail: 'Kon back-ups niet lezen.' }; }
    }
  }
];

// Draai alle checks (ook async), en respecteer een gesprongen zekering: staat de
// stroom eraf, dan is het subsysteem bewust uit -> toon dat i.p.v. een "fout".
async function draaiChecks(ctx) {
  const uit = [];
  for (const chk of CHECKS) {
    let res;
    try { res = await chk.run(ctx); } catch (e) { res = { status: 'fout', detail: 'Check wierp een fout: ' + (e.message || e) }; }
    const zeker = ctx.zekeringen && ctx.zekeringen[chk.id];
    if (zeker && zeker.aan === false) res = { status: 'fout', detail: 'Zekering gesprongen (subsysteem uit): ' + (zeker.reden || 'handmatig') };
    uit.push({ id: chk.id, naam: chk.naam, code: chk.code, categorie: chk.categorie, status: res.status, detail: res.detail });
  }
  return uit;
}

/* Standaard-zekeringen. `aan:true` = stroom erop (normaal). `poort` = of deze
   zekering echt gedrag afsluit als hij springt (onderhoud, registratie). */
function standaardZekeringen() {
  return {
    onderhoud:   { naam: 'Onderhoudsstand', code: 'FUSE-MAINT', aan: true, poort: true, uitleg: 'Springt hij (stroom eraf), dan is de hele app in onderhoud: alleen de eigenaar komt er nog in.' },
    registratie: { naam: 'Nieuwe registraties', code: 'FUSE-REG', aan: true, poort: true, uitleg: 'Eraf = geen nieuwe accounts (bijv. bij misbruik).' },
    betalingen:  { naam: 'Betaalverkeer', code: 'FUSE-PAY', aan: true, poort: true, uitleg: 'Eraf = betalingen tijdelijk geblokkeerd.' },
    ai:          { naam: 'AI-antwoorden', code: 'FUSE-AI', aan: true, poort: true, uitleg: 'Eraf = de persoonlijke AI staat uit.' }
  };
}

module.exports = { CHECKS, draaiChecks, standaardZekeringen };
