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

async function zetSpelKlaar({ post, tokens, gezinLijf }) {
  const stappen = [];
  const een = (tokens || {}).member;
  const twee = (tokens || {})['member-account'];
  if (!een || !twee) {
    return { klaar: false, extra: {}, stappen, idVoor: () => ({}),
      reden: 'er zijn twee verschillende ledensessies nodig; een potje ontstaat pas met een tegenstander' };
  }

  let v = null;
  try { v = await post('/api/member/spel/varianten', {}, een); } catch (e) { v = null; }
  const soorten = Object.keys((v && v.data && v.data.varianten) || {});
  stappen.push({ naam: 'de spelsoorten opvragen', pad: '/api/member/spel/varianten',
    status: v ? v.status : 0, ok: !!soorten.length,
    waarom: soorten.length ? null : 'geen enkele spelsoort teruggekregen' });
  if (!soorten.length) return { klaar: false, extra: {}, stappen, idVoor: () => ({}),
    reden: 'zonder spelsoort valt er niets te starten' };

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
    if (!id) continue;

    /* EN DE RTF-HELFT, met precies dezelfde mechaniek maar andere mensen.
       /api/rtf/spel/* draait niet op een sessie maar op een gezinscode plus
       een profieltoken uit het LIJF (routes/spellen.js, rtfSpeler). Ook daar
       zijn twee spelers nodig, en een gezin heeft er standaard maar een: de
       beheerder.

       De weg is de echte weg van het product: de beheerder maakt een profiel
       voor een kind, en dat kind kiest zichzelf met zijn eigen pincode
       (/api/foundation/gezin/profiel/kies). Dat is de enige route die een
       profieltoken teruggeeft -- `profiel/maak` doet dat met opzet niet, en
       dat is geen gebrek maar een grens: een token is een sleutel, en die
       hoort achter de pincode van de eigenaar vandaan te komen.

       Lukt deze helft niet, dan blijft de RTG-helft gewoon staan. Twee
       halve werelden zijn beter dan een die valt op de tweede. */
    const rtf = await rtfPotje(post, gezinLijf, soort, stappen);

    /* EN EEN TWEEDE POTJE, om dezelfde reden waarom de school een tweede
       medewerker heeft. /api/member/spel/opgeven beeindigt het potje, en de
       proef roept elke route aan -- dus gaf zij haar eigen potje op, en elke
       spelroute die alfabetisch NA `opgeven` komt (staat, zet, ...) viel
       daarna om. De wereldcontrole na afloop vond dat; eerder werd zoiets bij
       toeval ontdekt.

       Het verschil met de school is dat daar twee VELDEN bestonden
       (personeelId naast klasCode) en hier maar een: alles heet `id`. De
       scheiding moet dus per ROUTE, net als bij het livinglab. `opgeven` krijgt
       het reservepotje; al het andere het echte. */
    const reserve = await tweedePotje(post, tokens, soort, stappen);

    const extra = { id, potje: id, soort };
    if (reserve) extra.reserve = reserve;
    if (rtf) extra.rtf = rtf;
    return { klaar: true, extra, stappen, reden: null,
      idVoor: (pad) => idVoor(extra, pad) };
  }

  return { klaar: false, extra: {}, stappen, idVoor: () => ({}),
    reden: 'geen van de ' + soorten.length + ' spelsoorten leverde een potje op; zie stappen' };
}

async function rtfPotje(post, gezinLijf, soort, stappen) {
  if (!gezinLijf || !gezinLijf.code || !gezinLijf.token) {
    stappen.push({ naam: 'een potje in het gezin', pad: '/api/rtf/spel/random', status: 0, ok: false,
      waarom: 'er is geen gezinssleutel; zonder gezinscode en profieltoken speelt daar niemand' });
    return null;
  }
  const G = { code: gezinLijf.code, token: gezinLijf.token };
  const doe = async (naam, pad, lijf) => {
    let a = null;
    try { a = await post(pad, lijf, null); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  const gemaakt = await doe('een tweede profiel in het gezin', '/api/foundation/gezin/profiel/maak',
    /* De pincode is '5678' en niet '1234' of '4321', en dat is geen smaak: de
       gezinsfamilie maakt de beheerder met 1234 en de schoolwereld een kind
       met 4321, allebei in DIT gezin. Een gezin weigert twee gelijke pincodes
       ("Kies voor ieder gezinslid een andere pincode"), en dat is precies de
       weigering die deze stap een ronde lang tegenhield. */
    { ...G, naam: 'Proefspeler', rol: 'kind', geboortedatum: '2014-05-05', pin: '5678' });
  const profielId = gemaakt && gemaakt.profiel && gemaakt.profiel.id;
  if (!profielId) return null;

  const gekozen = await doe('dat profiel kiest zichzelf met zijn pincode',
    '/api/foundation/gezin/profiel/kies', { ...G, profielId, pin: '5678' });
  const tweede = gekozen && gekozen.token;
  if (!tweede) return null;

  await doe('de beheerder in de wachtrij', '/api/rtf/spel/random', { ...G, soort, grootte: 2 });
  const b = await doe('het kind erbij, en het potje start', '/api/rtf/spel/random',
    { code: G.code, token: tweede, soort, grootte: 2 });
  const id = b && b.id;
  return id ? { id, potje: id, code: G.code, token: G.token, profielId } : null;
}

/* Nog een potje uit dezelfde wachtrij, met dezelfde twee spelers. */
async function tweedePotje(post, tokens, soort, stappen) {
  const een = tokens.member, twee = tokens['member-account'];
  let a = null, b = null;
  try { a = await post('/api/member/spel/random', { soort, grootte: 2 }, een); } catch (e) { a = null; }
  if (!a || a.status !== 200) {
    stappen.push({ naam: 'reservepotje', pad: '/api/member/spel/random', status: a ? a.status : 0,
      ok: false, waarom: (a && a.data && a.data.error) || 'geen antwoord' });
    return null;
  }
  try { b = await post('/api/member/spel/random', { soort, grootte: 2 }, twee); } catch (e) { b = null; }
  const id = b && b.status === 200 && b.data && b.data.id;
  stappen.push({ naam: 'reservepotje voor de routes die een potje beeindigen',
    pad: '/api/member/spel/random', status: b ? b.status : 0, ok: !!id,
    waarom: id ? null : ((b && b.data && b.data.error) || 'er ontstond geen tweede potje') });
  return id || null;
}

/* Welke routes krijgen het RESERVEpotje. Klein en met de reden erbij: elke
   route hier beeindigt een potje, en met het echte potje sloopt de proef haar
   eigen wereld. Wie er een bij zet, doet dat omdat de wereldcontrole na afloop
   klaagt -- niet op gevoel. */
const BEEINDIGT = new Set(['/api/member/spel/opgeven', '/api/rtf/spel/opgeven']);

function idVoor(extra, pad) {
  if (!BEEINDIGT.has(String(pad || ''))) return {};
  return extra.reserve ? { id: extra.reserve, potje: extra.reserve } : {};
}

module.exports = { zetSpelKlaar, BEEINDIGT, idVoor };
