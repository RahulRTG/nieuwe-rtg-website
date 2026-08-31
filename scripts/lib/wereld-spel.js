/* ============================================================================
   DE SPELWERELD -- een potje dat echt loopt.

   HET PROBLEEM. Achtentwintig routes onder /api/member/spel/ en nog eens
   achtentwintig onder /api/rtf/spel/ zeggen "Dit potje bestaat niet (meer)".
   Het zijn dezelfde acties, tweemaal geregistreerd (routes/spellen.js): een
   keer voor een RTG-lid en een keer voor een profiel uit een gezin.

   WAAROM ER TWEE SESSIES NODIG ZIJN, en dat is de hele aardigheid: een potje
   ontstaat pas als er iemand tegenover je zit. `spelNieuw` weigert zonder
   uitgenodigde speler ("Nodig minstens een speler uit, of speel random"), en
   `spelRandom` zet je in de WACHTRIJ -- de eerste oproep krijgt netjes
   { wachten: true, plek: 1 }, en pas de tweede speler laat er een potje van
   ontstaan.

   De proef heeft twee ledensessies die echt verschillende mensen zijn:
   `member` (een pas) en `member-account` (een eigen account, zie
   ./accountroutes.js). Die twee in dezelfde wachtrij zetten levert een echt
   potje op -- gemeten: de tweede oproep geeft { gestart: true, id }.

   DAT IS GEEN TRUC MAAR DE ROUTE ZELF. Er wordt niets in de database gezet,
   geen wachtrij omzeild en geen tegenstander verzonnen: twee mensen vragen om
   een willekeurige tegenstander en krijgen elkaar. Precies wat de matchmaking
   hoort te doen.

   HET SPEL IS GEMETEN EN NIET GEKOZEN. /api/member/spel/varianten noemt de
   soorten die deze installatie kent; de wereld pakt de eerste die een potje
   oplevert in plaats van er een te noemen die er morgen niet meer is. `quiz`
   antwoordt bijvoorbeeld "Dit spel vind je in de RTFoundation-app" -- een
   grens, geen gebrek, en de wereld loopt gewoon door naar de volgende. */
'use strict';

async function zetSpelKlaar({ post, tokens }) {
  const stappen = [];
  const een = (tokens || {}).member;
  const twee = (tokens || {})['member-account'];
  if (!een || !twee) {
    return { klaar: false, extra: {}, stappen,
      reden: 'er zijn twee verschillende ledensessies nodig; een potje ontstaat pas met een tegenstander' };
  }

  let v = null;
  try { v = await post('/api/member/spel/varianten', {}, een); } catch (e) { v = null; }
  const soorten = Object.keys((v && v.data && v.data.varianten) || {});
  stappen.push({ naam: 'de spelsoorten opvragen', pad: '/api/member/spel/varianten',
    status: v ? v.status : 0, ok: !!soorten.length,
    waarom: soorten.length ? null : 'geen enkele spelsoort teruggekregen' });
  if (!soorten.length) return { klaar: false, extra: {}, stappen, reden: 'zonder spelsoort valt er niets te starten' };

  for (const soort of soorten) {
    let a = null, b = null;
    try { a = await post('/api/member/spel/random', { soort, grootte: 2 }, een); } catch (e) { a = null; }
    if (!a || a.status !== 200) {
      stappen.push({ naam: 'wachtrij voor ' + soort, pad: '/api/member/spel/random',
        status: a ? a.status : 0, ok: false,
        waarom: (a && a.data && a.data.error) || 'geen antwoord' });
      continue;
    }
    try { b = await post('/api/member/spel/random', { soort, grootte: 2 }, twee); } catch (e) { b = null; }
    const id = b && b.status === 200 && b.data && b.data.id;
    stappen.push({ naam: 'tweede speler voor ' + soort, pad: '/api/member/spel/random',
      status: b ? b.status : 0, ok: !!id,
      waarom: id ? null : ((b && b.data && b.data.error) || 'er ontstond geen potje') });
    if (id) return { klaar: true, extra: { id, potje: id, soort }, stappen, reden: null };
  }

  return { klaar: false, extra: {}, stappen,
    reden: 'geen van de ' + soorten.length + ' spelsoorten leverde een potje op; zie stappen' };
}

module.exports = { zetSpelKlaar };
