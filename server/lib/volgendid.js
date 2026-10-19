/* EEN ID DIE IN ZIJN LIJST NOG VRIJ IS.

   Een tijdstempel in milliseconden, en bij een botsing de eerstvolgende vrije.
   Dit stond vier keer letterlijk hetzelfde: in kern/genootschap (de groepen,
   het prikbord met zijn reacties, de bijeenkomsten) en in kern/beraad -- vier
   kopieen van een regel die samen moeten blijven kloppen, want een groep, een
   bericht en een beraad worden met dezelfde soort id aangesproken.

   Hier en niet in een van die twee domeinen: dan zou het ene het andere moeten
   requiren voor een regel van vier lijnen (VERSTRENGELING.json telt zo'n rand).
   `nu` mag worden meegegeven; kern/beraad krijgt zijn klok van buiten mee en
   houdt die. */
'use strict';

function volgendId(lijst, nu = Date.now) {
  let id = nu();
  while ((lijst || []).some(x => x && x.id === id)) id++;
  return id;
}

module.exports = { volgendId };
