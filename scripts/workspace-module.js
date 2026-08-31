#!/usr/bin/env node
/* Maakt het minimale, uniforme begin van een Living Module en registreert haar
   in de enige catalogus van de app-shell. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const id = String(process.argv[2] || '').trim();
const title = String(process.argv.slice(3).join(' ') || '').trim();
if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id) || !title) {
  console.error('Gebruik: npm run workspace:module -- module-id "Moduletitel"'); process.exit(1);
}
const dir = path.join(ROOT, 'public', 'shared', 'interface', 'modules');
const file = path.join(dir, id + '.js');
if (fs.existsSync(file)) { console.error('Module bestaat al: ' + file); process.exit(1); }
const code = `/* RTG Living Module: ${title}. De host tekent chrome, state en bediening. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK;
  SDK.add(SDK.define({
    id: '${id}', name: ${JSON.stringify(title)}, version: '1.0.0', maturity: 'L3',
    runtime: { minVersion: '0.1.0' }, source: 'native', defaultHidden: true,
    states: SDK.states, surfaces: { peek: true, panel: true, workspace: true, focus: true },
    capabilities: ['${id}.read'], services: [], permissions: [], actions: [],
    events: { publishes: [], subscribes: [] },
    state: { persistence: 'none', schema: '${id}.state.v1' },
    performance: { peekBudgetKb: 40, panelBudgetKb: 180 }
  }, function () {
    var root;
    return {
      mount: function (body) {
        root = d.createElement('p'); root.className = 'rtg-ss-quiet';
        root.textContent = 'Nog geen bron gekoppeld.'; body.appendChild(root);
      },
      render: function () {},
      destroy: function () { root = null; }
    };
  }));
})(window, document);
`;
fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, code);
const app = path.join(ROOT, 'public', 'apps', 'app.html');
let html = fs.readFileSync(app, 'utf8');
const marker = '<!-- RTG_WORKSPACE_MODULES_END -->';
if (!html.includes(marker)) { fs.rmSync(file); console.error('Modulemarkering ontbreekt in app.html.'); process.exit(1); }
html = html.replace(marker, '<script src="/shared/interface/modules/' + id + '.js" defer></script>\n' + marker);
fs.writeFileSync(app, html); console.log('Living Module gemaakt: ' + path.relative(ROOT, file));
