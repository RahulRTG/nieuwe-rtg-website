/* DE AFSLUITING VAN EEN PERIODE: hoeveel van dit geld is bewezen.

   Dit huis heeft controles genoeg. De btw-aangifte weigert op een register dat
   zichzelf tegenspreekt, het toezicht legt facturatie naast wat er is
   aangegeven, de loonaangifte weigert als het nominatieve deel niet optelt, en
   de bewijsketen herbouwt een bedrag uit zijn bronnen. Wat er NIET was, is het
   antwoord op de vraag die een controller stelt aan het eind van een kwartaal:

     is dit af, en waar zit de rest?

   Die controles stonden namelijk elk in hun eigen module, gingen af op hun eigen
   moment, en niemand telde ze bij elkaar op. Verspreid is niet hetzelfde als
   beschikbaar -- hetzelfde argument als bij het loondossier.

   HOE DE DEKKING WORDT GEMETEN, en waarom in CENTEN. Een percentage over "aantal
   controles" is een getal zonder betekenis: drie controles waarvan er een faalt
   is 67%, of die ene nu over twee euro of over twee ton gaat. Dus telt deze
   module GELD:

     bewezen       centen die onder een controle vallen die is uitgevoerd en
                   klopt
     uitzondering  centen waar een controle is uitgevoerd en NIET klopt
     ontbrekend    centen waar geen controle overheen ligt -- de gevaarlijkste
                   categorie, want die ziet er in elk dashboard uit als nul

   WAT DIT NIET IS. Bewezen betekent "twee onafhankelijke wegen komen op dit
   bedrag uit", niet "dit bedrag is juist". Een factuur met een verkeerd tarief
   die netjes in de aangifte staat, telt hier als bewezen -- daar is de
   vreemd-tarief-controle in ./herkomst.js voor. Deze module meet DEKKING, geen
   correctheid, en dat staat in het antwoord zodat niemand het anders leest. */
'use strict';

const { maakBtwTelling, periodeVak } = require('./btwtelling');
const { zekerheid } = require('./zekerheid');

function maakAansluiting({ db, btwAangifte, payrollOS }) {
  const { telFacturen, controleerRegister } = maakBtwTelling({ db });

  const pot = () => ({ bewezen: 0, uitzondering: 0, ontbrekend: 0 });

  /* ---- 1. het factuurregister met zichzelf: regels tegen koppen ---- */
  function registerMetZichzelf(t) {
    const centen = t.verkoopSom;
    const scheef = controleerRegister(t);
    if (!scheef) return { sleutel: 'register.regels-tegen-koppen', pot: 'btw', stand: 'sluit_aan', centen,
      naam: 'Factuurregels tegen de factuurkoppen',
      let: 'Twee wegen door hetzelfde register komen op hetzelfde bedrag uit.' };
    return { sleutel: 'register.regels-tegen-koppen', pot: 'btw', stand: 'wijkt_af', centen,
      verschilCenten: Math.abs(t.verkoopSom - t.verkoopKoppen),
      naam: 'Factuurregels tegen de factuurkoppen', let: scheef.error };
  }

  /* ---- 2. het register tegen wat er is aangegeven ---- */
  function registerTegenAangifte(code, vak, t) {
    const centen = t.verkoopSom;
    const naam = 'Het factuurregister tegen de btw-aangifte';
    if (!btwAangifte) return { sleutel: 'btw.aangifte', pot: 'btw', stand: 'niet_uitgevoerd', centen, naam,
      let: 'De aangiftelaag draait niet.' };
    const over = (btwAangifte.vanZaak(code) || []).filter(a => a.periode === vak.periode);
    const ingediend = over.find(a => a.stand === 'ingediend');
    const concept = over.find(a => a.stand === 'concept');
    if (!ingediend && !concept) return { sleutel: 'btw.aangifte', pot: 'btw', stand: 'niet_uitgevoerd', centen, naam,
      let: 'Over deze periode is niets opgemaakt, dus er valt niets naast te leggen.' };
    const a = ingediend || concept;
    if (a.verschuldigdCenten === t.verkoopSom)
      return { sleutel: 'btw.aangifte', pot: 'btw', stand: 'sluit_aan', centen, naam,
        let: 'Wat er is gefactureerd is ook wat er is aangegeven' + (ingediend ? '.' : ' (concept).') };
    return { sleutel: 'btw.aangifte', pot: 'btw', stand: 'wijkt_af', centen, naam,
      verschilCenten: Math.abs(t.verkoopSom - a.verschuldigdCenten),
      let: 'Geteld uit het register: ' + t.verkoopSom + ' cent; aangegeven: ' + a.verschuldigdCenten + ' cent.' };
  }

  /* ---- 3. de facturen die aan geen tarief toe te wijzen zijn ---- */
  /* Deze telt NIET als een controle die faalt maar als geld waar geen controle
     overheen ligt. Dat onderscheid is de hele reden dat `ontbrekend` bestaat:
     een factuur zonder regels is niet fout, hij is onbekend. */
  function zonderRegels(t) {
    if (!t.zonderRegels.length) return null;
    return { sleutel: 'register.zonder-regels', stand: 'niet_uitgevoerd', centen: 0,
      naam: 'Facturen zonder regels', aantal: t.zonderRegels.length,
      nummers: t.zonderRegels.slice(0, 5),
      let: 'Deze facturen zijn aan geen btw-tarief toe te wijzen en tellen daarom in geen enkele controle mee.' };
  }

  /* ---- 4. de loonkant: de aangifte tegen zijn eigen run ---- */
  function loon(code, vak) {
    const naam = 'De loonaangifte tegen de loonrun';
    if (!payrollOS || !payrollOS.herkomst) return null;
    const maanden = (payrollOS.aangifte.vanZaak(code) || [])
      .filter(a => a.periode >= vak.van.slice(0, 7) && a.periode <= vak.tot.slice(0, 7));
    if (!maanden.length) return { sleutel: 'loon.aangifte', pot: 'loon', stand: 'niet_uitgevoerd', centen: 0, naam,
      let: 'Er is over deze periode geen loonaangifte opgemaakt.' };
    let bewezen = 0, mis = 0;
    const scheef = [];
    for (const a of maanden) {
      const h = payrollOS.herkomst.herbouw(a.id);
      if (h && h.ok && h.gelijk) bewezen += a.teBetalenCenten;
      else { mis += a.teBetalenCenten; scheef.push(a.periode); }
    }
    return { sleutel: 'loon.aangifte', pot: 'loon', stand: mis ? 'wijkt_af' : 'sluit_aan',
      centen: bewezen + mis, verschilCenten: mis, naam, perioden: maanden.map(a => a.periode),
      let: mis ? 'Deze loonaangiftes komen herbouwd niet op hetzelfde uit: ' + scheef.join(', ') + '.'
        : 'Elke loonaangifte is herbouwd uit zijn run en kwam op de cent uit.' };
  }

  /* ---- de afsluiting ---- */
  function sluiting(zaak, periode) {
    if (!zaak || !zaak.code) return { status: 404, error: 'Deze zaak kennen we niet.' };
    const vak = periodeVak(periode);
    if (!vak) return { status: 400, error: 'Geef een periode als 2026K3 (kwartaal) of 2026-07 (maand).' };
    const code = String(zaak.code).toUpperCase();
    const t = telFacturen(code, vak);

    const controles = [registerMetZichzelf(t), registerTegenAangifte(code, vak, t),
      zonderRegels(t), loon(code, vak)].filter(Boolean);

    /* DE POTTEN, EN WAAROM DIT PER GELDSTROOM GAAT EN NIET PER CONTROLE.

       Meerdere controles lopen over HETZELFDE geld: de btw van een kwartaal
       wordt zowel binnen het register nagerekend als tegen de aangifte gelegd.
       Die elk hun eigen centen laten optellen was de eerste opzet hier, en dat
       gaf een totaal van het dubbele van wat er is gefactureerd -- 200% dekking
       op een kwartaal met een factuur erin. De toets ving dat.

       Dus telt hij per POT (de btw van de periode, het loon van de periode), en
       de ZWAARSTE uitslag die eroverheen ligt bepaalt wat ermee gebeurt:

         wijkt een controle af   -> dat verschil is uitzondering
         is er een niet gedaan   -> de rest is ontbrekend, niet bewezen
         alles gedaan en sluitend-> de rest is bewezen

       Die volgorde is niet willekeurig. Een pot waar EEN controle overheen ligt
       die niet is uitgevoerd, is niet half bewezen: hij is onbewezen, ook als
       drie andere controles hem wel goedkeuren. */
    const potten = new Map();
    for (const c of controles) {
      if (!c.pot || !c.centen) continue;
      const v = potten.get(c.pot) || { centen: c.centen, verschil: 0, gat: false };
      v.centen = Math.max(v.centen, c.centen);
      if (c.stand === 'wijkt_af') v.verschil = Math.max(v.verschil, c.verschilCenten || c.centen);
      if (c.stand === 'niet_uitgevoerd') v.gat = true;
      potten.set(c.pot, v);
    }
    const p = pot();
    for (const v of potten.values()) {
      const uitzondering = Math.min(v.verschil, v.centen);
      const rest = v.centen - uitzondering;
      p.uitzondering += uitzondering;
      if (v.gat) p.ontbrekend += rest; else p.bewezen += rest;
    }
    const totaal = p.bewezen + p.uitzondering + p.ontbrekend;
    const deel = (n) => (totaal ? Math.round((n / totaal) * 10000) / 100 : 0);

    return { ok: true, code, periode: vak.periode, van: vak.van, tot: vak.tot,
      controles,
      dekking: { totaalCenten: totaal, bewezenCenten: p.bewezen,
        uitzonderingCenten: p.uitzondering, ontbrekendCenten: p.ontbrekend,
        bewezenPct: deel(p.bewezen), uitzonderingPct: deel(p.uitzondering), ontbrekendPct: deel(p.ontbrekend) },
      af: p.uitzondering === 0 && p.ontbrekend === 0,
      zekerheid: zekerheid('btw.aangifte'),
      let: 'Bewezen betekent dat twee onafhankelijke wegen op hetzelfde bedrag uitkomen -- niet dat het bedrag juist is. Dit meet dekking, geen correctheid.' };
  }

  return { aansluiting: { sluiting } };
}

module.exports = { maakAansluiting };
