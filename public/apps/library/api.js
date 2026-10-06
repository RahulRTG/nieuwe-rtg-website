(function(){'use strict';
var token=null;try{token=localStorage.getItem('rtg_member_token')}catch(e){}
function call(path,body){return fetch('/api/library/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body||{})}).then(async function(r){var b=await r.json().catch(function(){return{error:'Ongeldig antwoord.'}});if(!r.ok||b.error)throw Object.assign(new Error(b.error||'De handeling mislukte.'),{body:b,status:r.status});return b})}
function op(prefix){return window.RTGId(String(prefix||'library').replace(/[^A-Za-z0-9_-]/g,'_'))}
window.LibraryAPI={call:call,op:op,token:token};
})();
