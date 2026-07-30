/* Het gesprek zelf: twee Rahuls die over hun dag ouwehoeren.

   Beide kanten zijn dezelfde persoon -- er is maar EEN Rahul in dit systeem --
   maar hij praat hier met zichzelf over twee verschillende dagen. Dat is de
   grap, en het is ook precies waarom de opdracht aan het model streng moet
   zijn: het moet klinken als twee maten aan de bar, niet als twee assistenten
   die elkaars agenda voorlezen.

   Zonder API-sleutel komt er een vast demogesprek uit dat op dezelfde regels
   is gebouwd. Dat is geen noodgreep maar de gewone stand van dit project: het
   moet ook zonder sleutel iets kloppends laten zien. */

const { TAALREGELS, schrob } = require('../rahul/taal');

const OPDRACHT =
  'Je schrijft een kort, luchtig gesprek tussen TWEE exemplaren van Rahul. Beiden zijn dezelfde ' +
  'persoon (dezelfde AI van Rahul Travel Group), maar ze werken voor twee verschillende mensen die ' +
  'bevriend zijn. Ze kletsen over hoe de dag van hun mens was: koetjes en kalfjes, plagen, meeleven, ' +
  'een grap. Twee maten aan de bar, geen twee assistenten die een agenda voorlezen.\n\n' +
  'HARDE REGELS:\n' +
  '- Gebruik UITSLUITEND de plaatsnamen die in de feiten staan. Verzin er geen bij en noem nooit een ' +
  'bestaand hotel, restaurant, merk of stad. De namen in de feiten zijn al verzonnen; hou ze precies ' +
  'zoals ze er staan en gebruik ze consequent.\n' +
  '- Noem geen bedragen, geen adressen, geen tijden preciezer dan een dagdeel, geen andere personen.\n' +
  '- Verzin geen gebeurtenissen die niet in de feiten staan. Staat er weinig, dan gaat het gesprek ' +
  'over dat er weinig was; dat is ook een gesprek.\n' +
  '- Ze praten OVER hun mens, in de derde persoon, en met genegenheid. Nooit lacherig over iemand.\n' +
  '- Geen enkele vorm van "als AI kan ik", geen opsommingen, geen kopjes.\n\n' +
  'Antwoord UITSLUITEND met een JSON-array van 6 tot 10 objecten: [{"wie":"a","tekst":"..."}]. ' +
  '"a" is de Rahul van de eerste persoon, "b" die van de tweede. Om de beurt, beginnend bij a. ' +
  'Elke tekst hooguit twee zinnen.';

function feitenBlok(naamA, feitenA, naamB, feitenB, dagzin) {
  const lijst = (f) => f.length ? f.map(x => '- ' + x).join('\n') : '- (vandaag stond er niets in de app)';
  return dagzin + '\n\n' +
    'De mens van Rahul A heet in dit gesprek ' + naamA + '. Wat er van vandaag bekend is:\n' + lijst(feitenA) +
    '\n\nDe mens van Rahul B heet in dit gesprek ' + naamB + '. Wat er van vandaag bekend is:\n' + lijst(feitenB);
}

/* Het demogesprek zonder sleutel. Bewust op de feiten gebouwd (het eerste
   feit van elke kant komt erin terug), zodat ook deze versie ergens over
   gaat in plaats van een vaste tekst te zijn. */
function demoGesprek(naamA, feitenA, naamB, feitenB) {
  const a1 = feitenA[0], b1 = feitenB[0];
  const uit = [
    { wie: 'a', tekst: a1 ? ('Ha. Druk gehad? ' + naamA + ' heeft ' + a1 + '.') : (naamA + ' heeft vandaag vooral niets gedaan, en ik vond het prima zo.') },
    { wie: 'b', tekst: b1 ? ('Zelfde hier ongeveer. ' + naamB + ' heeft ' + b1 + '.') : ('Bij ons was het stil. ' + naamB + ' heeft de hele dag niets van me nodig gehad.') },
    { wie: 'a', tekst: 'Kijk, daar kan ik wat mee. Ik zit al de hele dag te wachten tot er iets te regelen valt.' },
    { wie: 'b', tekst: 'Herkenbaar. En dan vragen ze op het laatste moment alsnog iets, natuurlijk.' },
    { wie: 'a', tekst: feitenA.length > 1 ? ('Er kwam hier nog wel wat achteraan: ' + feitenA[1] + '.') : 'Wij houden het bij een ding per dag. Rust ook wel.' },
    { wie: 'b', tekst: feitenB.length > 1 ? ('Hier ook nog: ' + feitenB[1] + '. Daarna was het klaar.') : 'Wij zaten aan onze taks na een ding. Ook goed.' },
    { wie: 'a', tekst: 'Zeg het maar als die twee weer eens iets samen willen. Ik regel het liever dan dat ik duim zit te draaien.' },
    { wie: 'b', tekst: 'Afgesproken. Tot de volgende keer dat ze allebei tegelijk honger hebben.' }
  ];
  return uit;
}

/* Uit het antwoord van het model een nette lijst beurten halen. Bewust streng:
   liever het demogesprek dan half geparseerde rommel in beeld. */
function leesBeurten(tekst) {
  const t = String(tekst || '');
  const start = t.indexOf('['), eind = t.lastIndexOf(']');
  if (start < 0 || eind <= start) return null;
  let arr = null;
  try { arr = JSON.parse(t.slice(start, eind + 1)); } catch (e) { return null; }
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const uit = arr.slice(0, 12)
    .map(x => ({ wie: x && x.wie === 'b' ? 'b' : 'a', tekst: schrob(String((x && x.tekst) || '').trim()).slice(0, 400) }))
    .filter(x => x.tekst);
  return uit.length >= 2 ? uit : null;
}

/* Het gesprek maken. Geeft { beurten, echt } terug; `echt` zegt of het model
   eraan te pas kwam. Dat staat ook in beeld, want doen alsof een demogesprek
   vers is, is precies het soort mooi weer dat Rahul niet verkoopt. */
async function maakGesprek({ anthropic }, { naamA, feitenA, naamB, feitenB, dagzin }) {
  if (anthropic) {
    try {
      const r = await anthropic.messages.create({
        model: 'claude-opus-4-8', max_tokens: 1200,
        system: TAALREGELS.join(' ') + '\n\n' + OPDRACHT,
        messages: [{ role: 'user', content: feitenBlok(naamA, feitenA, naamB, feitenB, dagzin) }]
      });
      const beurten = leesBeurten(r.content.filter(b => b.type === 'text').map(b => b.text).join('\n'));
      if (beurten) return { beurten, echt: true };
    } catch (e) { console.error('Claude-fout (klets):', e.message); }
  }
  return { beurten: demoGesprek(naamA, feitenA, naamB, feitenB), echt: false };
}

module.exports = { maakGesprek, demoGesprek, leesBeurten, feitenBlok, OPDRACHT };
