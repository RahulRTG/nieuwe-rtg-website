/* Zelfzorg, pijler 4: UPGRADEN. De datakast heeft een schemaversie
   (db.data.__schema); nieuwe code brengt genummerde migraties mee. De kaart
   toont eerlijk wat er klaarstaat, en de knop voert ze uit: eerst een
   back-up, dan elke migratie in volgorde, dan de versie omhoog. Migraties
   zijn klein, idempotent en raken nooit geld of klantinhoud; wat dat wel zou
   moeten, hoort in de ontwikkelstraat (code), niet in een datamigratie. */

const pakket = require('../../../package.json');

module.exports = (ctx) => {
  const { db, save, schrijf, fs, path, DATA_DIR } = ctx;

  /* Elke migratie: een versienummer, een uitleg in mensentaal, en een
     idempotente run. De hoogste v is de doelversie van deze code. */
  const MIGRATIES = [
    {
      v: 2, uitleg: 'Zelfzorg-journaal aanleggen en de verlopen inhoud (snaps, verhalen, munt-ontvangsten) eenmalig vegen',
      run: () => { ctx.z(); if (ctx.opruim) ctx.opruim('migratie v2'); }
    }
  ];

  const doelSchema = () => MIGRATIES.reduce((m, x) => Math.max(m, x.v), 1);
  const huidig = () => Number(db.data.__schema || 1);
  const wachtendeMigraties = () => MIGRATIES.filter(m => m.v > huidig()).map(m => ({ v: m.v, uitleg: m.uitleg }));

  /* Voor de grote klap eerst een kopie van de kast. Op mega-schaal (waar
     Postgres de waarheid is en de kast honderden MB's kan zijn) slaan we de
     lokale kopie eerlijk over in plaats van de server minutenlang te laten
     serialiseren; Postgres zelf blijft dan het vangnet. */
  function backup() {
    try {
      const j = JSON.stringify(db.data);
      if (j.length > 50 * 1024 * 1024) return { gemaakt: false, reden: 'kast te groot voor een lokale kopie; de gedeelde opslag is het vangnet' };
      const dir = path.join(DATA_DIR, 'backups');
      fs.mkdirSync(dir, { recursive: true });
      const naam = 'pre-upgrade-v' + huidig() + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      fs.writeFileSync(path.join(dir, naam), j, { mode: 0o600 });
      return { gemaakt: true, bestand: naam };
    } catch (e) { return { gemaakt: false, reden: e.message }; }
  }

  function upgrade(door) {
    const wachtend = MIGRATIES.filter(m => m.v > huidig()).sort((a, b) => a.v - b.v);
    if (!wachtend.length) {
      const regel = schrijf('upgraden', door, [{ wat: 'al op schema v' + huidig() + '; niets te doen', aantal: 0 }], []);
      return { ok: true, bijgewerkt: false, schema: huidig(), at: regel.at };
    }
    const acties = [];
    const bak = backup();
    acties.push({ wat: bak.gemaakt ? 'back-up gemaakt (' + bak.bestand + ')' : 'back-up overgeslagen: ' + bak.reden, aantal: 1 });
    for (const m of wachtend) {
      m.run();
      db.data.__schema = m.v;
      acties.push({ wat: 'migratie v' + m.v + ': ' + m.uitleg, aantal: 1 });
    }
    save();
    const regel = schrijf('upgraden', door, acties, []);
    return { ok: true, bijgewerkt: true, schema: huidig(), acties, at: regel.at };
  }

  return { upgrade, doelSchema, wachtendeMigraties, pakketVersie: () => pakket.version || '0.0.0' };
};
