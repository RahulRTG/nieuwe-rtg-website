/* De echte chatrenderers met een DOM-adapter. Servermodus gaat voor een
   achtergebleven clienttier; een servicemelding is geen conciergebelofte. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app(tier, antwoord) {
  const bron = fs.readFileSync(path.join(__dirname, '../public/apps/app-main/app-main-50.js'), 'utf8');
  const code = bron.slice(bron.indexOf('  function eigenChatMode'), bron.indexOf('  // Kies een partner'));
  const elementen = new Map(), bubbels = [];
  const element = id => {
    if (!elementen.has(id)) elementen.set(id, { textContent: '', innerHTML: '', addEventListener() {} });
    return elementen.get(id);
  };
  const context = vm.createContext({
    user: { tier }, $: element, document: { querySelector: () => element('deck') },
    T: (key, tekst) => tekst, FID_MINI: '', kiesPartnerEnBetaal() {},
    aiOpener: () => 'Rahul-opener', bubble: tekst => bubbels.push(tekst),
    API: { live: true, call: async () => antwoord },
    Util: { el: (tag, attrs, tekst, inhoud) => ({ tekst: inhoud || tekst }),
      vervang: (el, kinderen) => { el.kinderen = kinderen; } }
  });
  vm.runInContext(code, context);
  return { context, element, bubbels };
}

test('server service-modus vervangt oude Business-kop, uitleg en betaalchip', async () => {
  const a = app('business', { mode: 'service', messages: [] });
  a.element('#aiTitle').textContent = 'Uw concierge.';
  a.element('#chips').innerHTML = 'oude betaalchip';
  await a.context.renderChat();
  assert.equal(a.element('#aiTitle').textContent, 'RTG Service.');
  assert.match(a.element('deck').textContent, /Geen persoonlijke AI of concierge/);
  assert.equal(a.element('#chips').innerHTML, '');
  assert.match(a.bubbels[0], /Hulp in de app/);
  assert.doesNotMatch(a.bubbels[0], /concierge|Rahul/);
});

test('nieuwe chatberichten volgen service-modus en worden automatisch gelabeld', () => {
  const a = app('business');
  a.context.renderChatMsgs([{ from: 'service', text: 'Bekijk uw hulpvragen.' }], 'service');
  assert.equal(a.element('#aiTitle').textContent, 'RTG Service.');
  assert.equal(a.element('#chips').innerHTML, '');
  assert.equal(a.element('#chat').kinderen.length, 1);
  assert.match(a.element('#chat').kinderen[0].tekst, /^RTG Service · automatisch bericht:/);
  a.context.renderChatMsgs([{ from: 'member', text: 'Ik wil een mens.' }], 'service');
  assert.equal(a.element('#chat').kinderen.length, 1, 'geen concierge is ingelicht-belofte');
});
