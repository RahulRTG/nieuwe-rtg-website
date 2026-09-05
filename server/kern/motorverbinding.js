/* DE GEDEELDE VERBINDING MET DE RUST-MOTOR OP HET GELDPAD.

   Hier stonden twee bestanden die op vijf woorden na hetzelfde deden:
   server/kern/pay/motorklant.js en server/kern/bank/motorklant.js. Allebei
   lazen ze dezelfde vlaggen, bouwden ze dezelfde koppen, deden ze dezelfde
   POST met dezelfde time-out, en vertaalden ze dezelfde fouten. Wat verschilde
   waren twee paden en drie zinnen tekst.

   Dat is precies de vorm waar LAT.md regel 4 over gaat: zodra dezelfde waarheid
   op twee plekken staat lopen ze uiteen, en meestal zonder dat iets klaagt. Op
   het GELDPAD is dat geen theoretisch bezwaar. Een time-out die je op een plek
   verhoogt en op de andere vergeet, een poortwacht-token dat de ene client wel
   en de andere niet meestuurt, een fout die de een als 502 en de ander als 503
   teruggeeft: dat zijn drie manieren om een boeking anders te laten aflopen
   afhankelijk van welk van twee bijna-identieke bestanden hem toevallig deed.

   Dit bestand gaat over WAT er naar de motor gaat: welke twee paden, welk
   lichaam, en hoe een antwoord gelezen moet worden. Of er nog iets HEEN mag --
   de zekering, de gelijktijdigheidsgrens en het dak op de antwoordgrootte --
   staat in ./motorzekering.js. Twee vragen die los van elkaar fout kunnen gaan.

   NOOIT THROWEN OP HET GELDPAD. Elke uitkomst komt terug als {error, status},
   ook een open zekering. De aanroeper spiegelt alleen na een bevestiging, dus
   elke fout betekent: er is niets gebeurd. */
'use strict';

const maakZekering = require('./motorzekering');

module.exports = function maakMotorverbinding({ boekPad, saldiPad, watBoeking, watSaldi }, opties = {}) {
  const globaleNoodstop = process.env.RTG_RUST_ALLES_UIT === '1';
  const modus = globaleNoodstop ? 'uit' : String(process.env.RTG_MOTOR_GELD || 'schaduw').toLowerCase();
  const aan = modus === 'motor';
  const URL = (process.env.RTG_MOTOR_GELD_URL || process.env.RTG_MOTOR_SHADOW || '').replace(/\/$/, '');
  const TIMEOUT_MS = Number(process.env.RTG_MOTOR_GELD_TIMEOUT || 5000);
  /* Het gedeelde geheim van de motor-poortwacht. Staat het daar gezet, dan
     weigert de motor elk verzoek zonder geldig token -- dus moet de client hem
     meesturen. Leeg laten is prima zolang de motor op loopback staat. */
  const TOKEN = process.env.RTG_MOTOR_TOKEN || '';
  const koppen = () => {
    const h = { 'content-type': 'application/json' };
    if (TOKEN) h['x-rtg-motor-token'] = TOKEN;
    return h;
  };

  if (aan && !URL) {
    // Fail-closed: motor-modus zonder motor-URL is een misconfiguratie. Beter nu
    // luid dan stil geld verliezen.
    throw new Error('RTG_MOTOR_GELD=motor maar geen RTG_MOTOR_GELD_URL / RTG_MOTOR_SHADOW gezet.');
  }

  const zekering = maakZekering({ url: URL, koppen, timeoutMs: TIMEOUT_MS }, opties);

  return {
    aan, modus, globaleNoodstop, url: URL,

    /* Boeken op de motor (autoriteit). NOOIT throwen op het geld-pad: de caller
       vertaalt dit naar een nette fout en past NIETS toe op de spiegel bij een
       fout. */
    async boek({ van, naar, centen, soort, oms, ref, economischeSleutel }) {
      if (!aan) return { error: 'Rust-motor staat uit; JavaScript blijft autoritatief.', status: 503 };
      const r = await zekering.verstuur(boekPad, { van, naar, centen: Math.round(Number(centen)), soort, oms, ref,
        idem: economischeSleutel || undefined });
      if (r.fout) return r.fout;
      const { http, body } = r;
      if (http >= 300 || !body || body.ok !== true || !body.boeking) {
        return { error: (body && body.error) || ('Motor weigerde ' + watBoeking + '.'), status: http || 502 };
      }
      return { ok: true, boeking: body.boeking, herhaald: !!body.herhaald,
        saldoVan: body.saldoVan, saldoNaar: body.saldoNaar };
    },

    /* De volledige saldi-stand van de motor (autoriteit), voor de herstart-
       reconcile van de JS-spiegel. Vereist RTG_MOTOR_SALDI=1 (of _DEBUG=1) op
       de motor. */
    async saldi() {
      if (!aan) return { error: 'Rust-motor staat uit; geen ' + watSaldi + ' opgevraagd.', status: 503 };
      const r = await zekering.verstuur(saldiPad, {});
      if (r.fout) return r.fout;
      const { http, body } = r;
      if (http >= 300) return { error: 'Motor gaf ' + http + ' op ' + saldiPad + ' (staat RTG_MOTOR_SALDI=1 aan?).', status: http };
      if (!body || typeof body !== 'object') return { error: 'Motor gaf geen saldi terug.', status: 502 };
      return { ok: true, saldi: body };
    },

    /* Voor het techniekbord: de stand van de zekering plus wie hij bewaakt. */
    stand: () => Object.assign({ aan, modus, globaleNoodstop }, zekering.stand()),
  };
};
