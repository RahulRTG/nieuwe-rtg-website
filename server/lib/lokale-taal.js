/* Lokale taalprimitieven voor werk dat geen generatief model nodig heeft.

   Deze laag schrijft niets nieuws: hij selecteert, ordent en benoemt wat al in
   de invoer staat. Daardoor kan hij samenvatten, vragen aanwijzen en concrete
   actiepunten tonen zonder gegevens naar een provider te sturen en zonder een
   tweede waarheid te verzinnen. De uitvoer is bewust gewone taal; "lokaal"
   hoort als herkomst in metadata, niet als goedkope toon in de zin zelf. */
'use strict';

const STOP = new Set(('de het een en van voor met dat die dit naar in op om te is zijn was waren wordt worden ' +
  'ik wij je jij u uw onze deze daar hier nog ook dan maar als bij aan uit over door heeft hebben').split(/\s+/));
const BESLUIT = /\b(besluit|besloten|afgesproken|akkoord|conclusie|definitief|blijft|deadline|uiterlijk|moet|zal|gaat|actiepunt|risico)\b/i;
const DAAD = /\b(moet(?:en)?|zal|zullen|gaat|gaan|stuurt?|sturen|levert?|leveren|controleert?|controleren|plant|plannen|regelt?|regelen|beslist?|beslissen|maakt?|maken|mailt?|mailen|belt?|bellen|bevestigt?|bevestigen|rondt?\b|uitwerken|opleveren)\b/i;
const GROET = /^(goedemorgen|goedemiddag|goedenavond|hallo|hoi|dank(?:jewel| u| je)?|bedankt)\b/i;
const POSITIEF = /\b(goed|mooi|prachtig|fijn|sterk|helder|geweldig|blij|enthousiast|akkoord|prima|tevreden)\b/i;
const ZORG = /\b(zorg|bezorgd|onduidelijk|probleem|jammer|slecht|risico|moeilijk|kritiek|twijfel|toegankelijkheid|allergie|veilig)\b/i;
const WANNEER = /\b(vandaag|morgen|overmorgen|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|volgende\s+(?:week|maand)|voor\s+(?:\d{1,2}(?:[-/]\d{1,2}(?:[-/]\d{2,4})?|\s+[a-z]+)|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)|uiterlijk\s+[^,.!?;]{1,35})\b/i;

function normaal(tekst) {
  return String(tekst || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function zinnen(tekst) {
  // Een punt tussen cijfers is in Nederlandse tekst vaak een duizendtalteken
  // (12.000) en soms een decimaal. Die mag geen kunstmatige zinsgrens worden.
  const s = normaal(tekst).replace(/\n+/g, ' ').replace(/(\d)\.(?=\d)/g, '$1\u0000');
  if (!s) return [];
  return (s.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(x => x.replace(/\u0000/g, '.').trim()).filter(Boolean);
}

function woorden(zin) {
  return String(zin).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
}

function samenvat(tekst, opties) {
  const o = opties || {};
  const alle = zinnen(tekst);
  if (!alle.length) return '';
  const maxZinnen = Math.max(1, Math.min(8, Number(o.maxZinnen) || 3));
  const maxTekens = Math.max(120, Math.min(4000, Number(o.maxTekens) || 900));
  if (alle.length <= maxZinnen && normaal(tekst).length <= maxTekens) return alle.join(' ');

  const freq = new Map();
  for (const zin of alle) {
    for (const w of new Set(woorden(zin).filter(x => x.length > 3 && !STOP.has(x))))
      freq.set(w, (freq.get(w) || 0) + 1);
  }
  const rang = alle.map((zin, index) => {
    const ws = woorden(zin), uniek = new Set(ws.filter(x => x.length > 3 && !STOP.has(x)));
    let score = [...uniek].reduce((n, w) => n + Math.min(3, freq.get(w) || 0), 0) / Math.max(4, ws.length);
    if (BESLUIT.test(zin)) score += 4;
    if (DAAD.test(zin)) score += 2;
    if (/\b(?:€\s*)?\d[\d.,]*\b/.test(zin) || WANNEER.test(zin)) score += 1.5;
    if (/\?$/.test(zin)) score += 0.7;
    if (index === 0) score += 0.25;
    if (GROET.test(zin) && ws.length < 10) score -= 5;
    if (ws.length < 4) score -= 1.5;
    return { zin, index, score };
  });
  const gekozen = rang.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, maxZinnen)
    .sort((a, b) => a.index - b.index).map(x => x.zin);
  let uit = gekozen.join(' ');
  if (uit.length > maxTekens) uit = uit.slice(0, maxTekens).replace(/\s+\S*$/, '').replace(/[,;:]?$/, '') + '…';
  return uit;
}

function actiepunten(tekst, opties) {
  const limiet = Math.max(1, Math.min(20, Number(opties && opties.max) || 8));
  const uit = [];
  for (const zin of zinnen(tekst)) {
    if (!DAAD.test(zin)) continue;
    const eigenaar = zin.match(/^([\p{Lu}][\p{L}'-]{1,30}|Ik|Wij|Je|Jij|U)\s+/u);
    const termijn = zin.match(WANNEER);
    uit.push({
      wie: eigenaar ? eigenaar[1] : '',
      wat: zin.replace(/[.!?]+$/, '').trim().slice(0, 240),
      wanneer: termijn ? termijn[0] : ''
    });
    if (uit.length >= limiet) break;
  }
  return uit;
}

function vragen(tekst, max) {
  return zinnen(tekst).filter(x => /\?$/.test(x)).map(x => x.replace(/^[^:]{1,40}:\s*/, '').trim()).slice(0, max || 5);
}

function reactiesSamenvatting(regels) {
  const inhoud = (Array.isArray(regels) ? regels : []).map(x => String(x || '').replace(/^[^:]{1,40}:\s*/, '').trim()).filter(Boolean);
  if (!inhoud.length) return 'Er zijn nog geen reacties om samen te vatten.';
  const positief = inhoud.filter(x => POSITIEF.test(x)).length;
  const zorg = inhoud.filter(x => ZORG.test(x)).length;
  const qs = vragen(inhoud.join(' '), 3);
  let toon = 'neutraal en inhoudelijk';
  if (positief && zorg) toon = 'gemengd: waardering, met een duidelijke zorg of kritische kanttekening';
  else if (positief) toon = 'overwegend positief';
  else if (zorg) toon = 'bezorgd of kritisch';
  const delen = ['De toon is ' + toon + '.'];
  if (qs.length === 1) delen.push('Er staat één concrete vraag: “' + qs[0] + '”');
  else if (qs.length > 1) delen.push('Er staan ' + qs.length + ' concrete vragen; de eerste is: “' + qs[0] + '”');
  const kern = samenvat(inhoud.filter(x => !/\?$/.test(x)).join(' '), { maxZinnen: 2, maxTekens: 420 });
  if (kern) delen.push('Inhoudelijk komt dit terug: ' + kern);
  return delen.join(' ');
}

function beantwoordUitTekst(tekst, vraag, opties) {
  const vraagStop = new Set([...STOP, 'wie', 'wat', 'waar', 'wanneer', 'waarom', 'welke', 'hoe',
    'heeft', 'kan', 'kunnen', 'over', 'vertel', 'staat']);
  const termen = [...new Set(woorden(vraag).filter(x => x.length > 2 && !vraagStop.has(x)))];
  if (!termen.length) return '';
  const rang = zinnen(tekst).map((zin, index) => {
    const laag = zin.toLowerCase();
    const raak = termen.filter(t => laag.includes(t));
    return { zin, index, score: raak.length };
  }).filter(x => x.score >= Math.min(2, termen.length));
  if (!rang.length) return '';
  const max = Math.max(1, Math.min(3, Number(opties && opties.maxZinnen) || 2));
  return rang.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, max)
    .sort((a, b) => a.index - b.index).map(x => x.zin).join(' ');
}

module.exports = { normaal, zinnen, samenvat, actiepunten, vragen, reactiesSamenvatting, beantwoordUitTekst };
