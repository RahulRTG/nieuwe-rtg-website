/* De live PostgreSQL-waarheidsgrens: requestcommit vóór antwoord, een echte
   write-health toestand en volledige resync vóór verkeer weer open gaat. */
'use strict';

const context = require('./verzoekcontext');

module.exports = function maakPostgresVerzoeken(o) {
  const { store, db, state, motor, slot, topUp, extern, basisKlaar } = o;
  let gezond = false, reden = 'PostgreSQL wordt geladen', herstel = null;
  let timer = null, poging = 0, achtergrondOpen = false;
  const stromen = new Set();
  const actief = () => store === 'postgres';
  const vrij = p => p === '/api/health' || p === '/api/ready' ||
    String(p || '').startsWith('/api/techniek') || String(p || '').startsWith('/api/cluster');

  function stand() { return { writeHealthy: !actief() || gezond, reden: gezond ? null : reden }; }

  function sluitStromen() {
    for (const res of stromen) {
      try { res.destroy(Object.assign(new Error('PostgreSQL-write-health gesloten.'), { code: 'PG_ONGEZOND' })); } catch (e) {}
    }
    stromen.clear();
  }

  function planHerstel() {
    if (!actief() || (basisKlaar && !basisKlaar()) || herstel || timer) return;
    const ms = Math.min(5000, 100 * Math.pow(2, Math.min(poging, 6)));
    timer = setTimeout(() => { timer = null; herstelNu().catch(() => {}); }, ms);
    if (timer.unref) timer.unref();
  }

  function ongezond(err, bron) {
    if (!actief()) return;
    gezond = false;
    reden = String((bron ? bron + ': ' : '') + ((err && err.message) || err || 'opslagfout')).slice(0, 240);
    sluitStromen(); planHerstel();
  }

  async function volledigeResync(p) {
    await p.pool.query('SELECT 1');
    const alles = await p.laadAlles();
    if (!alles) throw new Error('PostgreSQL bevat geen autoritatieve collecties.');
    state.setRuweData(alles);
    if (typeof topUp === 'function') await topUp();
    await p.pool.query('SELECT 1');
    const cb = typeof extern === 'function' ? extern() : null;
    if (cb) cb();
  }

  async function herstelNu() {
    if (!actief()) return true;
    if (herstel) return herstel;
    herstel = slot(async () => {
      const p = motor();
      if (!p) throw new Error('PostgreSQL-motor ontbreekt.');
      /* Een achtergrondmutatie heeft geen HTTP-bevestiging, maar wordt terwijl
         verkeer dicht staat wel als één collectiebundel gecommit. */
      if (achtergrondOpen) {
        const w = p.openstaandeWijzigingen(state.getRuweData());
        if (w.length) await p.commitVerzoek(state.getRuweData(), w);
        achtergrondOpen = false;
      }
      await volledigeResync(p);
      gezond = true; reden = null; poging = 0;
      context.voltooiAchtergrond();
      return true;
    });
    try { return await herstel; }
    catch (e) {
      gezond = false; reden = 'resync: ' + String(e.message || e).slice(0, 220);
      poging++; planHerstel(); throw e;
    } finally { herstel = null; if (!gezond) planHerstel(); }
  }

  function gestart() { if (actief()) { gezond = true; reden = null; poging = 0; if (achtergrondOpen) ongezond(null, 'opstartmutatie'); } }
  function achtergrondSave() {
    /* Tijdens de pre-ready fase is de PG-motor al verbonden zodat de
       verplichte startupmigraties transactioneel kunnen draaien. Een gewone
       timer/save is dan nog steeds startdata, niet een runtime-incident. */
    if (!actief() || !motor() || (basisKlaar && !basisKlaar())) return false;
    achtergrondOpen = true;
    context.beginAchtergrond();
    ongezond(new Error('mutatie buiten requestcontext'), 'achtergrond');
    return true;
  }

  async function commit(ctx) {
    if (!gezond) throw Object.assign(new Error(reden || 'PostgreSQL is niet schrijfgezond.'), { code: 'PG_ONGEZOND' });
    const p = motor();
    if (!p || typeof p.commitVerzoek !== 'function')
      throw Object.assign(new Error('PostgreSQL-requestcommit ontbreekt.'), { code: 'PG_GEEN_COMMIT' });
    const w = context.wijzigingen(ctx);
    if (!w.length) return { geschreven: 0 };
    try { return await slot(() => p.commitVerzoek(state.getRuweData(), w)); }
    catch (e) {
      if (!e || e.code !== 'PG_REQUEST_CONFLICT') ongezond(e, 'requestcommit');
      throw e;
    }
  }

  function foutAntwoord(req, res, echtEnd, herstel, ctx, err) {
    context.sluit(ctx);
    if (res.headersSent) { try { res.destroy(err); } catch (e) {} return; }
    herstel();
    try {
      for (const h of ['content-length', 'content-encoding', 'etag']) res.removeHeader(h);
      res.statusCode = err && err.code === 'PG_REQUEST_CONFLICT' ? 409
        : err && err.code === 'PG_SAVE_ONTBREEKT' ? 500 : 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (res.statusCode === 503) res.setHeader('Retry-After', '2');
    } catch (e) {}
    const tekst = res.statusCode === 409
      ? 'Deze gegevens zijn intussen gewijzigd; laad opnieuw en probeer nogmaals.'
      : res.statusCode === 500
        ? 'Deze handeling wijzigde gegevens zonder de verplichte opslagbevestiging.'
        : 'De opslag kon deze handeling niet duurzaam bevestigen; probeer opnieuw.';
    return echtEnd(JSON.stringify({ error: tekst }));
  }

  function middleware() {
    if (!actief()) return (_req, _res, next) => next();
    return function postgresWaarheid(req, res, next) {
      const ctx = context.nieuw(req);
      const echtEnd = res.end.bind(res);
      const echtWrite = typeof res.write === 'function' ? res.write.bind(res) : null;
      const echtWriteHead = typeof res.writeHead === 'function' ? res.writeHead.bind(res) : null;
      const echtFlush = typeof res.flushHeaders === 'function' ? res.flushHeaders.bind(res) : null;
      const gebufferd = [];
      let eindigt = false;
      let hersteld = false;
      const herstel = () => {
        if (hersteld) return;
        hersteld = true; res.end = echtEnd;
        if (echtWrite) res.write = echtWrite;
        if (echtWriteHead) res.writeHead = echtWriteHead;
        if (echtFlush) res.flushHeaders = echtFlush;
      };
      const stroomMagOpen = () => (req.method === 'GET' || req.method === 'HEAD') &&
        !ctx.opslaan && !ctx.voorCommit.length && !context.onbevestigdeWijzigingen(ctx).length;
      const openStroom = (soort, args) => {
        if (!stroomMagOpen()) return false;
        if (!gezond && !vrij(req.path)) throw Object.assign(
          new Error(reden || 'PostgreSQL is niet schrijfgezond.'), { code: 'PG_ONGEZOND' });
        ctx.stroom = true; stromen.add(res); herstel();
        if (soort === 'flush') echtFlush(); else echtWrite(...args);
        return true;
      };
      if (echtWriteHead) res.writeHead = (status, arg2, arg3) => {
        res.statusCode = status;
        const koppen = typeof arg2 === 'string' ? arg3 : arg2;
        if (typeof arg2 === 'string') res.statusMessage = arg2;
        if (Array.isArray(koppen)) {
          for (let i = 0; i + 1 < koppen.length; i += 2) res.setHeader(koppen[i], koppen[i + 1]);
        } else if (koppen) for (const k of Object.keys(koppen)) res.setHeader(k, koppen[k]);
        return res;
      };
      if (echtFlush) res.flushHeaders = () => {
        if (openStroom('flush')) return;
        /* flushHeaders is geen cosmetische hint: de aanroeper verklaart dat
           vanaf dit punt een langlevend antwoord begint. Wanneer eerdere
           middleware in hetzelfde GET-verzoek toch een opslagmutatie heeft
           klaargezet, kan die stroom nooit veilig tot de latere end()/COMMIT
           wachten. Stil bufferen zou de client onbeperkt laten hangen. */
        if (req.method === 'GET' || req.method === 'HEAD') {
          const e = new Error('Een antwoordstroom kan niet openen na een onbevestigde opslagmutatie.');
          e.code = 'PG_STREAM_MUTATIE';
          throw e;
        }
        /* Een gewone muterende response mag flushHeaders aanroepen, maar de
           echte kop blijft tot de latere requestcommit gebufferd. */
        ctx.koppenGevraagd = true;
      };
      if (echtWrite) res.write = (...a) => {
        if (openStroom('write', a)) return true;
        gebufferd.push(a); return true;
      };
      const ruim = () => { stromen.delete(res); if (!res.finished) context.sluit(ctx); };
      res.on('close', ruim); res.on('finish', () => stromen.delete(res));
      res.end = (...args) => {
        if (eindigt) return res;
        eindigt = true;
        Promise.resolve().then(() => context.voer(ctx, async () => {
          const status = res.statusCode || 200;
          if (ctx.hardeFout) throw ctx.hardeFout;
          if (!vrij(req.path) && !gezond)
            throw Object.assign(new Error(reden || 'PostgreSQL is niet schrijfgezond.'), { code: 'PG_ONGEZOND' });
          /* Een redirect kan de succesvolle uitkomst van een mutatie zijn
             (onder meer de SSO-callbacks). De opslagbeslissing volgt daarom
             het verzoekresultaat, niet alleen de 2xx-familie. 4xx/5xx blijven
             een rollback/discard en voeren ook geen na-commithaak uit. */
          const succes = status >= 200 && status < 400;
          if (succes) {
            if (context.onbevestigdeWijzigingen(ctx).length && !ctx.opslaan)
              throw Object.assign(new Error('save() ontbreekt na een mutatie.'), { code: 'PG_SAVE_ONTBREEKT' });
            await context.draaiVoorCommit(ctx);
            if (context.onbevestigdeWijzigingen(ctx).length && !ctx.opslaan)
              throw Object.assign(new Error('Een voor-commithaak muteerde zonder save().'), { code: 'PG_SAVE_ONTBREEKT' });
            if (ctx.opslaan) await commit(ctx);
            context.draaiNaCommit(ctx);
          }
          context.sluit(ctx);
          herstel();
          for (const a of gebufferd) echtWrite(...a);
          return echtEnd(...args);
        })).catch(e => foutAntwoord(req, res, echtEnd, herstel, ctx, e));
        return res;
      };
      context.voer(ctx, next);
    };
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null; sluitStromen(); context.annuleerAchtergrond();
  }

  return { middleware, gestart, ongezond, achtergrondSave, herstelNu,
    klaar: () => !actief() || gezond, stand, stop };
};
