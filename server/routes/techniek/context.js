/* Gedeelde meetcontext van het techniekbord. De checks krijgen werkelijke
   runtime-statussen, niet alleen de aanwezigheid van omgevingsvariabelen. */
'use strict';

const dbmod = require('../../db');
const { log } = require('../../log');

module.exports = function maakContext({ kern, db, accounts, anthropic, betaal, sessions, DATA_DIR, fs, path, mail, zekeringen }) {
  return () => ({
    db, accounts, anthropic, betaal, sessions, DATA_DIR, fs, path,
    STORE: dbmod.STORE,
    pgPing: dbmod.pgPing,
    mailGeconfigureerd: !!mail.configured,
    mailLiveGeconfigureerd: !!mail.liveConfigured,
    mailSandboxGeconfigureerd: !!mail.sandboxConfigured,
    smsGeconfigureerd: !!mail.smsConfigured,
    smsSandboxGeconfigureerd: !!mail.smsSandboxConfigured,
    zekeringen: zekeringen(),
    pay: kern.pay,
    bank: kern.bank,
    bankRegie: kern.bankregieOverzicht,
    stad: kern.stad,
    fouten: () => log.foutenSamenvatting()
  });
};
