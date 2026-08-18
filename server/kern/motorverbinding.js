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

   DIT IS EEN ZUIVERE VERPLAATSING EN GEEN VERBETERING. Zelfde vlaggen, zelfde
   time-out, zelfde koppen, zelfde foutteksten, zelfde statuscodes, zelfde
   fail-closed bij een ontbrekende URL. Wie dit leest en denkt "hier had ook
   meteen X bij gekund" heeft gelijk -- zie de notitie onderaan -- maar een
   refactor van een geldpad die tegelijk gedrag verandert is niet meer na te
   trekken, en dan weet niemand meer of een verschil van de verplaatsing kwam of
   van de verbetering.

   WAT ER BEWUST NIET IN ZIT, EN HET IS OPGEMERKT. server/kern/magnaat-motorklant.js
   praat met dezelfde motor en heeft daar wel een zekering omheen: een
   foutenteller met afkoelperiode (stop met bellen als de motor stuk is), een
   grens op het aantal gelijktijdige verzoeken, en een maximum op de grootte van
   het antwoord. Die drie ontbreken hier -- op het pad waar geld loopt, en dat
   is het pad waar ze het hardst nodig zijn. Dat is een echte bevinding en geen
   detail, maar het is een GEDRAGSwijziging op boekingen en hoort dus in een
   eigen ronde met een eigen bewijs, niet stiekem mee in een samenvoeging. */
'use strict';

module.exports = function maakMotorverbinding({ boekPad, saldiPad, watBoeking, watSaldi, vlagUitleg }) {
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

  async function post(pad, body) {
    const af = new AbortController();
    const t = setTimeout(() => af.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(URL + pad, {
        method: 'POST', headers: koppen(),
        body: JSON.stringify(body || {}), signal: af.signal,
      });
      const j = await r.json().catch(() => ({}));
      return { http: r.status, body: j };
    } finally { clearTimeout(t); }
  }

  const onbereikbaar = (e) => ({
    error: e.name === 'AbortError' ? 'Motor-time-out.' : ('Motor onbereikbaar: ' + e.message),
    status: 502
  });

  return {
    aan, modus, globaleNoodstop, url: URL,

    /* Boeken op de motor (autoriteit). NOOIT throwen op het geld-pad: de caller
       vertaalt dit naar een nette fout en past NIETS toe op de spiegel bij een
       fout. */
    async boek({ van, naar, centen, soort, oms, ref }) {
      if (!aan) return { error: 'Rust-motor staat uit; JavaScript blijft autoritatief.', status: 503 };
      try {
        const { http, body } = await post(boekPad, { van, naar, centen: Math.round(Number(centen)), soort, oms, ref });
        if (http >= 300 || !body || body.ok !== true || !body.boeking) {
          return { error: (body && body.error) || ('Motor weigerde ' + watBoeking + '.'), status: http || 502 };
        }
        return { ok: true, boeking: body.boeking };
      } catch (e) { return onbereikbaar(e); }
    },

    /* De volledige saldi-stand van de motor (autoriteit), voor de herstart-
       reconcile van de JS-spiegel. Vereist RTG_MOTOR_SALDI=1 (of _DEBUG=1) op
       de motor. */
    async saldi() {
      if (!aan) return { error: 'Rust-motor staat uit; geen ' + watSaldi + ' opgevraagd.', status: 503 };
      const af = new AbortController();
      const t = setTimeout(() => af.abort(), TIMEOUT_MS);
      try {
        const r = await fetch(URL + saldiPad, { method: 'POST', headers: koppen(), body: '{}', signal: af.signal });
        if (r.status >= 300) return { error: 'Motor gaf ' + r.status + ' op ' + saldiPad + ' (staat RTG_MOTOR_SALDI=1 aan?).', status: r.status };
        const j = await r.json().catch(() => null);
        if (!j || typeof j !== 'object') return { error: 'Motor gaf geen saldi terug.', status: 502 };
        return { ok: true, saldi: j };
      } catch (e) { return onbereikbaar(e); }
      finally { clearTimeout(t); }
    },
  };
};
