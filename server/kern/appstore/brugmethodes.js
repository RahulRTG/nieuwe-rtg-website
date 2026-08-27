/* ============================================================================
   HET CONTRACT MET EEN DERDE -- de zes methodes die een app kan aanroepen.

   Afgesplitst van ./brug.js langs een echte naad. Deze tabel is het CONTRACT:
   wat een app kan vragen en wat hij dan terugkrijgt. ./brug.js is de POORT: de
   rem, de machtigingscontrole, het weigeren en het tellen. Wie wil weten wat een
   app MAG, leest een tabel; wie wil weten of hij erdoor KOMT, leest de poort.

   ER ZIJN ER ZES, EN DAT IS EEN GESLOTEN LIJST. Elke regel draagt drie dingen:
   welke MACHTIGING een lid ervoor moet hebben verleend, welke MUTATIEKLASSE
   hij heeft (mag deze aanroep herhaald worden?), en wat hij DOET. Geen van de
   drie is optioneel -- een methode zonder mutatieklasse laat de server niet
   starten, en die poort staat in ./brug.js waar de tabel wordt aangenomen.

   Wat er met opzet NIET in staat, staat in ./machtigingen.js onder
   NIET_GEBOUWD, mét de reden. Push staat daar bovenaan: `bericht.zet` ZET KLAAR
   en stuurt niet, en dat is geen instelling maar het ontbreken van een weg.
   ========================================================================== */
'use strict';

function maakMethodes({ GRENS, bak, nu, save }) {
  const METHODES = {
    /* profiel.basis -- de codenaam en verder niets waarmee je iemand vindt. */
    'profiel.wieBenIk': { machtiging: 'profiel.basis', mutatie: 'idempotent', doe: (ctx) => ({
      codenaam: ctx.codenaam, taal: ctx.taal, pas: ctx.pas,
      let: 'Dit is alles wat een app van derden over jou te zien krijgt.' }) },

    /* opslag.eigen -- een kladblok per app per lid. */
    'opslag.lees': { machtiging: 'opslag.eigen', mutatie: 'idempotent', doe: (ctx, args) => {
      const k = String((args && args.sleutel) || '').slice(0, GRENS.opslagSleutelLengte);
      const b = bak('opslag', ctx.sleutel, ctx.key);
      return { sleutel: k, waarde: Object.prototype.hasOwnProperty.call(b, k) ? b[k] : null };
    } },
    'opslag.lijst': { machtiging: 'opslag.eigen', mutatie: 'idempotent', doe: (ctx) => ({ sleutels: Object.keys(bak('opslag', ctx.sleutel, ctx.key)).sort() }) },
    'opslag.zet': { machtiging: 'opslag.eigen', mutatie: 'idempotent', doe: (ctx, args) => {
      const k = String((args && args.sleutel) || '').trim();
      if (!k || k.length > GRENS.opslagSleutelLengte) return { fout: 'Een sleutel is 1 tot ' + GRENS.opslagSleutelLengte + ' tekens.' };
      const w = args && args.waarde == null ? '' : String(args.waarde);
      if (w.length > GRENS.opslagWaarde) return { fout: 'Een waarde is hooguit ' + GRENS.opslagWaarde + ' tekens; deze is er ' + w.length + '.' };
      const b = bak('opslag', ctx.sleutel, ctx.key);
      const nieuw = !Object.prototype.hasOwnProperty.call(b, k);
      if (nieuw && Object.keys(b).length >= GRENS.opslagSleutels) return { fout: 'Je app heeft al ' + GRENS.opslagSleutels + ' sleutels bij dit lid; wis er eerst een.' };
      const totaal = Object.entries(b).reduce((n, [kk, vv]) => n + kk.length + String(vv).length, 0) - (nieuw ? 0 : k.length + String(b[k]).length);
      if (totaal + k.length + w.length > GRENS.opslagTotaal) return { fout: 'Het kladblok van je app bij dit lid is vol (' + Math.round(GRENS.opslagTotaal / 1024) + ' kB).' };
      b[k] = w; save();
      return { ok: true, sleutel: k };
    } },
    'opslag.wis': { machtiging: 'opslag.eigen', mutatie: 'idempotent', doe: (ctx, args) => {
      const b = bak('opslag', ctx.sleutel, ctx.key);
      const k = String((args && args.sleutel) || '');
      if (Object.prototype.hasOwnProperty.call(b, k)) { delete b[k]; save(); }
      return { ok: true };
    } },

    /* bericht.klaarzetten -- KLAARZETTEN, niet sturen. Het bericht komt in het
       bakje van deze app; het lid haalt het op in de App Store. Er gaat geen
       push, geen e-mail en geen sms achteraan, en dat is geen kwestie van
       instellingen: er is geen weg naartoe (zie machtigingen.NIET_GEBOUWD). */
    'bericht.zet': { machtiging: 'bericht.klaarzetten', mutatie: 'nietHerhaalbaar', doe: (ctx, args) => {
      const t = String((args && args.tekst) || '').trim().slice(0, GRENS.berichtLengte);
      if (t.length < 2) return { fout: 'Een bericht is 2 tot ' + GRENS.berichtLengte + ' tekens.' };
      const b = bak('bakjes', ctx.key, ctx.sleutel);
      const dag = nu().slice(0, 10);
      if (b.filter(x => String(x.at).slice(0, 10) === dag).length >= GRENS.berichtenPerDag) {
        return { fout: 'Je app heeft vandaag al ' + GRENS.berichtenPerDag + ' berichten voor dit lid klaargezet. Dat is het maximum.' };
      }
      b.unshift({ id: Math.random().toString(36).slice(2, 10), tekst: t, at: nu(), gelezen: false });
      if (b.length > GRENS.bakGrootte) b.length = GRENS.bakGrootte;
      save();
      return { ok: true, klaargezet: t };
    } }
  };

  return METHODES;
}

module.exports = { maakMethodes };
