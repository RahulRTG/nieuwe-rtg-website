/* De demo-les voor kern/lesmaker.js: de vaste, warme les met zes meerkeuze-
   vragen die de motor gebruikt als er geen API-sleutel is (of als het AI-
   antwoord niet bruikbaar terugkomt). Pure functie van onderwerp + niveau;
   apart gehouden zodat de motor klein blijft. */
module.exports = function demoLes(onderwerp, niveau) {
  const o = onderwerp;
  const mini = niveau === 'mini' || niveau === 'kind';
  return {
    titel: 'Les over ' + o,
    uitleg: 'Vandaag leren we over ' + o + '. ' + (mini
      ? 'We kijken eerst samen wat het is, daarna gaan we oefenen met vragen. Fouten maken mag: zo leert je hoofd het juist goed onthouden!'
      : 'We beginnen met de kern: wat is het, waar gebruik je het voor en wat zijn de valkuilen. Daarna toetsen we het begrip met een korte quiz; noteer wat je fout had, dat zijn je leerpunten.'),
    vragen: [
      { v: 'Wat is een goede eerste stap als je iets nieuws over ' + o + ' wilt leren?',
        opties: ['Eerst kijken wat je al weet', 'Meteen alles uit je hoofd leren', 'Wachten tot de toets', 'Het overslaan'], juist: 0 },
      { v: 'Je snapt iets over ' + o + ' niet. Wat werkt het best?',
        opties: ['Een vraag stellen aan de leraar', 'Doen alsof je het snapt', 'Stoppen met opletten', 'Het antwoord gokken en doorgaan'], juist: 0 },
      { v: 'Hoe onthoud je de stof over ' + o + ' het langst?',
        opties: ['Elke dag een klein stukje herhalen', 'Een keer heel lang op de avond ervoor', 'Alleen de plaatjes bekijken', 'Niet herhalen'], juist: 0 },
      { v: 'Wat doe je met een fout antwoord in de quiz?',
        opties: ['Bekijken waarom het fout was; dat is je leerpunt', 'Snel vergeten', 'Boos worden', 'De quiz stoppen'], juist: 0 },
      { v: 'Waarom oefenen we ' + o + ' samen in de klas?',
        opties: ['Samen leren werkt: je leert van elkaars antwoorden', 'Omdat het moet', 'Om te kijken wie de snelste telefoon heeft', 'Zomaar'], juist: 0 },
      { v: 'Wat is een goede afsluiting van deze les over ' + o + '?',
        opties: ['In eigen woorden vertellen wat je geleerd hebt', 'Alles meteen vergeten', 'Alleen je score onthouden', 'Niets'], juist: 0 }
    ], demo: true
  };
};
