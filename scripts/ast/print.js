/* AST-printer (deel van de eigen minifier). Zet de boom van onze parser terug om
   in compacte JS: geen commentaar (dat gooit de lexer al weg), geen overbodige
   witruimte, en haakjes alleen waar de voorrang ze eist. Puur eigen werk.

   De minifier is bewust veilig: als de geprinte code niet exact dezelfde boom
   oplevert, valt hij terug op de bron (zie minify.js). Deze printer hoeft dus
   niet elk theoretisch randgeval te dekken -- fouten worden opgevangen, niet
   uitgeleverd. */
'use strict';

// voorrang per knoop (hoger = bindt strakker); bepaalt waar haakjes moeten
const BINP = { '??': 4, '||': 5, '&&': 6, '|': 7, '^': 8, '&': 9,
  '==': 10, '!=': 10, '===': 10, '!==': 10,
  '<': 11, '>': 11, '<=': 11, '>=': 11, 'instanceof': 11, 'in': 11,
  '<<': 12, '>>': 12, '>>>': 12, '+': 13, '-': 13, '*': 14, '/': 14, '%': 14, '**': 15 };

function voorrang(n) {
  switch (n.type) {
    case 'SequenceExpression': return 1;
    case 'AssignmentExpression': case 'ArrowFunctionExpression': case 'YieldExpression': return 2;
    case 'ConditionalExpression': return 3;
    case 'BinaryExpression': case 'LogicalExpression': return BINP[n.operator] || 10;
    case 'UnaryExpression': case 'AwaitExpression': return 16;
    case 'UpdateExpression': return 17;
    case 'CallExpression': case 'MemberExpression': case 'NewExpression': case 'TaggedTemplateExpression': case 'ImportExpression': return 18;
    default: return 20;
  }
}

// twee stukjes samenvoegen met een spatie alleen als ze anders zouden samensmelten
function isWoord(c) { return c != null && /[A-Za-z0-9_$]/.test(c); }
function plak(a, b) {
  if (!a) return b; if (!b) return a;
  const l = a[a.length - 1], r = b[0];
  let spatie = (isWoord(l) && isWoord(r)) || (l === '+' && r === '+') || (l === '-' && r === '-') || (l === '/' && r === '/');
  return a + (spatie ? ' ' : '') + b;
}

function printer() {
  function pr(n) {
    if (n == null) return '';
    const f = TABEL[n.type];
    if (!f) throw new Error('printer kent knoop niet: ' + n.type);
    return f(n);
  }
  // deel-expressie met haakjes indien de voorrang lager is dan gevraagd
  function sub(n, min) { const s = pr(n); return voorrang(n) < min ? '(' + s + ')' : s; }
  const subToe = (n) => sub(n, 2);        // toewijzings-niveau (arg, init, element)
  function sleutel(k, computed) { return computed ? '[' + subToe(k) + ']' : (k.type === 'Identifier' ? k.name : k.raw); }

  function params(lijst) { return lijst.map(pr).join(','); }
  function functie(n, decl) {
    let s = (n.async ? 'async ' : '') + 'function' + (n.generator ? '*' : '');
    s = n.id ? plak(s, n.id.name) : s + (n.generator ? '' : '');
    return s + '(' + params(n.params) + '){' + n.body.body.map(pr).join('') + '}';
  }
  function klasseLijf(n) {
    let s = 'class' + (n.id ? ' ' + n.id.name : '');
    if (n.superClass) s += ' extends ' + sub(n.superClass, 18);
    return s + '{' + n.body.map(pr).join('') + '}';
  }
  // begint de geprinte expressie met iets dat aan het begin van een statement fout gaat?
  function statementProbleem(n) {
    let cur = n;
    for (let i = 0; i < 40 && cur; i++) {
      switch (cur.type) {
        case 'ObjectExpression': case 'FunctionExpression': case 'ClassExpression': return true;
        case 'MemberExpression': cur = cur.object; break;
        case 'CallExpression': case 'NewExpression': cur = cur.callee; break;
        case 'TaggedTemplateExpression': cur = cur.tag; break;
        case 'BinaryExpression': case 'LogicalExpression': case 'AssignmentExpression': cur = cur.left; break;
        case 'SequenceExpression': cur = cur.expressions[0]; break;
        case 'ConditionalExpression': cur = cur.test; break;
        case 'UpdateExpression': if (!cur.prefix) { cur = cur.argument; break; } return false;
        default: return false;
      }
    }
    return false;
  }
  function forKop(init) { // init van een for zonder puntkomma
    if (init.type === 'VariableDeclaration') return init.kind + ' ' + init.declarations.map(d => plak(pr(d.id), d.init ? '=' + subToe(d.init) : '')).join(',');
    return pr(init);
  }
  function lus(n) { // left van for-in/of
    if (n.type === 'VariableDeclaration') return n.kind + ' ' + pr(n.declarations[0].id);
    return pr(n);
  }

  const TABEL = {
    Program: (n) => n.body.map(pr).join(''),
    BlockStatement: (n) => '{' + n.body.map(pr).join('') + '}',
    EmptyStatement: () => ';',
    ExpressionStatement: (n) => { const s = pr(n.expression); return (statementProbleem(n.expression) ? '(' + s + ')' : s) + ';'; },
    VariableDeclaration: (n) => n.kind + ' ' + n.declarations.map(d => plak(pr(d.id), d.init ? '=' + subToe(d.init) : '')).join(',') + ';',
    FunctionDeclaration: (n) => functie(n, true),
    ClassDeclaration: klasseLijf,
    ReturnStatement: (n) => n.argument ? plak('return', pr(n.argument)) + ';' : 'return;',
    ThrowStatement: (n) => plak('throw', pr(n.argument)) + ';',
    BreakStatement: (n) => (n.label ? 'break ' + n.label : 'break') + ';',
    ContinueStatement: (n) => (n.label ? 'continue ' + n.label : 'continue') + ';',
    DebuggerStatement: () => 'debugger;',
    WithStatement: (n) => 'with(' + pr(n.object) + ')' + pr(n.body),
    LabeledStatement: (n) => n.label + ':' + pr(n.body),
    IfStatement: (n) => {
      let cons = n.consequent;
      // dangling-else: haakjes om een if-zonder-else als er een else volgt
      let consS = (n.alternate && cons.type === 'IfStatement' && !cons.alternate) ? '{' + pr(cons) + '}' : pr(cons);
      let s = 'if(' + pr(n.test) + ')' + consS;
      if (n.alternate) s += plak('else', pr(n.alternate));
      return s;
    },
    ForStatement: (n) => 'for(' + (n.init ? forKop(n.init) : '') + ';' + (n.test ? pr(n.test) : '') + ';' + (n.update ? pr(n.update) : '') + ')' + pr(n.body),
    ForInStatement: (n) => 'for(' + lus(n.left) + ' in ' + pr(n.right) + ')' + pr(n.body),
    ForOfStatement: (n) => 'for(' + lus(n.left) + ' of ' + subToe(n.right) + ')' + pr(n.body),
    WhileStatement: (n) => 'while(' + pr(n.test) + ')' + pr(n.body),
    DoWhileStatement: (n) => plak('do', pr(n.body)) + 'while(' + pr(n.test) + ');',
    SwitchStatement: (n) => 'switch(' + pr(n.discriminant) + '){' + n.cases.map(c => (c.test ? plak('case', pr(c.test)) + ':' : 'default:') + c.consequent.map(pr).join('')).join('') + '}',
    TryStatement: (n) => 'try' + pr(n.block) + (n.handler ? 'catch' + (n.handler.param ? '(' + pr(n.handler.param) + ')' : '') + pr(n.handler.body) : '') + (n.finalizer ? 'finally' + pr(n.finalizer) : ''),

    Identifier: (n) => n.name,
    Literal: (n) => n.raw,
    ThisExpression: () => 'this',
    Super: () => 'super',
    TemplateLiteral: (n) => '`' + n.quasis[0].cooked + n.expressions.map((e, i) => '${' + pr(e) + '}' + n.quasis[i + 1].cooked).join('') + '`',
    TaggedTemplateExpression: (n) => sub(n.tag, 18) + pr(n.quasi),
    ArrayExpression: (n) => '[' + n.elements.map(e => e == null ? '' : e.type === 'SpreadElement' ? '...' + subToe(e.argument) : subToe(e)).join(',') + ']',
    ObjectExpression: (n) => '{' + n.properties.map(prop).join(',') + '}',
    FunctionExpression: (n) => functie(n, false),
    ArrowFunctionExpression: (n) => {
      const kop = (n.async ? 'async ' : '') + (n.params.length === 1 && n.params[0].type === 'Identifier' ? plak(n.async ? '' : '', n.params[0].name) : '(' + params(n.params) + ')');
      // concise lijf dat met een { (object) begint -- of daar via .[]-toegang mee
      // begint -- moet tussen haakjes, anders leest het als een blok
      let lijf = n.expression ? (statementProbleem(n.body) ? '(' + pr(n.body) + ')' : subToe(n.body)) : '{' + n.body.body.map(pr).join('') + '}';
      return kop + '=>' + lijf;
    },
    ClassExpression: klasseLijf,
    MethodDefinition: (n) => (n.static ? 'static ' : '') + (n.kind === 'get' || n.kind === 'set' ? n.kind + ' ' : '') + (n.value.async ? 'async ' : '') + (n.value.generator ? '*' : '') + sleutel(n.key, n.computed) + '(' + params(n.value.params) + '){' + n.value.body.body.map(pr).join('') + '}',
    PropertyDefinition: (n) => (n.static ? 'static ' : '') + sleutel(n.key, n.computed) + (n.value ? '=' + subToe(n.value) : '') + ';',
    StaticBlock: (n) => 'static{' + n.body.map(pr).join('') + '}',

    UnaryExpression: (n) => { const woord = /^[a-z]/.test(n.operator); return plak(n.operator, sub(n.argument, 16)); },
    AwaitExpression: (n) => plak('await', sub(n.argument, 16)),
    UpdateExpression: (n) => n.prefix ? plak(n.operator, sub(n.argument, 17)) : plak(sub(n.argument, 17), n.operator),
    BinaryExpression: (n) => bin(n),
    LogicalExpression: (n) => bin(n),
    AssignmentExpression: (n) => sub(n.left, 2) + n.operator + subToe(n.right),
    ConditionalExpression: (n) => sub(n.test, 4) + '?' + subToe(n.consequent) + ':' + subToe(n.alternate),
    SequenceExpression: (n) => n.expressions.map(subToe).join(','),
    CallExpression: (n) => sub(n.callee, 18) + (n.optional ? '?.' : '') + '(' + n.arguments.map(a => a.type === 'SpreadElement' ? '...' + subToe(a.argument) : subToe(a)).join(',') + ')',
    NewExpression: (n) => plak('new', sub(n.callee, 18)) + '(' + n.arguments.map(a => a.type === 'SpreadElement' ? '...' + subToe(a.argument) : subToe(a)).join(',') + ')',
    MemberExpression: (n) => {
      let obj = sub(n.object, 18);
      if (n.object.type === 'Literal' && n.object.kind === 'num' && !/[.eExXbBoOn]/.test(obj)) obj = '(' + obj + ')';
      if (n.computed) return obj + (n.optional ? '?.' : '') + '[' + pr(n.property) + ']';
      return obj + (n.optional ? '?.' : '.') + n.property.name;
    },
    YieldExpression: (n) => n.argument ? plak('yield' + (n.delegate ? '*' : ''), subToe(n.argument)) : ('yield' + (n.delegate ? '*' : '')),
    MetaProperty: (n) => n.meta + '.' + n.property,
    ImportExpression: (n) => 'import(' + subToe(n.source) + ')',
    SpreadElement: (n) => '...' + subToe(n.argument),
    RestElement: (n) => '...' + pr(n.argument),
    AssignmentPattern: (n) => pr(n.left) + '=' + subToe(n.right),
    ArrayPattern: (n) => '[' + n.elements.map(e => e == null ? '' : pr(e)).join(',') + ']',
    ObjectPattern: (n) => '{' + n.properties.map(p => p.type === 'RestElement' ? '...' + pr(p.argument) : (p.shorthand ? pr(p.value) : sleutel(p.key, p.computed) + ':' + pr(p.value))).join(',') + '}'
  };

  function bin(n) {
    const p = BINP[n.operator] || 10;
    const woord = /^[a-z]/.test(n.operator);
    const rechtsAssoc = n.operator === '**';
    const links = sub(n.left, rechtsAssoc ? p + 1 : p);
    const rechts = sub(n.right, rechtsAssoc ? p : p + 1);
    if (woord) return plak(plak(links, n.operator), rechts);
    return plak(plak(links, n.operator), rechts);
  }
  function prop(p) {
    if (p.type === 'SpreadElement') return '...' + subToe(p.argument);
    if (p.kind === 'get' || p.kind === 'set') return p.kind + ' ' + sleutel(p.key, p.computed) + '(' + params(p.value.params) + '){' + p.value.body.body.map(pr).join('') + '}';
    if (p.method) { const v = p.value; return (v.async ? 'async ' : '') + (v.generator ? '*' : '') + sleutel(p.key, p.computed) + '(' + params(v.params) + '){' + v.body.body.map(pr).join('') + '}'; }
    if (p.shorthand) return pr(p.value);
    return sleutel(p.key, p.computed) + ':' + subToe(p.value);
  }

  return { print: pr };
}

function print(boom) { return printer().print(boom); }
module.exports = { print };
