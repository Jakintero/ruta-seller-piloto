(() => {
'use strict';
const $=id=>document.getElementById(id);
const configured=window.RUTA_SUPABASE_URL?.startsWith('https://') &&
  !window.RUTA_SUPABASE_URL.includes('PEGA_') && window.RUTA_SUPABASE_KEY &&
  !window.RUTA_SUPABASE_KEY.includes('PEGA_') && !!window.supabase?.createClient;
if(!configured){$('setup-screen').classList.remove('hidden');return;}
const db=window.supabase.createClient(window.RUTA_SUPABASE_URL,window.RUTA_SUPABASE_KEY);
let user=null,profile=null,task={status:'draft',teacher_feedback:''},current=0,busyPhoto=false;
let products=Array.from({length:5},()=>({...window.RUTA_BLANK(),image_path:null}));
const images=Array(5).fill(null),timers=Array(5).fill(null),chains=Array.from({length:5},()=>Promise.resolve());
let saveFailed=false,formMode='login';
function notice(message,type=''){const el=$('global-notice');el.textContent=message;el.className='notice '+type;el.classList.remove('hidden');}
function status(text){$('save-status').textContent=text;}
function canEdit(){return ['draft','changes_requested'].includes(task.status);}
function productData(slot){return Object.fromEntries(window.RUTA_FIELDS.map(k=>[k,String(products[slot][k]??'').slice(0,500)]));}
function qSave(slot){
 const job=chains[slot].catch(()=>{}).then(async()=>{
  const payload={owner_id:user.id,slot:slot+1,data:productData(slot),image_path:products[slot].image_path,updated_at:new Date().toISOString()};
  const {error}=await db.from('ruta_products').upsert(payload,{onConflict:'owner_id,slot'});
  if(error)throw error;
 });
 chains[slot]=job;
 job.then(()=>{if(!saveFailed)status('Guardado en la nube ✓');},e=>{saveFailed=true;status('Error al guardar');notice('No se pudo guardar: '+e.message+'. Comprueba tu conexión e inténtalo de nuevo.','error');});
 return job;
}
function scheduleSave(slot){
 if(!canEdit())return;
 clearTimeout(timers[slot]);status('Cambios pendientes de guardar…');
 timers[slot]=setTimeout(()=>{timers[slot]=null;qSave(slot);},950);
}
async function flush(){
 if(busyPhoto)throw Error('Espera a que termine de subirse la fotografía.');
 const jobs=[];
 for(let i=0;i<5;i++){
  if(timers[i]){clearTimeout(timers[i]);timers[i]=null;jobs.push(qSave(i));}
  else jobs.push(chains[i]);
 }
 await Promise.all(jobs);
 if(saveFailed)throw Error('Hay errores de guardado. Pulsa «Guardar ahora» para reintentar.');
}
function setMode(mode){
 formMode=mode;
 $('show-login').classList.toggle('active',mode==='login');
 $('show-signup').classList.toggle('active',mode==='signup');
 $('name-field').classList.toggle('hidden',mode!=='signup');
 $('auth-submit').textContent=mode==='login'?'Entrar a mi espacio':'Crear mi cuenta';
 $('auth-password').autocomplete=mode==='login'?'current-password':'new-password';
 $('auth-msg').textContent='';
}
$('show-login').onclick=()=>setMode('login');
$('show-signup').onclick=()=>setMode('signup');
$('auth-form').onsubmit=async e=>{
 e.preventDefault();
 const email=$('auth-email').value.trim(),password=$('auth-password').value;
 $('auth-msg').textContent='Procesando…';$('auth-submit').disabled=true;
 try{
  if(formMode==='signup'){
   const name=$('auth-name').value.trim();
   if(!name)throw Error('Escribe tu nombre.');
   const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin+location.pathname}});
   if(error)throw error;
   if(!data.session){$('auth-msg').textContent='Si el registro es válido, recibirás un correo para confirmar tu cuenta. Revisa también spam. (Las cuentas de prueba necesitan servicio de correo configurado.)';}
   else await bootstrap();
  }else{
   const {error}=await db.auth.signInWithPassword({email,password});
   if(error)throw error;
   await bootstrap();
  }
 }catch(err){$('auth-msg').textContent='No fue posible continuar: '+err.message;}
 finally{$('auth-submit').disabled=false;}
};
$('logout').onclick=async()=>{await db.auth.signOut();location.reload();};
function renderTabs(){
 const root=$('slots');root.textContent='';
 products.forEach((p,i)=>{
  const st=window.RUTA_STATS(p),b=document.createElement('button');
  b.type='button';b.className='slot'+(i===current?' active':'');
  const index=document.createElement('span');index.className='index';index.textContent=st.valid?'✓':String(i+1);
  const name=document.createElement('span');name.className='name';name.textContent=p.name||'Producto '+(i+1);
  b.append(index,name);b.setAttribute('aria-label','Editar producto '+(i+1)+': '+(p.name||'sin nombre'));
  b.onclick=()=>{current=i;renderEditor();};
  root.append(b);
 });
}
function renderCriteria(){
 const root=$('criteria');root.textContent='';
 for(const c of window.RUTA_CRITERIA){
  const art=document.createElement('article');art.className='criterion';
  const head=document.createElement('div');head.className='crit-head';
  const title=document.createElement('strong');title.textContent=c.title;
  const pts=document.createElement('span');pts.className='points';pts.dataset.points=c.key;
  head.append(title,pts);
  const rule=document.createElement('p');rule.className='rule';rule.textContent=c.rule;
  const label=document.createElement('label');label.className='field';
  const labelSpan=document.createElement('span');labelSpan.className='label';labelSpan.textContent=c.label;
  let inp;
  if(c.type==='select'){
   inp=document.createElement('select');
   [['','Seleccionar'],['yes','Sí'],['no','No']].forEach(([v,text])=>{
    const opt=document.createElement('option');opt.value=v;opt.textContent=text;inp.append(opt);
   });
  } else {
   inp=document.createElement('input');inp.type='text';
   inp.inputMode=c.type==='int'?'numeric':'decimal';inp.autocomplete='off';
   inp.placeholder=c.type==='int'?'Ej. 32':c.key==='price'?'Ej. 29,99':'Ej. 28,5';
  }
  inp.dataset.field=c.key;
  label.append(labelSpan,inp);
  const info=document.createElement('p');info.className='stat';info.dataset.stat=c.key;
  art.append(head,rule,label,info);root.append(art);
 }
}
function renderScore(){
 const p=products[current],stats=window.RUTA_STATS(p);
 $('total-score').textContent=stats.used?stats.total:'—';
 $('score-detail').textContent=stats.valid?'Evaluación completa':stats.completed+'/7 criterios';
 $('progress-fill').style.width=stats.total+'%';
 for(const c of window.RUTA_CRITERIA){
  const r=window.RUTA_SCORE(c.key,p[c.key]);
  const point=document.querySelector('[data-points="'+c.key+'"]');
  const note=document.querySelector('[data-stat="'+c.key+'"]');
  if(point){point.textContent=r.kind==='scored'?r.points+' / '+c.max:'— / '+c.max;point.className='points'+(r.kind==='scored'&&r.points>0?' pass':'');}
  if(note)note.textContent=r.kind==='undefined'?'Revisar: este valor exacto no está definido en el Excel.':
      r.kind==='invalid'?'Introduce un número válido.':r.kind==='pending'?'Pendiente':'Puntos asignados automáticamente.';
 }
}
function renderOverview(){
 const rows=products.map((p,i)=>{
  const st=window.RUTA_STATS(p);
  return '<tr><td>Producto '+(i+1)+'</td><td>'+window.RUTA_ESC(p.name||'Sin nombre')+'</td><td>'+
    (st.used?st.total+'/100':'—')+'</td><td>'+(st.valid?'Completo':st.used?'Incompleto':'Sin evaluar')+'</td></tr>';
 });
 $('overview').innerHTML='<table><thead><tr><th>Casilla</th><th>Producto</th><th>Puntos</th><th>Evaluación</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
 const count=products.filter(p=>window.RUTA_STATS(p).valid).length;
 $('submit-hint').textContent=count+' de 5 productos completos. Puedes entregar desde 1 producto completo; los restantes son opcionales.';
 const badge=$('task-badge');badge.textContent=window.RUTA_STATE_LABEL[task.status]||task.status;
 badge.className='badge '+(task.status==='submitted'?'review':task.status==='approved'?'good':task.status==='changes_requested'?'rework':'');
 $('submit-task').disabled=!canEdit()||count===0;
 $('submit-task').textContent=task.status==='changes_requested'?'Volver a entregar tarea':'Entregar tarea para revisión';
 if(task.teacher_feedback){
  $('teacher-message').classList.remove('hidden');$('teacher-feedback').textContent=task.teacher_feedback;
 }else $('teacher-message').classList.add('hidden');
}
function renderPhoto(){
 const box=$('photo-box');box.textContent='';
 if(images[current]){
  const img=document.createElement('img');img.src=images[current];img.alt='Fotografía del producto';box.append(img);
 }else box.textContent='Sin fotografía';
}
function renderEditor(){
 renderTabs();$('product-heading').textContent='Producto '+(current+1);
 document.querySelectorAll('#student-screen [data-field]').forEach(el=>{
  el.value=products[current][el.dataset.field]||'';
  el.disabled=!canEdit();
 });
 $('photo-file').disabled=!canEdit();
 $('save-now').disabled=!canEdit();$('clear-product').disabled=!canEdit();
 $('submit-task').disabled=!canEdit();
 $('photo-status').textContent=canEdit()?'':'La tarea está bloqueada mientras se revisa.';
 renderScore();renderOverview();renderPhoto();
}
function onInput(e){
 const field=e.target.dataset.field;if(!field||!window.RUTA_FIELDS.includes(field))return;
 products[current][field]=e.target.value;
 scheduleSave(current);
 renderTabs();renderScore();renderOverview();
}
$('student-screen').addEventListener('input',onInput);
$('student-screen').addEventListener('change',e=>{if(e.target.tagName==='SELECT'&&e.target.dataset.field)onInput(e);});
$('next-product').onclick=()=>{current=(current+1)%5;renderEditor();};
$('save-now').onclick=async()=>{
 try{saveFailed=false;status('Guardando…');if(!timers[current])await qSave(current);await flush();status('Guardado en la nube ✓');notice('Los cambios quedaron guardados en tu cuenta.','ok');}
 catch(e){notice('No se guardaron todos los cambios: '+e.message,'error');}
};
$('clear-product').onclick=async()=>{
 if(!canEdit()||!confirm('¿Vaciar los datos del producto '+(current+1)+'?'))return;
 const slot=current,oldPath=products[slot].image_path;
 try{
  if(oldPath){const {error}=await db.storage.from('ruta-piloto-fotos').remove([oldPath]);if(error)throw error;}
  products[slot]={...window.RUTA_BLANK(),image_path:null};
  images[slot]=null;saveFailed=false;
  clearTimeout(timers[slot]);timers[slot]=null;
  await qSave(slot);renderEditor();notice('Producto limpiado.','ok');
 }catch(e){notice('No se pudo limpiar el producto: '+e.message,'error');}
};
$('submit-task').onclick=async()=>{
 if(!canEdit())return;
 const used=products.filter(p=>window.RUTA_STATS(p).used);
 if(used.length===0||used.some(p=>!window.RUTA_STATS(p).valid)){
  notice('Completa todos los criterios de los productos que empezaste antes de entregar. Los valores «Revisar criterio» deben resolverse.','error');return;
 }
 if(!confirm('¿Entregar esta tarea al profesor? No podrás editarla hasta que la revise.'))return;
 const btn=$('submit-task');btn.disabled=true;
 try{
  saveFailed=false;await flush();
  const {error}=await db.rpc('ruta_submit_task');if(error)throw error;
  await loadData();notice('¡Tarea entregada! El profesor podrá verla en su panel.','ok');
 }catch(e){notice('No se pudo entregar: '+e.message,'error');}
 finally{btn.disabled=!canEdit();}
};
async function compressedWebp(file){
 if(!file.type.startsWith('image/'))throw Error('Selecciona una imagen válida.');
 if(file.size>5*1024*1024)throw Error('La imagen original no debe superar 5 MB.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  for(const bound of [900,750,600]){
   const ratio=Math.min(1,bound/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
   canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.78,.65,.48]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(!blob||blob.type!=='image/webp')throw Error('Este navegador no puede convertir fotos a WebP.');
    if(blob.size<=190*1024)return blob;
   }
  }
  throw Error('No fue posible reducir la imagen a menos de 190 KB. Elige otra foto.');
 }finally{URL.revokeObjectURL(url);}
}
$('photo-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file||!canEdit())return;
 const slot=current;busyPhoto=true;$('photo-status').textContent='Comprimiendo y subiendo…';$('photo-file').disabled=true;
 try{
  const blob=await compressedWebp(file);
  await chains[slot].catch(()=>{});
  const path=user.id+'/'+(slot+1)+'.webp';
  const {error}=await db.storage.from('ruta-piloto-fotos').upload(path,blob,{contentType:'image/webp',upsert:true,cacheControl:'60'});
  if(error)throw error;
  products[slot].image_path=path;
  await qSave(slot);
  images[slot]=URL.createObjectURL(blob);
  if(slot===current)renderPhoto();
  $('photo-status').textContent='Foto guardada ('+Math.ceil(blob.size/1024)+' KB).';
 }catch(ex){$('photo-status').textContent='Error: '+ex.message;}
 finally{busyPhoto=false;$('photo-file').value='';$('photo-file').disabled=!canEdit()?true:false;}
};
async function loadData(){
 const [{data:rows,error:e1},{data:t,error:e2}]=await Promise.all([
   db.from('ruta_products').select('slot,data,image_path').eq('owner_id',user.id).order('slot'),
   db.from('ruta_tasks').select('status,teacher_feedback,submitted_at,reviewed_at').eq('owner_id',user.id).single()
 ]);
 if(e1||e2)throw e1||e2;
 task=t;
 products=Array.from({length:5},()=>({...window.RUTA_BLANK(),image_path:null}));
 images.fill(null);
 for(const row of rows||[]){
  const i=row.slot-1;if(i<0||i>=5)continue;
  products[i]={...window.RUTA_BLANK(),...Object.fromEntries(window.RUTA_FIELDS.map(k=>[k,typeof row.data?.[k]==='string'?row.data[k]:''])),image_path:row.image_path};
  if(row.image_path){
   const {data}=await db.storage.from('ruta-piloto-fotos').createSignedUrl(row.image_path,3600);
   images[i]=data?.signedUrl||null;
  }
 }
 renderEditor();
 if(!canEdit())notice(task.status==='submitted'?'Tu tarea está entregada y pendiente de revisión.':
   task.status==='approved'?'¡Tu tarea fue aprobada!':'Estado de la tarea: '+task.status,'ok');
 else if(task.status==='changes_requested')notice('Tu profesor pidió correcciones. Revisa sus comentarios, actualiza y vuelve a entregar.');
}
async function bootstrap(){
 try{
  const {data:{user:u},error}=await db.auth.getUser();if(error)throw error;
  $('setup-screen').classList.add('hidden');$('auth-screen').classList.add('hidden');$('student-screen').classList.add('hidden');
  if(!u){$('logout').classList.add('hidden');$('auth-screen').classList.remove('hidden');return;}
  user=u;$('user-email').textContent=u.email||'';$('logout').classList.remove('hidden');
  const {data:p,error:pe}=await db.from('ruta_profiles').select('role,full_name').eq('id',u.id).single();if(pe)throw pe;
  profile=p;
  if(profile.role==='teacher'){location.replace('./profesor.html');return;}
  $('student-screen').classList.remove('hidden');
  await loadData();status('Conectado y sincronizado');
 }catch(ex){
  $('auth-screen').classList.remove('hidden');
  $('auth-msg').textContent='No se pudo cargar tu cuenta. Verifica la instalación de la base de datos: '+ex.message;
 }
}
renderCriteria();bootstrap();
})();
