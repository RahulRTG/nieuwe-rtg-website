/* De DS Edge presenteert de bestaande RTGAppMenu-contracten. Deze proef
   bewaakt dat er geen tweede functieregister of afwijkende uitvoering ontstaat. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '..', 'public/ds/edge-modi.js'), 'utf8');

function node(tag = 'div') {
  return { tag, kinderen: [], events: {}, attrs: {},
    appendChild(kind) { this.kinderen.push(kind); return kind; },
    addEventListener(naam, fn) { this.events[naam] = fn; },
    setAttribute(naam, waarde) { this.attrs[naam] = waarde; }
  };
}

function omgeving() {
  const modi = {}, bladen = {}, balk = node('nav'), uitgevoerd = [];
  const bestaand = {
    disabled: false, textContent: 'Bestaande actie',
    getAttribute(naam) { return naam === 'data-ds-actie' ? 'Bestaande actie' : null; },
    closest() { return null; }, click() { uitgevoerd.push('bestaand'); }
  };
  const appknop = { click() { uitgevoerd.push('appknop'); } };
  const window = {
    RTGAppMenu: {
      functies: () => [
        { label: 'Bestaande actie', doe: () => uitgevoerd.push('duplicaat') },
        { label: 'Appfilter', knop: appknop }
      ],
      systeemfuncties: () => [
        { label: 'Instellingen', doe: () => uitgevoerd.push('instellingen') }
      ]
    },
    RTGDs: {
      token: () => null,
      hulp: { el: tag => node(tag), svg: () => '', lippen: () => '', ICONEN: {} },
      edge: {
        registreer: (naam, fn) => { modi[naam] = fn; }, terug() {},
        delen: {
          balk: () => balk,
          linkKnop: () => node('a'), rahulKnop: () => node('button'), knop: () => node('button'),
          bladKnop(naam, label, icoon, titel, vul) { bladen[naam] = { titel, vul }; return node('button'); },
          lijst: regels => ({ regels }), openBlad() {}
        }
      }
    }
  };
  const document = { querySelectorAll: () => [bestaand], createDocumentFragment: () => node('fragment') };
  vm.runInNewContext(bron, { window, document, setTimeout: fn => fn(), fetch: async () => ({ json: async () => ({}) }) });
  modi.navigatie();
  return { bladen, uitgevoerd };
}

test('DS Edge voegt actuele Appmenu-acties toe, dedupliceert en behoudt hun uitvoering', () => {
  const o = omgeving(), regels = o.bladen.acties.vul().regels;
  assert.deepEqual(Array.from(regels, x => x.label), ['Bestaande actie', 'Appfilter']);
  regels[0].doe(); regels[1].doe();
  assert.deepEqual(o.uitgevoerd, ['bestaand', 'appknop']);
});

test('DS Edge-menu ontsluit de capability-gebonden systeemfuncties van Appmenu', () => {
  const o = omgeving(), regels = o.bladen.menu.vul().regels;
  assert.deepEqual(Array.from(regels, x => x.label), [
    'Berichten', 'RTG Media', 'Uw account', 'Privacy en veiligheid', 'Instellingen'
  ]);
  regels.at(-1).doe();
  assert.deepEqual(o.uitgevoerd, ['instellingen']);
});
