// app.js
/*
  Finanzas Web App — Reescritura completa
  - SPA con router simple
  - CRUD por sección
  - Login con PIN (SHA-256 Web Crypto) + bloqueo por intentos
  - localStorage, Exportar/Importar JSON, Print por vista
*/
(function(){
  // ======== Estado ========
  const STORAGE_KEY = 'finanzas-state-v2';
  const LOCK_KEY = 'finanzas-lock-v2';
  const SCHEMA_VERSION = 2;

  const DEFAULT_STATE = {
    _version: SCHEMA_VERSION,
    settings: {
      businessName: 'Mi Negocio',
      logoBase64: '',
      theme: { primary: '#0b0b0e', accent: '#C7A24B', text: '#ffffff' },
      pinHash: '',
      currency: 'USD'
    },
    expensesDaily: [],
    incomesDaily: [],
    payments: [],
    ordinary: [],
    budgets: [],
    personal: []
  };

  const $ = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> Array.from(r.querySelectorAll(s));
  const clone = o => JSON.parse(JSON.stringify(o));

  function load(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){ localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE)); return clone(DEFAULT_STATE); }
    try{
      let st = JSON.parse(raw);
      if(!st._version) st._version = 1;
      if(st._version < SCHEMA_VERSION){
        // migraciones simples aquí si hiciera falta
        st._version = SCHEMA_VERSION;
      }
      return st;
    }catch{ return clone(DEFAULT_STATE); }
  }
  let state = load();
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); applyTheme(); refreshAll(); }

  // ======== Utilidades ========
  function fmt(n){
    const cur = state.settings.currency || 'USD';
    const val = Number(n||0);
    try{ return new Intl.NumberFormat('es-PR',{style:'currency',currency:cur}).format(val); }
    catch{ return `${cur} ${val.toFixed(2)}`; }
  }
  function toast(msg){
    const c = $('#toastContainer');
    const t = document.createElement('div');
    t.className='toast'; t.textContent=msg; c.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(), 300); }, 2200);
  }
  function uid(){ return Math.random().toString(36).slice(2,9)+Date.now().toString(36); }
  const toDate = s=> new Date(s);
  function inRange(d, from, to){
    const t = +toDate(d);
    if(from && t < +toDate(from)) return false;
    if(to && t > (+toDate(to) + 86400000 -1)) return false;
    return true;
  }

  // ======== Tema / Identidad ========
  function applyTheme(){
    const r = document.documentElement;
    r.style.setProperty('--primary', state.settings.theme.primary);
    r.style.setProperty('--accent', state.settings.theme.accent);
    r.style.setProperty('--text', state.settings.theme.text);
    $('#brandName').textContent = state.settings.businessName || 'Mi Negocio';
    ['brandLogo','logoPreview'].forEach(id=>{ const i=$('#'+id); if(i) i.src = state.settings.logoBase64 || 'assets/logo.png'; });
    if($('#setName')) $('#setName').value = state.settings.businessName;
    if($('#setCurrency')) $('#setCurrency').value = state.settings.currency;
  }

  // ======== Router ========
  function showView(id){
    $$('.view').forEach(v=>v.classList.remove('visible'));
    const target = $('#'+id) || $('#home');
    target.classList.add('visible');
    $$('.nav-btn').forEach(b=> b.classList.toggle('active', b.dataset.target===id));
    $('#viewTitle').textContent = target.dataset.title || id;
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function wireNav(){
    $$('.nav-btn').forEach(b=> b.addEventListener('click', ()=>{
      showView(b.dataset.target);
      $('#sidebar').classList.remove('open');
    }));
    $('#menuToggle').addEventListener('click', ()=> $('#sidebar').classList.toggle('open'));
    $('#mobileMenu').addEventListener('click', ()=> $('#sidebar').classList.toggle('open'));
  }

  // ======== Seguridad (PIN) ========
  async function sha256(msg){
    const enc = new TextEncoder().encode(msg);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function attempts(){ return Number(localStorage.getItem(LOCK_KEY)||0); }
  function setAttempts(n){ localStorage.setItem(LOCK_KEY, String(n)); }
  function attemptsLeft(){ return Math.max(0, 5 - attempts()); }

  async function handleLogin(){
    const createMode = !state.settings.pinHash;
    const pin = $('#loginPIN').value.trim();
    if(!pin) return toast('Introduce un PIN');

    if(createMode){
      const pin2 = $('#loginPIN2').value.trim();
      if(pin.length<4 || pin.length>8) return toast('El PIN debe tener 4–8 dígitos');
      if(pin!==pin2) return toast('Los PIN no coinciden');
      state.settings.pinHash = await sha256(pin); save();
      toast('PIN creado'); showView('home');
    }else{
      if(attempts()>=5){ toast('Bloqueado por demasiados intentos.'); return; }
      const ok = await sha256(pin) === state.settings.pinHash;
      if(ok){ setAttempts(0); toast('Bienvenido'); showView('home'); }
      else { setAttempts(attempts()+1); toast('PIN incorrecto'); updateLoginUI(); }
    }
  }
  function updateLoginUI(){
    const createMode = !state.settings.pinHash;
    $('#loginTitle').textContent = createMode ? 'Crear PIN' : 'Ingresar PIN';
    $('#loginHint').textContent = createMode ? 'Crea un PIN de 4–8 dígitos.' : 'Introduce tu PIN para acceder.';
    $('#loginPIN2').style.display = createMode ? 'block' : 'none';
    const left = attemptsLeft();
    $('#loginAttempts').textContent = createMode ? '' : (left===0 ? 'Bloqueado.' : `Intentos restantes: ${left}`);
    $('#loginBtn').onclick = handleLogin;
  }

  // ======== Gastos Diarios ========
  function renderExpenses(){
    const tbody = $('#expensesTable tbody'); if(!tbody) return;
    tbody.innerHTML='';
    const from = $('#fExpFrom')?.value; const to = $('#fExpTo')?.value;
    let total=0; const cats={};
    state.expensesDaily.filter(e=>inRange(e.date, from, to)).forEach(e=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.date||''}</td>
        <td>${e.category||''}</td>
        <td>${e.desc||''}</td>
        <td>${e.method||''}</td>
        <td>${fmt(e.amount)}</td>
        <td>${e.note||''}</td>
        <td class="row-actions"><button class="btn-outline" data-del="${e.id}">Eliminar</button></td>`;
      tbody.appendChild(tr);
      total+=Number(e.amount||0);
      cats[e.category]=(cats[e.category]||0)+Number(e.amount||0);
    });
    $('#expensesTotal').textContent = fmt(total);
    const wrap = $('#expCategoryTotals'); if(wrap){ wrap.innerHTML=''; Object.entries(cats).forEach(([k,v])=>{ const s=document.createElement('span'); s.className='pill'; s.textContent=`${k}: ${fmt(v)}`; wrap.appendChild(s);}); }
    $$('#expensesTable [data-del]').forEach(b=> b.onclick=()=>{ state.expensesDaily = state.expensesDaily.filter(x=>x.id!==b.dataset.del); save(); toast('Gasto eliminado'); });
  }
  function wireExpenses(){
    $('#expenseForm')?.addEventListener('submit',(ev)=>{
      ev.preventDefault();
      const rec = {
        id: uid(), date: $('#expDate').value, category: $('#expCategory').value,
        desc: $('#expDesc').value, amount: Number($('#expAmount').value||0),
        method: $('#expMethod').value, note: $('#expNote').value
      };
      if(!rec.date) return toast('Fecha requerida');
      state.expensesDaily.push(rec); save(); toast('Gasto guardado'); ev.target.reset();
    });
    $('#fExpApply')?.addEventListener('click', renderExpenses);
  }

  // ======== Ingresos ========
  function renderIncomes(){
    const tbody = $('#incomesTable tbody'); if(!tbody) return;
    tbody.innerHTML='';
    const from = $('#fIncFrom')?.value; const to = $('#fIncTo')?.value;
    let total=0;
    state.incomesDaily.filter(r=>inRange(r.date, from, to)).forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.date||''}</td>
        <td>${r.client||''}</td>
        <td>${r.method||''}</td>
        <td>${fmt(r.amount)}</td>
        <td class="row-actions"><button class="btn-outline" data-del="${r.id}">Eliminar</button></td>`;
      tbody.appendChild(tr); total+=Number(r.amount||0);
    });
    $('#incomesTotal').textContent = fmt(total);
    $$('#incomesTable [data-del]').forEach(b=> b.onclick=()=>{ state.incomesDaily = state.incomesDaily.filter(x=>x.id!==b.dataset.del); save(); toast('Ingreso eliminado'); });
  }
  function wireIncomes(){
    $('#incomeForm')?.addEventListener('submit',(ev)=>{
      ev.preventDefault();
      const rec = { id:uid(), date: $('#incDate').value, client: $('#incClient').value, method: $('#incMethod').value, amount: Number($('#incAmount').value||0) };
      if(!rec.date) return toast('Fecha requerida');
      state.incomesDaily.push(rec); save(); toast('Ingreso guardado'); ev.target.reset();
    });
    $('#fIncApply')?.addEventListener('click', renderIncomes);
  }

  // ======== Pagos ========
  function renderPayments(){
    const tbody = $('#paymentsTable tbody'); if(!tbody) return;
    tbody.innerHTML='';
    const totals = { Pendiente:0, Pagado:0 };
    state.payments.forEach(p=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td>${p.date||''}</td>
        <td>${p.to||''}</td>
        <td>${p.category||''}</td>
        <td>${fmt(p.amount)}</td>
        <td>${p.status}</td>
        <td class="row-actions"><button class="btn-outline" data-del="${p.id}">Eliminar</button></td>`;
      tbody.appendChild(tr);
      totals[p.status] = (totals[p.status]||0) + Number(p.amount||0);
    });
    const wrap = $('#payTotals'); if(wrap){ wrap.innerHTML=''; Object.entries(totals).forEach(([k,v])=>{ const s=document.createElement('span'); s.className='pill'; s.textContent=`${k}: ${fmt(v)}`; wrap.appendChild(s); });}
    $$('#paymentsTable [data-del]').forEach(b=> b.onclick=()=>{ state.payments = state.payments.filter(x=>x.id!==b.dataset.del); save(); toast('Pago eliminado'); });
  }
  function wirePayments(){
    $('#paymentForm')?.addEventListener('submit',(ev)=>{
      ev.preventDefault();
      const rec = { id:uid(), date: $('#payDate').value, to: $('#payTo').value, category: $('#payCategory').value, amount: Number($('#payAmount').value||0), status: $('#payStatus').value };
      if(!rec.date) return toast('Fecha requerida');
      state.payments.push(rec); save(); toast('Pago guardado'); ev.target.reset();
    });
  }

  // ======== Recurrentes ========
  function renderOrdinary(){
    const tbody = $('#ordinaryTable tbody'); if(!tbody) return;
    tbody.innerHTML='';
    state.ordinary.forEach(o=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${o.name}</td><td>${fmt(o.amount)}</td><td>${o.freq}</td><td>${o.next}</td>
      <td class="row-actions"><button class="btn-outline" data-del="${o.id}">Eliminar</button></td>`;
      tbody.appendChild(tr);
    });
    $$('#ordinaryTable [data-del]').forEach(b=> b.onclick=()=>{ state.ordinary = state.ordinary.filter(x=>x.id!==b.dataset.del); save(); toast('Recurrente eliminado'); });
  }
  function wireOrdinary(){
    $('#ordinaryForm')?.addEventListener('submit',(ev)=>{
      ev.preventDefault();
      const rec = { id:uid(), name: $('#ordName').value, amount: Number($('#ordAmount').value||0), freq: $('#ordFreq').value, next: $('#ordNext').value };
      if(!rec.next) return toast('Próxima fecha requerida');
      state.ordinary.push(rec); save(); toast('Recurrente guardado'); ev.target.reset();
    });
  }
  function autoGenerateOrdinary(){
    const today = new Date().toISOString().slice(0,10);
    let changed=false;
    state.ordinary.forEach(o=>{
      if(o.next && o.next <= today){
        state.expensesDaily.push({ id:uid(), date:o.next, category:o.name, desc:`Recurrente (${o.freq})`, method:'Automático', amount:o.amount, note:'' });
        const d = new Date(o.next);
        if(o.freq==='semanal') d.setDate(d.getDate()+7);
        else if(o.freq==='mensual') d.setMonth(d.getMonth()+1);
        else if(o.freq==='anual') d.setFullYear(d.getFullYear()+1);
        o.next = d.toISOString().slice(0,10);
        changed=true;
      }
    });
    if(changed) save();
  }

  // ======== Presupuestos ========
  function spendByCategory(cat){ return state.expensesDaily.filter(e=>e.category===cat).reduce((a,b)=>a+Number(b.amount||0),0); }
  function renderBudgets(){
    const wrap = $('#budgetBars'); if(!wrap) return;
    wrap.innerHTML='';
    state.budgets.forEach(b=>{
      const used = spendByCategory(b.category);
      const pct = b.limit>0 ? Math.min(100, Math.round(100*used/b.limit)) : 0;
      const div = document.createElement('div');
      div.className = 'budget'+(used>b.limit?' over':'');
      div.innerHTML = `<div class="row"><strong>${b.category}</strong> · Límite ${fmt(b.limit)} · Usado ${fmt(used)} (${pct}%)</div>
      <div class="meter"><span style="width:${pct}%"></span></div>
      <div class="row-actions"><button class="btn-outline" data-del="${b.id}">Eliminar</button></div>`;
      wrap.appendChild(div);
    });
    $$('#budgetBars [data-del]').forEach(b=> b.onclick=()=>{ state.budgets = state.budgets.filter(x=>x.id!==b.dataset.del); save(); toast('Presupuesto eliminado'); });
  }
  function wireBudgets(){
    $('#budgetForm')?.addEventListener('submit',(ev)=>{
      ev.preventDefault();
      const rec = { id:uid(), category: $('#budCategory').value, limit: Number($('#budLimit').value||0) };
      state.budgets.push(rec); save(); toast('Presupuesto guardado'); ev.target.reset();
    });
  }

  // ======== Personales ========
  function renderPersonal(){
    const tbody = $('#personalTable tbody'); if(!tbody) return;
    tbody.innerHTML='';
    let total=0;
    state.personal.forEach(p=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${p.date}</td><td>${p.category||''}</td><td>${p.desc||''}</td><td>${fmt(p.amount)}</td>
        <td class="row-actions"><button class="btn-outline" data-del="${p.id}">Eliminar</button></td>`;
      tbody.appendChild(tr); total+=Number(p.amount||0);
    });
    $('#personalTotal').textContent = fmt(total);
    $$('#personalTable [data-del]').forEach(b=> b.onclick=()=>{ state.personal = state.personal.filter(x=>x.id!==b.dataset.del); save(); toast('Gasto personal eliminado'); });
  }
  function wirePersonal(){
    $('#personalForm')?.addEventListener('submit',(ev)=>{
      ev.preventDefault();
      const rec = { id:uid(), date: $('#perDate').value, category: $('#perCategory').value, desc: $('#perDesc').value, amount: Number($('#perAmount').value||0) };
      if(!rec.date) return toast('Fecha requerida');
      state.personal.push(rec); save(); toast('Gasto personal guardado'); ev.target.reset();
    });
  }

  // ======== Reportes / KPIs ========
  function sumRange(list, from, to){ return list.filter(r=>inRange(r.date, from, to)).reduce((a,b)=>a+Number(b.amount||0),0); }
  function startOfWeek(d){ const x=new Date(d); const day=x.getDay()||7; x.setDate(x.getDate()-day+1); x.setHours(0,0,0,0); return x; }

  function renderReports(){
    const now = new Date();
    const today = now.toISOString().slice(0,10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0,10);
    const weekStart = startOfWeek(now).toISOString().slice(0,10);

    const incToday = sumRange(state.incomesDaily, today, today);
    const expToday = sumRange(state.expensesDaily, today, today);
    const incWeek = sumRange(state.incomesDaily, weekStart, today);
    const expWeek = sumRange(state.expensesDaily, weekStart, today);
    const incMonth = sumRange(state.incomesDaily, monthStart, today);
    const expMonth = sumRange(state.expensesDaily, monthStart, today);
    const incYear = sumRange(state.incomesDaily, yearStart, today);
    const expYear = sumRange(state.expensesDaily, yearStart, today);

    if($('#rToday')) $('#rToday').textContent = `${fmt(incToday)} / ${fmt(expToday)}`;
    if($('#rWeek')) $('#rWeek').textContent = `${fmt(incWeek)} / ${fmt(expWeek)}`;
    if($('#rMonth')) $('#rMonth').textContent = `${fmt(incMonth)} / ${fmt(expMonth)}`;
    if($('#rYear')) $('#rYear').textContent = `${fmt(incYear)} / ${fmt(expYear)}`;

    const bars = $('#barsIG'); if(!bars) return;
    bars.innerHTML='';
    const row = (label, a, b)=>{
      const total = Math.max(a,b,1);
      const ia = Math.round(100*a/total), ib = Math.round(100*b/total);
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div style="display:flex; justify-content:space-between"><strong>${label}</strong><span>${fmt(a)} / ${fmt(b)}</span></div>
      <div class="bar"><span style="width:${ia}%"></span></div>
      <div class="bar"><span style="width:${ib}%"></span></div>`;
      bars.appendChild(wrap);
    };
    row('Semana', incWeek, expWeek);
    row('Mes', incMonth, expMonth);
    row('Año', incYear, expYear);
  }

  function renderHome(){
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const today = now.toISOString().slice(0,10);
    const incMonth = sumRange(state.incomesDaily, monthStart, today);
    const expMonth = sumRange(state.expensesDaily, monthStart, today);
    $('#kpiIncomesMonth').textContent = fmt(incMonth);
    $('#kpiExpensesMonth').textContent = fmt(expMonth);
    $('#kpiBalanceMonth').textContent = fmt(incMonth-expMonth);

    // Gráfico simple (canvas)
    const c = $('#chart12'); if(!c) return; const ctx = c.getContext('2d');
    c.width = c.clientWidth; c.height = 180;
    ctx.clearRect(0,0,c.width,c.height);

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
    const barW = Math.floor((c.width-40) / (months.length*2));
    months.forEach((m,idx)=>{
      const x = idx*(barW*2)+20;
      const hI = Math.round((inc[idx]/max)*(c.height-30));
      const hE = Math.round((exp[idx]/max)*(c.height-30));
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#C7A24B';
      ctx.fillRect(x, c.height-10-hI, barW, hI);
      ctx.fillStyle = '#555';
      ctx.fillRect(x+barW+4, c.height-10-hE, barW, hE);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px system-ui';
      ctx.fillText(m, x, c.height-2);
    });
  }

  // ======== Exportar / Importar JSON ========
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
          state.settings = Object.assign({}, state.settings, incoming.settings||{});
          ['expensesDaily','incomesDaily','payments','ordinary','budgets','personal'].forEach(k=>{
            if(Array.isArray(incoming[k])) state[k] = state[k].concat(incoming[k]);
          });
          save(); toast('Datos fusionados');
        }
      }catch{ toast('Archivo inválido'); }
    };
    reader.readAsText(file);
  }

  // ======== Print ========
  function printView(id){ showView(id); setTimeout(()=>window.print(), 100); }

  // ======== Logo (Base64) ========
  function fileToBase64(file){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);
    });
  }

  // ======== Wiring general ========
  function wireSettings(){
    $('#saveSettings')?.addEventListener('click', ()=>{
      state.settings.businessName = $('#setName').value || 'Mi Negocio';
      state.settings.currency = $('#setCurrency').value || 'USD';
      state.settings.theme.primary = $('#colorPrimary').value;
      state.settings.theme.accent = $('#colorAccent').value;
      state.settings.theme.text = $('#colorText').value;
      save(); toast('Configuración guardada');
    });
    $('#setLogo')?.addEventListener('change', async (ev)=>{
      const f = ev.target.files[0]; if(!f) return;
      state.settings.logoBase64 = await fileToBase64(f); save(); toast('Logo actualizado');
    });
    $('#delLogo')?.addEventListener('click', ()=>{ state.settings.logoBase64=''; save(); toast('Logo eliminado'); });

    $('#exportJSON')?.addEventListener('click', exportJSON);
    $('#importJSON')?.addEventListener('change', (ev)=>{ const f=ev.target.files[0]; if(f) importJSON(f); });

    $('#changePIN')?.addEventListener('click', async ()=>{
      const old = $('#pinOld').value; const n1 = $('#pinNew').value; const n2 = $('#pinNew2').value;
      if(!state.settings.pinHash) return toast('Primero crea un PIN en Login');
      if(await sha256(old) !== state.settings.pinHash) return toast('PIN actual incorrecto');
      if(n1!==n2 || n1.length<4 || n1.length>8) return toast('Nuevo PIN inválido');
      state.settings.pinHash = await sha256(n1); save(); toast('PIN actualizado');
      $('#pinOld').value=$('#pinNew').value=$('#pinNew2').value='';
    });

    $('#resetAll')?.addEventListener('click', ()=>{
      if(confirm('⚠️ ¿Seguro que quieres restablecer TODO?')){
        if(confirm('Esto borrará todos los datos. ¿Continuar?')){
          localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LOCK_KEY);
          state = load(); save(); toast('Sistema restablecido'); showView('login'); updateLoginUI();
        }
      }
    });
  }

  function wireExports(){
    $$('[data-print-view]').forEach(b=> b.addEventListener('click', ()=> printView(b.dataset.printView)));
    $('#printBtn')?.addEventListener('click', ()=>{
      const current = document.querySelector('.view.visible')?.id || 'home';
      printView(current);
    });
  }

  // ======== Refresh ========
  function refreshAll(){
    applyTheme();
    renderExpenses();
    renderIncomes();
    renderPayments();
    renderOrdinary();
    renderBudgets();
    renderPersonal();
    renderReports();
    renderHome();
  }

  // ======== Init ========
  function init(){
    wireNav();
    wireExpenses();
    wireIncomes();
    wirePayments();
    wireOrdinary();
    wireBudgets();
    wirePersonal();
    wireSettings();
    wireExports();
    updateLoginUI();
    autoGenerateOrdinary();
    applyTheme();
    refreshAll();

    // Forzar vista login al inicio
    showView('login');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
