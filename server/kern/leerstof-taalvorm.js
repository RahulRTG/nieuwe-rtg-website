/* RTG School: dezelfde opgave in een andere taal.

   De Language Independence Test vraagt om DEZELFDE conceptuele vraag in een
   tweede taal. Dat kan niet met een vertaler: een half vertaalde som is een
   andere som, en dan meet de test iets anders dan hij belooft.

   Het kan wel met het FEIT dat een opgave sinds de Misconception Graph al
   draagt: de bouwstenen waaruit hij is gemaakt (de twee getallen, de
   bewerking, de noemer, de eenheid). Uit datzelfde feit is de vraag in elke
   taal opnieuw op te bouwen -- en het ANTWOORD verandert niet, want dat volgt
   uit de bouwstenen en niet uit de zin. Dat is de kern: er wordt niet vertaald
   maar OPNIEUW GESTELD.

   WAAR DIT NIET VOOR IS. Voor taalvakken. Daar is de zin zelf wat je meet, en
   dan is dit een manier om de meting weg te halen. De poort daarvoor staat in
   ./taalbeleid.js en wordt hier niet nog eens nagebouwd.

   WAT ER NIET IS, STAAT ER OOK. Voor een taal die hier niet staat komt er null
   uit en geen half werk. Nederlands en Engels zijn nagelopen; andere talen
   horen erbij te komen met iemand die ze spreekt, niet met een gok. Dat is
   dezelfde regel als bij de leerlijnen: liever een lege plek dan een lege
   belofte. */
const TALEN = ['nl', 'en'];

const kommaNL = (x) => String(x).replace('.', ',');

/* Per feitsoort de zin, per taal. De DATA is overal dezelfde; alleen de zin
   verschilt -- dat is precies wat de test wil isoleren. */
const VORMEN = {
  som: {
    nl: (f) => f.a + ' ' + f.op + ' ' + f.b + ' =',
    en: (f) => f.a + ' ' + f.op + ' ' + f.b + ' ='
  },
  tafel: {
    nl: (f) => f.n + ' x ' + f.t + ' =',
    en: (f) => f.n + ' x ' + f.t + ' ='
  },
  deel: {
    nl: (f) => f.deeltal + ' : ' + f.deler + ' =',
    en: (f) => f.deeltal + ' : ' + f.deler + ' ='
  },
  'breuk-som': {
    nl: (f) => f.a + '/' + f.noemer + ' + ' + f.b + '/' + f.noemer + ' =',
    en: (f) => f.a + '/' + f.noemer + ' + ' + f.b + '/' + f.noemer + ' ='
  },
  procent: {
    nl: (f) => f.p + '% van ' + f.basis + ' =',
    en: (f) => f.p + '% of ' + f.basis + ' ='
  },
  metriek: {
    nl: (f) => f.van + ' = hoeveel ' + f.naar + '?',
    en: (f) => f.van + ' = how many ' + f.naar + '?'
  },
  deelrest: {
    nl: (f) => (f.heel * f.deler + f.rest) + ' : ' + f.deler + ' = ?  (schrijf eerst hoe vaak het past, dan het woord rest, dan wat overblijft)',
    en: (f) => (f.heel * f.deler + f.rest) + ' : ' + f.deler + ' = ?  (write how many times it fits, then the word rest, then what is left)'
  },
  negatief: {
    nl: (f) => 'Het is ' + f.start + ' graden. Het wordt ' + f.stijging + ' graden warmer. Hoe warm is het dan?',
    en: (f) => 'It is ' + f.start + ' degrees. It gets ' + f.stijging + ' degrees warmer. How warm is it then?'
  },
  afronden: {
    nl: (f) => 'Rond ' + f.n + ' af op ' + (f.stap === 10 ? 'tientallen' : f.stap === 100 ? 'honderdtallen' : 'duizendtallen'),
    en: (f) => 'Round ' + f.n + ' to the nearest ' + f.stap
  }
};

/* De vraag opnieuw stellen in een taal. Geeft null als het niet kan -- geen
   half vertaalde zin, want die meet iets anders. */
function inTaal(feit, taal) {
  const t = String(taal || '').toLowerCase();
  const vorm = feit && VORMEN[feit.soort];
  if (!vorm || !vorm[t]) return null;
  return vorm[t](feit);
}

const kan = (feit, taal) => inTaal(feit, taal) !== null;
const talenVoor = (feit) => (feit && VORMEN[feit.soort] ? Object.keys(VORMEN[feit.soort]) : []);

module.exports = { inTaal, kan, talenVoor, VORMEN, TALEN, kommaNL };
