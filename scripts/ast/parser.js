/* Eigen recursive-descent parser (deel van de zelfgebouwde AST-scanner). Zet de
   tokenstroom van de lexer om in een boom (AST) met ESTree-achtige knopen, zodat
   de regels intuitief blijven. Geen dependency: puur eigen werk.

   Dekt de moderne JS die onze code gebruikt: let/const, arrow- en async-functies,
   destructuring + defaults + rest/spread, template-literals (incl. tagged),
   klassen (incl. #prive-velden, get/set, static), optional chaining ?. en ?? ,
   for/of, try/catch (met of zonder binding), generatoren, yield/await,
   new.target / import.meta, dynamische import(). Wat de parser NIET begrijpt is
   een harde fout -- de scanner slaat nooit stil iets over. */
'use strict';
const { lex } = require('./lexer');

// binaire operator -> bindingssterkte (hoger = bindt strakker)
const BIN = { '??': 1, '||': 2, '&&': 3, '|': 4, '^': 5, '&': 6,
  '==': 7, '!=': 7, '===': 7, '!==': 7,
  '<': 8, '>': 8, '<=': 8, '>=': 8, 'instanceof': 8, 'in': 8,
  '<<': 9, '>>': 9, '>>>': 9, '+': 10, '-': 10, '*': 11, '/': 11, '%': 11, '**': 12 };
const TOEWIJS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=']);

function parse(bron, opties) {
  opties = opties || {};
  const T = lex(bron);
  let k = 0;

  const piek = () => T[k];
  const piekN = (x) => T[k + x] || T[T.length - 1];
  const eind = () => T[k].type === 'eof';
  function fout(bericht, tok) { tok = tok || piek(); const e = new Error('parsefout regel ' + tok.lijn + ': ' + bericht + ' bij ' + toon(tok)); e.lijn = tok.lijn; throw e; }
  function toon(t) { return t.type === 'eof' ? '<eof>' : t.type === 'template' ? '`...`' : JSON.stringify(t.value); }
  const isLees = (v) => { const t = piek(); return t.type === 'lees' && t.value === v; };
  const isSleutel = (w) => { const t = piek(); return t.type === 'naam' && t.value === w; };
  function volgende() { return T[k++]; }
  function eetLees(v) { if (!isLees(v)) fout("verwacht '" + v + "'"); return volgende(); }
  function eetSleutel(w) { if (!isSleutel(w)) fout("verwacht '" + w + "'"); return volgende(); }
  function knoop(type, start, velden) { return Object.assign({ type, start, end: T[k - 1] ? T[k - 1].end : start.start, lijn: start.lijn }, velden); }
  const af = (nd) => { nd.end = T[k - 1].end; return nd; };

  // ASI-hulp: een puntkomma consumeren, of accepteren aan het regeleinde/}/eof.
  function puntkomma() {
    if (isLees(';')) { volgende(); return; }
    const t = piek();
    if (t.type === 'eof' || (t.type === 'lees' && t.value === '}') || t.nl) return;
    fout("verwacht ';'");
  }

  /* ---------- programma + statements ---------- */
  function programma() {
    const start = piek(); const body = [];
    while (!eind()) body.push(statement());
    return knoop('Program', start, { body });
  }

  function statement() {
    const t = piek();
    if (t.type === 'lees') {
      if (t.value === '{') return blok();
      if (t.value === ';') { volgende(); return knoop('EmptyStatement', t, {}); }
      if (t.value === '@') return klasseMetDecorators();
    }
    if (t.type === 'naam' && t.keyword) {
      switch (t.value) {
        case 'var': case 'let': case 'const': return varDecl();
        case 'function': return functieDecl(false);
        case 'async': if (piekN(1).type === 'naam' && piekN(1).value === 'function' && !piekN(1).nl) return functieDecl(true); break;
        case 'class': return klasseDecl();
        case 'if': return ifStatement();
        case 'for': return forStatement();
        case 'while': return whileStatement();
        case 'do': return doStatement();
        case 'switch': return switchStatement();
        case 'try': return tryStatement();
        case 'return': return kortStatement('ReturnStatement', true);
        case 'throw': return kortStatement('ThrowStatement', false);
        case 'break': return sprong('BreakStatement');
        case 'continue': return sprong('ContinueStatement');
        case 'debugger': { volgende(); puntkomma(); return knoop('DebuggerStatement', t, {}); }
        case 'with': { volgende(); eetLees('('); const object = expressie(); eetLees(')'); return af(knoop('WithStatement', t, { object, body: statement() })); }
        case 'import': if (!(piekN(1).type === 'lees' && (piekN(1).value === '(' || piekN(1).value === '.'))) return importDecl(); break;
        case 'export': return exportDecl();
      }
    }
    // gelabeld statement:  naam:
    if (t.type === 'naam' && !t.keyword && piekN(1).type === 'lees' && piekN(1).value === ':') {
      volgende(); volgende(); return af(knoop('LabeledStatement', t, { label: t.value, body: statement() }));
    }
    const uitdr = expressie();
    puntkomma();
    return af(knoop('ExpressionStatement', t, { expression: uitdr }));
  }

  function blok() {
    const start = eetLees('{'); const body = [];
    while (!isLees('}') && !eind()) body.push(statement());
    eetLees('}');
    return af(knoop('BlockStatement', start, { body }));
  }

  function varDecl(geenIn) {
    const start = volgende(); const soort = start.value; const declaraties = [];
    do {
      const id = bindDoel();
      let init = null;
      if (isLees('=')) { volgende(); init = toewijzing(geenIn); }
      declaraties.push(knoop('VariableDeclarator', start, { id, init }));
    } while (isLees(',') && volgende());
    if (!geenIn) puntkomma();
    return af(knoop('VariableDeclaration', start, { kind: soort, declarations: declaraties }));
  }

  function kortStatement(type, mag) {
    const start = volgende();
    let arg = null;
    if (mag) { const t = piek(); if (!(t.nl || t.type === 'eof' || isLees(';') || isLees('}'))) arg = expressie(); }
    else { if (piek().nl) fout('nieuwe regel na throw'); arg = expressie(); }
    puntkomma();
    return af(knoop(type, start, { argument: arg }));
  }
  function sprong(type) {
    const start = volgende(); let label = null;
    const t = piek(); if (t.type === 'naam' && !t.keyword && !t.nl) label = volgende().value;
    puntkomma(); return af(knoop(type, start, { label }));
  }

  function ifStatement() {
    const start = volgende(); eetLees('('); const test = expressie(); eetLees(')');
    const consequent = statement(); let alternate = null;
    if (isSleutel('else')) { volgende(); alternate = statement(); }
    return af(knoop('IfStatement', start, { test, consequent, alternate }));
  }

  function forStatement() {
    const start = volgende();
    if (isSleutel('await')) volgende(); // for await
    eetLees('(');
    let init = null;
    if (isLees(';')) { /* leeg */ }
    else if (isSleutel('var') || isSleutel('let') || isSleutel('const')) init = varDecl(true);
    else init = expressie(true);
    if (isSleutel('of') || isSleutel('in')) {
      const soort = volgende().value; const right = soort === 'of' ? toewijzing() : expressie();
      eetLees(')');
      const left = init;
      return af(knoop(soort === 'of' ? 'ForOfStatement' : 'ForInStatement', start, { left, right, body: statement() }));
    }
    eetLees(';');
    const test = isLees(';') ? null : expressie(); eetLees(';');
    const update = isLees(')') ? null : expressie(); eetLees(')');
    return af(knoop('ForStatement', start, { init, test, update, body: statement() }));
  }
  function whileStatement() { const start = volgende(); eetLees('('); const test = expressie(); eetLees(')'); return af(knoop('WhileStatement', start, { test, body: statement() })); }
  function doStatement() { const start = volgende(); const body = statement(); eetSleutel('while'); eetLees('('); const test = expressie(); eetLees(')'); if (isLees(';')) volgende(); return af(knoop('DoWhileStatement', start, { body, test })); }

  function switchStatement() {
    const start = volgende(); eetLees('('); const disc = expressie(); eetLees(')'); eetLees('{');
    const cases = [];
    while (!isLees('}') && !eind()) {
      const cs = piek(); let test = null;
      if (isSleutel('case')) { volgende(); test = expressie(); } else eetSleutel('default');
      eetLees(':'); const cons = [];
      while (!isLees('}') && !isSleutel('case') && !isSleutel('default') && !eind()) cons.push(statement());
      cases.push(knoop('SwitchCase', cs, { test, consequent: cons }));
    }
    eetLees('}');
    return af(knoop('SwitchStatement', start, { discriminant: disc, cases }));
  }

  function tryStatement() {
    const start = volgende(); const block = blok(); let handler = null, finalizer = null;
    if (isSleutel('catch')) {
      const cs = volgende(); let param = null;
      if (isLees('(')) { volgende(); param = bindDoel(); eetLees(')'); }
      handler = knoop('CatchClause', cs, { param, body: blok() });
    }
    if (isSleutel('finally')) { volgende(); finalizer = blok(); }
    if (!handler && !finalizer) fout('try zonder catch of finally');
    return af(knoop('TryStatement', start, { block, handler, finalizer }));
  }

  /* ---------- functies + klassen ---------- */
  function functieDecl(async) {
    const start = piek(); if (async) volgende(); eetSleutel('function');
    const gen = isLees('*'); if (gen) volgende();
    const id = knoop('Identifier', piek(), { name: volgende().value });
    const params = paramLijst();
    const body = blok();
    return af(knoop('FunctionDeclaration', start, { id, params, body, async, generator: gen }));
  }
  function paramLijst() {
    eetLees('('); const params = [];
    while (!isLees(')')) {
      if (isLees('...')) { const s = volgende(); params.push(af(knoop('RestElement', s, { argument: bindDoel() }))); }
      else { let p = bindDoel(); if (isLees('=')) { volgende(); p = knoop('AssignmentPattern', p, { left: p, right: toewijzing() }); } params.push(p); }
      if (!isLees(')')) eetLees(',');
    }
    eetLees(')'); return params;
  }
  function klasseDecl() { return klasse('ClassDeclaration'); }
  function klasseMetDecorators() { while (isLees('@')) { volgende(); linksHand(); } return klasse('ClassDeclaration'); }
  function klasse(type) {
    const start = eetSleutel('class');
    let id = null; if (piek().type === 'naam' && !isSleutel('extends')) id = knoop('Identifier', piek(), { name: volgende().value });
    let superClass = null; if (isSleutel('extends')) { volgende(); superClass = linksHand(); }
    eetLees('{'); const body = [];
    while (!isLees('}') && !eind()) {
      if (isLees(';')) { volgende(); continue; }
      body.push(klasseLid());
    }
    eetLees('}');
    return af(knoop(type, start, { id, superClass, body }));
  }
  function klasseLid() {
    const start = piek(); let statisch = false, async = false, gen = false, soort = 'method';
    if (isSleutel('static') && !(piekN(1).type === 'lees' && (piekN(1).value === '(' || piekN(1).value === '='))) { statisch = true; volgende(); if (isLees('{')) { return af(knoop('StaticBlock', start, { body: blok().body })); } }
    if (isSleutel('async') && !(piekN(1).type === 'lees' && (piekN(1).value === '(' || piekN(1).value === '=')) && !piekN(1).nl) { async = true; volgende(); }
    if (isLees('*')) { gen = true; volgende(); }
    if ((isSleutel('get') || isSleutel('set')) && !(piekN(1).type === 'lees' && (piekN(1).value === '(' || piekN(1).value === '=' || piekN(1).value === ';' || piekN(1).value === '}'))) { soort = volgende().value; }
    const computed = isLees('[');
    const key = propNaam();
    if (isLees('(')) {
      const params = paramLijst(); const body = blok();
      const fn = knoop('FunctionExpression', start, { id: null, params, body, async, generator: gen });
      if (soort === 'method' && !computed && key.type === 'Identifier' && key.name === 'constructor') soort = 'constructor';
      return af(knoop('MethodDefinition', start, { key, value: fn, kind: soort, static: statisch, computed }));
    }
    // veld
    let value = null; if (isLees('=')) { volgende(); value = toewijzing(); }
    puntkomma();
    return af(knoop('PropertyDefinition', start, { key, value, static: statisch, computed }));
  }
  function propNaam() {
    if (isLees('[')) { volgende(); const e = toewijzing(); eetLees(']'); return e; }
    const t = piek();
    if (t.type === 'string' || t.type === 'getal') { volgende(); return knoop('Literal', t, { raw: t.value }); }
    volgende(); return knoop('Identifier', t, { name: t.value });
  }

  /* ---------- bindingsdoelen (patronen) ---------- */
  function bindDoel() {
    const t = piek();
    if (t.type === 'lees' && t.value === '[') return arrayPatroon();
    if (t.type === 'lees' && t.value === '{') return objectPatroon();
    if (t.type === 'naam') { volgende(); return knoop('Identifier', t, { name: t.value }); }
    fout('verwacht een naam of patroon');
  }
  function arrayPatroon() {
    const start = eetLees('['); const elems = [];
    while (!isLees(']')) {
      if (isLees(',')) { elems.push(null); volgende(); continue; }
      if (isLees('...')) { const s = volgende(); elems.push(af(knoop('RestElement', s, { argument: bindDoel() }))); }
      else { let el = bindDoel(); if (isLees('=')) { volgende(); el = knoop('AssignmentPattern', el, { left: el, right: toewijzing() }); } elems.push(el); }
      if (!isLees(']')) { if (!isLees(',')) break; volgende(); }
    }
    eetLees(']'); return af(knoop('ArrayPattern', start, { elements: elems }));
  }
  function objectPatroon() {
    const start = eetLees('{'); const props = [];
    while (!isLees('}')) {
      if (isLees('...')) { const s = volgende(); props.push(af(knoop('RestElement', s, { argument: bindDoel() }))); }
      else {
        const ps = piek(); const computed = isLees('['); const key = propNaam(); let value, shorthand = false;
        if (isLees(':')) { volgende(); value = bindDoel(); }
        else { value = knoop('Identifier', ps, { name: key.name }); shorthand = true; }
        if (isLees('=')) { volgende(); value = knoop('AssignmentPattern', value, { left: value, right: toewijzing() }); }
        props.push(knoop('Property', ps, { key, value, kind: 'init', computed, shorthand }));
      }
      if (!isLees('}')) eetLees(',');
    }
    eetLees('}'); return af(knoop('ObjectPattern', start, { properties: props }));
  }

  /* ---------- expressies ---------- */
  function expressie(geenIn) {
    let e = toewijzing(geenIn);
    if (isLees(',')) {
      const start = e; const exprs = [e];
      while (isLees(',')) { volgende(); exprs.push(toewijzing(geenIn)); }
      return af(knoop('SequenceExpression', start, { expressions: exprs }));
    }
    return e;
  }
  function toewijzing(geenIn) {
    // pijl-functie speculatief herkennen
    const pijl = probeerPijl();
    if (pijl) return pijl;
    if (isSleutel('yield')) return yieldExpr(geenIn);
    const links = voorwaarde(geenIn);
    const t = piek();
    if (t.type === 'lees' && TOEWIJS.has(t.value)) {
      volgende();
      const doel = t.value === '=' ? naarPatroon(links) : links;
      return af(knoop('AssignmentExpression', links, { operator: t.value, left: doel, right: toewijzing(geenIn) }));
    }
    return links;
  }
  function yieldExpr(geenIn) {
    const start = volgende(); let delegate = false, arg = null;
    if (isLees('*')) { delegate = true; volgende(); }
    const t = piek();
    if (!(t.nl || t.type === 'eof' || isLees(')') || isLees(']') || isLees('}') || isLees(',') || isLees(';') || isLees(':'))) arg = toewijzing(geenIn);
    return af(knoop('YieldExpression', start, { argument: arg, delegate }));
  }
  function voorwaarde(geenIn) {
    const test = binair(0, geenIn);
    if (isLees('?')) {
      volgende(); const cons = toewijzing(); eetLees(':'); const alt = toewijzing(geenIn);
      return af(knoop('ConditionalExpression', test, { test, consequent: cons, alternate: alt }));
    }
    return test;
  }
  function binair(min, geenIn) {
    let links = unair();
    for (;;) {
      const t = piek(); let op = null;
      if (t.type === 'lees' && BIN[t.value] != null) op = t.value;
      else if (t.type === 'naam' && (t.value === 'instanceof' || (t.value === 'in' && !geenIn))) op = t.value;
      if (op == null) break;
      const pr = BIN[op]; if (pr < min) break;
      volgende();
      const rechtsMin = op === '**' ? pr : pr + 1; // ** is rechts-associatief
      const rechts = binair(rechtsMin, geenIn);
      const type = (op === '&&' || op === '||' || op === '??') ? 'LogicalExpression' : 'BinaryExpression';
      links = af(knoop(type, links, { operator: op, left: links, right: rechts }));
    }
    return links;
  }
  function unair() {
    const t = piek();
    if (t.type === 'lees' && ['+', '-', '!', '~'].includes(t.value)) { volgende(); return af(knoop('UnaryExpression', t, { operator: t.value, prefix: true, argument: unair() })); }
    if (t.type === 'naam' && ['typeof', 'void', 'delete'].includes(t.value)) { volgende(); return af(knoop('UnaryExpression', t, { operator: t.value, prefix: true, argument: unair() })); }
    if (t.type === 'naam' && t.value === 'await') { volgende(); return af(knoop('AwaitExpression', t, { argument: unair() })); }
    if (t.type === 'lees' && (t.value === '++' || t.value === '--')) { volgende(); return af(knoop('UpdateExpression', t, { operator: t.value, prefix: true, argument: unair() })); }
    let e = postfix();
    return e;
  }
  function postfix() {
    let e = linksHand();
    const t = piek();
    if (t.type === 'lees' && (t.value === '++' || t.value === '--') && !t.nl) { volgende(); e = af(knoop('UpdateExpression', e, { operator: t.value, prefix: false, argument: e })); }
    return e;
  }

  function linksHand() {
    let e;
    if (isSleutel('new')) e = nieuw();
    else e = primair();
    return staartOproepen(e);
  }
  function nieuw() {
    const start = volgende();
    if (isLees('.')) { volgende(); const p = volgende(); return af(knoop('MetaProperty', start, { meta: 'new', property: p.value })); }
    let callee = isSleutel('new') ? nieuw() : primair();
    callee = staartLeden(callee); // leden mogen, oproep hoort bij new
    let args = [];
    if (isLees('(')) args = argLijst();
    return af(knoop('NewExpression', start, { callee, arguments: args }));
  }
  function staartLeden(e) {
    for (;;) {
      if (isLees('.')) { volgende(); const p = volgende(); e = af(knoop('MemberExpression', e, { object: e, property: knoop('Identifier', p, { name: p.value }), computed: false, optional: false })); }
      else if (isLees('[')) { volgende(); const p = expressie(); eetLees(']'); e = af(knoop('MemberExpression', e, { object: e, property: p, computed: true, optional: false })); }
      else break;
    }
    return e;
  }
  function staartOproepen(e) {
    for (;;) {
      const t = piek();
      if (t.type === 'lees' && t.value === '.') { volgende(); const p = volgende(); e = af(knoop('MemberExpression', e, { object: e, property: knoop('Identifier', p, { name: p.value }), computed: false, optional: false })); }
      else if (t.type === 'lees' && t.value === '?.') {
        volgende();
        if (isLees('(')) { e = af(knoop('CallExpression', e, { callee: e, arguments: argLijst(), optional: true })); }
        else if (isLees('[')) { volgende(); const p = expressie(); eetLees(']'); e = af(knoop('MemberExpression', e, { object: e, property: p, computed: true, optional: true })); }
        else { const p = volgende(); e = af(knoop('MemberExpression', e, { object: e, property: knoop('Identifier', p, { name: p.value }), computed: false, optional: true })); }
      }
      else if (t.type === 'lees' && t.value === '[') { volgende(); const p = expressie(); eetLees(']'); e = af(knoop('MemberExpression', e, { object: e, property: p, computed: true, optional: false })); }
      else if (t.type === 'lees' && t.value === '(') { e = af(knoop('CallExpression', e, { callee: e, arguments: argLijst(), optional: false })); }
      else if (t.type === 'template') { const q = template(); e = af(knoop('TaggedTemplateExpression', e, { tag: e, quasi: q })); }
      else break;
    }
    return e;
  }
  function argLijst() {
    eetLees('('); const args = [];
    while (!isLees(')')) {
      if (isLees('...')) { const s = volgende(); args.push(af(knoop('SpreadElement', s, { argument: toewijzing() }))); }
      else args.push(toewijzing());
      if (!isLees(')')) eetLees(',');
    }
    eetLees(')'); return args;
  }

  function primair() {
    const t = piek();
    if (t.type === 'getal' || t.type === 'string' || t.type === 'regex') { volgende(); return knoop('Literal', t, { raw: t.value, kind: t.type }); }
    if (t.type === 'template') return template();
    if (t.type === 'lees') {
      if (t.value === '(') return groepOfPijl();
      if (t.value === '[') return arrayExpr();
      if (t.value === '{') return objectExpr();
    }
    if (t.type === 'naam') {
      if (t.value === 'function') return functieExpr(false);
      if (t.value === 'async' && piekN(1).type === 'naam' && piekN(1).value === 'function' && !piekN(1).nl) return functieExpr(true);
      if (t.value === 'class') return klasse('ClassExpression');
      if (t.value === 'this') { volgende(); return knoop('ThisExpression', t, {}); }
      if (t.value === 'super') { volgende(); return knoop('Super', t, {}); }
      if (t.value === 'import') { volgende(); if (isLees('.')) { volgende(); const p = volgende(); return knoop('MetaProperty', t, { meta: 'import', property: p.value }); } eetLees('('); const src = toewijzing(); if (isLees(',')) volgende(); if (!isLees(')')) toewijzing(); eetLees(')'); return af(knoop('ImportExpression', t, { source: src })); }
      if (t.value === 'null') { volgende(); return knoop('Literal', t, { raw: 'null', kind: 'null' }); }
      if (t.value === 'true' || t.value === 'false') { volgende(); return knoop('Literal', t, { raw: t.value, kind: 'bool' }); }
      volgende(); return knoop('Identifier', t, { name: t.value });
    }
    fout('onverwacht token');
  }
  function template() {
    const t = volgende();
    const quasis = t.value.quasis.map((q, idx) => knoop('TemplateElement', t, { cooked: q, tail: idx === t.value.quasis.length - 1 }));
    const exprs = t.value.exprs.map(src => deelParse(src, t.lijn));
    return knoop('TemplateLiteral', t, { quasis, expressions: exprs });
  }
  function functieExpr(async) {
    const start = piek(); if (async) volgende(); eetSleutel('function');
    const gen = isLees('*'); if (gen) volgende();
    let id = null; if (piek().type === 'naam' && !isLees('(')) id = knoop('Identifier', piek(), { name: volgende().value });
    const params = paramLijst(); const body = blok();
    return af(knoop('FunctionExpression', start, { id, params, body, async, generator: gen }));
  }
  function arrayExpr() {
    const start = eetLees('['); const elems = [];
    while (!isLees(']')) {
      if (isLees(',')) { elems.push(null); volgende(); continue; }
      if (isLees('...')) { const s = volgende(); elems.push(af(knoop('SpreadElement', s, { argument: toewijzing() }))); }
      else elems.push(toewijzing());
      if (!isLees(']')) { if (!isLees(',')) break; volgende(); }
    }
    eetLees(']'); return af(knoop('ArrayExpression', start, { elements: elems }));
  }
  function objectExpr() {
    const start = eetLees('{'); const props = [];
    while (!isLees('}')) {
      if (isLees('...')) { const s = volgende(); props.push(af(knoop('SpreadElement', s, { argument: toewijzing() }))); if (!isLees('}')) eetLees(','); continue; }
      props.push(objectLid());
      if (!isLees('}')) eetLees(',');
    }
    eetLees('}'); return af(knoop('ObjectExpression', start, { properties: props }));
  }
  function objectLid() {
    const start = piek(); let async = false, gen = false, soort = 'init';
    if (isSleutel('async') && !(piekN(1).type === 'lees' && ['(', ',', ':', '}', '='].includes(piekN(1).value)) && !piekN(1).nl) { async = true; volgende(); }
    if (isLees('*')) { gen = true; volgende(); }
    if ((isSleutel('get') || isSleutel('set')) && !(piekN(1).type === 'lees' && ['(', ',', ':', '}', '='].includes(piekN(1).value))) { soort = volgende().value; }
    const computed = isLees('[');
    const key = propNaam();
    if (isLees('(')) {
      const params = paramLijst(); const body = blok();
      const fn = knoop('FunctionExpression', start, { id: null, params, body, async, generator: gen });
      return af(knoop('Property', start, { key, value: fn, kind: soort === 'init' ? 'init' : soort, method: soort === 'init', computed, shorthand: false }));
    }
    if (soort !== 'init') { const params = paramLijst(); const body = blok(); const fn = knoop('FunctionExpression', start, { id: null, params, body, async: false, generator: false }); return af(knoop('Property', start, { key, value: fn, kind: soort, computed, shorthand: false })); }
    if (isLees(':')) { volgende(); const value = toewijzing(); return af(knoop('Property', start, { key, value, kind: 'init', computed, shorthand: false })); }
    // shorthand (evt. met default in destructuring-context)
    let value = knoop('Identifier', start, { name: key.name });
    if (isLees('=')) { volgende(); value = knoop('AssignmentPattern', start, { left: value, right: toewijzing() }); }
    return af(knoop('Property', start, { key, value, kind: 'init', computed, shorthand: true }));
  }

  /* ---------- pijl-functies (cover-grammar) ---------- */
  function probeerPijl() {
    const t = piek();
    // async x => ... | async (…) => ...
    if (t.type === 'naam' && t.value === 'async' && !piekN(1).nl) {
      if (piekN(1).type === 'naam' && !piekN(1).keyword && piekN(2).type === 'lees' && piekN(2).value === '=>') { volgende(); return pijlVanIdent(true); }
      if (piekN(1).type === 'lees' && piekN(1).value === '(') { const bewaar = k; volgende(); const p = probeerPijlHaakjes(true); if (p) return p; k = bewaar; }
    }
    // x => ...
    if (t.type === 'naam' && !t.keyword && piekN(1).type === 'lees' && piekN(1).value === '=>') return pijlVanIdent(false);
    // (…) => ...
    if (t.type === 'lees' && t.value === '(') { const bewaar = k; const p = probeerPijlHaakjes(false); if (p) return p; k = bewaar; }
    return null;
  }
  function pijlVanIdent(async) {
    const start = piek(); const id = knoop('Identifier', piek(), { name: volgende().value }); eetLees('=>');
    return pijlLijf(start, [id], async);
  }
  function probeerPijlHaakjes(async) {
    let params;
    try { params = paramLijst(); } catch (e) { return null; }
    if (!(isLees('=>') && !piek().nl)) return null;
    const start = T[k]; volgende();
    return pijlLijf(start, params, async);
  }
  function pijlLijf(start, params, async) {
    let body, expr = false;
    if (isLees('{')) body = blok(); else { body = toewijzing(); expr = true; }
    return af(knoop('ArrowFunctionExpression', start, { params, body, async, expression: expr, generator: false }));
  }
  function groepOfPijl() {
    // gewone haakjes-groepering (pijl is al afgevangen in probeerPijl)
    eetLees('('); const e = expressie(); eetLees(')'); return e;
  }

  /* ---------- expressie -> patroon (voor toewijzingsdoelen) ---------- */
  function naarPatroon(nd) {
    if (!nd || typeof nd !== 'object') return nd;
    switch (nd.type) {
      case 'ArrayExpression': return { type: 'ArrayPattern', start: nd.start, end: nd.end, lijn: nd.lijn, elements: nd.elements.map(el => el && el.type === 'SpreadElement' ? { type: 'RestElement', argument: naarPatroon(el.argument), start: el.start, end: el.end, lijn: el.lijn } : naarPatroon(el)) };
      case 'ObjectExpression': return { type: 'ObjectPattern', start: nd.start, end: nd.end, lijn: nd.lijn, properties: nd.properties.map(p => p.type === 'SpreadElement' ? { type: 'RestElement', argument: naarPatroon(p.argument), start: p.start, end: p.end, lijn: p.lijn } : Object.assign({}, p, { value: naarPatroon(p.value) })) };
      case 'AssignmentExpression': if (nd.operator === '=') return { type: 'AssignmentPattern', left: naarPatroon(nd.left), right: nd.right, start: nd.start, end: nd.end, lijn: nd.lijn }; return nd;
      default: return nd; // Identifier, MemberExpression (geldig toewijzingsdoel)
    }
  }

  function deelParse(src, lijn) {
    try { const p = parse(src, {}); const b = p.body[0]; return b && b.expression ? b.expression : (b || knoop('Literal', { lijn, start: 0 }, { raw: '' })); }
    catch (e) { const e2 = new Error('in template-expressie (regel ' + lijn + '): ' + e.message); e2.lijn = lijn; throw e2; }
  }

  const boom = programma();
  return boom;
}

module.exports = { parse };
