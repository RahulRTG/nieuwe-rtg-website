/* RTF Living Lab, deel "spel": missies, badges, niveaus en het labpaspoort.

   WAT HIER BEWUST NIET BELOOND WORDT: meer data. Geen punten per observatie,
   geen punten per deelnemer, geen ranglijst op volume. Dat is niet preuts maar
   praktisch -- een spel dat volume beloont, levert volume op, en een
   onderzoeksbestand vol snel ingetikte waarnemingen is minder waard dan tien
   goede. De eerste versie van deze module had wél een punt per observatie, en
   dat is er weer uit gehaald voordat het buiten kwam.

   WAT WEL BELOOND WORDT, is wetenschappelijk gedrag zelf:

     hypothese   een verwachting formuleren MET wat het tegendeel zou bewijzen
     bron        een bron natrekken (en dat geldt ook als hij niet blijkt te kloppen)
     interview   iemand echt spreken, in plaats van over hem schrijven
     prototype   iets bouwen en het laten testen
     misging     een fout in het eigen werk opschrijven
     herzien     een eerdere conclusie durven terugnemen -- de duurste van allemaal
     gestopt     een onderzoek stoppen omdat het bewijs tegenviel
     stap        de cyclus netjes een stap verder brengen

   `herzien` en `gestopt` leveren het meest op. Dat is de hele stelling van deze
   module in één tabel: wie zijn eigen ongelijk vastlegt, doet het beste werk.

   HET LABPASPOORT EN DE SCHEIDING. Een paspoort verzamelt punten over studies
   heen. Dat kan niet bij een GESCHEIDEN studie (klasse hoog en hoger), want dan
   zou het paspoort precies de koppeling maken die ./mensen.js met opzet niet
   vastlegt: wie meedeed aan die studie. Daar verdien je dus punten binnen de
   studie, en ze gaan niet mee naar buiten. Dat is een echt verlies en het staat
   hier zo opgeschreven, in plaats van dat het paspoort stilletjes toch koppelt. */
'use strict';

const PUNTEN = { hypothese: 15, bron: 10, interview: 12, prototype: 15, misging: 20, herzien: 40, gestopt: 35, stap: 5 };
const BADGES = [
  { badge: 'scherpsteller', naam: 'Scherpsteller', wat: 'hypothese', n: 1, uitleg: 'Een hypothese geformuleerd met het tegendeel erbij.' },
  { badge: 'brongraver', naam: 'Brongraver', wat: 'bron', n: 5, uitleg: 'Vijf bronnen zelf nagetrokken.' },
  { badge: 'luisteraar', naam: 'Luisteraar', wat: 'interview', n: 5, uitleg: 'Vijf mensen echt gesproken.' },
  { badge: 'bouwer', naam: 'Bouwer', wat: 'prototype', n: 3, uitleg: 'Drie prototypes getest.' },
  { badge: 'eerlijk', naam: 'Eerlijke onderzoeker', wat: 'misging', n: 3, uitleg: 'Drie keer een eigen fout vastgelegd.' },
  { badge: 'herziener', naam: 'Herziener', wat: 'herzien', n: 1, uitleg: 'Een eerdere conclusie teruggenomen toen het bewijs tegensprak.' },
  { badge: 'durfstopper', naam: 'Durfstopper', wat: 'gestopt', n: 1, uitleg: 'Een onderzoek gestopt omdat het bewijs tegenviel.' }
];
const NIVEAUS = [
  { niveau: 1, naam: 'Nieuwsgierig', vanaf: 0 }, { niveau: 2, naam: 'Buurtonderzoeker', vanaf: 50 },
  { niveau: 3, naam: 'Onderzoeker', vanaf: 150 }, { niveau: 4, naam: 'Hoofdonderzoeker', vanaf: 400 },
  { niveau: 5, naam: 'Labmeester', vanaf: 900 }
];
const MISSIES = [
  { missie: 'eerste', naam: 'Je eerste onderzoek', stappen: ['hypothese', 'bron', 'stap'], uitleg: 'Formuleer een hypothese, trek één bron na en zet de cyclus een stap verder.' },
  { missie: 'buurt', naam: 'De buurt in', stappen: ['interview', 'interview', 'interview'], uitleg: 'Spreek drie bewoners over wat er werkelijk speelt.' },
  { missie: 'eerlijk', naam: 'Eerlijk werk', stappen: ['misging', 'herzien'], uitleg: 'Leg een eigen fout vast en neem een conclusie terug die niet houdbaar bleek.' },
  { missie: 'bouw', naam: 'Van idee naar ding', stappen: ['prototype', 'prototype', 'stap'], uitleg: 'Bouw en test twee prototypes en breng het onderzoek verder.' }
];

module.exports = (ctx) => {
  const { nu, rid, schoon, code, S, save } = ctx;

  const niveauVan = p => NIVEAUS.slice().reverse().find(n => p >= n.vanaf) || NIVEAUS[0];
  const P = () => { if (!Array.isArray(S().paspoorten)) S().paspoorten = []; return S().paspoorten; };

  /* Belonen. `wie` is een alias of een naam; alleen een ALIAS die op deze studie
     staat krijgt punten op zijn deelnemersrij -- een medewerker die de knop
     indrukt is geen deelnemer. De studie zelf telt altijd mee, want de
     kwaliteitsscore van een onderzoek hoort bij het onderzoek. */
  function beloon(s, wat, wie) {
    const n = PUNTEN[wat];
    if (!n) return null;
    s.punten = (s.punten || 0) + n;
    if (!s.verdiend) s.verdiend = {};
    s.verdiend[wat] = (s.verdiend[wat] || 0) + 1;
    const alias = schoon(wie, 40);
    const d = s.dossier.deelnemers.find(x => x.alias === alias);
    if (!d) return { punten: n, studie: s.punten };
    d.punten = (d.punten || 0) + n;
    if (!d.verdiend) d.verdiend = {};
    d.verdiend[wat] = (d.verdiend[wat] || 0) + 1;
    const nieuw = [];
    for (const b of BADGES) {
      if (d.badges.includes(b.badge)) continue;
      if ((d.verdiend[b.wat] || 0) >= b.n) { d.badges.push(b.badge); nieuw.push(b); }
    }
    // het paspoort draagt alleen wat een niet-gescheiden studie mag doorgeven
    if (d.paspoortId) {
      const pas = P().find(x => x.id === d.paspoortId);
      if (pas) {
        pas.punten += n;
        pas.niveau = niveauVan(pas.punten).niveau;
        for (const b of nieuw) if (!pas.badges.includes(b.badge)) pas.badges.push(b.badge);
      }
    }
    return { punten: n, deelnemer: d.punten, studie: s.punten, badges: nieuw };
  }

  /* ---------- het labpaspoort ----------
     Een paspoort is van de MENS, niet van een studie. Het draagt een naam die de
     drager zelf kiest (een roepnaam, geen echte naam is nodig) en een code die
     alleen hij heeft. */
  function paspoortMaak(b) {
    b = b || {};
    const lab = ctx.vindLab(b.labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const naam = schoon(b.naam, 40);
    if (naam.length < 2) return { status: 400, error: 'Onder welke naam wilt u dit paspoort? Een roepnaam volstaat.' };
    if (P().length >= 100000) return { status: 400, error: 'Het paspoortregister zit vol.' };
    const p = { id: rid(), labId: lab.id, naam, code: code('LABPAS'), punten: 0, niveau: 1, badges: [], at: nu() };
    P().unshift(p);
    save();
    return { ok: true, paspoort: { id: p.id, naam: p.naam, code: p.code, punten: 0, niveau: 1, badges: [] } };
  }

  const opCode = c => P().find(p => p.code === String(c || '').trim().toUpperCase()) || null;

  function paspoort(c) {
    const p = opCode(c);
    if (!p) return { status: 404, error: 'Dit labpaspoort bestaat niet.' };
    const nv = niveauVan(p.punten), volgende = NIVEAUS.find(x => x.vanaf > p.punten) || null;
    return { ok: true, paspoort: { naam: p.naam, punten: p.punten, niveau: nv.niveau, niveauNaam: nv.naam,
      volgende: volgende ? { naam: volgende.naam, vanaf: volgende.vanaf, teGaan: volgende.vanaf - p.punten } : null,
      badges: p.badges.map(b => BADGES.find(x => x.badge === b)).filter(Boolean) },
      missies: MISSIES };
  }

  // door ./mensen.js aangeroepen als een deelnemer zijn paspoort meebrengt
  function koppelPaspoort(deelnemer, paspoortCode, gescheiden) {
    if (!paspoortCode) return { ok: true };
    if (gescheiden)
      return { status: 409, error: 'Deze studie houdt onderzoeksdata gescheiden; een labpaspoort zou juist de koppeling maken die daarmee wordt voorkomen. U doet mee zonder paspoort, en de punten blijven binnen dit onderzoek.' };
    const p = opCode(paspoortCode);
    if (!p) return { status: 404, error: 'Dit labpaspoort bestaat niet.' };
    deelnemer.paspoortId = p.id;
    return { ok: true, paspoort: p.naam };
  }

  const tabel = () => ({ ok: true, punten: PUNTEN, badges: BADGES, niveaus: NIVEAUS, missies: MISSIES,
    nietBeloond: ['aantal observaties', 'aantal deelnemers', 'aantal studies'] });

  return { beloon, paspoortMaak, paspoort, koppelPaspoort, opCode, niveauVan, tabel,
    PUNTEN, BADGES, NIVEAUS, MISSIES };
};
