/* Rahul kijkt mee: een foto van iets, en hij vertelt wat het is.

   LET OP HET VERSCHIL MET RTG EYE (kern/oog.js). Daar draait de visielaag
   volledig op het toestel en verlaat er geen beeld het apparaat -- dat is de
   werkvloer, waar een camera de hele dag aan staat en waar zwijgend meekijken
   een surveillancesysteem zou zijn.

   Dit is iets anders: het lid richt zelf, tikt zelf, en vraagt zelf iets. Die
   ene foto gaat wel naar het model, want anders is er geen antwoord. De regels
   die daarbij horen staan hier en niet ergens in een voorwaarde:

   - de foto wordt NERGENS opgeslagen. Niet in db.data, niet op schijf, niet in
     een log. Hij bestaat in het geheugen tijdens dit ene verzoek.
   - er komt geen naam, geen plek en geen tijd mee; alleen het beeld en de
     vraag.
   - staat er geen sleutel, dan zegt hij dat hij niet kan kijken. Iets verzinnen
     bij een foto die je niet gezien hebt, is precies het liegen waar Rahul niet
     aan doet.
   - gezichten: hij beschrijft geen personen en probeert niemand te herkennen.
     Dat staat in de opdracht en het is geen vrijblijvend verzoek.

   Bewaakt door test/kijken.test.js. */

const { schrob } = require('./rahul/taal');

const MAX = 1400 * 1024;           // ~1,4 MB dataURL; genoeg voor een nette foto
const SOORTEN = ['image/jpeg', 'image/png', 'image/webp'];

const OPDRACHT =
  'Iemand houdt de camera op iets en vraagt jou wat het is. Je bent Rahul: kort, concreet en eerlijk. ' +
  'Zeg wat je ziet en wat er nuttig aan is om te weten. Weet je het niet zeker, dan zeg je dat, met ' +
  'wat het waarschijnlijk is en waar je aan twijfelt. Verzin nooit een merk, een prijs, een jaartal ' +
  'of een herkomst die je niet kunt zien.\n' +
  'HARDE GRENS: staan er mensen op de foto, dan beschrijf je die niet en probeer je niemand te ' +
  'herkennen. Je zegt dan gewoon dat er iemand op staat en gaat verder over het voorwerp. ' +
  'Gaat de foto over iets medisch, juridisch of over veiligheid, dan zeg je wat je ziet en dat een ' +
  'mens ernaar moet kijken; je stelt geen diagnose.\n' +
  'Hooguit vier zinnen.';

/* De dataURL uitpakken. Streng: alleen de drie beeldsoorten, alleen base64,
   en een harde grens op de lengte. Alles wat daar niet aan voldoet gaat er
   niet in, in plaats van dat we het "wel proberen". */
function leesFoto(foto) {
  const s = String(foto || '');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) return null;
  if (s.length > MAX) return null;
  if (!SOORTEN.includes(m[1])) return null;
  return { soort: m[1], data: m[2] };
}

function maakKijken({ anthropic }) {
  async function kijk(foto, vraag) {
    const beeld = leesFoto(foto);
    if (!beeld) return { status: 400, error: 'Stuur een foto (jpeg, png of webp, max ongeveer 1 MB).' };
    if (!anthropic) return { status: 503, error: 'Ik kan nu niet kijken: er staat geen AI-sleutel ingesteld. Ik ga niet raden wat erop staat.' };
    const tekst = String(vraag || '').trim().slice(0, 200) || 'Wat is dit?';
    try {
      const r = await anthropic.messages.create({
        model: 'claude-opus-4-8', max_tokens: 400, system: OPDRACHT,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: beeld.soort, data: beeld.data } },
          { type: 'text', text: tekst }
        ] }]
      });
      const uit = schrob((r.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim());
      return uit ? { ok: true, tekst: uit } : { status: 502, error: 'Ik kreeg er niets uit. Probeer een scherpere foto.' };
    } catch (e) {
      return { status: 502, error: 'Kijken lukte nu niet: ' + String(e && e.message || '').slice(0, 80) };
    }
  }
  return { kijk, leesFoto };
}

module.exports = { maakKijken, leesFoto, OPDRACHT, MAX };
