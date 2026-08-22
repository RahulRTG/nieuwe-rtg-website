'use strict';
/* LCOV SAMENVOEGEN -- de reden dat de suite in één stap zat.

   HET PROBLEEM. `node --test --experimental-test-coverage --test-coverage-lines=78`
   rekent de vloer uit over ÉÉN proces. Verdeel je de 1083 toetsbestanden over
   vier parallelle jobs, dan meet elke job alleen de code die zijn eigen scherf
   aanraakt en zakt hij op de vloer -- terwijl de suite als geheel er ruim
   overheen zit. Daarom draaide alles achter elkaar: vier uur, en met elke
   samenvoeging langer.

   HET ANTWOORD. Elke scherf schrijft zijn dekking als lcov weg; daarna worden ze
   opgeteld en wordt de vloer één keer over het TOTAAL gehandhaafd. Optellen is
   hier geen middeling maar echt optellen: regel 12 van bestand X is gedekt als
   ÉÉN scherf hem heeft aangeraakt. Dat is precies wat het ene proces ook deed.

   WAT LCOV IS, in de vier regels die er hier toe doen:
     SF:<pad>              begin van een bestand
     DA:<regel>,<aantal>   deze regel is zoveel keer uitgevoerd
     FNDA:<aantal>,<naam>  deze functie is zoveel keer aangeroepen
     BRDA:<regel>,<blok>,<tak>,<genomen>   `-` betekent: nooit bereikt
     end_of_record

   De tellingen LF/LH/FNF/FNH/BRF/BRH staan er ook in, maar die worden hier
   opnieuw gerekend en niet overgenomen: een som van twee percentages is geen
   percentage, en een som van twee "hit"-tellingen telt een regel die in beide
   scherven is geraakt dubbel.

   EEN GEMISTE REGEL BLIJFT GEMIST. `DA:12,0` in alle scherven blijft 0. Alleen
   waar minstens één scherf een treffer heeft, telt hij als gedekt -- de zeef
   staat dus nooit ruimer dan het enkele proces.
   ========================================================================== */
const fs = require('fs');

function ontleed(tekst) {
  const bestanden = new Map();
  let nu = null;
  for (const rauw of String(tekst).split('\n')) {
    const r = rauw.trim();
    if (!r) continue;
    if (r.startsWith('SF:')) {
      const pad = r.slice(3);
      nu = bestanden.get(pad);
      if (!nu) { nu = { pad, regels: new Map(), functies: new Map(), takken: new Map() }; bestanden.set(pad, nu); }
      continue;
    }
    if (!nu) continue;
    if (r === 'end_of_record') { nu = null; continue; }
    if (r.startsWith('DA:')) {
      const [lijn, aantal] = r.slice(3).split(',');
      nu.regels.set(lijn, (nu.regels.get(lijn) || 0) + (Number(aantal) || 0));
    } else if (r.startsWith('FNDA:')) {
      const stuk = r.slice(5);
      const komma = stuk.indexOf(',');
      const aantal = Number(stuk.slice(0, komma)) || 0;
      const naam = stuk.slice(komma + 1);
      nu.functies.set(naam, (nu.functies.get(naam) || 0) + aantal);
    } else if (r.startsWith('FN:')) {
      const stuk = r.slice(3);
      const naam = stuk.slice(stuk.indexOf(',') + 1);
      if (!nu.functies.has(naam)) nu.functies.set(naam, 0);
    } else if (r.startsWith('BRDA:')) {
      const [lijn, blok, tak, genomen] = r.slice(5).split(',');
      const sleutel = lijn + ':' + blok + ':' + tak;
      /* `-` betekent "dit blok is nooit bereikt". Dat is iets anders dan nul
         keer genomen, maar voor de vloer telt allebei als niet-gedekt -- en een
         `-` in de ene scherf mag een echte treffer in de andere niet wissen. */
      const n = genomen === '-' ? 0 : (Number(genomen) || 0);
      nu.takken.set(sleutel, (nu.takken.get(sleutel) || 0) + n);
    }
  }
  return bestanden;
}

function voegSamen(teksten) {
  const totaal = new Map();
  for (const t of teksten) {
    for (const [pad, b] of ontleed(t)) {
      let doel = totaal.get(pad);
      if (!doel) { doel = { pad, regels: new Map(), functies: new Map(), takken: new Map() }; totaal.set(pad, doel); }
      for (const [k, v] of b.regels) doel.regels.set(k, (doel.regels.get(k) || 0) + v);
      for (const [k, v] of b.functies) doel.functies.set(k, (doel.functies.get(k) || 0) + v);
      for (const [k, v] of b.takken) doel.takken.set(k, (doel.takken.get(k) || 0) + v);
    }
  }
  return totaal;
}

function tel(samen) {
  let LF = 0, LH = 0, FNF = 0, FNH = 0, BRF = 0, BRH = 0;
  for (const b of samen.values()) {
    for (const v of b.regels.values()) { LF++; if (v > 0) LH++; }
    for (const v of b.functies.values()) { FNF++; if (v > 0) FNH++; }
    for (const v of b.takken.values()) { BRF++; if (v > 0) BRH++; }
  }
  const pct = (h, f) => (f === 0 ? 100 : Math.round((h / f) * 10000) / 100);
  return { bestanden: samen.size, regels: { gedekt: LH, totaal: LF, pct: pct(LH, LF) },
    functies: { gedekt: FNH, totaal: FNF, pct: pct(FNH, FNF) },
    takken: { gedekt: BRH, totaal: BRF, pct: pct(BRH, BRF) } };
}

function lees(paden) {
  const uit = [];
  for (const p of paden) {
    try { uit.push(fs.readFileSync(p, 'utf8')); }
    catch (e) { throw new Error('lcov-bestand niet te lezen: ' + p + ' -- ' + e.message); }
  }
  return uit;
}

module.exports = { ontleed, voegSamen, tel, lees };
