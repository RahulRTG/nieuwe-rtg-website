/* DE LOKALE KANALEN EN HUN ZEKERING.

   Twee dingen die in ./mail.js stonden en er niet over gaan: het versturen van
   een SMS (dat gebeurt hier volledig lokaal -- er is bewust GEEN extern
   SMS-kanaal aangesloten) en de runtime-schakelaar waarmee de Integratiekamer
   de twee sandboxen aan- en uitzet.

   WAAROM DIT EEN EIGEN BESTAND IS

   ./mail.js stond op 13302 byte, over de grens uit keuringsregel 13. Maar de
   winst is niet de omvang: het is dat de TWEE VLAGGEN nu een eigenaar hebben.
   Ze stonden bovenin mail.js, werden op vier plaatsen gelezen en op twee
   geschreven, en niets wees aan wie erover ging. Hier woont de stand naast de
   enige functie die hem verzet, en de rest vraagt hem op (`smtpAan()`).

   DAAROM EEN FABRIEK EN GEEN LOSSE FUNCTIES. Twee kopieen van deze module
   zouden twee standen hebben, en dan zet de Integratiekamer de sandbox uit
   terwijl de verzendkant hem nog aan ziet staan. Een module wordt in Node maar
   een keer geladen, dus dat kan niet gebeuren -- maar de vorm zegt het nu ook.

   WAT ER BINNENKOMT. De startconfiguratie die mail.js uit de omgeving leest, en
   `toOutbox`: het vangnet is van mail.js en wordt hier gebruikt, niet nagemaakt.
   ========================================================================== */
'use strict';
const smsSandbox = require('./sms-sandbox');

module.exports = ({ CONFIGURED, SMTP_SANDBOX, DIRECT, toOutbox }) => {
  /* De lokale sandboxes krijgen bovenop hun startconfiguratie een runtime-
     zekering. De Integratiekamer kan ze UIT zetten zonder procesherstart; AAN kan
     alleen wanneer de veilige lokale provider bij de start echt is ingericht. */
  let smtpSandboxAan = CONFIGURED && SMTP_SANDBOX;
  let smsSandboxAan = smsSandbox.enabled;

  /* Providerachtige SMS-aflevering, volledig lokaal. In sandboxstand valideert
     de contractsimulator eerst het verzoek; pas bij acceptatie komt het bericht
     in de (waar mogelijk versleutelde) outbox. Zonder sandbox blijft de outbox
     het zichtbare lokale vangnet. */
  function sendSms(to, subject, text) {
    const journaal = (gelukt, hoe, reden) => {
      try { require('./journaalhaak').meld({ richting: 'uit', wat: 'post/' + hoe, naar: 'sms:' + to, mislukt: !gelukt, reden }); } catch (e) {}
    };
    try {
      if (smsSandbox.enabled && !smsSandboxAan) {
        const e = new Error('De SMS-sandbox is door de Integratiekamer uitgezet.');
        e.code = 'SMS_SANDBOX_UIT';
        throw e;
      }
      const r = smsSandbox.enabled
        ? smsSandbox.send(to, text)
        : { ok: true, status: 'outbox', provider: 'outbox', sandbox: false, bezorgd: false };
      toOutbox('sms:' + to, subject, text);
      journaal(true, smsSandbox.enabled ? 'sms-sandbox' : 'outbox');
      return r;
    } catch (e) {
      journaal(false, smsSandbox.enabled ? 'sms-sandbox' : 'outbox', e.message);
      throw e;
    }
  }

  function zetSandbox(kanaal, aan) {
    if (process.env.NODE_ENV === 'production') return { ok: false, code: 'SANDBOX_PRODUCTIE', error: 'Een lokale sandbox kan niet in productie worden geschakeld.' };
    if (kanaal === 'smtp') {
      if (aan && !(CONFIGURED && SMTP_SANDBOX)) return { ok: false, code: 'SMTP_SANDBOX_NIET_INGERICHT', error: 'Richt eerst SMTP_SANDBOX met een lokale SMTP_URL in.' };
      smtpSandboxAan = !!aan;
      return { ok: true, aan: smtpSandboxAan };
    }
    if (kanaal === 'sms') {
      if (aan && !smsSandbox.enabled) return { ok: false, code: 'SMS_SANDBOX_NIET_INGERICHT', error: 'Zet SMS_SANDBOX=1 bij de lokale start.' };
      smsSandboxAan = !!aan;
      return { ok: true, aan: smsSandboxAan };
    }
    return { ok: false, code: 'KANAAL_ONBEKEND', error: 'Onbekend postkanaal.' };
  }

  function sandboxStand() {
    return {
      smtp: { geconfigureerd: CONFIGURED && SMTP_SANDBOX, aan: smtpSandboxAan, live: (CONFIGURED && !SMTP_SANDBOX) || DIRECT },
      sms: { geconfigureerd: smsSandbox.enabled, aan: smsSandboxAan, live: false }
    };
  }

  /* De verzendkant (send en bezorgNu in mail.js) leest deze stand; hij schrijft
     hem nooit. Een getter en geen waarde, want de vlag verandert tijdens de rit. */
  return { sendSms, zetSandbox, sandboxStand, smtpAan: () => smtpSandboxAan };
};
