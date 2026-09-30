'use strict';
const { createHash } = require('node:crypto');
const rechten = require('../rechten');
const context = require('../context');
const koppel = require('../koppel');
const { BRONNEN, schoon } = require('./voorkeur');
const tijd = x => new Date(x || 0).getTime() || 0;
const klein = x => String(x || '').toLowerCase();
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 20);
const veiligPad = x => typeof x === 'string' && /^\/apps\/[a-z0-9/_-]+\.html(?:[?#]|$)/i.test(x) ? x : null;

module.exports = ({ kern, sociaal, lezers, voorkeurOpslag }) => {
  const voorkeur = require('./voorkeur')(voorkeurOpslag);
  const bronnen = lezers || require('./bronnen')({ kern, sociaal });
  async function lees(sess, invoer = {}) {
    const modus = invoer.modus || 'alles', lens = invoer.lens || 'all';
    if (!rechten.modusOpen(sess.tier, modus) || !context.LENS_CONTEXT[lens])
      return { error: 'Deze wereld is niet beschikbaar.', items: [] };
    if (lens !== 'all' && !require('../../lidmaatschap').lenzenVoor(sess.tier).some(x => x.id === lens && x.open))
      return { error: 'Deze lens is niet beschikbaar.', items: [] };
    const o = schoon({ ...voorkeur.lees(sess.key), ...invoer, bewaard: voorkeur.lees(sess.key).bewaard });
    const beschikbaar = BRONNEN.filter(b => o.bronnen.includes(b.id)
      && (b.id === 'sociaal' || modus === 'alles'));
    const status = [], alles = [];
    await Promise.all(beschikbaar.map(async b => {
      try {
        const d = await bronnen[b.id](sess, { ...o, modus, lens });
        const meldingen = (d.meldingen || []).filter(Boolean);
        status.push({ id: b.id, naam: b.naam, ok: true, beperkt: !!d.beperkt, meldingen });
        for (const a of d.items) {
          const naar = veiligPad(a.url) || (a.open ? (koppel.open(a.open) || {}).url : null);
          const i = { ...a, bronGroep: b.id, url: naar,
            herkomst: { naam: a.uitgever || b.naam, ref: a.id, gewijzigd: a.gewijzigd || a.at || null,
              zicht: a.prive ? 'Alleen voor u' : 'Volgens de bron' },
            waarom: a.prive ? 'Uw eigen stand in ' + b.naam + '.' : 'U heeft ' + b.naam.toLowerCase() + ' aangezet.',
            bewaard: o.bewaard.includes(a.id) };
          // Veranderingen in inhoud, datum of bestemming tellen; likes niet.
          i.versie = hash([i.titel, i.tekst, i.beeld, i.begint, i.eindigt, i.plaats, i.url, i.herkomst, i.bronversie]);
          alles.push(i);
        }
      } catch (e) { status.push({ id: b.id, naam: b.naam, ok: false, meldingen: ['Tijdelijk niet bereikbaar. Probeer opnieuw.'] }); }
    }));
    const uniek = [...new Map(alles.map(i => [i.id, i])).values()];
    let passend = uniek.filter(i => {
      if (o.vorm === 'bewaard' && !i.bewaard) return false;
      if (o.vorm === 'agenda' && !i.begint) return false;
      if (o.plaats && !klein(i.plaats).includes(klein(o.plaats))) return false;
      return !o.zoek || klein([i.titel, i.tekst, i.auteur, ...(i.onderwerpen || [])].join(' ')).includes(klein(o.zoek));
    });
    // Sociale bronnen hebben hun relatiepoort al toegepast. Andere bronnen
    // horen niet in Friends of Dating, tenzij er een echte relatiebron is.
    if (['friends', 'dating'].includes(lens)) passend = passend.filter(i => i.bronGroep === 'sociaal');
    else passend = context.doorLens(passend, lens);
    passend.sort((a, b) => (o.vorm === 'agenda' ? tijd(a.begint) - tijd(b.begint) : tijd(b.at) - tijd(a.at))
      || a.id.localeCompare(b.id));
    const start = Math.max(0, Math.floor(Number(invoer.vanaf) || 0));
    const items = passend.slice(start, start + 30).map(i => ({ ...i, sectie: context.sectieVan(i),
      verbanden: passend.filter(x => x.id !== i.id && (x.onderwerpen || []).some(t =>
        (i.onderwerpen || []).includes(t))).slice(0, 3).map(x => ({ id: x.id, titel: x.titel || x.tekst.slice(0, 70),
        relatie: 'Gedeeld onderwerp', url: x.url })) }));
    return { ervaring: 'saloon', items, totaal: passend.length, meer: start + items.length < passend.length,
      secties: context.SECTIES, context: context.LENS_CONTEXT[lens], voorkeuren: o,
      bronnen: BRONNEN, bronstatus: BRONNEN.map(b => status.find(s => s.id === b.id)).filter(Boolean),
      volgorde: o.vorm === 'agenda' ? 'Op begindatum' : 'Nieuwste publicaties eerst',
      opgehaald: new Date().toISOString() };
  }
  return { lees, voorkeuren: voorkeur.lees, zetVoorkeuren: voorkeur.zet, bronnen: BRONNEN };
};
