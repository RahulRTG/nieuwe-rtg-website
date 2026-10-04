#!/usr/bin/env node
'use strict';
/* Source reachability is deliberately NOT visual or functional certification.
   Discover every shipped HTML source, follow its actual CSS imports and keep
   redirect, offline package, embedded and protected-canvas scopes separate. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const TARGET = 'public/shared/rtg-editorial-system.css';
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const {read,walk,attr,resolveLocal,stylesheetLinks,cssPath,redirectTarget,directScripts,classifyFamily}=require('./lib/editorial-source');
function discover(root = ROOT, target = TARGET) {
  const identityFile = path.join(root, 'public/shared/rtg-world-identity.js');
  const registryFile = path.join(root, 'public/shared/rtg-heritage-registry.js');
  const identity = fs.existsSync(identityFile) ? require(identityFile) : { classify: () => null };
  const registry = fs.existsSync(registryFile) ? require(registryFile) : {};
  const files = ['index.html', ...walk(root, 'public').filter(x => x.endsWith('.html')),
    ...walk(root, 'explore').filter(x => x.endsWith('.html')), ...walk(root, 'storeapps').filter(x => x.endsWith('.html'))]
    .filter(file => fs.existsSync(path.join(root, file)));
  const rows = files.map(file => {
    const html = read(root, file), body = html.match(/<body\b[^>]*>/i)?.[0] || '';
    const route = file === 'index.html' ? '/' : '/' + file.replace(/^public\//, '').replace(/\/index\.html$/, '/');
    // The file route, not its index alias, indexes the existing component register.
    const canonical = file.startsWith('public/') ? '/' + file.slice(7) : route;
    const redirect = redirectTarget(html), packageSource = file.startsWith('storeapps/');
    const stylesheets = stylesheetLinks(html, file), scripts = directScripts(html, file);
    const linkage = stylesheets.map(style => cssPath(root, style, target)).find(Boolean) || null;
    const world = identity.classify(canonical) || attr(body, 'data-rtg-world') || null;
    const iframeElements = [...html.matchAll(/<iframe\b[^>]*>/gi)].map(([tag]) => ({
      id: attr(tag, 'id'), src: attr(tag, 'src'), sandbox: attr(tag, 'sandbox'), title: attr(tag, 'title')
    }));
    return {
      route: canonical, aliases: route !== canonical ? [route] : [], source: file, source_sha256: digest(html),
      type: redirect ? 'REDIRECT' : packageSource ? 'ISOLATED_PACKAGE' : 'SCREEN',
      delivery: packageSource ? 'SIGNED_OFFLINE_BUNDLE' : file.startsWith('public/') || file === 'index.html' ? 'NODE_AND_OR_STATIC_SITE' : 'STATIC_SITE',
      redirect_to: redirect, world: world === 'redirect' ? null : world,
      family: classifyFamily(file, canonical, html, registry),
      component_profile: registry.profiles?.[canonical]?.type || null,
      protected_canvas: registry.canvas?.[canonical] || null,
      stylesheets, scripts, shared_design_path: linkage,
      shared_design_coverage: redirect ? 'TARGET_MUST_RESOLVE' : packageSource ? 'SEPARATE_BUNDLE_REVIEW_REQUIRED' : linkage ? 'STATIC_LINKED' : 'MISSING',
      inline_style_blocks: [...html.matchAll(/<style\b/gi)].length,
      inline_style_attributes: [...html.matchAll(/\sstyle\s*=/gi)].length,
      embedded_frames: iframeElements,
      visual_review: 'NOT_PROVEN_BY_STATIC_LINKAGE', functional_review: 'NOT_PROVEN_BY_STATIC_LINKAGE'
    };
  });
  const map = new Map(rows.flatMap(row => [row.route, ...row.aliases].map(route => [route, row])));
  for (const row of rows.filter(item => item.type === 'REDIRECT')) {
    const targetRoute = new URL(row.redirect_to, 'https://rtg.local' + row.route).pathname;
    const targetRow = map.get(targetRoute);
    row.redirect_target_design = targetRow?.shared_design_coverage || 'UNRESOLVED';
  }
  let commit = null, dirty = null;
  try { commit = execFileSync('git', ['rev-parse','HEAD'], {cwd: root, encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim();
    dirty = Boolean(execFileSync('git',['status','--porcelain'], {cwd: root, encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim());
  } catch (_) { /* Fixture roots and source archives do not invent a commit. */ }
  const screens = rows.filter(r => r.type === 'SCREEN'), redirects = rows.filter(r => r.type === 'REDIRECT'), packages = rows.filter(r => r.type === 'ISOLATED_PACKAGE');
  const families = [...new Set(screens.map(row => row.family))].sort().map(family => ({family, count:screens.filter(r=>r.family===family).length, routes:screens.filter(r=>r.family===family).map(r=>r.route)}));
  const missing = screens.filter(r => r.shared_design_coverage === 'MISSING').map(r=>r.route);
  const badRedirects = redirects.filter(r => r.redirect_target_design !== 'STATIC_LINKED').map(r=>r.route);
  return {
    schema:'RTG_EDITORIAL_COVERAGE/v1', timestamp:new Date().toISOString(), commit, worktree_dirty:dirty,
    scope:'Source linkage inventory; not a browser, visual, functional, physical-device or release certificate.',
    target, target_sha256:fs.existsSync(path.join(root,target)) ? digest(read(root,target)) : null,
    hosting_json:fs.existsSync(path.join(root,'.openai/hosting.json')),
    totals:{screen_sources:screens.length,redirects:redirects.length,isolated_packages:packages.length,static_linked:screens.length-missing.length,missing_shared_design:missing.length,unresolved_redirect_design:badRedirects.length},
    findings:{missing_shared_design:missing,unresolved_redirect_design:badRedirects,isolated_package_review:packages.map(r=>r.source)},
    aliases:[
      {routes:['/apps','/apps/','/apps/index.html','/apps/bureau.html'],target:'/apps/app.html',source:'server/middleware/voordeur.js',proof:'SOURCE_DECLARATION_ONLY'},
      {routes:['/apps/foundation/'],target:'/apps/foundation/index.html',source:'server/middleware/voordeur.js',proof:'STATIC_DIRECTORY_INDEX'},
    ],
    contextual_routes:[{route:'/apps/werkruimte.html',query_parameter:'gebied',values:['kantoor','persoonlijk','reizen','living','foundation'],source:'public/shared/rtg-world-identity.js',proof:'SOURCE_DECLARATION_ONLY'}],
    exclusions:[
      {source:'ontwerp/**/*.dc.html',reason:'Design source canvases and partials, not app routes.'},
      {route:'/toestel/cel',source:'server/routes/toestel.js',reason:'Invisible computation sandbox. style-src none is an isolation boundary, not a missing screen theme.'},
      {source:'third-party app bundles and arbitrary browser contents',reason:'Contents belong to their publisher; RTG themes their containing workspace, never injects across an isolation boundary.'}
    ],
    families, rows
  };
}
function summary(report) {
  const t=report.totals;
  return '# RTG editorial screen inventory\n\n' +
    `Source snapshot: ${report.commit || 'no git commit'}; dirty worktree: ${report.worktree_dirty}.\n\n`+
    `${t.screen_sources} independent screen sources, ${t.redirects} redirect sources, ${t.isolated_packages} offline app-package sources. `+
    `${t.static_linked} screens statically link the shared design; ${t.missing_shared_design} do not.\n\n`+
    'This does not certify visual equivalence, loaded CSS, authenticated states, dialogs, actions, device behavior or production readiness. Browser and human visual evidence must remain separate.\n\n'+
    '## Families\n\n'+report.families.map(x=>`- ${x.family}: ${x.count}`).join('\n')+'\n\n'+
    '## Explicit gaps\n\n'+
    report.findings.missing_shared_design.map(x=>`- Missing shared design: ${x}`).concat(
      report.findings.unresolved_redirect_design.map(x=>`- Redirect target not linked: ${x}`),
      report.findings.isolated_package_review.map(x=>`- Isolated bundle requires its own material review: ${x}`)
    ).join('\n')+'\n';
}
if(require.main===module){
  const at=process.argv.indexOf('--output'), out=at>=0?path.resolve(process.argv[at+1]):null;
  const report=discover();
  if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'SCREEN-REGISTER.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,'SCREEN-COVERAGE.md'),summary(report));}
  console.log(JSON.stringify({scope:report.scope,totals:report.totals,findings:report.findings,output:out},null,2));
  process.exitCode=report.totals.missing_shared_design||report.totals.unresolved_redirect_design?1:0;
}
module.exports={discover,resolveLocal,stylesheetLinks,cssPath,redirectTarget,summary};
