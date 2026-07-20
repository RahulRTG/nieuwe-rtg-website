/* De regels van de zelfgebouwde AST-scanner. Elke regel krijgt elke knoop met
   zijn pad (voorouders) en geeft nul of meer bevindingen terug. Bewust hoog-
   signaal en schoon op de huidige code: een bevinding betekent echt iets.

   Ernst 'fout' laat de scan falen (exit 1); 'waarschuwing' wordt getoond maar
   laat de scan slagen -- zelfde filosofie als de techniek-checks en check.js. */
'use strict';

// Pakketten die we bewust NIET (meer) gebruiken: zelf gebouwd (zie docs/de-lijn.md).
// Een require hiervan betekent dat een zelfbouw-beslissing is teruggedraaid.
const VERBODEN = new Set(['web-push', 'express-rate-limit', 'http_ece',
  '@simplewebauthn/server', '@anthropic-ai/sdk', 'terser', 'acorn', 'nodemailer', 'express', '@sentry/node', 'redis', 'axe-core', 'pg']);
// Namen die op een geheim wijzen: daar mag Math.random NOOIT aan ten grondslag liggen (regel 1).
const GEHEIM = /token|secret|sleutel|geheim|wachtwoord|pincode|salt|nonce|otp|sessie|vapid/i;
const TERMINATORS = new Set(['ReturnStatement', 'ThrowStatement', 'BreakStatement', 'ContinueStatement']);

function strWaarde(node) {
  if (!node || node.type !== 'Literal' || node.kind !== 'string') return null;
  const r = node.raw; return r.slice(1, -1); // buitenste quotes eraf (genoeg voor pakketnamen)
}
const isNaam = (n, w) => n && n.type === 'Identifier' && n.name === w;
// require('x') -> 'x', anders null
function requireDoel(node) {
  if (node.type !== 'CallExpression' || !isNaam(node.callee, 'require') || node.arguments.length !== 1) return null;
  return strWaarde(node.arguments[0]);
}
// dichtstbijzijnde "doel" met een naam boven een knoop (voor de geheim-check)
function doelNaamBoven(pad) {
  for (let i = pad.length - 1; i >= 0; i--) {
    const p = pad[i];
    if (p.type === 'VariableDeclarator' && p.id && p.id.type === 'Identifier') return p.id.name;
    if (p.type === 'AssignmentExpression') { const l = p.left; if (l && l.type === 'Identifier') return l.name; if (l && l.type === 'MemberExpression' && l.property && l.property.type === 'Identifier') return l.property.name; }
    if (p.type === 'Property' && p.key) return p.key.name || strWaarde(p.key);
    if (p.type === 'FunctionDeclaration' || p.type === 'FunctionExpression') break; // niet over een functiegrens heen kijken
  }
  return null;
}

const REGELS = [
  {
    id: 'verboden-pakket', ernst: 'fout',
    keur(node) {
      const doel = requireDoel(node);
      if (doel && VERBODEN.has(doel)) return ['require van "' + doel + '" is verboden: dat bouwen we zelf (zie docs/de-lijn.md).'];
      return null;
    }
  },
  {
    id: 'geen-eval', ernst: 'fout',
    keur(node) {
      if (node.type === 'CallExpression' && (isNaam(node.callee, 'eval') || isNaam(node.callee, 'Function'))) return ['eval()/Function() bouwt code uit een string: injectie-risico, niet gebruiken.'];
      if (node.type === 'NewExpression' && isNaam(node.callee, 'Function')) return ['new Function() bouwt code uit een string: injectie-risico, niet gebruiken.'];
      return null;
    }
  },
  {
    id: 'math-random-geheim', ernst: 'fout',
    keur(node, pad) {
      if (node.type === 'MemberExpression' && !node.computed && isNaam(node.object, 'Math') && isNaam(node.property, 'random')) {
        const naam = doelNaamBoven(pad);
        if (naam && GEHEIM.test(naam)) return ['Math.random voor "' + naam + '": nooit een toevalsbron voor geheimen (regel 1). Gebruik crypto.randomBytes/randomInt.'];
      }
      return null;
    }
  },
  {
    id: 'onbereikbare-code', ernst: 'fout',
    keur(node) {
      const lijst = node.type === 'BlockStatement' || node.type === 'Program' ? node.body : node.type === 'SwitchCase' ? node.consequent : null;
      if (!lijst) return null;
      const uit = [];
      for (let i = 0; i < lijst.length - 1; i++) {
        if (TERMINATORS.has(lijst[i].type)) {
          const volgend = lijst[i + 1];
          // functie- en var-declaraties worden gehoist: die tellen niet als dood
          if (volgend.type !== 'FunctionDeclaration' && !(volgend.type === 'VariableDeclaration' && volgend.kind === 'var'))
            uit.push('onbereikbare code na ' + lijst[i].type + ' (regel ' + lijst[i].lijn + ').');
          break;
        }
      }
      return uit.length ? uit : null;
    }
  },
  {
    id: 'dubbele-objectsleutel', ernst: 'waarschuwing',
    keur(node) {
      if (node.type !== 'ObjectExpression') return null;
      const gezien = new Map(); const uit = [];
      for (const p of node.properties) {
        if (p.type !== 'Property' || p.computed) continue;
        const naam = (p.key && (p.key.name || strWaarde(p.key)));
        if (naam == null) continue;
        const soort = p.kind === 'get' || p.kind === 'set' ? p.kind : 'init';
        const eerder = gezien.get(naam);
        if (eerder != null && !(eerder !== 'init' && soort !== 'init' && eerder !== soort)) uit.push('dubbele objectsleutel "' + naam + '".');
        gezien.set(naam, soort);
      }
      return uit.length ? uit : null;
    }
  }
];

module.exports = { REGELS, VERBODEN, GEHEIM };
