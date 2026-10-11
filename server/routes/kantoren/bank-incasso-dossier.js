/* Kantoren, deel "bank-incasso-dossier": DE LEESKANT VAN DE GELDKETEN.

   AFGESPLITST VAN ./bank-incasso.js toen dat over de 10 KB ging, precies op de naad die
   de kop daar al noemde: de leeskant hoort niet bij de baan. Het dossier is per
   VOORNEMEN en dus ook dat van de reisteruggave (./reisteruggave.js).

   Gemount vanuit ./bank-incasso.js, met dezelfde context. */
'use strict';

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, kern } = ctx;

  /* HET DOSSIER: wat er per as gebeurde, en welke VERPLICHTE as nog open staat.

     OOK LEZEN VRAAGT EEN NAAM. Eerst stond dit achter de gedeelde code, omdat het
     dossier over de HANDELING gaat en niet over een mens. Dat hield geen stand:
     `npm run kantoormacht` rekent dit pad tot de zware wegen (GELD_BEWEGEN) en
     zette `zwaarePaden.zonderMens` van nul op EEN. En het dossier toont de
     bedragen van leden en de NAMEN van beide ondertekenaars; dat het journaal die
     al droeg, zegt dat het elders lekt en niet dat het hier mag.

     DIT IS OOK DE NAAD als dit bestand ooit over de 10 kB gaat: de leeskant hoort
     bij ./bank-incasso-dossier.js en niet bij de baan. */
  /* mutatie: idempotent -- alleen lezen; de enige schrijver van het journaal is de
     baan zelf (klaarzetten, tekenen, uitvoeren). Twee keer lezen laat dezelfde
     stand achter. */
  app.post('/api/office/bank/incasso/dossier', kluisAuth, (req, res) => veilig(res, () => {
    if (!kern.geldketen) return { status: 503, error: 'De geldketen is niet gemount.' };
    const id = String((req.body || {}).voornemen || '');
    if (id) return kern.geldketen.dossier(id);
    const l = kern.geldketen.lijst({ limit: (req.body || {}).limit });
    return { ...l, ketenTop: kern.geldketen.journaalTop(), ketenHeel: kern.geldketen.journaalVerifieer() };
  }));
};
