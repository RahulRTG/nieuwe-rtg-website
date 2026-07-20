/* Buddy (deelmodule): de coachdata. De systeem-prompts en demo-antwoorden per
   hulpsoort staan in ./prompts; hier de buddy-persona's, de leeftijdslaag, de
   bespaartips en de gesprekskaarten. Pure data, geen logica. */
const { HULP_SYS, HULP_DEMO } = require('./prompts');
const AI_KINDS = Object.keys(HULP_SYS);
/* De AI-buddy: iedereen kiest zelf hoe die klinkt (vrouw, man of non-binair)
   met een eigen naam. De buddy blijft dezelfde persoon door alle coaches heen;
   we vervangen alleen de vaste naam in de systeemprompt door de gekozen buddy. */
/* Een AI-buddy voor het hele huis: Rahul. De oude keuzesleutels blijven
   bestaan zodat opgeslagen voorkeuren gewoon blijven werken, maar elk pad
   leidt naar dezelfde vaste buddy. */
const RAHUL = { naam: 'Rahul', wie: 'Rahul, de vaste AI-buddy van RTG voor het hele gezin' };
const BUDDY = { vrouw: RAHUL, man: RAHUL, nonbinair: RAHUL };

/* De leeftijdslaag: dezelfde tool voelt anders per leeftijdsgroep. Elke AI
   krijgt te horen met wie die praat, zodat taal, voorbeelden en niveau
   verschillen tussen een kind, een tiener, een jongvolwassene en een
   volwassene. Zo zijn de tools echt verschillend per groep. */
const LEEFTIJD = {
  mini:   { wie: 'een peuter of kleuter (0 tot 4 jaar), samen met een ouder', hoe: 'Richt je uitleg op de ouder: speels, heel eenvoudig, met een spelletje of liedje.' },
  kind:   { wie: 'een kind (5 tot 11 jaar)', hoe: 'Gebruik korte zinnen, simpele woorden en concrete voorbeelden uit hun wereld. Maak het speels en moedig aan.' },
  tiener: { wie: 'een tiener (12 tot 15 jaar)', hoe: 'Praat respectvol en op ooghoogte, iets uitdagender, en koppel het aan hun eigen wereld (school, vrienden, games).' },
  jong:   { wie: 'een jongvolwassene (16 tot 21 jaar)', hoe: 'Praat volwassen en direct, koppel aan studie, werk, geld en zelfstandig worden.' },
  volw:   { wie: 'een volwassene', hoe: 'Praat gelijkwaardig en praktisch, gericht op het echte leven en concrete stappen.' }
};

const BESPAARTIPS = [
  'Maak een boodschappenlijst en ga niet met honger naar de winkel: je koopt zo veel minder onnodige dingen.',
  'Kook een keer per week een grote pan (soep, stamppot, rijst met groente) en vries porties in. Goedkoop en klaar op drukke dagen.',
  'Check ieder jaar op toeslagen.nl of je recht hebt op zorgtoeslag, huurtoeslag of het kindgebonden budget. Aanvragen is gratis.',
  'Vraag bij je gemeente naar bijzondere bijstand en de energietoeslag. Veel mensen die er recht op hebben, vragen het niet aan.',
  'Zet de verwarming een graadje lager en doe een trui aan. Een dekentje op de bank scheelt echt op de energierekening.',
  'Huismerk in de supermarkt is vaak hetzelfde als het dure merk, maar veel goedkoper. Durf te ruilen.',
  'Kijk voor kleding, speelgoed en spullen eerst tweedehands: kringloop, Marktplaats of een weggeefgroep in de buurt.',
  'Heb je kinderen op school of sport? Stichting Leergeld en het Jeugdfonds Sport & Cultuur betalen mee. Vraag ernaar, het is gratis.',
  'Zeg abonnementen op die je niet gebruikt. Zet ze een maand stil en kijk of je ze mist.',
  'Betaal met contant of een aparte pas voor boodschappen. Als het op is, is het op; zo hou je grip.'
];

const GESPREKSKAARTEN = [
  'Wat was vandaag het fijnste moment van je dag?',
  'Waar ben je de laatste tijd trots op geworden?',
  'Als je een dag alles mocht doen wat je wilt, wat zou je dan doen?',
  'Wie heeft jou deze week geholpen, en hoe?',
  'Wat zou je later willen worden of doen? Waarom?',
  'Waar word jij blij van, ook al kost het niks?',
  'Wat wil je nog leren, en wie kan je daarbij helpen?',
  'Waar zijn we als gezin goed in samen?',
  'Wat is iets liefs dat iemand ooit tegen je heeft gezegd?',
  'Als we samen een klein feestje geven, wat doen we dan?',
  'Wat is een moeilijk moment geweest, en wat heeft je er doorheen geholpen?',
  'Voor wie zou je iets liefs willen doen, en wat?'
];

module.exports = { HULP_SYS, HULP_DEMO, AI_KINDS, BUDDY, LEEFTIJD, BESPAARTIPS, GESPREKSKAARTEN };
