(() => {
'use strict';
const $=id=>document.getElementById(id);
if(!window.RUTA_SUPABASE_URL?.startsWith('https://') ||
   window.RUTA_SUPABASE_URL.includes('PEGA_') ||
   !window.RUTA_SUPABASE_KEY || window.RUTA_SUPABASE_KEY.includes('PEGA_') ||
   !window.supabase?.createClient){
 $('loading').textContent='Primero configura supabase-config.js. Consulta la guía del ZIP.';return;
}
const db=window.supabase.createClient(window.RUTA_SUPABASE_URL,window.RUTA_SUPABASE_KEY);
let students=[],tasks=[],products=[];
const escape=window.RUTA_ESC;
$('logout').onclick=async()=>{await db.auth.signOut();location.href='./index.html';};
function statusClass(s){return s==='submitted'?'review':s==='approved'?'good':'lock';}
function fmt(dt){return dt?new Date(dt).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'}):'—';}
async function load(){
 $('last-sync').textContent='Actualizando datos…';
 const [{data:a,error:e1},{data:b,error:e2},{data:c,error:e3}]=await Promise.all([
  db.from('ruta_profiles').select('id,email,full_name,role,created_at,access_status').eq('role','student').order('created_at',{ascending:false}),
  db.from('ruta_tasks').select('owner_id,status,teacher_feedback,submitted_at,updated_at,reviewed_at'),
  db.from('ruta_products').select('owner_id,slot,data,image_path')
 ]);
 if(e1||e2||e3)throw e1||e2||e3;
 students=a||[];tasks=b||[];products=c||[];
 $('total-students').textContent=students.length;
 $('pending-access').textContent=students.filter(s=>(s.access_status||'pending')==='pending').length;
 $('pending-tasks').textContent=tasks.filter(x=>x.status==='submitted').length;
 $('approved-tasks').textContent=tasks.filter(x=>x.status==='approved').length;
 $('last-sync').textContent='Actualizado: '+fmt(new Date().toISOString());
 render();renderAccess();
}
function render(){
 const filter=$('status-filter').value,root=$('task-list');root.textContent='';
 const items=students.map(p=>({...p,task:tasks.find(t=>t.owner_id===p.id)||{status:'draft'},prods:products.filter(x=>x.owner_id===p.id)}));
 items.sort((a,b)=>Number(b.task.status==='submitted')-Number(a.task.status==='submitted')||
  String(b.task.submitted_at||b.task.updated_at||'').localeCompare(String(a.task.submitted_at||a.task.updated_at||'')));
 const show=items.filter(x=>filter==='all'||x.task.status===filter);
 if(!show.length){root.innerHTML='<div class="empty">No hay estudiantes con ese estado todavía.</div>';return;}
 show.forEach(item=>{
  const complete=item.prods.filter(x=>window.RUTA_STATS(x.data||{}).valid).length;
  const card=document.createElement('article');card.className='teacher-card';
  const header=document.createElement('div');header.className='summary';
  const ident=document.createElement('div');
  const name=document.createElement('strong');name.textContent=item.full_name||'Estudiante';
  const mail=document.createElement('div');mail.className='small muted';mail.textContent=item.email;
  const timing=document.createElement('div');timing.className='small muted';timing.textContent='Entregado: '+fmt(item.task.submitted_at)+' · '+complete+' productos completos';
  ident.append(name,mail,timing);
  const badge=document.createElement('span');badge.className='badge '+statusClass(item.task.status);
  badge.textContent=window.RUTA_STATE_LABEL[item.task.status]||item.task.status;
  header.append(ident,badge);card.append(header);
  const detail=document.createElement('details');detail.className='details';
  const summary=document.createElement('summary');summary.textContent='Ver productos y evaluación';
  detail.append(summary);
  const inside=document.createElement('div');inside.className='student-table table-wrap';
  const rows=Array.from({length:5},(_,i)=>{
   const p=item.prods.find(x=>x.slot===i+1);
   if(!p)return '<tr><td>'+(i+1)+'</td><td>Sin datos</td><td>—</td><td>—</td></tr>';
   const stats=window.RUTA_STATS(p.data||{});
   const keywords=String(p.data?.blackbox||'')+' / '+String(p.data?.specific||'');
   const vals=window.RUTA_CRITERIA.map(k=>k.title+': '+String(p.data?.[k.key]||'—')+
    ' ('+(window.RUTA_SCORE(k.key,p.data?.[k.key]).kind==='scored'?window.RUTA_SCORE(k.key,p.data?.[k.key]).points+' pts':'revisar')+')').join(' | ');
   return '<tr><td>'+(i+1)+'</td><td><b>'+escape(p.data?.name||'Sin nombre')+'</b><div class="small muted">Keywords: '+escape(keywords)+'</div><div class="small muted">'+escape(vals)+'</div></td><td>'+stats.total+'/100'+(stats.valid?' ✓':' · parcial')+'</td><td>'+(p.image_path?'<button type="button" class="button light tiny" data-photo="'+(i+1)+'">Ver foto</button>':'—')+'</td></tr>';
  }).join('');
  inside.innerHTML='<table><thead><tr><th>#</th><th>Datos investigados</th><th>Resultado</th><th>Imagen</th></tr></thead><tbody>'+rows+'</tbody></table>';
  inside.addEventListener('click',async e=>{
   const button=e.target.closest('button[data-photo]');if(!button)return;
   const slot=Number(button.dataset.photo),p=item.prods.find(x=>x.slot===slot);
   if(!p?.image_path)return;
   button.disabled=true;button.textContent='Cargando…';
   const {data,error}=await db.storage.from('ruta-piloto-fotos').createSignedUrl(p.image_path,300);
   if(error||!data?.signedUrl){button.disabled=false;button.textContent='No disponible';return;}
   const img=document.createElement('img');img.src=data.signedUrl;img.alt='Producto '+slot;img.className='teacher-photo';
   button.replaceWith(img);
  });
  detail.append(inside);
  if(item.task.teacher_feedback){
   const old=document.createElement('p');old.className='feedback small';old.textContent='Última observación: '+item.task.teacher_feedback;detail.append(old);
  }
  if(item.task.status==='submitted'){
   const area=document.createElement('textarea');area.className='teacher-feedback';
   area.placeholder='Escribe una observación concreta para el estudiante…';
   area.maxLength=2000;area.setAttribute('aria-label','Comentario de revisión');
   const actions=document.createElement('div');actions.className='actions';actions.style.marginTop='9px';
   const approve=document.createElement('button');approve.type='button';approve.className='button primary tiny';approve.textContent='Aprobar tarea';
   const comment=document.createElement('button');comment.type='button';comment.className='button orange tiny';comment.textContent='Guardar comentarios';
   const result=document.createElement('span');result.className='small muted';result.setAttribute('aria-live','polite');
   const execute=async decision=>{
    if(decision==='draft'&&!area.value.trim()){result.textContent='Escribe tus observaciones antes de devolver la tarea.';return;}
    if(!confirm(decision==='approved'?'¿Aprobar esta tarea y permitir que el estudiante siga investigando?':'¿Guardar tus comentarios y devolver la tarea a borrador para que el alumno la corrija?'))return;
    approve.disabled=true;comment.disabled=true;result.textContent='Guardando revisión…';
    const {error}=await db.rpc('ruta_review_task',{p_student:item.id,p_decision:decision,p_feedback:area.value.trim()});
    if(error){result.textContent='Error: '+error.message;approve.disabled=false;comment.disabled=false;return;}
    try{await load();}catch(ex){result.textContent='Revisión guardada, pero falló la actualización: '+ex.message;}
   };
   approve.onclick=()=>execute('approved');comment.onclick=()=>execute('draft');
   actions.append(approve,comment,result);
   detail.append(area,actions);
  }
  card.append(detail);root.append(card);
 });
}

const accessText={pending:'Pendiente',approved:'Aprobado',rejected:'Rechazado',suspended:'Suspendido'};
function renderAccess(){
 const root=$('access-list'),filter=$('access-filter').value;
 root.textContent='';
 const sorted=[...students].sort((a,b)=>{
   const aPending=a.access_status==='pending'?1:0,bPending=b.access_status==='pending'?1:0;
   return bPending-aPending||String(b.created_at||'').localeCompare(String(a.created_at||''));
 });
 const list=sorted.filter(s=>filter==='all'||(s.access_status||'pending')===filter);
 if(!list.length){root.innerHTML='<div class="empty">No hay solicitudes con este estado.</div>';return;}
 for(const s of list){
   const state=s.access_status||'pending';
   const card=document.createElement('article');card.className='access-card';
   const head=document.createElement('div');head.className='summary';
   const who=document.createElement('div');
   const name=document.createElement('strong');name.textContent=s.full_name||'Estudiante';
   const info=document.createElement('div');info.className='small muted';
   info.textContent=s.email+' · Registrado: '+fmt(s.created_at);
   who.append(name,info);
   const badge=document.createElement('span');badge.className='badge '+state;
   badge.textContent=accessText[state]||state;
   head.append(who,badge);card.append(head);
   const actions=document.createElement('div');actions.className='actions';
   const hint=document.createElement('span');hint.className='small muted';
   const action=async(next)=>{
     const explain=next==='approved'?'¿Confirmas que revisaste la compra y deseas aprobar este acceso?':
       next==='rejected'?'¿Rechazar esta solicitud?':
       '¿Suspender temporalmente el acceso de este estudiante?';
     if(!confirm(explain))return;
     actions.querySelectorAll('button').forEach(b=>b.disabled=true);
     hint.textContent='Guardando…';
     const {error}=await db.rpc('ruta_set_access',{p_student:s.id,p_status:next});
     if(error){hint.textContent='Error: '+error.message;actions.querySelectorAll('button').forEach(b=>b.disabled=false);return;}
     try{await load();}catch(e){hint.textContent='Cambio guardado, pero falló actualizar la vista: '+e.message;}
   };
   const make=(text,next,cls)=>{
      const b=document.createElement('button');b.type='button';
      b.className='button tiny '+cls;b.textContent=text;
      b.onclick=()=>action(next);actions.append(b);
   };
   if(state==='pending'){
     make('Aprobar acceso','approved','primary');
     make('Rechazar','rejected','danger');
   }else if(state==='approved'){
     make('Suspender acceso','suspended','danger');
   }else{
     make('Aprobar después de comprobar compra','approved','primary');
   }
   actions.append(hint);card.append(actions);root.append(card);
 }
}
$('access-filter').onchange=renderAccess;
$('refresh-access').onclick=()=>load().catch(e=>$('last-sync').textContent='Error: '+e.message);

$('status-filter').onchange=render;
$('reload-data').onclick=()=>load().catch(e=>$('last-sync').textContent='Error: '+e.message);
(async()=>{
 try{
  const {data:{user},error}=await db.auth.getUser();
  if(error)throw error;
  if(!user){$('loading').classList.add('hidden');$('not-allowed').classList.remove('hidden');
  $('not-allowed').querySelector('h2').textContent='Inicia sesión como profesor';
  $('not-allowed').querySelector('p').textContent='Para entrar al panel docente, inicia sesión con tu cuenta de profesor.';
  return;}
  $('user-email').textContent=user.email||'';$('logout').classList.remove('hidden');
  const {data,error:pe}=await db.from('ruta_profiles').select('role').eq('id',user.id).single();
  if(pe)throw pe;
  $('loading').classList.add('hidden');
  if(data?.role!=='teacher'){$('not-allowed').classList.remove('hidden');return;}
  $('teacher-main').classList.remove('hidden');await load();
 }catch(ex){$('loading').textContent='No se pudo cargar el panel: '+ex.message;}
})();
})();
