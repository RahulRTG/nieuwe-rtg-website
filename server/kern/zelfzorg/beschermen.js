/* Zelfzorg, pijler 2: BESCHERMEN. Een wachtronde langs de verdedigingswerken:
   de gezondheidschecks, de open beveiligingsmeldingen, de zekeringen en de
   geld-sluitcontroles. De ronde grijpt zelf nooit in; wat aandacht vraagt
   wordt een concreet advies met de plek waar de mens de knop vindt (het
   techniekbord voor zekeringen, de boardroom voor de schakelkast). */

const techniek = require('../../techniek');
const kluis = require('../../kluis');

module.exports = (ctx) => {
  const { db, schrijf, beveilig, pay, bank, accounts, sessions, DATA_DIR, fs, path, log } = ctx;

  async function bescherm(door) {
    const adviezen = [];
    const acties = [];

    // de gezondheidschecks van het techniekbord, met wat hier voorhanden is
    const zek = (db.data.techniek && db.data.techniek.zekeringen) || {};
    const checks = await techniek.draaiChecks({
      db, accounts, sessions, DATA_DIR, fs, path,
      STORE: require('../../db').STORE, pgPing: require('../../db').pgPing,
      mailGeconfigureerd: !!(process.env.SMTP_URL || process.env.SMTP_HOST),
      zekeringen: zek, pay, bank,
      fouten: log ? () => log.foutenSamenvatting() : null
    });
    const fout = checks.filter(c => c.status === 'fout');
    const waarschuwing = checks.filter(c => c.status === 'waarschuwing');
    acties.push({ wat: 'gezondheidschecks gedraaid', aantal: checks.length });
    for (const c of fout) adviezen.push({ ernst: 'hoog', tekst: c.naam + ' staat op rood: ' + c.detail, waar: 'techniekbord (' + c.code + ')' });

    // versleuteling-at-rest: in productie een must
    if (!kluis.AAN) adviezen.push({ ernst: 'middel', tekst: 'Versleuteling-at-rest staat uit; zet RTG_ENC_KEY voor productie.', waar: 'omgeving (RTG_ENC_KEY)' });

    // open beveiligingsmeldingen uit het commandocentrum
    if (beveilig) {
      const s = beveilig.samenvatting();
      if (s.kritiek) adviezen.push({ ernst: 'hoog', tekst: s.kritiek + ' kritieke beveiligingsmelding(en) staan open.', waar: 'beveiligings-commandocentrum' });
      else if (s.open) adviezen.push({ ernst: 'middel', tekst: s.open + ' beveiligingsmelding(en) wachten op afhandeling.', waar: 'beveiligings-commandocentrum' });
      acties.push({ wat: 'beveiligingsmeldingen nagekeken', aantal: s.open || 0 });
    }

    // de geld-sluitcontroles: beide grootboeken horen exact op nul te sluiten.
    // Faalt er een, dan is dat NOOIT iets om automatisch te "repareren":
    // geld raakt alleen een mens aan, met het grootboek ernaast.
    if (pay && pay.sluitcontrole) {
      const s = pay.sluitcontrole();
      acties.push({ wat: 'wallet-sluitcontrole', aantal: 1 });
      if (!s.klopt) adviezen.push({ ernst: 'hoog', tekst: 'De wallet-sluitcontrole faalt (som ' + s.som + '). Niet automatisch aanraken; grootboek nalopen.', waar: 'techniekbord (PAY-02)' });
    }
    if (bank && bank.gezondheid) {
      const g = bank.gezondheid();
      acties.push({ wat: 'bank-sluitcontrole', aantal: 1 });
      if (g.sluit && !g.sluit.klopt) adviezen.push({ ernst: 'hoog', tekst: 'De bank-sluitcontrole faalt (som ' + g.sluit.som + '). Niet automatisch aanraken; grootboek nalopen.', waar: 'techniekbord (BANK-01)' });
    }

    // recente storingsgolf: dan is de registratie-zekering het overwegen waard
    if (log) {
      const f = log.foutenSamenvatting();
      const kwartier = (f.recent || []).filter(g => Date.now() - g.laatst < 15 * 60000).reduce((n, g) => n + g.aantal, 0);
      if (kwartier > 20) adviezen.push({ ernst: 'middel', tekst: kwartier + ' storingen in het laatste kwartier; overweeg de betrokken zekering tot de oorzaak gevonden is.', waar: 'techniekbord (zekeringen)' });
    }

    const oordeel = fout.length || adviezen.some(a => a.ernst === 'hoog') ? 'let-op' : 'ok';
    const regel = schrijf('beschermen', door, acties, adviezen);
    return { ok: true, oordeel, checks: { ok: checks.length - fout.length - waarschuwing.length, waarschuwing: waarschuwing.length, fout: fout.length }, adviezen, at: regel.at };
  }

  return { bescherm };
};
