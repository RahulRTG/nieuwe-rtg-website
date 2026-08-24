/* De LEESBARE uitvoer, naast de machineleesbare.

   WAAROM ALLEBEI. De JSON is de waarheid: daar hangen de checksums aan en die
   gaat weer naar binnen. Maar een klant die vertrekt wil eerst iets anders
   weten -- staat mijn werk erin? -- en dat is aan tienduizend regels JSON niet
   te zien. Een mens die zijn eigen archief niet kan lezen, heeft geen archief
   maar een bestand.

   DEZE UITVOER IS EEN OVERZICHT EN GEEN KOPIE, en dat staat er ook in. Hij
   draagt per soort het aantal en de checksum uit dezelfde catalogus, plus de
   mensen met hun rollen -- want dat is de lijst waar een vertrekkende
   organisatie het vaakst naar kijkt. Zou hij alle velden uitschrijven, dan
   ontstaat er een tweede volledige uitvoer die kan afwijken van de eerste, en
   dan is de vraag welke van de twee geldt.

   Markdown en geen PDF: platte tekst die over tien jaar nog opengaat, zonder
   een bibliotheek die tegen die tijd niet meer bestaat. */
'use strict';

/* Een cel afschermen. DE BACKSLASH GAAT EERST, en dat is geen cosmetiek:
   schermen we alleen de pijp af, dan wordt een naam die letterlijk `\|` bevat
   `\\|` -- en dat leest een markdownlezer als "een echte backslash, gevolgd door
   een CELSCHEIDING". Wie zijn eigen naam mag kiezen, kiest dan de kolommen van
   iemand anders, en dan liegt het overzicht over wie welke rol had. Eerst de
   backslash verdubbelen, dan pas de pijp. Regeleindes gaan er allebei uit: een
   losse \r breekt de rij bij een lezer die op \r splitst net zo goed. */
const esc = (t) => String(t == null ? '' : t)
  .replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();

/* De mensen zijn de enige soort die we UITSCHRIJVEN, en met reden: bij een
   overgang is "wie had welke rol, en tot wanneer" de vraag die de nieuwe
   beheerder als eerste moet beantwoorden. */
function ledenTabel(leden) {
  const rijen = Object.values(leden || {});
  if (!rijen.length) return '_Geen leden._\n';
  const uit = ['| Naam | Functie | Stand | Rollen | Herkomst |', '|---|---|---|---|---|'];
  for (const l of rijen) {
    const rollen = (l.rollen || []).map(r => r.id + (r.tot ? ' tot ' + r.tot : '') + (r.bron === 'idp' ? ' (provider)' : '')).join(', ');
    uit.push('| ' + [esc(l.naam), esc(l.functie) || '-', esc(l.status),
      esc(rollen) || 'geen', l.bron === 'idp' ? 'identiteitsprovider' : 'met de hand'].join(' | ') + ' |');
  }
  return uit.join('\n') + '\n';
}

function maak(uitvoer) {
  const u = uitvoer || {};
  const w = u.werkruimte || {};
  const t = u.tenant;
  const r = [];

  r.push('# Uitvoer van ' + esc(w.naam || w.code));
  r.push('');
  r.push('_Gemaakt op ' + esc(u.at) + '._');
  r.push('');
  r.push('> **Dit overzicht is niet de uitvoer zelf.** De volledige gegevens staan in het');
  r.push('> machineleesbare bestand (JSON); daar horen de checksums bij en dat bestand gaat');
  r.push('> ook weer naar binnen. Wat u hier leest is een samenvatting om te controleren');
  r.push('> dat alles erin zit.');
  r.push('');

  r.push('## De organisatie');
  r.push('');
  r.push('| | |');
  r.push('|---|---|');
  r.push('| Werkruimte | ' + esc(w.naam) + ' (' + esc(w.code) + ') |');
  r.push('| Land / valuta / taal | ' + [esc(w.land), esc(w.valuta), esc(w.taal)].filter(Boolean).join(' · ') + ' |');
  if (w.kvk) r.push('| KvK | ' + esc(w.kvk) + ' |');
  if (w.btwNummer) r.push('| Btw-nummer | ' + esc(w.btwNummer) + ' |');
  r.push('| Aangemaakt | ' + esc(w.at) + ' |');
  r.push('| Organisatie (tenant) | ' + (t ? esc(t.naam) + ' (' + esc(t.org) + '), modus ' + esc(t.modus) : 'geen') + ' |');
  r.push('');

  r.push('## Wat er in deze uitvoer zit');
  r.push('');
  r.push('| Soort | Aantal | Checksum (sha256) |');
  r.push('|---|---:|---|');
  for (const c of (u.catalogus || [])) r.push('| ' + esc(c.soort) + ' | ' + c.aantal + ' | `' + String(c.checksum).slice(0, 16) + '…` |');
  r.push('');
  r.push('Eindsom van de uitvoer: `' + String(u.checksum || '').slice(0, 16) + '…`');
  r.push('');
  r.push('**Zelf narekenen:** ' + esc(u.recept));
  r.push('');

  r.push('## De mensen');
  r.push('');
  r.push(ledenTabel((u.inhoud || {}).leden));
  r.push('');

  r.push('## Wat er NIET in zit');
  r.push('');
  r.push('- De sleutels: het beheer-token, de lid-tokens en de koppeling naar RTG-accounts.');
  r.push('  Die zijn er bewust uit: een uitvoer is een archief en geen sleutelbos, en die');
  r.push('  laatste koppelt buiten de identiteitskluis om een werkruimtelid aan een');
  r.push('  RTG-account.');
  r.push('- Documenten, agenda en post van de medewerkers. Die horen bij hun eigen');
  r.push('  RTG-account en niet bij de werkruimte; de werkruimte zag daar alleen tellingen');
  r.push('  van. Wie die wil, vraagt zijn eigen inzage aan.');
  r.push('');

  return r.join('\n');
}

module.exports = { maak, ledenTabel };
