/* DE GRENZEN VAN EEN SPELWERELD -- wat er niet in past, en waarom.

   Afgesplitst van ./spelwereld.js op de naad die de vier veiligheidsvragen
   blootlegden. Dat bestand gaat over het VAK: een wereld maken, vinden, laten
   vervallen, en de kern erop. Dit bestand gaat over de GRENS: welke namen een
   wereld nooit mag aanraken en met welke fout dat gebeurt.

   Twee onderwerpen met een verschillend tempo, en dat is de echte reden dat ze
   uit elkaar horen. Het vak is af zodra het werkt; de grenslijst groeit met elke
   capability die het platform erbij krijgt -- en hij hoort te groeien, want de
   lijst wordt compleet doordat hij ergens knelt en niet doordat iemand hem goed
   heeft geraden. */
'use strict';

/* WAT EEN SPELWERELD NIET MAG AANRAKEN. Alles wat naar buiten gaat: een mens
   waarschuwen, een scherm laten piepen, een bericht sturen. De lijst is een
   PREFIXLIJST en geen namenlijst, want een nieuwe `notifyX` hoort er vanzelf in
   te vallen -- anders is de grens compleet op de dag dat hij geschreven werd en
   daarna niet meer.

   `chatStuur` en `commWerk` staan er voluit bij: die dragen geen prefix maar
   openen wel een gesprek met een echt mens. */
const NAAR_BUITEN = [
  // een mens waarschuwen of een scherm laten piepen
  'sseTo', 'sseSend', 'notify', 'meld', 'push', 'mail', 'smtp', 'sms',
  /* GELD EN VERPLICHTINGEN, en deze acht zijn er later bij gekomen op de vraag
     "wat zou je absoluut getoetst willen hebben". De eerste lijst dekte het
     rinkelen af en niet het BETALEN, en dat is de duurdere helft: een
     spelhandeling die een betaalprovider aanroept, een boeking vastlegt of een
     tafel reserveert, doet iets in de echte wereld dat niet terug te draaien is.
     CLAUDE.md zegt het ook met zoveel woorden: nooit claimen dat een boeking
     daadwerkelijk verwerkt is. Hier kan het niet eens. */
  'betaal', 'pay', 'munt', 'stripe', 'tap', 'boek', 'reserv', 'webhook'
];
const NAAR_BUITEN_VOLUIT = ['chatStuur', 'commWerk', 'anthropic', 'gemini', 'nudge'];

/* WAT EEN WERELD VAN DE IDENTITEIT MAG WETEN, en dit is de scherpste grens van
   de vier.

   Een echt lid mag met zijn eigen identiteit spelen -- dat is juist de
   bedoeling: je bent jezelf, je leert de echte software. Maar een spelrol mag
   NOOIT een echt recht opleveren, en een spelwereld heeft niets te zoeken in de
   identiteitskluis.

   `accounts` draagt allebei: lezers (getUserById, publicUser) en schrijvers
   (createUser, renameUser, setTier, issueToken, trekIn, schrijfKluisRing). En
   het draagt de KLUIS: realNameOf, emailOf, phoneOf. Dat laatste is precies wat
   CLAUDE.md beschermt -- klantdata draait op codenamen, echte namen staan in de
   gescheiden kluis, en dat ontwerp omzeilen we niet. Een spel hoort nooit een
   echte naam of een e-mailadres te zien.

   Dus krijgt een wereld een LEESLIJST en geen module. Alles wat er niet in
   staat gooit, inclusief elke schrijver en elke kluisvraag. */
const IDENTITEIT_MAG = ['getUserById', 'publicUser', 'isActief', 'verifyToken', 'count'];

const gaatNaarBuiten = (naam) => NAAR_BUITEN_VOLUIT.includes(naam)
  || NAAR_BUITEN.some(p => naam.startsWith(p));

/* Een fout die zegt WAT er miste en WAAROM. Dezelfde vorm als grensFout in
   ../opzet/domeingrens.js, en om dezelfde reden: undefined is de gevaarlijkste
   uitkomst. */
function identiteitFout(id, naam) {
  const e = new Error('spelwereld: "' + id + '" reikt naar accounts.' + naam +
    ' -- een spelwereld mag de identiteit LEZEN en nooit veranderen, en de kluis nooit openen.\n' +
    '  Toegestaan: ' + IDENTITEIT_MAG.join(', ') + '.\n' +
    '  Een spelrol hoort nooit een echt recht op te leveren, en een spel hoort geen echte naam te zien.');
  e.spelwereld = { id, naam, soort: 'identiteit' };
  return e;
}

/* De leesbare kant van de identiteitskluis, en verder niets. */
function leesAccounts(accounts, id) {
  if (!accounts || typeof accounts !== 'object') return accounts;
  return new Proxy(accounts, {
    get(doel, naam) {
      if (typeof naam !== 'string') return doel[naam];
      if (!(naam in doel)) return undefined;
      if (!IDENTITEIT_MAG.includes(naam)) throw identiteitFout(id, naam);
      return typeof doel[naam] === 'function' ? doel[naam].bind(doel) : doel[naam];
    },
    set(doel, naam) { throw identiteitFout(id, naam); }
  });
}

function buitenFout(id, naam) {
  const e = new Error('spelwereld: "' + id + '" reikt naar kern.' + naam +
    ' -- dat kanaal gaat naar buiten en bestaat hier niet.\n' +
    '  Een spelhandeling hoort geen melding, mail of schermpiep bij een echt mens op te leveren.\n' +
    '  Moet deze route dat wel kunnen? Dan hoort hij niet in een spelwereld thuis.');
  e.spelwereld = { id, naam };
  return e;
}


module.exports = { NAAR_BUITEN, NAAR_BUITEN_VOLUIT, IDENTITEIT_MAG,
  gaatNaarBuiten, buitenFout, identiteitFout, leesAccounts };
