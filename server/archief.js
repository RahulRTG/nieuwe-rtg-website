/* ============================================================================
   De archiefkast: afgeronde tickets verhuizen uit de levende kast.

   Waarom: de levende datastore (db.data) wordt bij elke wijziging in zijn
   geheel geserialiseerd. De spitsuur-test bewees dat dat vlot blijft zolang
   de kast tienduizenden tickets bevat, maar bij honderdduizenden tot
   miljoenen levende tickets horen flush-pauzes van seconden. Tickets die
   afgerond EN ouder dan een afgesloten kwartaal zijn, verhuizen daarom naar
   een append-only archief op schijf (JSONL per maand). Zo blijft de levende
   kast klein en snel, terwijl niets ooit verloren gaat:

   - het archiefbestand is duurzaam (fsync) geschreven VOOR de levende kast
     wordt aangepast; crasht het daartussen, dan archiveert de volgende ronde
     opnieuw en staat een ticket hooguit dubbel in het archief (zelfde ref),
     nooit nergens;
   - de boekhoud-export (export.csv) leest het archief gewoon mee;
   - de backoffice-totalen tellen het archief mee via de kleine tellerstaat
     in db.data.archief (aantallen en betaalde omzet, per zaak en per maand);
   - de maandboekhouding van de zaak (financeVoor) rekent alleen over de
     lopende maand en raakt het archief dus per definitie nooit: de grens
     staat standaard op 92 dagen, een afgesloten kwartaal plus marge.

   In vloot-modus (RTG_DOMAINS) archiveert alleen het office-domein, zodat
   niet twee processen tegelijk aan de orders-collectie trekken.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

module.exports = function maakArchief({ db, save, DATA_DIR }) {
  const DAGEN = Math.max(7, Number(process.env.RTG_ARCHIEF_DAGEN || 92));
  const MAP = path.join(DATA_DIR, 'archief');
  const KLAAR = { geserveerd: 1, geweigerd: 1, terugbetaald: 1 };
  const NUL = { aantal: 0, omzetBetaald: 0, perZaak: {}, perMaand: {} };

  /* Alleen-lezen zicht op de tellerstaat: muteert db.data niet, zodat
     leesroutes (backoffice-totalen) geen schrijfwerk veroorzaken. */
  function stat() {
    return (db.data.archief && db.data.archief.orders) || NUL;
  }

  function archiveerNu() {
    if (!db.writable) return { verplaatst: 0 };
    const grens = Date.now() - DAGEN * 86400000;
    const blijven = [], weg = [];
    for (const o of db.data.orders || []) {
      (KLAAR[o.status] && new Date(o.at).getTime() < grens ? weg : blijven).push(o);
    }
    if (!weg.length) return { verplaatst: 0 };

    // 1) eerst duurzaam naar schijf, per maandbestand (append-only JSONL)
    fs.mkdirSync(MAP, { recursive: true, mode: 0o700 });
    const perBestand = new Map();
    for (const o of weg) {
      const m = String(o.at).slice(0, 7) || 'onbekend';
      if (!perBestand.has(m)) perBestand.set(m, []);
      perBestand.get(m).push(JSON.stringify(o));
    }
    for (const [m, regels] of perBestand) {
      const f = path.join(MAP, 'orders-' + m + '.jsonl');
      const fd = fs.openSync(f, 'a', 0o600);
      try { fs.writeSync(fd, regels.join('\n') + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }

    // 2) dan de tellerstaat bijwerken en de levende kast verkleinen
    const a = db.data.archief = db.data.archief || {};
    const s = a.orders = a.orders || { aantal: 0, omzetBetaald: 0, perZaak: {}, perMaand: {} };
    for (const o of weg) {
      const m = String(o.at).slice(0, 7);
      const z = s.perZaak[o.supplierCode] = s.perZaak[o.supplierCode] || { aantal: 0, omzetBetaald: 0 };
      const pm = s.perMaand[m] = s.perMaand[m] || { aantal: 0, omzetBetaald: 0 };
      s.aantal += 1; z.aantal += 1; pm.aantal += 1;
      if (o.paid && o.status === 'geserveerd') {
        const bedrag = o.total || 0;
        s.omzetBetaald += bedrag; z.omzetBetaald += bedrag; pm.omzetBetaald += bedrag;
      }
    }
    db.data.orders = blijven;
    save();
    console.log('[archief] ' + weg.length + ' afgeronde tickets (ouder dan ' + DAGEN +
      ' dagen) verhuisd naar het archief; ' + blijven.length + ' levend, ' + s.aantal + ' totaal in het archief.');
    return { verplaatst: weg.length };
  }

  /* Alle gearchiveerde orders teruglezen, oudste maand eerst. Synchronous
     generator: bedoeld voor de (zeldzame, beheerders-)export, niet voor het
     verzoekpad van leden. */
  function* leesAlles() {
    let bestanden = [];
    try { bestanden = fs.readdirSync(MAP).filter(f => /^orders-.*\.jsonl$/.test(f)).sort(); } catch (e) { return; }
    for (const f of bestanden) {
      let inhoud = '';
      try { inhoud = fs.readFileSync(path.join(MAP, f), 'utf8'); } catch (e) { continue; }
      for (const regel of inhoud.split('\n')) {
        if (!regel) continue;
        try { yield JSON.parse(regel); } catch (e) { /* halve regel na een crash: overslaan */ }
      }
    }
  }

  return { archiveerNu, stat, leesAlles, MAP, DAGEN };
};
