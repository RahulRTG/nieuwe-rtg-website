/* DE OFFERTEBOUWER: een prijs die is opgebouwd in plaats van bedacht.

   De offertestroom (kern/vakwerk/pro.js) vroeg de zaak om één getal: `prijs`.
   Dat werkt, en het is precies wat er misgaat zodra een klus uit meer dan één
   ding bestaat. De ondernemer rekent het in zijn hoofd of op een kladje uit,
   typt de uitkomst in, en de klant krijgt een bedrag zonder te zien waarvoor.
   Bij "waarom is het duurder dan vorig jaar" heeft niemand een antwoord, en bij
   het factureren begint het rekenwerk opnieuw.

   Deze laag bouwt de prijs uit REGELS. Twee soorten, en het onderscheid is het
   hele punt:

     uit de eigen diensten -> de regel wijst een dienst van de zaak aan, en de
                              prijs komt DAARVANDAAN. Wie zijn tarief verhoogt,
                              hoeft dat niet in elke offerte na te lopen.
     los ingevoerd         -> materiaal, voorrijkosten, een eenmalige post. Die
                              draagt zijn eigen prijs, want er is geen bron.

   DE ZAAK BLIJFT DE ENIGE SCHRIJVER. Deze module is PUUR: hij leest de zaak,
   rekent de regels door en geeft het resultaat terug. Het wegschrijven -- de
   status, de melding aan de klant, de boeking bij akkoord -- blijft in de
   offertestroom staan, waar het al stond. Een tweede plek die offertes bijwerkt
   is precies hoe twee waarheden ontstaan over dezelfde offerte (lat-regel 4).

   EN DE SOM STAAT NIET HIER. kern/regelsom.js rekent hem, dezelfde functie die
   de factuurmotor gebruikt. Zou deze laag zijn eigen btw terugrekenen, dan kan
   een offerte van 1.000 euro een factuur van 999,99 opleveren -- en dat is een
   cent waar een klant een mail over stuurt die niemand kan beantwoorden.

   WAT ER NIET IN ZIT, EN MET OPZET: een adviesprijs. Wij weten niet wat deze
   klus bij deze klant waard is, en een "voorgestelde prijs" op basis van
   eerdere offertes zou de ondernemer aanpraten wat hij moet vragen. Wat wij wel
   doen, is rekenen wat hij zelf invoert -- en zeggen wanneer dat onder zijn
   eigen tarief ligt. */
'use strict';

const REGELSOM = require('../regelsom');

/* Het standaardtarief per genre, dezelfde regel als de facturatie hanteert.
   Bewust hier herhaald als LIJST en niet als functie-aanroep: de offertebouwer
   draait binnen de vakwerklaag, die de facturatiemotor niet in handen heeft.
   Loopt deze lijst ooit uiteen met die van kern/facturatie.js, dan valt dat op
   in de toets die ze naast elkaar legt. */
const LAAG_BTW_TYPES = ['restaurant', 'bar', 'hotel', 'groothandel', 'boerderij'];
const MAX_REGELS = 40;

const btwVanZaak = (s) => (s && LAAG_BTW_TYPES.includes(s.type) ? 9 : 21);

/* De diensten van een zaak, ongeacht waar ze wonen. Een vakzaak zet ze in
   `services`; dat is de lijst waar de offertestroom zelf ook uit put. */
const dienstenVan = (s) => (Array.isArray(s && s.services) ? s.services : []);

/* Bouw de regels op. Geeft OF een resultaat OF een fout met de reden -- nooit
   een half resultaat, want een offerte met een stilzwijgend weggevallen regel
   is een offerte die te laag is en dat niet laat zien. */
function offerteBouw(zaak, regelsIn, scho) {
  const schoon = scho || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const lijst = Array.isArray(regelsIn) ? regelsIn : [];
  if (!lijst.length) return { status: 400, error: 'Een offerte zonder regels is een prijs zonder onderbouwing.' };
  if (lijst.length > MAX_REGELS) {
    return { status: 400, error: 'Ten hoogste ' + MAX_REGELS + ' regels per offerte.' };
  }

  const diensten = dienstenVan(zaak);
  const btwStd = btwVanZaak(zaak);
  const uit = [];

  for (const r of lijst) {
    const aantal = Math.max(1, Math.round(Number((r || {}).aantal) || 1));
    const dienstId = (r || {}).dienstId ? String(r.dienstId) : null;

    if (dienstId) {
      const d = diensten.find(x => String(x.id) === dienstId);
      /* Een dienst die niet bestaat wordt NIET stil overgeslagen en ook niet
         als losse regel behandeld: de ondernemer denkt dan dat zijn tarief in
         de offerte staat terwijl er iets anders in staat. */
      if (!d) return { status: 404, error: 'Deze dienst staat niet in uw aanbod: ' + dienstId.slice(0, 40) };
      const stuk = Number(d.price);
      if (!(stuk > 0)) {
        return { status: 409, error: 'De dienst "' + String(d.name).slice(0, 40) + '" heeft geen prijs. Zet die eerst in uw aanbod.' };
      }
      uit.push({ omschrijving: schoon(r.omschrijving, 120) || String(d.name || 'Dienst'),
        aantal, stuk, btw: Number.isFinite(Number(d.btw)) ? Number(d.btw) : btwStd,
        bron: 'dienst', dienstId });
    } else {
      const stuk = Math.round((Number((r || {}).stuk) || 0) * 100) / 100;
      if (!(stuk > 0)) return { status: 400, error: 'Elke losse regel heeft een prijs boven nul nodig.' };
      const oms = schoon((r || {}).omschrijving, 120);
      if (!oms) return { status: 400, error: 'Elke losse regel heeft een omschrijving nodig; anders leest de klant een bedrag zonder reden.' };
      uit.push({ omschrijving: oms, aantal, stuk,
        btw: Number.isFinite(Number(r.btw)) ? Number(r.btw) : btwStd, bron: 'los' });
    }
  }

  const som = REGELSOM.verwerkRegels(uit, btwStd, schoon);
  if (!(som.totaal > 0)) return { status: 400, error: 'Het totaal komt op nul uit.' };

  /* De regels dragen hun herkomst mee: verwerkRegels geeft alleen het geld
     terug, en zonder `bron` kan een scherm niet laten zien welke regel uit het
     eigen aanbod komt en welke met de hand is ingevoerd. */
  const metBron = som.regels.map((r, i) => Object.assign({}, r,
    { bron: uit[i].bron, dienstId: uit[i].dienstId || null }));

  return {
    ok: true, regels: metBron,
    subtotaal: som.subtotaal, btwBedrag: som.btwBedrag, totaal: som.totaal,
    btwStandaard: btwStd,
    uitLijst: metBron.filter(r => r.bron === 'dienst').length,
    los: metBron.filter(r => r.bron === 'los').length,
    uitleg: 'Stukprijzen zijn inclusief btw; de btw is teruggerekend per regel. Dit is dezelfde som als op de factuur die er straks uit voortkomt.'
  };
}

module.exports = { offerteBouw, btwVanZaak, LAAG_BTW_TYPES, MAX_REGELS };
