'use strict';
/* Bedradings-contract: elke `accounts.<methode>(...)` die ergens in de
   serverbron wordt aangeroepen, MOET ook echt door de accounts-module
   geëxporteerd worden. Precies de fout die de server liet crashen bij het
   opstarten (accounts.renameUser bestond wel als functie, maar stond niet in
   module.exports) - een gewone unittest ziet dat niet, want de tak die hem
   aanroept draaide niet. Deze statische controle vangt het altijd. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const accounts = require('../server/accounts');

// alle .js onder server/ (zonder data/node_modules)
function serverBestanden() {
  const uit = [];
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const vol = path.join(dir, naam);
      const st = fs.statSync(vol);
      if (st.isDirectory()) { if (!/node_modules|\.git|data/.test(naam)) loop(vol); }
      else if (naam.endsWith('.js')) uit.push(vol);
    }
  })(path.join(ROOT, 'server'));
  return uit;
}

/* Verzamel elke identifier die als `<obj>.naam(` wordt aangeroepen. Alleen de
   call-vorm (met haakje) telt: puur property-lezen slaan we over, want dat kan
   een optioneel veld zijn. */
function aangeroepenMethoden(bron, objNaam) {
  const re = new RegExp('\\b' + objNaam + '\\.([A-Za-z_$][\\w$]*)\\s*\\(', 'g');
  const namen = new Set();
  let m;
  while ((m = re.exec(bron))) namen.add(m[1]);
  return namen;
}

test('elke aangeroepen accounts.<methode> bestaat ook echt in de export', () => {
  const bekend = new Set(Object.keys(accounts));
  const bestanden = serverBestanden();
  const missers = [];
  for (const f of bestanden) {
    const bron = fs.readFileSync(f, 'utf8');
    for (const naam of aangeroepenMethoden(bron, 'accounts')) {
      if (!bekend.has(naam)) missers.push(path.relative(ROOT, f) + ' roept accounts.' + naam + '() aan, maar dat is geen export');
    }
  }
  assert.deepEqual(missers, [], 'ontbrekende accounts-exports:\n  ' + missers.join('\n  '));
});

test('de accounts-API dekt de kern-methoden die de server nodig heeft', () => {
  // een harde ondergrens: deze methoden MOETEN er zijn (regressievangnet als
  // iemand een export per ongeluk verwijdert of hernoemt).
  const verplicht = ['createUserSync', 'findByLogin', 'getUserById', 'realNameOf',
    'renameUser', 'issueToken', 'verifyToken', 'saveMemberState', 'getMemberState', 'setVerification'];
  for (const naam of verplicht) {
    assert.equal(typeof accounts[naam], 'function', 'accounts.' + naam + ' ontbreekt of is geen functie');
  }
});
