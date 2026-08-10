/* Horeca (kern): de pols van een zaak -- hoe druk, hoe luid, hoe gezellig het
   NU is. Drie bronnen, en dat is de hele architectuur van dit bestand.

   1. GEMETEN. Wat wij zelf uitrekenen uit gegevens die er toch al zijn:
      openstaande bereidingsminuten gedeeld door de koks (de wachttijd), open
      rekeningen tegenover de geregistreerde tafels (de bezetting), en de
      clubdeurteller. Dat deel staat in ./polsmeting.js.
   2. WAT DE ZAAK INVULT. Sfeer, geluid, temperatuur, terras. Daar is geen
      sensor voor, dus zegt de zaak het, met een tijdstip erbij.
   3. WAT GASTEN MELDEN. Dezelfde onderwerpen, maar vanaf de tafel waar ze
      zitten, en met het aantal meldingen erbij.

   DRIE REGELS DIE DIT EERLIJK HOUDEN

   a. ER KOMT GEEN EEN GETAL UIT. Geen "sfeerscore 8,2" waarin een meting en
      een mening tot een gemiddelde zijn geroerd. Zo'n cijfer is door niemand
      meer na te rekenen en betekent bij elke zaak iets anders. De drie blokken
      blijven gescheiden en dragen allemaal hun eigen etiket.
   b. WIE MAG WAT ZEGGEN LIGT VAST. Per onderwerp staat welke bronnen erover
      mogen spreken. Een zaak die haar eigen wachttijd mag invullen, vult hem
      laag in; wat gemeten kan worden, wordt gemeten.
   c. OUD IS WEG. Een invulling van vanmiddag zegt niets over vanavond. Buiten
      het versvenster verdwijnt de waarde: hij wordt niet met een oud tijdstip
      alsnog als "nu" gepresenteerd. Liever een gat met uitleg dan een gevuld
      veld dat niet klopt. */
'use strict';

const ONDERWERPEN = {
  wachttijd: { naam: 'Wachttijd in de keuken', eenheid: 'min', bronnen: ['gemeten'] },
  bezetting: { naam: 'Hoe vol het is', eenheid: '%', bronnen: ['gemeten'] },
  drukte: { naam: 'Drukte', standen: ['rustig', 'gezellig', 'druk', 'vol'], bronnen: ['zaak', 'gasten'] },
  geluid: { naam: 'Geluid', standen: ['stil', 'achtergrond', 'levendig', 'luid'], bronnen: ['zaak', 'gasten'] },
  sfeer: { naam: 'Sfeer', standen: ['ingetogen', 'gezellig', 'feestelijk'], bronnen: ['zaak', 'gasten'] },
  temperatuur: { naam: 'Temperatuur', standen: ['koel', 'aangenaam', 'warm'], bronnen: ['zaak', 'gasten'] },
  terras: { naam: 'Terras', standen: ['zon', 'half in de schaduw', 'schaduw', 'dicht'], bronnen: ['zaak'] },
  wachtrij: { naam: 'Wachtrij aan de deur', standen: ['geen', 'kort', 'lang'], bronnen: ['zaak', 'gasten'] }
};

// hoe lang een uitspraak meegaat. Een avond kantelt in een uur, dus kort.
const VERS = { zaak: 180, gasten: 120 };

module.exports = ({ save, schoon, horeca }) => {
  const { H, nu } = horeca;
  const gemeten = require('./polsmeting')({ horeca, ONDERWERPEN });
  const minutenSinds = (at) => at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 1e9;
  const klok = (at) => { const d = new Date(at); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function P(zaakcode) {
    const h = H(zaakcode);
    if (!h.pols) h.pols = { zaak: {}, meldingen: [] };
    if (!h.pols.zaak) h.pols.zaak = {};
    if (!Array.isArray(h.pols.meldingen)) h.pols.meldingen = [];
    return h.pols;
  }

  const kent = (onderwerp, bron) => {
    const o = ONDERWERPEN[String(onderwerp || '')];
    return o && o.bronnen.includes(bron) ? o : null;
  };
  const paren = (x) => Object.entries(x && typeof x === 'object' ? x : {}).slice(0, 20);

  /* ---------- wat de zaak invult ---------- */
  function zetZaak(zaakcode, standen, wie) {
    const p = P(zaakcode);
    const gezet = [];
    const geweigerd = [];
    for (const [onderwerp, stand] of paren(standen)) {
      const o = kent(onderwerp, 'zaak');
      if (!o) { geweigerd.push({ onderwerp, waarom: 'Dit onderwerp vult de zaak niet in: het wordt gemeten of het bestaat niet.' }); continue; }
      const s = schoon(stand, 30);
      if (s === '') { delete p.zaak[onderwerp]; gezet.push({ onderwerp, stand: null }); continue; }
      if (!o.standen.includes(s)) { geweigerd.push({ onderwerp, waarom: 'Kies uit: ' + o.standen.join(', ') + '.' }); continue; }
      p.zaak[onderwerp] = { stand: s, at: nu(), door: schoon(wie, 40) || null };
      gezet.push({ onderwerp, stand: s });
    }
    // eerst opruimen, dan pas bewaren: anders blijft het verlopene tot de
    // volgende schrijfactie in de opslag staan
    const beeld = zaakZegt(zaakcode);
    save();
    return { ok: true, gezet, geweigerd, zaakZegt: beeld };
  }

  function zaakZegt(zaakcode) {
    const p = P(zaakcode);
    const uit = [];
    for (const [onderwerp, rij] of Object.entries(p.zaak)) {
      const min = minutenSinds(rij.at);
      if (min > VERS.zaak) { delete p.zaak[onderwerp]; continue; }  // oud is weg, niet oud getoond
      uit.push({ onderwerp, naam: (ONDERWERPEN[onderwerp] || {}).naam || onderwerp, stand: rij.stand,
        bron: 'zaak', minutenGeleden: min, label: 'volgens de zaak, bijgewerkt om ' + klok(rij.at) });
    }
    return uit;
  }

  /* ---------- wat gasten melden ----------
     Een melding hangt aan de deelnemershash van een tafelsessie: je meldt
     vanaf de tafel waar je zit. Een tweede melding over hetzelfde onderwerp
     VERVANGT de eerste, zodat een gast die twintig keer op de knop drukt even
     zwaar telt als de rest van zijn tafel. */
  function meld(zaakcode, hash, standen) {
    const p = P(zaakcode);
    const wie = String(hash || '');
    if (!wie) return { status: 401, error: 'Deze melding heeft geen tafel.' };
    const gezet = [];
    const geweigerd = [];
    for (const [onderwerp, stand] of paren(standen)) {
      const o = kent(onderwerp, 'gasten');
      if (!o) { geweigerd.push({ onderwerp, waarom: 'Hierover vragen we gasten niets.' }); continue; }
      const s = schoon(stand, 30);
      if (!o.standen.includes(s)) { geweigerd.push({ onderwerp, waarom: 'Kies uit: ' + o.standen.join(', ') + '.' }); continue; }
      p.meldingen = p.meldingen.filter(m => !(m.door === wie && m.onderwerp === onderwerp));
      p.meldingen.push({ onderwerp, stand: s, door: wie, at: nu() });
      gezet.push({ onderwerp, stand: s });
    }
    if (!gezet.length && geweigerd.length) return { status: 400, error: geweigerd[0].waarom, geweigerd };
    p.meldingen = p.meldingen.slice(-500);
    const beeld = gastenZeggen(zaakcode);
    save();
    return { ok: true, gezet, geweigerd, gastenZeggen: beeld };
  }

  /* Samenvatten zonder over de standen te middelen: we tonen de stand die het
     vaakst genoemd is, met de hele verdeling en het aantal erbij. Bij twee
     meldingen is "levendig" geen feit, en dat mag je zien. */
  function gastenZeggen(zaakcode) {
    const p = P(zaakcode);
    p.meldingen = p.meldingen.filter(m => minutenSinds(m.at) <= VERS.gasten);
    const per = new Map();
    for (const m of p.meldingen) {
      if (!per.has(m.onderwerp)) per.set(m.onderwerp, { verdeling: {}, aantal: 0, laatste: m.at });
      const r = per.get(m.onderwerp);
      r.verdeling[m.stand] = (r.verdeling[m.stand] || 0) + 1;
      r.aantal++;
      if (m.at > r.laatste) r.laatste = m.at;
    }
    return [...per.entries()].map(([onderwerp, r]) => {
      const o = ONDERWERPEN[onderwerp] || { standen: [] };
      const top = Object.entries(r.verdeling)
        .sort((a, b) => b[1] - a[1] || o.standen.indexOf(a[0]) - o.standen.indexOf(b[0]))[0];
      return { onderwerp, naam: o.naam || onderwerp, stand: top[0], aantal: r.aantal, verdeling: r.verdeling,
        bron: 'gasten', minutenGeleden: minutenSinds(r.laatste),
        label: r.aantal === 1 ? 'gemeld door 1 gast'
          : 'volgens ' + r.aantal + ' gasten, laatste ' + Math.round(VERS.gasten / 60) + ' uur' };
    });
  }

  /* De pols zoals een gast of de avondplanner hem leest: drie blokken naast
     elkaar, nooit tot een cijfer geroerd. */
  function pols(zaakcode) {
    /* Lezen ruimt op (zaakZegt en gastenZeggen gooien het verlopene weg), en
       dus kan een LEESACTIE de opslag veranderen. Alleen dan schrijven we ook:
       een save() bij elke opvraging betekent een schrijfronde per zaak per
       plan, en dat is werk dat niemand heeft gevraagd. */
    const p = P(zaakcode);
    const voor = Object.keys(p.zaak).length + p.meldingen.length;
    const g = gemeten(zaakcode);
    const zegt = zaakZegt(zaakcode);
    const zeggen = gastenZeggen(zaakcode);
    if (Object.keys(p.zaak).length + p.meldingen.length !== voor) save();
    return { zaak: String(zaakcode || ''), gemeten: g.gemeten, nietGemeten: g.nietGemeten,
      zaakZegt: zegt, gastenZeggen: zeggen,
      stil: !g.gemeten.length && !zegt.length && !zeggen.length,
      let: 'Elk getal draagt hier zijn bron. Wat gemeten is, is na te rekenen; wat de zaak of een gast zegt, is een waarneming met een tijdstip.' };
  }

  return { ONDERWERPEN, VERS, gemeten, zetZaak, zaakZegt, meld, gastenZeggen, pols };
};
