'use strict';
/* Late binding: de bestaande domeinen bepalen publicatie en toegang. Deze
   adapters lezen hun publieke/sessionele projecties, nooit een tweede archief. */
const enc = encodeURIComponent;
const url = (pad, q) => pad + '?' + new URLSearchParams(q).toString();
module.exports = ({ kern, sociaal }) => ({
  livingworld(sess) {
    return kern.livingWorld.saloon(sess.key);
  },
  sociaal(sess, o) {
    const items = []; let d;
    do {
      d = sociaal({ ...sess, modus: o.modus, lens: o.lens, vanaf: items.length, hoeveel: 60 });
      if (d.error) throw new Error('Sociale bron niet beschikbaar');
      items.push(...d.items);
    } while (d.meer && items.length < 300);
    return { items, beperkt: d.meer };
  },
  nieuws() {
    const items = [];
    for (const krant of kern.journalistiek.krantGids()) {
      const d = kern.journalistiek.krant(krant.code);
      if (d.error) throw new Error('Krant niet beschikbaar');
      for (const a of d.artikelen) items.push({
        id: 'nieuws:' + krant.code + ':' + a.id, bron: 'nieuws', type: 'article',
        titel: a.titel, tekst: a.chapo, auteur: a.auteur || krant.naam,
        uitgever: krant.naam, at: a.gepubliceerd || a.bij, gewijzigd: a.bij, bronversie: a.publicatieversie,
        onderwerpen: [a.rubriek], beeld: a.beeld ? [{ src: a.beeld, alt: a.titel }] : [],
        url: url('/apps/krant.html', { zaak: krant.code }) + '#' + enc(a.id),
        actie: 'Lees artikel', artikel: { code: krant.code, id: a.id }
      });
    }
    return { items };
  },
  makers(sess) {
    const d = kern.mediaWereld(sess, { modus: 'alles' });
    if (d.error) throw new Error('Media niet beschikbaar');
    return { beperkt: d.totaal > d.stukken.length, meldingen: (d.buiten || []).map(x => x.reden),
      items: d.stukken.map(a => ({
        id: 'makers:' + a.id, bron: 'makers', type: a.vorm === 'live' && a.live ? 'live' : 'work',
        titel: a.titel, tekst: a.omschrijving || a.toelichting || a.meta || '',
        auteur: (a.maker || {}).codenaam || 'Maker', at: a.at,
        onderwerpen: a.onderwerp ? [a.onderwerp] : [],
        beeld: a.poster ? [{ src: a.poster, alt: a.titel }] : [],
        url: '/apps/media.html#stuk=' + enc(a.id), actie: 'Open werk',
        media: a.id, volgIk: !!a.volgIk,
        volgMaker: !a.mijn && ['clip', 'video'].includes(a.vorm) ? (a.maker || {}).codenaam : null,
        waarom: a.waarom || ''
      })) };
  },
  plekken() {
    const d = kern.mall.gidsen();
    return { items: d.genres.flatMap(g => g.leveranciers.filter(a =>
      kern.salonZichtbaar(kern.findSupplier(a.code))).map(a => ({
      id: 'plekken:' + a.code, bron: 'plekken', type: 'place', titel: a.naam,
      tekst: a.tagline || g.label, auteur: a.naam, plaats: a.stad,
      onderwerpen: [g.label], partner: true,
      url: url('/apps/app.html', { zaak: a.code }), actie: 'Bekijk zaak',
      uitgever: a.naam
    }))) };
  },
  persoonlijk(sess) {
    const d = kern.reiswereld.komend(sess.key);
    return { meldingen: (d.stil || []).map(() => 'Een reisbron is niet bereikbaar.'),
      items: d.komend.map(a => ({
        id: 'persoonlijk:' + a.soort + ':' + a.kenmerk, bron: 'persoonlijk', type: 'travel',
        titel: a.titel, tekst: [a.status, a.wacht].filter(Boolean).join(' · '),
        auteur: 'Uw reis', plaats: a.bestemming, begint: a.van, eindigt: a.tot,
        url: a.link, actie: 'Open reis', prive: true,
        uitgever: a.herkomst || a.app
      })) };
  }
});
