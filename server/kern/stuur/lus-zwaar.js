/* EEN ZWARE OPDRACHT OPKNIPPEN -- de deeltaken, hun lussen en de synthese.

   Afgesplitst uit ./lus.js toen dat door de omvangband van keuringsregel
   `omvang` ging. De naad is echt en niet cosmetisch: ./lus.js houdt EEN BEURT
   (de lus naar het model, de tools, het budget) en dit bestand houdt de
   TAAKVERDELING erboven -- opknippen, per deeltaak een eigen lus, en aan het
   eind een antwoord dat een mens kan lezen. Die twee schuiven om verschillende
   redenen. Zelfde naad als ./lusstap.js en ./lusregels.js.

   HIJ BEZIT DE LUS NIET, HIJ KRIJGT HEM. `loop` komt binnen als functie; dit
   bestand kent het stappenbudget, de tools en het spoor niet. Zou het die zelf
   opbouwen, dan waren er twee plekken die een beurt draaien -- en dan is de
   vraag "welke poort zat ertussen" niet meer met een antwoord te beantwoorden.

   DE PLANNER IS EEN MODELAANROEP EN GEEN POORT. Wat hij teruggeeft zijn
   NAMEN van deeltaken; elke deeltaak loopt daarna door dezelfde lus met
   dezelfde poorten als een lichte taak. Een deeltaak kan dus nooit iets wat een
   losse vraag niet zou mogen -- de opdeling verandert het budget en niet de
   bevoegdheid.

   ZONDER NETTE OPDELING IS HET EEN KLUS. Geeft de planner niets bruikbaars
   terug, dan wordt de hele vraag als een deeltaak gedraaid. Dat is met opzet
   geen foutmelding: de opdeling is een besparing, geen voorwaarde.

   DE HUISREGELS MOETEN HIER LEXICAAL STAAN, EN DAT IS GEEN FORMALITEIT. Deze
   afsplitsing maakte een gat dat keuringsregel 34 meteen vond: de SYNTHESE
   schrijft vrije tekst aan een lid, en droeg de toegangsregel alleen doordat
   ./lus.js `systeem` meegaf. Wie `zwaar()` ooit zonder dat veld aanroept, laat
   die regel stil verdwijnen -- en een merkregel die aan een parameter hangt, is
   geen merkregel. Vandaar de terugval op LUS_REGELS hieronder: hij faalt naar
   de VEILIGE kant en is bovendien te zien voor wie het bestand leest.

   De PLANNER-aanroep draagt hem met opzet niet. Die vraagt uitsluitend een
   JSON-array met namen van deeltaken en schrijft niets aan een mens; dat is
   dezelfde categorie als de bestaande uitzonderingen in scripts/check.js. */
'use strict';

const { LUS_REGELS } = require('./lusregels');

async function zwaar({ anthropic, parseSubs, loop, opStap, systeem, vraag, metContext, totaal, acties }) {
  let subs = [];
  try {
    const plan = await anthropic.messages.create({
      model: 'claude-sonnet-5', max_tokens: 350,
      system: 'Je bent een planner. Verdeel de opdracht in maximaal 3 concrete, uitvoerbare deeltaken. ' +
        'Antwoord UITSLUITEND met een JSON-array van korte NL-strings, niets anders.',
      messages: [{ role: 'user', content: vraag }]
    });
    subs = parseSubs(plan.content.filter(c => c.type === 'text').map(c => c.text).join(''));
  } catch (e) { subs = []; }
  if (!subs.length) subs = [vraag]; // geen nette splitsing? dan als één klus

  let tel = 0; const deel = [];
  const perSub = Math.max(4, Math.floor(totaal / subs.length));
  for (let i = 0; i < subs.length && tel < totaal; i++) {
    const label = subs[i];
    try { opStap({ stap: tel, totaal, bericht: label }); } catch (e) {}
    const seed = [{ role: 'user', content:
      'Hoofddoel van de gebruiker: ' + metContext(vraag) + '\nVoer NU alleen deze deeltaak volledig uit: ' + label +
      '\nStop zodra deze deeltaak klaar is en meld kort het resultaat.' }];
    const r = await loop(seed, Math.min(perSub, totaal - tel), tel, totaal, label, label);
    tel = r.tel;
    deel.push('- ' + label + ': ' + (r.tekst || 'gedaan'));
  }

  /* De synthese. Mislukt hij, dan gaan de DEELRESULTATEN terug en niet een
     lege zin: de deeltaken zijn echt gedraaid en wat er gebeurd is, hoort de
     gebruiker te horen ook als het samenvatten niet lukte. */
  let eind = deel.join('\n');
  try {
    const synth = await anthropic.messages.create({
      /* Leeg is hier niet "geen regels" maar de gedeelde basis: een synthese
         zonder doctrine schrijft vrije tekst aan een lid zonder de merkregel. */
      model: 'claude-sonnet-5', max_tokens: 500, system: systeem || LUS_REGELS,
      messages: [{ role: 'user', content: 'Vat voor de gebruiker kort en concreet samen wat er is gedaan ' +
        '(en wat niet lukte, eerlijk). Deelresultaten:\n' + deel.join('\n') }]
    });
    const st = synth.content.filter(c => c.type === 'text').map(c => c.text).join('').trim();
    if (st) eind = st;
  } catch (e) {}
  try { opStap({ stap: totaal, totaal, bericht: 'Klaar', klaar: true }); } catch (e) {}
  return { tekst: eind || 'Gedaan.', acties, zwaar: true, stappen: tel, deeltaken: subs };
}

module.exports = { zwaar };
