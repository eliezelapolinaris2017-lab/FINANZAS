/* ===================== Firebase ===================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC66vv3-yaap1mV2n1GXRUopLqccobWqRE",
  authDomain: "finanzas-web-f4e05.firebaseapp.com",
  projectId: "finanzas-web-f4e05",
  storageBucket: "finanzas-web-f4e05.firebasestorage.app",
  messagingSenderId: "1047152523619",
  appId: "1:1047152523619:web:7d8f7d1f7a5ccc6090bb56"
};
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
enableIndexedDbPersistence(db).catch(()=>{});

/* ===================== Estado inicial ===================== */
const STORAGE_KEY = 'finanzas-state-v6';

const DEFAULT_STATE = {
  settings: {
    businessName: 'Mi Negocio',
    logoBase64: '',
    theme: { primary: '#0B0D10', accent: '#C7A24B', text: '#F2F3F5' },
    pinHash: '',
    currency: 'USD'
  },
  expensesDaily: [],
  incomesDaily: [],
  payments: [],
  ordinary: [],
  budgets: [],
  personal: [],
  invoices: [],
  quotes: [],
  reconciliations: [], // ✅ nuevo módulo de conciliación
  _cloud: { updatedAt: 0 }
};

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const clone = o=>JSON.parse(JSON.stringify(o));
const todayStr = ()=>new Date().toISOString().slice(0,10);
const fmt = (n)=> new Intl.NumberFormat('es-PR',{style:'currency',currency:state.settings.currency}).format(Number(n||0));

let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(DEFAULT_STATE));
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); refreshAll(); }

/* ===================== Tema y vistas ===================== */
function showView(id){
  $$('.view').forEach(v=>v.classList.remove('visible'));
  $('#'+id)?.classList.add('visible');
  $$('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.target===id));
}
function applyTheme(){
  const r=document.documentElement, t=state.settings.theme;
  r.style.setProperty('--primary',t.primary); r.style.setProperty('--accent',t.accent); r.style.setProperty('--text',t.text);
}

/* ===================== Toast ===================== */
function toast(m){
  const c=$('#toastContainer'); const d=document.createElement('div');
  d.className='toast'; d.textContent=m; c.appendChild(d);
  setTimeout(()=>{d.style.opacity=0; setTimeout(()=>d.remove(),300)},2000);
}

/* ===================== Funciones comunes ===================== */
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36);
const inRange=(d,f,t)=>{const x=new Date(d);if(f&&x<new Date(f))return false;if(t&&x>new Date(t))return false;return true;}
const byDateDesc=(a,b)=>new Date(b.date)-new Date(a.date);
function ask(c,v){const x=prompt(v,c);if(x===null)return{cancel:true,val:c};return{cancel:false,val:x};}
function askNum(c,v){const r=ask(String(c),v);if(r.cancel)return r;const n=parseFloat(r.val.replace(',','.'));return isNaN(n)?{cancel:true,val:c}:{cancel:false,val:n};}

/* ===================== PDF ===================== */
let jsPDFReady=false;
async function ensurePDF(){
  if(jsPDFReady) return;
  await new Promise(res=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    s.onload=res; document.head.appendChild(s);
  });
  jsPDFReady=true;
}
async function generatePDF(view="reconciliations"){
  await ensurePDF();
  const { jsPDF }=window.jspdf;
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const business=state.settings.businessName||"Mi Negocio";
  const logo=state.settings.logoBase64||"assets/logo.png";

  try{ if(logo.startsWith("data:")) doc.addImage(logo,"PNG",14,10,24,24);}catch{}
  doc.setFont("helvetica","bold"); doc.setFontSize(16);
  doc.text(business,42,18); doc.text(view.toUpperCase(),42,26);
  doc.line(14,36,200,36);

  let y=44;
  if(view==="reconciliations"){
    doc.setFontSize(10);
    doc.text("Fecha",14,y); doc.text("Saldo Banco",54,y);
    doc.text("Balance App",94,y); doc.text("Diferencia",134,y); doc.text("Nota",174,y);
    y+=4; doc.line(14,y,200,y); y+=6;
    let totalBank=0,totalApp=0;
    state.reconciliations.forEach(r=>{
      doc.text(r.date||"",14,y);
      doc.text(fmt(r.bank||0),54,y);
      doc.text(fmt(r.app||0),94,y);
      doc.text(fmt(r.diff||0),134,y);
      doc.text((r.note||"").substring(0,15),174,y);
      totalBank+=r.bank||0; totalApp+=r.app||0;
      y+=6; if(y>280){doc.addPage(); y=20;}
    });
    doc.line(14,y,200,y); y+=7;
    doc.text("TOTAL BANCO:",14,y); doc.text(fmt(totalBank),60,y);
    doc.text("TOTAL APP:",94,y); doc.text(fmt(totalApp),140,y);
  }
  doc.save(`${business}_Conciliacion.pdf`);
  toast("PDF generado");
}

/* ===================== Conciliación Bancaria ===================== */
function calcBalanceApp(){
  const inc = state.incomesDaily.reduce((a,b)=>a+Number(b.amount||0),0);
  const exp = state.expensesDaily.reduce((a,b)=>a+Number(b.amount||0),0);
  const pay = state.payments.reduce((a,b)=>a+Number(b.amount||0),0);
  const per = state.personal.reduce((a,b)=>a+Number(b.amount||0),0);
  return inc - (exp + pay + per);
}
function renderReconciliations(){
  const tbody=$('#reconTable tbody'); if(!tbody)return; tbody.innerHTML="";
  state.reconciliations.sort(byDateDesc).forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${r.date}</td>
      <td>${fmt(r.bank)}</td>
      <td>${fmt(r.app)}</td>
      <td>${fmt(r.diff)}</td>
      <td>${r.note||""}</td>
      <td class="row-actions">
        <button class="btn-outline" data-edit="${r.id}">Editar</button>
        <button class="btn-outline" data-del="${r.id}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
  $$('#reconTable [data-del]').forEach(b=>b.onclick=()=>{
    state.reconciliations=state.reconciliations.filter(x=>x.id!==b.dataset.del); save(); toast("Eliminado");
  });
  $$('#reconTable [data-edit]').forEach(b=>b.onclick=()=>editReconciliation(b.dataset.edit));
}
function editReconciliation(id){
  const i=state.reconciliations.findIndex(x=>x.id===id); if(i<0)return;
  const r=state.reconciliations[i];
  let q=ask(r.date,"Fecha"); if(q.cancel)return; r.date=q.val;
  q=askNum(r.bank,"Saldo banco"); if(q.cancel)return; r.bank=q.val;
  q=ask(r.note,"Nota"); if(q.cancel)return; r.note=q.val;
  r.app=calcBalanceApp(); r.diff=(r.bank||0)-(r.app||0); save(); toast("Conciliación actualizada");
}
function wireReconciliation(){
  $('#reconForm')?.addEventListener('submit',(ev)=>{
    ev.preventDefault();
    const rec={ id:uid(), date:$('#reconDate').value, bank:Number($('#reconBank').value||0),
      app:calcBalanceApp(), diff:0, note:$('#reconNote').value };
    rec.diff=rec.bank-rec.app;
    state.reconciliations.push(rec); save(); toast("Conciliación guardada");
    ev.target.reset();
  });
  $('#reconExport')?.addEventListener('click',()=>generatePDF("reconciliations"));
}

/* ===================== Resto de funciones existentes ===================== */
// (aquí sigue el resto igual: gastos diarios, ingresos, facturas, cotizaciones, etc.)
/* ===================== Inicialización ===================== */
function refreshAll(){
  renderReconciliations();
  // ... (el resto de renders: gastos, ingresos, facturas, etc.)
}
function wireAll(){
  applyTheme();
  wireReconciliation();
  // ... (todas tus demás funciones wireX existentes)
  refreshAll();
  showView("login");
}
document.addEventListener("DOMContentLoaded", wireAll);
