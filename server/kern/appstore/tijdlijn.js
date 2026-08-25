/* ============================================================================
   DE TIJDLIJN VAN HET LID -- wat een app van jou heeft gekregen, wanneer, en
   wanneer je het weer hebt teruggenomen.

   WAAROM DIT ER IS. Een lid kan vandaag zien WAT een app mag. Wat hij niet kan
   zien is hoe dat zo is gekomen: wanneer hij hem installeerde, wat hij toen gaf,
   wat hij later heeft teruggenomen, en wat een update erbij vroeg. Zonder die
   geschiedenis is "wat mag deze app" een momentopname, en een momentopname is
   geen verantwoording.

   Dit is de tegenhanger van het journaal. Het journaal (kern/appstore/index.js)
   is van RTG: wie liet een uitgever toe, wie tekende een versie af. Deze
   tijdlijn is van het LID: wat gaf ik, en wanneer nam ik het terug. Twee lijsten
   omdat het twee verantwoordingen zijn, met twee lezers.

   HIJ GROEIT AAN EN WORDT NOOIT HERSCHREVEN. Ook niet als het lid de app
   verwijdert -- juist dan niet: "ik heb die app in mei drie dagen gehad en toen
   verwijderd" is precies het soort zin die een tijdlijn moet kunnen staven.
   Wat er wel gebeurt bij het wissen van de opslag, is dat het WISSEN erin komt
   te staan. De regel dat het gewist is, is zelf geen persoonsgegeven.
   ========================================================================== */
'use strict';

const MAX = 400;   // per lid; ouder dan dit valt eraf, nieuwste eerst

/* De gebeurtenissen die deze tijdlijn kent. Een gesloten lijst, en om dezelfde
   reden als bij de doelen: wat niet te vergelijken is, is niet te lezen. Een
   soort erbij is een besluit, geen invulveld. */
const SOORTEN = {
  geinstalleerd: 'op je startscherm gezet',
  verleend: 'machtigingen gegeven',
  teruggenomen: 'machtigingen teruggenomen',
  verwijderd: 'van je startscherm gehaald',
  gewist: 'wat deze app bewaarde, gewist',
  gekocht: 'gekocht',
  teruggekregen: 'geld teruggekregen',
  weggehaald: 'door RTG of de uitgever uit de store gehaald'
};

module.exports = function maakTijdlijn({ S, save, nu }) {
  function bak(key) {
    const s = S();
    if (!s.tijdlijn || typeof s.tijdlijn !== 'object') s.tijdlijn = {};
    if (!Array.isArray(s.tijdlijn[String(key)])) s.tijdlijn[String(key)] = [];
    return s.tijdlijn[String(key)];
  }

  /* Noteren mag nooit een handeling laten mislukken. Een tijdlijn die een
     installatie kan tegenhouden is een tijdlijn die op de verkeerde plek in de
     keten staat; hij schrijft mee en beslist niets. */
  function noteer(key, soort, sleutel, extra) {
    if (!key || !Object.prototype.hasOwnProperty.call(SOORTEN, String(soort))) return null;
    const r = Object.assign({ at: nu(), soort, wat: SOORTEN[soort], sleutel: String(sleutel || '') }, extra || null);
    const b = bak(key);
    b.unshift(r);
    if (b.length > MAX) b.length = MAX;
    save();
    return r;
  }

  /* Wat een lid terugkrijgt. Zonder sleutel de hele tijdlijn, met sleutel die
     van een enkele app -- dat laatste is wat er onder "wat mag deze app" hoort
     te staan, want daar wordt de vraag gesteld. */
  function tijdlijn(key, sleutel, n) {
    const b = bak(key);
    const uit = sleutel ? b.filter(r => r.sleutel === String(sleutel)) : b;
    return uit.slice(0, Math.max(1, Math.min(MAX, Number(n) || 100)));
  }

  return { noteer, tijdlijn, TIJDLIJN_SOORTEN: SOORTEN };
};
