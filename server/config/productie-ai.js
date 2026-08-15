/* De bewuste productiegrens rond externe AI. De handmatige werkmodus is een
   volwaardige terugval; een achtergebleven providersleutel in de uit-stand is
   juist een configuratiefout, omdat "uit" dan niet aantoonbaar uit is. */
'use strict';

function keurAi(env, fouten, waarschuwingen) {
  const uit = env.RTG_AI_UIT === '1';
  const provider = !!(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
  if (uit && provider)
    fouten.push('RTG_AI_UIT=1 botst met een ingestelde AI-sleutel. Verwijder de providersleutel zodat uit ook werkelijk uit betekent.');
  if (uit && !provider)
    waarschuwingen.push('RTG_AI_UIT=1: externe AI staat bewust uit. RTG draait volledig in handmatige werkmodus; kernprocessen, navigatie en regelgestuurde opdrachten blijven beschikbaar.');
  else if (!provider)
    waarschuwingen.push('Geen AI-provider ingesteld: RTG start volledig in handmatige werkmodus. Vrije AI-verrijking staat uit; kernprocessen, navigatie en regelgestuurde opdrachten blijven beschikbaar. Zet RTG_AI_UIT=1 als dit een bewuste productiekeuze is.');
}

module.exports = { keurAi };
