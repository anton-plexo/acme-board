"use strict";
const API="https://zifgoeppualinbsbfmsj.supabase.co/functions/v1/acme-board";
let KEY=null;
try{const m=(location.hash||"").match(/k=([\w-]{20,})/);if(m){localStorage.setItem("acmeBoardKey",m[1]);history.replaceState(null,"",location.pathname);}KEY=localStorage.getItem("acmeBoardKey");}catch(e){}
async function api(path,opts={},tries=1){for(let i=0;;i++){const ac=new AbortController();const tm=setTimeout(()=>ac.abort(),25000);
  try{const r=await fetch(API+path,{...opts,signal:ac.signal,headers:{"x-board-key":KEY||"",...(opts.headers||{})}});let j={};try{j=await r.json()}catch(e){}
    if(!r.ok){const err=new Error(j.error||("HTTP "+r.status));err.retry=r.status>=500||r.status===429;throw err;}return j;}
  catch(e){const again=e.name==="AbortError"||e.retry||e instanceof TypeError;
    if(i+1<tries&&again){await new Promise(res=>setTimeout(res,1500*(i+1)));continue;}
    throw e.name==="AbortError"?new Error("сервер не ответил за 25 секунд"):e;}
  finally{clearTimeout(tm);}}}
// Drafts survive refreshes, tab switches and reloads, so nothing typed or dictated is lost.
let drafts={};try{drafts=JSON.parse(localStorage.getItem("acmeBoardDrafts")||"{}")}catch(e){}
function setDraft(k,v){if(v&&v.trim())drafts[k]=v;else delete drafts[k];try{localStorage.setItem("acmeBoardDrafts",JSON.stringify(drafts))}catch(e){}}
const typing=()=>{const a=document.activeElement;return !!a&&(a.tagName==="TEXTAREA"||a.tagName==="INPUT")};
let saving=false,pendingRender=false,lastSig="",barCard=null;
let busy=0;
const MIC_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>';
const STOP_SVG='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';
function fmt(ms){const s=Math.floor(ms/1000);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");}
function micButton(ta,statusEl){
  const b=document.createElement("button");b.type="button";b.className="mic";b.setAttribute("aria-label","Записать голосом");b.innerHTML=MIC_SVG;
  let rec=null,stream=null,chunks=[],t0=0,timer=null,lastBlob=null;
  const say=(t,err)=>{statusEl.textContent=t;statusEl.classList.toggle("err",!!err);};
  async function transcribe(blob){b.disabled=true;say("Расшифровываю…");
    try{const r=await fetch(API+"/transcribe",{method:"POST",headers:{"x-board-key":KEY||"","content-type":(blob.type||"audio/mp4").split(";")[0]},body:blob});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||("HTTP "+r.status));
      const cur=ta.value.trim();ta.value=(cur?cur+" ":"")+j.text;ta.dataset.voice="1";lastBlob=null;ta.dispatchEvent(new Event("input",{bubbles:true}));
      say("Готово. Проверьте текст и сохраните.");ta.focus();try{ta.setSelectionRange(ta.value.length,ta.value.length)}catch(e){}}
    catch(e){lastBlob=blob;say("Не удалось расшифровать: "+e.message+". Нажмите микрофон, чтобы отправить эту запись ещё раз.",true);}
    finally{b.disabled=false;busy=Math.max(0,busy-1);}}
  b.onclick=async()=>{
    if(rec){rec.stop();return;}
    if(lastBlob){busy++;return transcribe(lastBlob);}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){say("Этот браузер не даёт записывать звук. Откройте доску в Safari или Chrome.",true);return;}
    try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
    catch(e){say(e&&e.name==="NotAllowedError"?"Доступ к микрофону запрещён. Разрешите микрофон для этого сайта в настройках браузера.":"Микрофон недоступен: "+((e&&e.message)||e),true);return;}
    const mime=["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"].find(m=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(m))||"";
    try{rec=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:undefined);}catch(e){rec=new MediaRecorder(stream);}
    chunks=[];busy++;
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    rec.onstop=()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());b.classList.remove("rec");b.innerHTML=MIC_SVG;b.setAttribute("aria-label","Записать голосом");
      const type=(rec.mimeType||mime||"audio/mp4");const blob=new Blob(chunks,{type});rec=null;
      if(blob.size<1500){say("Запись слишком короткая. Нажмите и говорите, затем нажмите ещё раз.",true);busy=Math.max(0,busy-1);return;}
      transcribe(blob);};
    rec.start(1000);t0=Date.now();b.classList.add("rec");b.innerHTML=STOP_SVG;b.setAttribute("aria-label","Остановить запись");
    say("Запись 0:00. Нажмите ещё раз, чтобы закончить.");
    timer=setInterval(()=>{const ms=Date.now()-t0;say("Запись "+fmt(ms)+". Нажмите ещё раз, чтобы закончить.");if(ms>10*60*1000&&rec)rec.stop();},250);
  };
  return b;}

const STAGES={Acquisition:"Привлечение",Activation:"Активация",Retention:"Удержание",Referral:"Рекомендации",Revenue:"Доход"};
const DEC={yes:"Согласен",alternative:"Нужен другой вариант",no:"Не согласен",postpone:"Отложено",changes:"Нужен другой вариант",pending:"Ждёт решения"};
const BTN_IDS=["#b-yes","#b-alt","#b-no","#b-later"];
const norm=n=>({id:n.id,cardId:n.card_id||n.cardId,target:n.target,text:n.text,source:n.source,at:n.at});
let notes=[],openComposer=null;
const EVID=[[0.1,"мнение"],[0.3,"исследование рынка"],[0.5,"наблюдение наших пользователей"],[0.8,"тест"],[1.0,"данные после запуска"]];
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const PROJECTS=[["RightHere","RightHere"],["Keeplane","Keeplane"],["all","Оба"]];
const STATUSES=[["pending","Ждут решения"],["decided","Решённые"],["all","Все"]];
let cards=[],decisions={},current=null,canWrite=!!KEY;
let project=lsGet("acmeBoardProject")||"RightHere",status=lsGet("acmeBoardStatus")||"pending";
const $=s=>document.querySelector(s);
const el=(t,a={},...kids)=>{const e=document.createElement(t);for(const[k,v]of Object.entries(a)){if(k==="class")e.className=v;else if(k==="text")e.textContent=v;else e.setAttribute(k,v)}for(const k of kids)if(k!=null)e.append(k);return e};
const revised=id=>{const d=decisions[id];const c=cards.find(x=>x.id===id);return !!(d&&c&&c.revisedAt&&c.revisedAt>d.at)};
const statusOf=id=>{const d=decisions[id];if(!d||revised(id))return "pending";return d.decision};
const score=c=>((c.priority?.impact||0)*(c.priority?.confidence||0));

const inProject=c=>project==="all"||c.product===project;
const inStatus=(c,st)=>{const s=statusOf(c.id);return st==="all"||(st==="pending"?s==="pending":s!=="pending")};
function visible(){return cards.filter(c=>inProject(c)&&inStatus(c,status))
  .sort((a,b)=>(statusOf(a.id)==="pending"?0:1)-(statusOf(b.id)==="pending"?0:1)||(b.bottleneck?1:0)-(a.bottleneck?1:0)||score(b)-score(a)||(a.order||99)-(b.order||99));}

function chipGroup(box,items,value,count,onPick){box.replaceChildren();for(const[v,label]of items){const n=count(v);
  const b=el("button",{class:"chip","aria-pressed":String(v===value)},label,el("b",{text:String(n)}));b.onclick=()=>onPick(v);box.append(b);}}
function renderFilters(){
  chipGroup($("#f-project"),PROJECTS,project,v=>cards.filter(c=>(v==="all"||c.product===v)&&statusOf(c.id)==="pending").length,v=>{project=v;lsSet("acmeBoardProject",v);afterFilter();});
  chipGroup($("#f-status"),STATUSES,status,v=>cards.filter(c=>inProject(c)&&inStatus(c,v)).length,v=>{status=v;lsSet("acmeBoardStatus",v);afterFilter();});}
function afterFilter(){renderFilters();const list=visible();
  if(current&&list.some(c=>c.id===current)){renderQueue();return;}
  if(window.matchMedia("(min-width:861px)").matches&&list[0]){openComposer=null;open(list[0].id,false);return;}
  current=null;$("#grid").classList.remove("detail-open");$("#decision").hidden=true;$("#detail").replaceChildren(emptyState());renderQueue();}
function renderQueue(){const q=$("#queue");q.replaceChildren();const list=visible();
  if(!list.length){q.append(el("p",{class:"note",text:!cards.length?"Очередь пуста.":status==="pending"?"Все карточки этого проекта решены. Новые появятся здесь.":"В этом фильтре карточек нет."}));return;}
  for(const c of list){const s=statusOf(c.id);
    const b=el("button",{class:"qitem","aria-current":String(current===c.id)},el("span",{class:"dot "+s,title:DEC[s]}),el("span",{class:"qt",text:c.title}),
      el("span",{class:"qm"},el("span",{class:"prod "+c.product,text:c.product}),el("span",{text:STAGES[c.stage]||c.stage||""}),c.bottleneck?el("span",{text:"узкое место"}):null,revised(c.id)?el("span",{class:"upd",text:"обновлено"}):null));
    b.onclick=()=>{openComposer=null;open(c.id,true)};q.append(b);}}

function notesFor(cardId,prefix){return notes.filter(n=>n.cardId===cardId&&(prefix==null||n.target===prefix||(prefix.endsWith(":")&&n.target.startsWith(prefix)))).sort((a,b)=>(a.at||"").localeCompare(b.at||""));}
function targetLabel(c,target){if(target==="card")return "Вся карточка";const[side,file]=target.split(":");const im=(c[side]?.images||[]).find(i=>i.file===file);return (side==="before"?"Было":"Станет")+(im?.caption?": "+im.caption:"");}
function noteList(c,items){const box=el("div",{class:"notes"});for(const n of items){
  box.append(el("div",{class:"note-item"},el("div",{class:"meta"},el("b",{text:targetLabel(c,n.target)}),n.source==="voice"?el("span",{class:"src-voice",text:"голосом"}):null,el("span",{text:n.at?new Date(n.at).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"}):""})),el("div",{text:n.text})));}return box;}
function composer(c,target){if(!canWrite){return el("p",{class:"note",text:"Комментировать может владелец доски."});}
  const id="cmp-"+c.id+"-"+target.replace(/[^\w-]/g,"_");
  const dkey="note:"+c.id+":"+target;
  const ta=el("textarea",{id,placeholder:"Что думаете? Нажмите микрофон и говорите."});ta.value=drafts[dkey]||"";ta.addEventListener("input",()=>setDraft(dkey,ta.value));
  const st=el("div",{class:"mic-status"});const mic=micButton(ta,st);
  const save=el("button",{class:"dbtn yes",text:"Сохранить"});const cancel=el("button",{class:"linkbtn",text:"Отмена"});
  const box=el("div",{class:"composer"},el("label",{for:id,text:"Комментарий: "+targetLabel(c,target)}),el("div",{class:"mic-row"},ta,mic),st,el("div",{class:"row"},save,cancel));
  cancel.onclick=()=>{setDraft(dkey,"");openComposer=null;busy=0;open(current,false)};
  save.onclick=async()=>{const text=ta.value.trim();if(!text){st.textContent="Пустой комментарий не сохраняю.";ta.focus();return;}
    save.disabled=true;st.textContent="Сохраняю…";
    try{const n=await api("/note",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({cardId:c.id,target,text,source:ta.dataset.voice?"voice":"text"})});
      setDraft(dkey,"");notes.push(norm(n));openComposer=null;busy=0;open(current,false);}
    catch(e){save.disabled=false;st.textContent="Не сохранилось: "+e.message+". Текст на месте, попробуйте ещё раз.";}};
  setTimeout(()=>ta.focus(),0);return box;}
function shots(images,side,c){const w=el("div",{class:"shots"});for(const im of images||[]){if(!im.url)continue;
  const btn=el("button",{class:"zoom","aria-label":"Открыть крупно: "+(im.caption||"")},el("img",{src:im.url,alt:im.caption||"Скриншот",loading:"lazy"}));
  btn.onclick=()=>{$("#lbimg").src=im.url;$("#lbimg").alt=im.caption||"";$("#lightbox").hidden=false};
  const target=side+":"+im.file;const count=c?notesFor(c.id,target).length:0;
  const cb=c?el("button",{class:"cbtn","aria-label":"Комментарий к экрану "+(im.caption||"")},"Комментарий",count?el("b",{text:String(count)}):null):null;
  if(cb)cb.onclick=()=>{openComposer={card:c.id,target};open(current,false)};
  w.append(el("figure",{class:"shot"},btn,im.caption?el("figcaption",{text:im.caption}):null,cb));}
  return w.childElementCount?w:null;}
function sidePane(c,side){const before=side==="before";const imgs=c[side]?.images||[];const row=shots(imgs,side,c);
  return el("div",{class:"side "+side},el("h3",{text:before?"Было":"Станет"}),row||el("p",{class:"note",text:before?(c.before?.text||"Сейчас этого нет."):"Макеты готовятся."}));}
function compare(c){const box=el("section",{class:"pair","aria-label":"Было и станет"},sidePane(c,"before"),sidePane(c,"after"));
  const items=notesFor(c.id,"before:").concat(notesFor(c.id,"after:")).sort((a,b)=>(a.at||"").localeCompare(b.at||""));
  const extra=[];if(items.length)extra.push(noteList(c,items));
  if(openComposer&&openComposer.card===c.id&&openComposer.target!=="card")extra.push(composer(c,openComposer.target));
  return extra.length?el("div",{},box,el("div",{class:"pair-notes"},...extra)):box;}
function changesBox(c){const ch=(c.changes||[]).slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));if(!ch.length)return null;
  const box=el("section",{class:"changes"},el("h3",{text:revised(c.id)?"Обновлено после вашего комментария":"Что менялось"}));
  for(const x of ch.slice(0,4))box.append(el("div",{class:"chg"},el("div",{class:"meta",text:(x.at?new Date(x.at).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})+" · ":"")+(x.because||"")}),el("div",{text:x.what||""})));
  return box;}

function sec(n,title,...body){return el("section",{class:"s"},el("h3",{},el("b",{text:n}),title),el("div",{class:"compare"},...body));}
function ul(items){const u=el("ul");for(const i of items||[])u.append(el("li",{text:i}));return u;}

function open(id,scroll){current=id;const c=cards.find(x=>x.id===id);const d=$("#detail");d.replaceChildren();
  $("#grid").classList.toggle("detail-open",!!c);
  if(!c){d.append(emptyState());$("#decision").hidden=true;renderQueue();return;}
  try{history.replaceState(null,"","#"+id)}catch(e){}
  const back=el("button",{class:"linkbtn back",text:"← Все карточки"});back.onclick=()=>{current=null;$("#grid").classList.remove("detail-open");$("#decision").hidden=true;renderQueue();};
  const p=c.priority||{};const flags=(p.costFlags||[]).map(f=>el("span",{class:"pill flag",text:f}));
  const issueLink=c.issue?(()=>{const m=c.issue.match(/^([\w-]+\/[\w-]+)#(\d+)$/);return m?el("a",{href:`https://github.com/${m[1]}/issues/${m[2]}`,target:"_blank",rel:"noopener",text:c.issue}):document.createTextNode(c.issue)})():null;
  d.append(el("div",{class:"dhead"},back,
    el("div",{class:"pills"},el("span",{class:"prod "+c.product,text:c.product}),el("span",{class:"pill",text:STAGES[c.stage]||c.stage||""}),c.bottleneck?el("span",{class:"pill neck",text:"узкое место"}):null,el("span",{class:"pill",text:DEC[statusOf(c.id)]}),revised(c.id)?el("span",{class:"pill upd",text:"обновлено"}):null),
    el("h2",{class:"title",text:c.title}),issueLink?el("div",{class:"issue"},issueLink):null));
  const ch=changesBox(c);if(ch)d.append(ch);
  d.append(compare(c));
  d.append(sec("1","Было",el("p",{text:c.before?.text||""}),c.before?.note?el("p",{class:"note",text:c.before.note}):null));
  d.append(sec("2","Проблема",el("p",{class:"story",text:c.story||""})));
  d.append(sec("3","Решение",ul(c.proposal)));
  const alt=c.alternatives||{};
  d.append(sec("4","Альтернативы",el("dl",{class:"kv"},el("dt",{text:"Не делать"}),el("dd",{text:alt.doNothing||"—"}),el("dt",{text:"Дешевле"}),el("dd",{text:alt.cheaper||"—"}))));
  const m=c.metric||{};
  d.append(sec("5","Метрика",el("dl",{class:"kv"},el("dt",{text:"Этап"}),el("dd",{text:STAGES[c.stage]||""}),el("dt",{text:"Метрика"}),el("dd",{text:m.name||""}),el("dt",{text:"Сейчас"}),el("dd",{text:m.current||"нет данных"}),el("dt",{text:"Цель"}),el("dd",{text:m.target||""}),el("dt",{text:"События"}),el("dd",{class:"mono",text:(m.events||[]).join(", ")}))));
  const basis=el("ul");for(const b of c.basis||[]){const li=el("li");li.append(b.label||"");if(b.ref&&/^https?:/.test(b.ref)){li.append(" ",el("a",{href:b.ref,target:"_blank",rel:"noopener",text:"ссылка"}))}else if(b.ref){li.append(" ",el("span",{class:"mono",text:b.ref}))}basis.append(li);}
  d.append(sec("6","На чём основано",basis));
  const pr=c.proof||{};
  d.append(sec("7","Как докажем",el("dl",{class:"kv"},el("dt",{text:"Сигнал"}),el("dd",{text:pr.signal||""}),el("dt",{text:"Порог"}),el("dd",{text:pr.threshold||""}),el("dt",{text:"Срок"}),el("dd",{text:pr.horizon||""}),el("dt",{text:"Метод"}),el("dd",{text:pr.method||""}))));
  const conf=p.confidence||0;const meter=el("div",{class:"meter","aria-label":`Уверенность ${conf}`});for(const[v]of EVID)meter.append(el("i",{class:v<=conf+1e-9?"on":""}));
  const evidLabel=(EVID.slice().reverse().find(([v])=>conf>=v-1e-9)||EVID[0])[1];
  d.append(sec("8","Приоритет",el("dl",{class:"kv"},el("dt",{text:"Влияние"}),el("dd",{text:`${p.impact??"?"} из 3`}),el("dt",{text:"Уверенность"}),el("dd",{},meter,el("span",{text:`${conf} · ${evidLabel}. ${p.confidenceWhy||""}`})),el("dt",{text:"Размер"}),el("dd",{text:p.size||""}),el("dt",{text:"Остановимся"}),el("dd",{text:p.stop||""})),flags.length?el("div",{class:"pills"},...flags):null,c.risks?.length?el("div",{},el("p",{class:"note",text:"Риски"}),ul(c.risks)):null));
  if(c.result)d.append(sec("✓","Результат",el("p",{text:c.result})));
  const general=notesFor(c.id,"card");const addBtn=canWrite?el("button",{class:"cbtn",text:"Добавить комментарий к карточке"}):null;
  if(addBtn)addBtn.onclick=()=>{openComposer={card:c.id,target:"card"};open(current,false)};
  d.append(sec("9","Обсуждение",general.length?noteList(c,general):el("p",{class:"note",text:"Комментариев к карточке пока нет. Комментарии к отдельным экранам — под скриншотами."}),openComposer&&openComposer.card===c.id&&openComposer.target==="card"?composer(c,"card"):addBtn));
  const dec=decisions[c.id];
  d.append(sec("10","Решение",el("p",{text:dec?`${DEC[dec.decision]||dec.decision}${dec.at?" · "+new Date(dec.at).toLocaleString("ru-RU",{dateStyle:"medium",timeStyle:"short"}):""}`:"Ещё нет."}),dec?.comment?el("p",{class:"story",text:dec.comment}):null));
  renderDecisionBar(c);renderQueue();if(scroll)window.scrollTo({top:0,behavior:"instant"in window?"instant":"auto"});}

function renderDecisionBar(c){const bar=$("#decision");bar.hidden=false;const rv=revised(c.id);const dec=rv?null:decisions[c.id];const st=$("#dstatus");
  const ta=$("#comment");if(!(barCard===c.id&&document.activeElement===ta))ta.value=drafts["dec:"+c.id]??(dec?.comment||"");
  const same=barCard===c.id;barCard=c.id;if(same&&saving)return;
  for(const b of BTN_IDS)$(b).disabled=!canWrite;
  st.className="status "+(dec?.decision||"");
  st.textContent=!canWrite?"Решение может принять владелец доски.":dec?`Сейчас: ${DEC[dec.decision]}. Можно изменить.`:rv?`Карточка обновлена после вашего «${DEC[decisions[c.id].decision]}». Решите заново.`:"Выберите решение.";}

async function decide(kind){if(saving)return;const c=cards.find(x=>x.id===current);if(!c||!canWrite)return;const st=$("#dstatus");
  const comment=$("#comment").value.trim();
  if((kind==="alternative"||kind==="no")&&!comment){st.className="status";st.textContent=kind==="alternative"?"Опишите, какой вариант нужен. Можно голосом: кнопка микрофона рядом с полем.":"Напишите пару слов, почему нет.";$("#comment").focus();return;}
  saving=true;for(const b of BTN_IDS)$(b).disabled=true;st.className="status";st.textContent="Сохраняю…";
  try{const d=await api("/decision",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({cardId:c.id,decision:kind,comment})},3);
    decisions[c.id]={decision:d.decision,comment:d.comment,at:d.at};setDraft("dec:"+c.id,"");
    st.className="status "+kind;st.replaceChildren(document.createTextNode(`Сохранено: ${DEC[kind]}. `));
    const next=visible().find(x=>statusOf(x.id)==="pending"&&x.id!==c.id);
    if(next){const nb=el("button",{class:"linkbtn",text:"Следующая карточка →"});nb.onclick=()=>open(next.id,true);st.append(nb);}
    renderFilters();renderQueue();}
  catch(e){st.className="status no";st.textContent="Не сохранилось: "+(e?.message||"ошибка")+". Текст на месте, нажмите ещё раз.";}
  finally{saving=false;for(const b of BTN_IDS)$(b).disabled=!canWrite;if(pendingRender&&!typing()){pendingRender=false;rerender();}}}

function emptyState(){const none=cards.length&&!visible().length;return el("div",{class:"empty"},el("h2",{text:none?(status==="pending"?"Здесь всё решено":"Здесь пока пусто"):cards.length?"Выберите карточку слева":"Карточки скоро появятся"}),el("p",{text:none?"Переключите проект или статус выше.":cards.length?"Решение принимается внизу экрана: Согласен, Другой вариант, Не согласен или Отложить.":"Product Owner готовит карточки с реальными скриншотами и макетами. Каждая придёт сюда с метрикой и оценкой."}));}

$("#b-yes").onclick=()=>decide("yes");$("#b-alt").onclick=()=>decide("alternative");$("#b-no").onclick=()=>decide("no");$("#b-later").onclick=()=>decide("postpone");
$("#lightbox").onclick=()=>{$("#lightbox").hidden=true};
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("#lightbox").hidden=true});

function rerender(){renderFilters();if(openComposer||busy){renderQueue();return;}if(current&&cards.some(c=>c.id===current))open(current,false);else{const d=$("#detail");d.replaceChildren(emptyState());renderQueue();}}
rerender();

(function boot(){
  const mic=micButton($("#comment"),$("#dstatus"));$("#comment-row").append(mic);
  $("#comment").addEventListener("input",()=>{if(current)setDraft("dec:"+current,$("#comment").value)});
  document.addEventListener("focusout",()=>setTimeout(()=>{if(pendingRender&&!typing()&&!saving&&!busy){pendingRender=false;rerender();}},300));
  if(!KEY){$("#grid").replaceChildren(el("div",{class:"gate"},el("h1",{text:"Обзор фич"}),el("p",{text:"Откройте доску по личной ссылке с ключом. Ключ сохранится на этом устройстве."})));$("#decision").hidden=true;return;}
  let first=true;
  async function load(){if(busy&&!first)return;
    try{const s=await api("/state",{},2);
      const strip=x=>x?{...x,images:(x.images||[]).map(({url,...i})=>i)}:x;
      const sig=JSON.stringify([s.cards.map(c=>({...c,before:strip(c.before),after:strip(c.after)})),s.decisions,s.notes]);
      if(!first&&sig===lastSig)return;lastSig=sig;
      const known={};for(const c of cards)for(const side of["before","after"])for(const im of c[side]?.images||[])if(im.imageId&&im.url)known[im.imageId]=im.url;
      for(const c of s.cards)for(const side of["before","after"])for(const im of c[side]?.images||[])if(known[im.imageId])im.url=known[im.imageId];
      cards=s.cards;decisions={};for(const d of s.decisions)decisions[d.card_id]={decision:d.decision,comment:d.comment,at:d.at};notes=s.notes.map(norm);
      if(!first&&(typing()||saving||busy)){pendingRender=true;renderFilters();renderQueue();return;}
      if(first){first=false;const h=(location.hash||"").slice(1);if(h&&cards.some(c=>c.id===h))current=h;else if(window.matchMedia("(min-width:861px)").matches){const v=visible();current=v[0]?.id||null;}}
      rerender();}
    catch(e){const auth=/unauthorized/.test(e.message);if(first||auth){$("#detail").replaceChildren(el("div",{class:"empty"},el("h2",{text:auth?"Ключ не подходит":"Карточки не загрузились"}),el("p",{text:auth?"Откройте доску по личной ссылке ещё раз.":e.message+". Обновите страницу."})));}}}
  load();setInterval(load,30000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)load();});
})();
