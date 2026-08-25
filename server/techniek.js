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
   testbaar is (geen verborgen globals). De integratie-checks (AI, betalingen,
   wallet, motor, bank, stad, e-mail) staan in ./techniek-checks.js en worden
   hieronder op hun vaste plek ingevoegd. */

const kluis = require('./kluis');
const { CHECKS_INTEGRATIES } = require('./techniek-checks');

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
  ...CHECKS_INTEGRATIES,
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
    id: 'fouten', naam: 'Storingen (fout-aggregatie)', code: 'ERR-01', categorie: 'Runtime',
    run: (c) => {
      const f = c.fouten ? c.fouten() : null;
      if (!f) return { status: 'ok', detail: 'Geen fout-aggregatie beschikbaar.' };
      if (!f.totaal) return { status: 'ok', detail: 'Geen storingen sinds de start.' };
      const nu = Date.now();
      const recentAantal = (f.recent || []).filter(g => nu - g.laatst < 15 * 60000).reduce((n, g) => n + g.aantal, 0);
      const status = recentAantal > 20 ? 'fout' : recentAantal > 0 ? 'waarschuwing' : 'ok';
      const top = (f.recent || [])[0];
      const kwart = recentAantal ? ` ${recentAantal} in het laatste kwartier.` : '';
      return { status, detail: `${f.totaal} storing(en) totaal, ${f.distinct} soort(en).${kwart}${top ? ' Laatst: ' + top.bericht : ''}` };
    }
  },
  {
    id: 'logstroom', naam: 'Logstroom', code: 'LOG-01', categorie: 'Runtime',
    /* WAAR DE LOG HEEN GAAT, BEPAALT OF HIJ DE SERVER OPHOUDT.

       Node kiest zijn stdout-stroom op wat eraan hangt. Een PIJP (systemd,
       docker, `| logger`) geeft een Socket en schrijft asynchroon. Een BESTAND
       geeft een SyncWriteStream, en dan is elke regel een synchrone
       schrijfactie -- op de event-loop, midden in het afhandelen van een
       verzoek. Met LOG_LEVEL=info schrijft elk verzoek een regel, dus dan
       betaalt elk verzoek dat.

       Gemeten op 24 augustus 2026 onder last (zie PRESTATIES.md): de synchrone
       schrijfactie stond op 5,2% van alle rekentijd, en het verschil tussen een
       bestand en een pijp was 26% op de event-loop-p99 (26,7 -> 19,8 ms) en 40%
       op de hoogste uitschieter (114 -> 68 ms).

       Dit is een INRICHTINGSkeuze en geen fout, dus hooguit een waarschuwing:
       wie zijn uitvoer naar een bestand leidt, hoort te weten wat het kost. */
    run: () => {
      const soort = (process.stdout && process.stdout.constructor && process.stdout.constructor.name) || 'onbekend';
      const perVerzoek = (require('./log').NIVEAU_WAARDE || 20) <= 20;   // info of debug
      if (soort !== 'SyncWriteStream') {
        return { status: 'ok', detail: 'stdout is ' + soort + ': schrijft asynchroon, de event-loop blijft vrij.' };
      }
      if (!perVerzoek) {
        return { status: 'ok', detail: 'stdout is een bestand (synchroon), maar er wordt niet per verzoek gelogd (LOG_LEVEL boven info).' };
      }
      return { status: 'waarschuwing', detail: 'stdout is een BESTAND: elke verzoekregel is een synchrone schrijfactie op de event-loop ' +
        '(gemeten 5,2% CPU en 26% hogere event-loop-p99). Laat de uitvoer door een pijp lopen (systemd, docker, | logger), of zet LOG_LEVEL=warn.' };
    }
  },
  {
    id: 'voordeuren', naam: 'Voordeurprocessen', code: 'TRI-01', categorie: 'Runtime',
    // Oordeel en meting staan in server/trio-stand.js, waar het onderwerp woont.
    run: () => require('./trio-stand').voordeurstand()
  },
  {
    id: 'backups', naam: 'Back-ups', code: 'BAK-01', categorie: 'Data',
    /* HIJ KEEK NAAR DE NAAM VAN EEN MAP. Bestond er een map die YYYY-MM-DD
       heette, dan stond deze check op groen -- leeg, half weggeschreven of met
       een db.json van nul bytes maakte niet uit. Het nakijken staat nu in
       server/backupstand.js, en de bewering "Dagelijkse back-up" in de
       tenantstand leest dezelfde functie: twee oordelen over dezelfde back-up
       lopen vroeg of laat uiteen, en dan is er geen back-upstand meer maar
       twee meningen. */
    run: (c) => {
      try {
        const b = require('./backupstand').lees(c.DATA_DIR);
        if (!b.er) return { status: 'waarschuwing', detail: b.reden.charAt(0).toUpperCase() + b.reden.slice(1) + '.' };
        const kop = `Laatste back-up: ${b.dag} (${b.ouderdom} dag(en) geleden). ${b.bewaard} bewaard.`;
        if (b.ouderdom > 1) return { status: 'waarschuwing', detail: kop };
        if (!b.compleet) return { status: 'waarschuwing', detail: kop + ' NIET COMPLEET: ' + b.reden + '.' };
        return { status: 'ok', detail: kop + ' Nagekeken: ' + b.reden + '.' };
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
