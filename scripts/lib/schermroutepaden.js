'use strict';

/* API-PADEN UIT EEN SCHERMBRON.

   De algemene schermmeter zag een lokale helper als

     const api = (pad, body) => fetch('/api/member/rechterhand/' + pad, ...);
     api('cellier');

   uitsluitend als het brede voorvoegsel `/api/member/rechterhand/`. Daardoor
   werd ELKE route onder dat voorvoegsel aan het scherm toegeschreven. Dat is
   veilig ruim, maar onbruikbaar als ingang voor bevoegdheidsbewijs.

   Deze lezer verfijnt alleen de eenvoudig bewijsbare vorm: een lokaal
   gedeclareerde arrow-helper, precies een fetch-prefix plus zijn eerste
   parameter, en uitsluitend directe aanroepen met een kale string als eerste
   argument. Zodra de helper wordt doorgegeven, met een variabele wordt
   aangeroepen, dubbel is gedeclareerd of de prefix ook elders dynamisch wordt
   gebruikt, blijft het brede voorvoegsel staan. Onzekerheid vernauwt dus nooit
   de bewijsgrens. */

const { lex } = require('../ast/lexer');

const IS_API = (s) => typeof s === 'string' && s.startsWith('/api/');
const ontdoe = (s) => String(s).replace(/^['"`]|['"`]$/g, '');
const isLees = (t, v) => t && t.type === 'lees' && t.value === v;
const isNaam = (t, v) => t && t.type === 'naam' && (v === undefined || t.value === v);

function sluitIndex(tokens, open, links, rechts) {
  let diep = 0;
  for (let i = open; i < tokens.length; i++) {
    if (isLees(tokens[i], links)) diep++;
    else if (isLees(tokens[i], rechts) && --diep === 0) return i;
  }
  return -1;
}

function arrowDeclaraties(tokens) {
  const uit = [];
  for (let i = 0; i < tokens.length - 6; i++) {
    if (!isNaam(tokens[i]) || !['const', 'let', 'var'].includes(tokens[i].value)) continue;
    if (!isNaam(tokens[i + 1]) || !isLees(tokens[i + 2], '=')) continue;
    const naamIndex = i + 1;
    let p = i + 3, params = [], naParams;
    if (isNaam(tokens[p]) && isLees(tokens[p + 1], '=>')) {
      params = [tokens[p].value];
      naParams = p + 1;
    } else if (isLees(tokens[p], '(')) {
      const dicht = sluitIndex(tokens, p, '(', ')');
      if (dicht < 0 || !isLees(tokens[dicht + 1], '=>')) continue;
      for (let k = p + 1; k < dicht; k++) if (isNaam(tokens[k]) && !tokens[k].keyword) params.push(tokens[k].value);
      naParams = dicht + 1;
    } else continue;
    if (!params.length || !isLees(tokens[naParams], '=>')) continue;

    const bodyStart = naParams + 1;
    let bodyEind;
    if (isLees(tokens[bodyStart], '{')) bodyEind = sluitIndex(tokens, bodyStart, '{', '}');
    else {
      let rond = 0, vierkant = 0, accolade = 0;
      bodyEind = tokens.length - 1;
      for (let k = bodyStart; k < tokens.length; k++) {
        if (isLees(tokens[k], '(')) rond++;
        else if (isLees(tokens[k], ')')) rond--;
        else if (isLees(tokens[k], '[')) vierkant++;
        else if (isLees(tokens[k], ']')) vierkant--;
        else if (isLees(tokens[k], '{')) accolade++;
        else if (isLees(tokens[k], '}')) accolade--;
        else if (isLees(tokens[k], ';') && rond === 0 && vierkant === 0 && accolade === 0) { bodyEind = k - 1; break; }
      }
    }
    if (bodyEind < bodyStart) continue;

    const koppelingen = [];
    for (let k = bodyStart; k <= bodyEind - 4; k++) {
      if (!isNaam(tokens[k], 'fetch') || !isLees(tokens[k + 1], '(') || tokens[k + 2].type !== 'string' ||
          !isLees(tokens[k + 3], '+') || !isNaam(tokens[k + 4], params[0])) continue;
      const prefix = ontdoe(tokens[k + 2].value);
      if (IS_API(prefix)) koppelingen.push({ prefix, stringIndex: k + 2 });
    }
    if (koppelingen.length !== 1) continue;
    uit.push({ naam: tokens[naamIndex].value, naamIndex, bodyStart, bodyEind, ...koppelingen[0] });
  }
  return uit;
}

function verfijnHelpers(tokens) {
  const declaraties = arrowDeclaraties(tokens);
  const dubbel = new Set();
  const telling = new Map();
  for (const d of declaraties) telling.set(d.naam, (telling.get(d.naam) || 0) + 1);
  for (const [naam, n] of telling) if (n !== 1) dubbel.add(naam);

  const opgelost = [];
  for (const d of declaraties) {
    if (dubbel.has(d.naam)) continue;
    const suffixen = [];
    let onzeker = false;
    for (let i = 0; i < tokens.length; i++) {
      if (!isNaam(tokens[i], d.naam) || i === d.naamIndex) continue;
      if (!isLees(tokens[i + 1], '(')) { onzeker = true; break; }
      const eerste = tokens[i + 2], erna = tokens[i + 3];
      if (!eerste || eerste.type !== 'string' || !(isLees(erna, ',') || isLees(erna, ')'))) { onzeker = true; break; }
      suffixen.push(ontdoe(eerste.value));
    }
    if (!onzeker && suffixen.length) opgelost.push({ ...d, suffixen });
  }
  return opgelost;
}

function paden(bron) {
  const exact = new Set(), voorvoegsels = new Set();
  let tokens;
  try { tokens = lex(bron); } catch (e) { return null; }

  const prefixVindplaatsen = new Map();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'string') {
      const v = ontdoe(t.value);
      if (!IS_API(v)) continue;
      const volgende = tokens[i + 1];
      const gaatVerder = (volgende && volgende.type === 'lees' && volgende.value === '+') || v.endsWith('/') || v.includes('?');
      if (gaatVerder) {
        voorvoegsels.add(v);
        if (!prefixVindplaatsen.has(v)) prefixVindplaatsen.set(v, new Set());
        prefixVindplaatsen.get(v).add(i);
      } else exact.add(v);
    } else if (t.type === 'template' && t.value && Array.isArray(t.value.quasis)) {
      const eerste = t.value.quasis[0];
      if (IS_API(eerste)) {
        if (!t.value.exprs || t.value.exprs.length === 0) exact.add(eerste);
        else voorvoegsels.add(eerste);
      }
    }
  }

  const helpers = verfijnHelpers(tokens);
  const opgelosteVindplaatsen = new Map();
  for (const h of helpers) {
    for (const suffix of h.suffixen) exact.add(h.prefix + suffix);
    if (!opgelosteVindplaatsen.has(h.prefix)) opgelosteVindplaatsen.set(h.prefix, new Set());
    opgelosteVindplaatsen.get(h.prefix).add(h.stringIndex);
  }
  for (const [prefix, plekken] of prefixVindplaatsen) {
    const opgelost = opgelosteVindplaatsen.get(prefix) || new Set();
    if ([...plekken].every((i) => opgelost.has(i))) voorvoegsels.delete(prefix);
  }

  return {
    exact: [...exact].sort(),
    voorvoegsels: [...voorvoegsels].sort(),
    verfijndeHelpers: helpers.map((h) => ({ naam: h.naam, prefix: h.prefix, exactePaden: h.suffixen.map((s) => h.prefix + s).sort() }))
  };
}

module.exports = { paden };
