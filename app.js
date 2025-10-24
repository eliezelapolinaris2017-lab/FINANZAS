// =============================
// Chart 12 months simple
const c = el('#chart12');
const ctx = c.getContext('2d');
c.width = c.clientWidth; c.height = 160;
ctx.clearRect(0,0,c.width,c.height);
// build data
const months=[]; const inc=[]; const exp=[];
for(let i=11;i>=0;i--){
const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
const to = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
months.push(d.toLocaleDateString('es-ES',{month:'short'}));
inc.push(sumRange(state.incomesDaily, from, to));
exp.push(sumRange(state.expensesDaily, from, to));
}
const max = Math.max(...inc, ...exp, 1);
const barW = Math.floor(c.width / (months.length*2));
months.forEach((m,idx)=>{
const x = idx*(barW*2)+20; // spacing
const hI = Math.round((inc[idx]/max)*(c.height-30));
const hE = Math.round((exp[idx]/max)*(c.height-30));
// incomes bar (top)
ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
ctx.fillRect(x, c.height-10-hI, barW, hI);
// expenses bar (below)
ctx.fillStyle = '#555';
ctx.fillRect(x+barW+4, c.height-10-hE, barW, hE);
ctx.fillStyle = '#aaa';
ctx.font = '12px system-ui';
ctx.fillText(m, x, c.height-2);
});
}

// ---------- Export/Import JSON ----------
function exportJSON(){
const data = JSON.stringify(state, null, 2);
const blob = new Blob([data], {type:'application/json'});
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'finanzas-backup.json';
a.click(); URL.revokeObjectURL(a.href); toast('JSON exportado');
}
function importJSON(file){
const reader = new FileReader();
reader.onload = ()=>{
try{
const incoming = JSON.parse(reader.result);
if(confirm('¿Reemplazar TODO con el archivo? (Cancelar = fusionar)')){
state = incoming; save(); toast('Datos reemplazados');
} else {
// fusionar simple (sobrescribe settings, concatena listas)
state.settings = Object.assign({}, state.settings, incoming.settings||{});
['expensesDaily','incomesDaily','payments','ordinary','budgets','personal'].forEach(k=>{
if(Array.isArray(incoming[k])) state[k] = state[k].concat(incoming[k]);
});
save(); toast('Datos fusionados');
}
}catch(e){ toast('Archivo inválido'); }
};
reader.readAsText(file);
}

// ---------- Print / PDF ----------
function printView(id){ showView(id); setTimeout(()=>window.print(), 100); }

// ---------- Settings ----------
function fileToBase64(file){
return new Promise((resolve,reject)=>{
const r = new FileReader();
r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);
});
}
function wireSettings(){
el('#saveSettings').onclick = ()=>{
state.settings.businessName = el('#setName').value || 'Mi Negocio';
state.settings.currency = el('#setCurrency').value || 'USD';
state.settings.theme.primary = el('#colorPrimary').value;
state.settings.theme.accent = el('#colorAccent').value;
state.settings.theme.text = el('#colorText').value;
save(); toast('Configuración guardada');
};
el('#setLogo').addEventListener('change', async (ev)=>{
const f = ev.target.files[0]; if(!f) return;
state.settings.logoBase64 = await fileToBase64(f); save(); toast('Logo actualizado');
});
el('#delLogo').onclick = ()=>{ state.settings.logoBase64=''; save(); toast('Logo eliminado'); };

el('#exportJSON').onclick = exportJSON;
el('#importJSON').addEventListener('change', (ev)=>{ const f=ev.target.files[0]; if(f) importJSON(f); });

el('#changePIN').onclick = async ()=>{
const old = el('#pinOld').value; const n1 = el('#pinNew').value; const n2 = el('#pinNew2').value;
if(!state.settings.pinHash){ toast('Primero crea un PIN en Login'); return; }
if(await sha256(old) !== state.settings.pinHash) return toa
