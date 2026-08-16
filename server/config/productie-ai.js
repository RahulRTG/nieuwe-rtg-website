/* De bewuste productiegrens rond externe AI. De handmatige werkmodus is een
   volwaardige terugval; een achtergebleven providersleutel in de uit-stand is
   juist een configuratiefout, omdat "uit" dan niet aantoonbaar uit is. */
'use strict';

function keurAi(env, fouten, waarschuwingen) {
  const uit = env.RTG_AI_UIT === '1';
  const externUit = env.RTG_EXTERNE_AI_UIT === '1';
  const extern = !!(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
  const lokaal = !!(env.LOCAL_AI_URL || env.LOCAL_AI_BASE_URL);
  const provider = extern || lokaal;
  if (lokaal && !env.LOCAL_AI_MODEL)
    fouten.push('LOCAL_AI_URL is gezet maar LOCAL_AI_MODEL ontbreekt. Kies expliciet welk lokaal model RTG gebruikt.');
  if (lokaal) {
    try {
      require('../local-ai')._intern.normaliseerUrl(env.LOCAL_AI_URL || env.LOCAL_AI_BASE_URL,
        env.LOCAL_AI_LAN_TOESTAAN === '1');
    } catch (e) { fouten.push(e.message); }
  }
  if (uit && provider)
    fouten.push('RTG_AI_UIT=1 botst met een ingestelde AI-sleutel of lokale modelserver. Verwijder de providerconfiguratie zodat uit ook werkelijk uit betekent.');
  if (externUit && extern)
    fouten.push('RTG_EXTERNE_AI_UIT=1 botst met ingestelde externe AI-sleutels. Verwijder die sleutels; lokaal mag actief blijven.');
  if (uit && !provider)
    waarschuwingen.push('RTG_AI_UIT=1: alle modelverrijking staat bewust uit. RTG draait volledig in regelgestuurde werkmodus; kernprocessen, navigatie en lokale extractie blijven beschikbaar.');
  else if (lokaal && externUit)
    waarschuwingen.push('Lokale AI is actief; externe AI staat bewust uit. Inhoud blijft op de eigen modelserver en regelgestuurde functies blijven de eerste keuze.');
  else if (lokaal)
    waarschuwingen.push('Lokale AI is de eerste provider. Externe aanbieders worden alleen gebruikt als zij expliciet zijn ingesteld en de lokale capability ontbreekt of uitvalt.');
  else if (!provider)
    waarschuwingen.push('Geen modelprovider ingesteld: RTG start volledig in regelgestuurde werkmodus. Vrije modelverrijking staat uit; kernprocessen, navigatie en lokale extractie blijven beschikbaar. Zet RTG_AI_UIT=1 als dit een bewuste productiekeuze is.');
}

module.exports = { keurAi };
