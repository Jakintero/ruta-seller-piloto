/* Criterios fieles a "Plantilla de puntuación RutaSeller 2026.xlsx". */
window.RUTA_FIELDS=['name','blackbox','specific','price','china','different','brands','reviews','demand','profit'];
window.RUTA_CRITERIA=[
 {key:'price',title:'Precio de venta',max:10,label:'Precio en USD',type:'decimal',rule:'De $20 a $50 (inclusive): 10 puntos; fuera: 0.'},
 {key:'china',title:'Competencia china',max:10,label:'Porcentaje de competencia china',type:'decimal',rule:'Menos de 50%: 10; más de 50%: 0.'},
 {key:'different',title:'Oportunidad de diferenciación',max:20,label:'¿Se puede diferenciar?',type:'select',rule:'Sí: 20 puntos; no: 0.'},
 {key:'brands',title:'Dominio del mercado',max:10,label:'Marcas dominantes',type:'int',rule:'0 marcas: 10; de 1 a 3: 0.'},
 {key:'reviews',title:'Reseñas de competidores',max:10,label:'Cantidad de reseñas',type:'int',rule:'Menos de 500: 10; más de 500: 0.'},
 {key:'demand',title:'Demanda de mercado',max:20,label:'Cantidad de keywords con mínimo 300 búsquedas',type:'int',rule:'Menos de 25 keywords: 0; más de 25: 20.'},
 {key:'profit',title:'Rentabilidad',max:20,label:'Rentabilidad porcentual',type:'decimal',rule:'Menos de 25%: 0; más de 25%: 20.'}
];
window.RUTA_BLANK=()=>Object.fromEntries(window.RUTA_FIELDS.map(k=>[k,'']));
window.RUTA_ESC=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.RUTA_SCORE=function(key,raw){
  if(String(raw??'').trim()==='')return {kind:'pending',points:0};
  if(key==='different')return raw==='yes'?{kind:'scored',points:20}:raw==='no'?{kind:'scored',points:0}:{kind:'invalid',points:0};
  const text=String(raw).trim().replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(text))return {kind:'invalid',points:0};
  const n=Number(text),integer=['brands','reviews','demand'].includes(key);
  if(!Number.isFinite(n)||(integer&&!Number.isInteger(n))||(key==='china'&&n>100))return {kind:'invalid',points:0};
  const score=points=>({kind:'scored',points});
  const und=()=>({kind:'undefined',points:0});
  switch(key){
    case 'price':return score(n>=20&&n<=50?10:0);
    case 'china':return n===50?und():score(n<50?10:0);
    case 'brands':return n===0?score(10):n<=3?score(0):und();
    case 'reviews':return n===500?und():score(n<500?10:0);
    case 'demand':return n===25?und():score(n>25?20:0);
    case 'profit':return n===25?und():score(n>25?20:0);
  }
  return {kind:'invalid',points:0};
};
window.RUTA_STATS=p=>{
 const c=window.RUTA_CRITERIA.map(x=>window.RUTA_SCORE(x.key,p[x.key]));
 const completed=c.filter(x=>x.kind==='scored').length;
 const used=window.RUTA_FIELDS.some(k=>String(p[k]??'').trim()!=='');
 return {total:c.reduce((s,x)=>s+(x.kind==='scored'?x.points:0),0),
   completed,used,valid:completed===7&&String(p.name??'').trim()!=='',
   unresolved:c.some(x=>x.kind==='undefined'||x.kind==='invalid')};
};
window.RUTA_STATE_LABEL={draft:'Borrador',submitted:'Por revisar',approved:'Aprobada'};
