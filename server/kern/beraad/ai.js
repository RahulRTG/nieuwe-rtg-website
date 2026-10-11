/* Beraad (deelmodule): Rahul in het beraad. Drie taken, alle drie LEZEND, en
   alle drie zonder model (GEMEENSCHAP-FASE0.md par. 4.3).

   1. samenvatting -- EEN regel per inbreng, als [{ zin, inbrengId }]. Niet de
      globale samenvatter over alles samen: die scoort zinnen en laat de
      minderheid vallen, en dat is wegen. Hier staat elke inbreng erin die niet
      is ingetrokken, en de bron hangt de SERVER eraan uit de projectie -- een
      regel waarvan het id niet in die projectie staat, vervalt.
   2. perspectieven -- een gesloten lijst aspecten, deterministisch nagelopen.
      Wat niemand noemde, komt terug als vraag, niet als oordeel.
   3. concept -- een conceptvoorstel als TEKST terug naar het invoerveld. Er
      wordt niets bewaard: een lid plaatst het onder zijn eigen sleutel.

   Deze module krijgt de leesweergave (./leesweergave.js) en verder niets: geen
   beraadmodule, geen opslag, geen melder. Zij kan dus niet stemmen, niet
   besluiten en niets vastleggen, en test/beraad.test.js leest de bron na. Er
   gaat ook niets naar een model: zonder model kan geen model sturen. */
'use strict';

const { samenvat: lokaal } = require('../../lib/lokale-taal');

const ASPECTEN = Object.freeze([
  Object.freeze({ aspect: 'kosten', zoek: /\b(kost\w*|duur\w*|goedkop\w*|prijs|geld|budget|euro|betal\w*|bijdrage)\b|€/i,
    vraag: 'Wat kost dit, en wie betaalt het?' }),
  Object.freeze({ aspect: 'tijd', zoek: /\b(wanneer|datum|tijd|termijn|deadline|week|maand|jaar|uur|planning)\b/i,
    vraag: 'Wanneer gebeurt dit, en hoe lang duurt het?' }),
  Object.freeze({ aspect: 'wie-raakt-het', zoek: /\b(wie|leden|iedereen|buren|kinderen|ouderen|mensen|raakt|gevolg\w*)\b/i,
    vraag: 'Wie raakt dit, ook buiten wie hier meepraat?' }),
  Object.freeze({ aspect: 'alternatief', zoek: /\b(alternatie\w*|anders|optie\w*|in plaats van|andere manier)\b/i,
    vraag: 'Is er een andere manier om hetzelfde te bereiken?' }),
  Object.freeze({ aspect: 'risico', zoek: /\b(risico\w*|gevaar\w*|misgaat|mis gaat|veilig\w*|onveilig\w*)\b/i,
    vraag: 'Wat kan er misgaan, en wat doen we dan?' }),
  Object.freeze({ aspect: 'toegankelijkheid', zoek: /\b(toegankelijk\w*|rolstoel\w*|drempel\w*|slechtziend\w*|doof|doven|bereikbaar\w*|vertaling|tolk)\b/i,
    vraag: 'Kan iedereen meedoen, ook wie slecht ter been is, slecht ziet of hoort, of de taal minder goed spreekt?' })
]);

const NIET = { ok: false, status: 404, reden: 'Dit beraad ken ik niet, of je bent geen lid van het genootschap waarin het loopt.' };

function eenRegel(tekst) {
  const z = lokaal(tekst, { maxZinnen: 1, maxTekens: 240 });
  const t = String(z || tekst || '').trim();
  return t.length > 240 ? t.slice(0, 237) + '...' : t;
}

module.exports = ({ lees }) => {

  function samenvatting(sess, id) {
    const r = lees.ronde(sess, id);
    if (!r) return NIET;
    const bekend = new Set(r.regels.map(x => x.id));
    const regels = r.regels
      .map(x => ({ zin: eenRegel(x.tekst), inbrengId: x.id, soort: x.soort }))
      .filter(x => bekend.has(x.inbrengId) && x.zin);
    return { ok: true, ronde: r.ronde, regels, aantal: regels.length, bron: 'lokale-taal', ai: false,
      uitleg: 'Een regel per inbreng, in de volgorde waarin ze kwamen. Niets is weggelaten of gewogen.' };
  }

  function perspectieven(sess, id) {
    const r = lees.ronde(sess, id);
    if (!r) return NIET;
    const alles = [r.vraag, r.voorstel || ''].concat(r.regels.map(x => x.tekst)).join('\n');
    const aanwezig = [], ontbreekt = [];
    for (const a of ASPECTEN) {
      if (a.zoek.test(alles)) aanwezig.push(a.aspect);
      else ontbreekt.push({ aspect: a.aspect, vraag: a.vraag });
    }
    return { ok: true, ronde: r.ronde, ontbreekt, aanwezig, bron: 'lokale-regels', ai: false,
      uitleg: 'Een vaste lijst van zes aspecten. Wat hier staat, noemde nog niemand; dat zegt niet dat het ontbreekt.' };
  }

  function klaarzetConcept(sess, id) {
    const r = lees.ronde(sess, id);
    if (!r) return NIET;
    const s = samenvatting(sess, id).regels;
    const p = perspectieven(sess, id).ontbreekt;
    const delen = ['Naar aanleiding van de vraag "' + r.vraag + '" stellen wij voor: [vul hier het voorstel in].'];
    if (s.length) delen.push('Wat er is ingebracht:\n' + s.map(x => '- ' + x.zin).join('\n'));
    if (p.length) delen.push('Nog niet besproken:\n' + p.map(x => '- ' + x.vraag).join('\n'));
    return { ok: true, ronde: r.ronde, concept: delen.join('\n\n'), bewaard: false, bron: 'lokale-regels', ai: false,
      uitleg: 'Dit is een concept in je invoerveld. Er is niets geplaatst; dat doe je zelf, onder je eigen naam.' };
  }

  return { samenvatting, perspectieven, concept: klaarzetConcept, ASPECTEN };
};
