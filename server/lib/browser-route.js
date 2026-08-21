/* Browser-driver, deel "route": het ONDERSCHEPPEN van verzoeken.

   Hiermee laat een schermtoets de pagina iets anders zien dan de echte server
   geeft -- een endpoint dat 500 teruggeeft, een antwoord dat te laat komt, een
   verbinding die wegvalt. Dat is een ander onderwerp dan navigeren en klikken:
   die gaan over wat een MENS doet, dit gaat over wat het NET doet.

   TWEE DINGEN DIE HIER VASTLIGGEN:

   1. EEN URL DIE NIEMAND ONDERSCHEPT LOOPT GEWOON DOOR. Fetch.enable houdt
      ELK verzoek tegen tot iemand antwoordt; vergeet je door te laten, dan
      hangt de pagina en lijkt het alsof de toets traag is in plaats van stuk.
   2. EEN HANDLER DIE STRUIKELT LAAT HET VERZOEK DOOR en breekt de toets niet
      af. Anders zou een fout in de toets zelf eruitzien als een fout in het
      scherm, en dat is het duurste soort verwarring.

   De glob wordt eenmalig naar een regexp vertaald: een patroon met sterretjes
   is wat een schermtoets wil typen, een regexp is wat de vergelijking nodig
   heeft. Voorbeelden staan bij naarRegexp() hieronder, en met opzet niet hier:
   een glob met een ster gevolgd door een schuine streep SLUIT dit commentaar,
   en dan wordt de rest van de regel als code gelezen. Dat is precies wat er
   gebeurde -- dit bestand wierp bij het laden "api is not defined", en omdat
   elke schermtoets die require in een try/catch zet ("geen browser"), sloegen
   ze allemaal stilletjes over in plaats van te melden dat de driver stuk was
   (LAT-regel 5: niets slaat stil over). */
'use strict';

function globNaarRe(glob) {
  const esc = String(glob).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*+/g, '.*');
  return new RegExp('^' + esc + '$');
}

/* Zet de twee route-methoden op de Page-klasse. Ze horen bij een pagina (elke
   pagina heeft zijn eigen onderscheppingen) maar niet in het bestand dat over
   de pagina zelf gaat -- zelfde opzet als rustUit() in ./browser-grepen.js. */
function routesUit(Page) {
  Page.prototype.route = async function (glob, handler) {
    this._routes.push({ re: globNaarRe(glob), handler });
    if (!this._fetchAan) { this._fetchAan = true; await this.conn.stuur('Fetch.enable', {}, this.sessionId); }
  };

  Page.prototype._opVerzoek = async function (p) {
    const url = p.request.url;
    const r = this._routes.find((x) => x.re.test(url));
    const req = p.requestId;
    if (!r) { try { await this.conn.stuur('Fetch.continueRequest', { requestId: req }, this.sessionId); } catch (e) {} return; }
    const route = {
      fulfill: async (resp) => {
        const body = resp.body != null ? Buffer.from(String(resp.body)).toString('base64') : undefined;
        await this.conn.stuur('Fetch.fulfillRequest', {
          requestId: req, responseCode: resp.status || 200,
          responseHeaders: [{ name: 'Content-Type', value: resp.contentType || 'text/plain' }], body
        }, this.sessionId);
      },
      continue: async () => { await this.conn.stuur('Fetch.continueRequest', { requestId: req }, this.sessionId); },
      abort: async () => { await this.conn.stuur('Fetch.failRequest', { requestId: req, errorReason: 'Aborted' }, this.sessionId); }
    };
    try { await r.handler(route); } catch (e) { try { await route.continue(); } catch (er) {} }
  };
}

module.exports = { routesUit, globNaarRe };
