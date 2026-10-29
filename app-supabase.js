(() => {
  'use strict';
  const config = window.HOSTELCONNECT_CONFIG || {};
  const pageNames = { overview:'Overview', rooms:'Room management', leaves:'Leave requests', complaints:'Complaints', announcements:'Announcements', people:'Student records' };
  const icons = { overview:'⌂', rooms:'▦', leaves:'↗', complaints:'◉', announcements:'▤', people:'♙' };
  let db, authUser, profile, page='overview', data={ rooms:[], leaves:[], complaints:[], announcements:[], profiles:[] }, toastTimer;
  const $ = id => document.getElementById(id);
  const staff = () => ['warden','admin'].includes(profile?.role);
  const admin = () => profile?.role === 'admin';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials = name => String(name||'?').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  const nice = text => String(text||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  const date = value => value ? new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '—';
  const statusBadge = value => `<span class="status ${esc(String(value||'').toLowerCase().replaceAll('_','-').replaceAll(' ','-'))}">${esc(nice(value))}</span>`;
  function notify(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3200); }
  function showLogin(message='') { authUser=null; profile=null; $('app').classList.add('hidden'); $('login-screen').classList.remove('hidden'); $('login-error').textContent=message; }
  function showApp(){ $('login-screen').classList.add('hidden'); $('app').classList.remove('hidden'); }
  function friendlyError(error){
    const msg=error?.message||'Please try again.';
    if(/Invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
    if(/Failed to fetch|NetworkError/i.test(msg)) return 'Could not reach Supabase. Check your internet and the URL/key in supabase-config.js.';
    if(/permission|row-level|RLS|schema cache|not found/i.test(msg)) return `${msg} Check that the database setup completed and access rules are enabled.`;
    return msg;
  }
  async function signIn(email,password){
    $('login-error').textContent='';
    const {data:result,error}=await db.auth.signInWithPassword({email:email.trim(),password});
    if(error){$('login-error').textContent=friendlyError(error);return;}
    await enterApp(result.user);
  }
  async function signOut(){await db.auth.signOut();showLogin();$('password').value='';}
  async function enterApp(user){
    authUser=user;
    const {data:row,error}=await db.from('profiles').select('*').eq('id',user.id).single();
    if(error||!row){await db.auth.signOut();showLogin(`Your account was found, but its HostelConnect profile could not be loaded. ${error?friendlyError(error):'Ask the administrator to check your profile.'}`);return;}
    profile=row; showApp();
    $('top-name').textContent=profile.full_name||user.email;
    $('top-role').textContent=nice(profile.role);
    $('top-avatar').textContent=initials(profile.full_name||user.email);
    await loadData();
  }
  async function loadData(){
    const requests=[
      db.from('rooms').select('*').order('room_number'),
      db.from('leave_requests').select('*').order('created_at',{ascending:false}),
      db.from('complaints').select('*').order('created_at',{ascending:false}),
      db.from('announcements').select('*').order('created_at',{ascending:false}),
      db.from('profiles').select('*').order('full_name')
    ];
    const results=await Promise.all(requests);
    const failed=results.find(x=>x.error);
    if(failed){notify(friendlyError(failed.error));return;}
    [data.rooms,data.leaves,data.complaints,data.announcements,data.profiles]=results.map(x=>x.data||[]);
    renderShell(); renderPage();
  }
  function renderShell(){
    const pages=['overview','rooms','leaves','complaints','announcements']; if(admin()) pages.push('people');
    $('navigation').innerHTML=pages.map(p=>`<button class="nav-item ${p===page?'active':''}" data-page="${p}"><span class="nav-icon">${icons[p]}</span>${pageNames[p]}${p==='leaves'&&staff()?`<span class="nav-badge">${data.leaves.filter(x=>x.status==='pending').length||''}</span>`:''}</button>`).join('');
  }
  function heading(title,sub,action=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${action?`<div class="heading-actions">${action}</div>`:''}</div>`;}
  function addButton(label,action){return `<button class="button button-primary button-small" data-action="${action}">＋ &nbsp;${label}</button>`;}
  function stat(label,value,note,icon,color){return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${note}</div></div>`;}
  function personName(id){return data.profiles.find(p=>p.id===id)?.full_name||'Resident';}
  function renderPage(){const f={overview:renderOverview,rooms:renderRooms,leaves:renderLeaves,complaints:renderComplaints,announcements:renderAnnouncements,people:renderPeople}[page]||renderOverview;$('page-crumb').textContent=pageNames[page]||'Overview';$('page-content').innerHTML=f();}
  function renderOverview(){
    const capacity=data.rooms.reduce((n,r)=>n+Number(r.capacity||0),0); const occupied=data.rooms.reduce((n,r)=>n+data.profiles.filter(p=>p.room_number===r.room_number).length,0); const pct=capacity?Math.round(occupied/capacity*100):0; const openLeaves=data.leaves.filter(x=>x.status==='pending').length; const openComplaints=data.complaints.filter(x=>!['resolved','closed'].includes(x.status)).length;
    const leaveRows=(staff()?data.leaves:data.leaves.filter(x=>x.user_id===authUser.id)).slice(0,4);
    return `${heading(`Welcome, ${esc((profile.full_name||authUser.email).split(' ')[0])}`,`Here’s what’s happening at your hostel today.`,staff()?addButton('Post announcement','new-announcement'):addButton('Request leave','new-leave'))}<div class="stat-grid">${stat('Residents',data.profiles.length,'Student profiles','♙','blue')}${stat('Room occupancy',`${pct}%`,`${occupied} of ${capacity} beds assigned`,'▦','green')}${stat('Pending leave',staff()?openLeaves:data.leaves.filter(x=>x.user_id===authUser.id&&x.status==='pending').length,'Awaiting review','↗','amber')}${stat('Open complaints',staff()?openComplaints:data.complaints.filter(x=>x.user_id===authUser.id&&!['resolved','closed'].includes(x.status)).length,'Needs follow-up','◉','red')}</div><div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><div class="panel-title">Room occupancy</div><div class="panel-subtitle">Current assigned beds</div></div><button class="link-button" data-page="rooms">View rooms →</button></div><div class="occupancy"><div class="donut" style="--percent:${pct*3.6}deg"><div class="donut-center"><strong>${pct}%</strong><span>occupied</span></div></div><div class="legend"><div class="legend-row"><span class="legend-label"><i class="legend-dot"></i>Assigned</span><strong>${occupied}</strong></div><div class="legend-row"><span class="legend-label"><i class="legend-dot gray"></i>Available</span><strong>${Math.max(0,capacity-occupied)}</strong></div><div class="legend-row"><span class="legend-label"><i class="legend-dot" style="background:#9b8be4"></i>Total beds</span><strong>${capacity}</strong></div></div></div></section><section class="panel"><div class="panel-header"><div><div class="panel-title">Latest announcements</div><div class="panel-subtitle">Updates from your hostel team</div></div><button class="link-button" data-page="announcements">See all →</button></div><div class="announcement-list">${data.announcements.slice(0,3).map(a=>`<div class="announcement-item"><span class="announcement-dot"></span><div><strong>${esc(a.title)}</strong><p>${esc(a.body)}</p><time>${date(a.created_at?.slice(0,10))}</time></div></div>`).join('')||'<div class="empty-state">No announcements yet.</div>'}</div></section></div><div class="lower-grid"><section class="panel"><div class="panel-header"><div><div class="panel-title">${staff()?'Recent leave requests':'Your leave requests'}</div><div class="panel-subtitle">Latest requests</div></div><button class="link-button" data-page="leaves">View all →</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>STUDENT</th><th>DATES</th><th>DESTINATION</th><th>STATUS</th></tr></thead><tbody>${leaveRows.map(x=>`<tr><td>${esc(personName(x.user_id))}</td><td>${date(x.start_date)} – ${date(x.end_date)}</td><td>${esc(x.destination)}</td><td>${statusBadge(x.status)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty-state">No requests yet.</td></tr>'}</tbody></table></div></section><section class="panel"><div class="panel-header"><div><div class="panel-title">Your role</div><div class="panel-subtitle">Access granted by the hostel administrator</div></div></div><p><strong>${esc(nice(profile.role))}</strong></p><p class="panel-subtitle">${profile.room_number?`Room ${esc(profile.room_number)}`:'Manage hostel records according to your access.'}</p></section></div>`;
  }
  function renderRooms(){return `${heading('Room management',`${data.rooms.length} rooms`,staff()?addButton('Add room','new-room'):'')}<div class="toolbar"><div class="search-box"><input id="room-search" placeholder="Search room or building…"></div><select class="filter-select" id="room-filter"><option value="all">All statuses</option><option value="occupied">Occupied</option><option value="available">Available</option><option value="maintenance">Maintenance</option></select></div><div class="room-grid" id="room-grid">${roomCards(data.rooms)}</div>`;}
  function roomCards(rows){return rows.length?rows.map(r=>{const people=data.profiles.filter(p=>p.room_number===r.room_number).map(p=>p.full_name).filter(Boolean);const pct=Math.min(100,Math.round(people.length/Math.max(1,r.capacity)*100));return `<div class="room-card"><div class="room-top"><strong>${esc(r.room_number)}</strong>${statusBadge(r.status)}</div><p>${esc(r.building)} · Floor ${esc(r.floor)}</p><div class="room-progress"><span style="width:${pct}%"></span></div><div class="room-foot"><span>${people.length} / ${r.capacity} beds</span><span>${esc(people.join(', ')||'No residents assigned')}</span></div>${staff()?`<div class="request-actions"><button class="table-action" data-action="edit-room" data-id="${esc(r.id)}">Edit</button><button class="table-action danger" data-action="delete-room" data-id="${esc(r.id)}">Remove</button></div>`:''}</div>`;}).join(''):'<div class="panel empty-state">No rooms have been added.</div>';}
  function renderLeaves(){const rows=data.leaves;return `${heading('Leave requests',staff()?'Review resident requests and update decisions.':'Submit a request and check its status.',!staff()?addButton('New leave request','new-leave'):'')}<div class="request-grid">${rows.map(x=>`<article class="request-card"><div class="request-card-head"><div><h3>${esc(personName(x.user_id))}${staff()?` · ${esc(data.profiles.find(p=>p.id===x.user_id)?.room_number||'')}`:''}</h3><div class="panel-subtitle">${date(x.created_at?.slice(0,10))}</div></div>${statusBadge(x.status)}</div><div class="request-meta"><span>↗ ${date(x.start_date)} – ${date(x.end_date)}</span><span>⌖ ${esc(x.destination)}</span></div><p>${esc(x.reason)}</p>${staff()&&x.status==='pending'?`<div class="request-actions"><button class="button button-primary button-small" data-action="leave-status" data-id="${x.id}" data-status="approved">Approve</button><button class="button button-secondary button-small" data-action="leave-status" data-id="${x.id}" data-status="rejected">Decline</button></div>`:''}</article>`).join('')||'<div class="panel empty-state">No leave requests yet.</div>'}</div>`;}
  function renderComplaints(){return `${heading('Complaints',staff()?'Review issues and update their status.':'Report an issue and follow its progress.',!staff()?addButton('Submit complaint','new-complaint'):'')}<div class="toolbar"><div class="search-box"><input id="complaint-search" placeholder="Search complaints…"></div><select class="filter-select" id="complaint-filter"><option value="all">All statuses</option><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div><div class="panel data-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>SUBJECT</th><th>${staff()?'STUDENT':'CATEGORY'}</th><th>DATE</th><th>STATUS</th>${staff()?'<th>UPDATE STATUS</th>':''}</tr></thead><tbody id="complaint-rows">${complaintRows(data.complaints)}</tbody></table></div></div>`;}
  function complaintRows(rows){return rows.length?rows.map(x=>`<tr><td><strong>${esc(x.subject)}</strong><br><small>${esc(x.description)}</small></td><td>${staff()?esc(personName(x.user_id)):esc(x.category)}</td><td>${date(x.created_at?.slice(0,10))}</td><td>${statusBadge(x.status)}</td>${staff()?`<td><select class="filter-select inline-status" data-id="${x.id}"><option value="open" ${x.status==='open'?'selected':''}>Open</option><option value="in_review" ${x.status==='in_review'?'selected':''}>In review</option><option value="resolved" ${x.status==='resolved'?'selected':''}>Resolved</option><option value="closed" ${x.status==='closed'?'selected':''}>Closed</option></select></td>`:''}</tr>`).join(''):'<tr><td colspan="5" class="empty-state">No complaints yet.</td></tr>';}
  function announcementCards(rows){
    if(!rows.length)return `<div class="panel empty-state">${data.announcements.length?'No announcements match your filters.':'No announcements yet.'}</div>`;
    return rows.map(a=>`<article class="announcement-card"><div class="announcement-card-top"><div><h3>${esc(a.title)}</h3><time>${date(a.created_at?.slice(0,10))} · ${esc(personName(a.author_id))}</time></div><span class="announcement-tag">${esc(nice(a.category))}</span></div><p>${esc(a.body)}</p>${staff()?`<button class="table-action danger" data-action="delete-announcement" data-id="${a.id}">Remove</button>`:''}</article>`).join('');
  }
  function renderAnnouncements(){
    const categories=[...new Set(data.announcements.map(a=>a.category).filter(Boolean))].sort();
    return `${heading('Announcements','Updates and notices for hostel residents.',staff()?addButton('Post announcement','new-announcement'):'')}<div class="callout">Only hostel staff can publish or remove announcements. All signed-in users can read them.</div><div class="toolbar"><div class="search-box"><input id="announcement-search" type="search" placeholder="Search announcements…" aria-label="Search announcements"></div><select class="filter-select" id="announcement-filter" aria-label="Filter announcements by category"><option value="all">All categories</option>${categories.map(category=>`<option value="${esc(category)}">${esc(nice(category))}</option>`).join('')}</select></div><div id="announcement-results">${announcementCards(data.announcements)}</div>`;
  }
  function filterAnnouncements(){
    const term=($('announcement-search')?.value||'').trim().toLowerCase(),category=$('announcement-filter')?.value||'all';
    const rows=data.announcements.filter(a=>`${a.title} ${a.body} ${a.category||''}`.toLowerCase().includes(term)&&(category==='all'||a.category===category));
    const results=$('announcement-results'); if(results)results.innerHTML=announcementCards(rows);
  }
  function renderPeople(){if(!admin())return '<div class="panel empty-state">Admin access required.</div>';return `${heading('Student records','Invite users, view profiles, and update details or roles.',addButton('Invite user','new-user'))}<div class="callout">Invited users receive an email link to set their own password. Passwords are private and cannot be viewed here. Supabase email delivery must be configured to invite external addresses.</div><div class="toolbar"><div class="search-box"><input id="people-search" placeholder="Search students…"></div></div><div class="panel data-panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>NAME</th><th>EMAIL</th><th>STUDENT ID</th><th>ROOM</th><th>ROLE</th><th>EDIT</th></tr></thead><tbody>${data.profiles.map(p=>`<tr><td>${esc(p.full_name||'—')}</td><td>${esc(p.email||'—')}</td><td>${esc(p.student_id||'—')}</td><td>${esc(p.room_number||'—')}</td><td>${statusBadge(p.role)}</td><td><button class="table-action" data-action="edit-person" data-id="${p.id}">Edit details</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty-state">No profiles found.</td></tr>'}</tbody></table></div></div>`;}
  function openModal(title,html){$('modal-root').innerHTML=`<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="modal-close" data-action="close-modal">×</button></div>${html}</section></div>`;}
  function input(label,name,type='text',value='',required=true){return `<div class="field"><label for="f-${name}">${label}${required?' *':''}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''}></div>`;}
  function formButtons(label){return `<div class="form-actions"><button class="button button-primary">${label}</button><button type="button" class="button button-secondary" data-action="close-modal">Cancel</button></div>`;}
  function showForm(kind,id){
    const room=data.rooms.find(x=>x.id===id), person=data.profiles.find(x=>x.id===id);
    if(kind==='new-user'&&admin())openModal('Invite a user',`<form data-form="new-user"><div class="callout">Supabase will email an invitation to this address. The user sets their own password from the link.</div><div class="form-grid">${input('Full name','full_name')}${input('Email address','email','email')}${input('Student ID','student_id','text','',false)}${input('Phone','phone','tel','',false)}${input('Room number','room_number','text','',false)}<div class="field"><label>Role</label><select name="role"><option value="student">Student</option><option value="warden">Warden</option></select></div></div>${formButtons('Send invitation')}</form>`);
    if(kind==='new-leave')openModal('Request leave',`<form data-form="leave"><div class="form-grid">${input('Start date','start_date','date')}${input('Return date','end_date','date')}${input('Destination','destination')}${input('Reason','reason')}</div>${formButtons('Submit request')}</form>`);
    if(kind==='new-complaint')openModal('Submit a complaint',`<form data-form="complaint"><div class="form-grid"><div class="field"><label>Category *</label><select name="category"><option>Maintenance</option><option>Facilities</option><option>Safety</option><option>Other</option></select></div>${input('Subject','subject')}<div class="field full"><label>Description *</label><textarea name="description" required maxlength="500"></textarea></div></div>${formButtons('Submit complaint')}</form>`);
    if(kind==='new-announcement')openModal('Post announcement',`<form data-form="announcement"><div class="form-grid"><div class="field full"><label>Title *</label><input name="title" required maxlength="100"></div><div class="field"><label>Category *</label><select name="category"><option>general</option><option>maintenance</option><option>reminder</option><option>event</option></select></div><div class="field full"><label>Message *</label><textarea name="body" required maxlength="1000"></textarea></div></div>${formButtons('Publish announcement')}</form>`);
    if(kind==='new-room')openModal('Add a room',`<form data-form="room"><div class="form-grid">${input('Room number','room_number')}${input('Building','building')}${input('Floor','floor','number','0')}${input('Bed capacity','capacity','number','2')}<div class="field full"><label>Status</label><select name="status"><option value="available">Available</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option></select></div></div>${formButtons('Add room')}</form>`);
    if(kind==='edit-room'&&room)openModal(`Edit room ${esc(room.room_number)}`,`<form data-form="edit-room" data-id="${room.id}">${input('Room number','room_number','text',room.room_number)}${input('Building','building','text',room.building)}${input('Floor','floor','number',room.floor)}${input('Bed capacity','capacity','number',room.capacity)}<div class="field"><label>Status</label><select name="status"><option value="available" ${room.status==='available'?'selected':''}>Available</option><option value="occupied" ${room.status==='occupied'?'selected':''}>Occupied</option><option value="maintenance" ${room.status==='maintenance'?'selected':''}>Maintenance</option></select></div>${formButtons('Save changes')}</form>`);
    if(kind==='edit-person'&&person&&admin())openModal(`Edit ${esc(person.full_name||person.email)}`,`<form data-form="edit-person" data-id="${person.id}">${input('Full name','full_name','text',person.full_name||'')}${input('Student ID','student_id','text',person.student_id||'',false)}${input('Phone','phone','tel',person.phone||'',false)}${input('Room number','room_number','text',person.room_number||'',false)}<div class="field"><label>Role</label><select name="role"><option value="student" ${person.role==='student'?'selected':''}>Student</option><option value="warden" ${person.role==='warden'?'selected':''}>Warden</option><option value="admin" ${person.role==='admin'?'selected':''}>Admin</option></select></div>${formButtons('Save profile')}</form>`);
  }
  async function submitForm(form){
    const v=Object.fromEntries(new FormData(form).entries()); let result;
    if(form.dataset.form==='new-user'){
      if(!admin()){notify('Only an admin can invite users.');return;}
      const {data:inviteResult,error}=await db.functions.invoke('create-hostel-user',{body:{email:v.email,full_name:v.full_name,student_id:v.student_id||null,phone:v.phone||null,room_number:v.room_number||null,role:v.role}});
      if(error){let message=friendlyError(error);try{const details=await error.context?.json();if(details?.error)message=details.error;}catch{}notify(message);return;}
      if(inviteResult?.error){notify(inviteResult.error);return;}
      $('modal-root').innerHTML='';notify(`Invitation sent to ${v.email}.`);await loadData();return;
    }
    if(form.dataset.form==='leave'){
      if(v.end_date<v.start_date){notify('Return date must be on or after the start date.');return;}
      result=await db.from('leave_requests').insert({user_id:authUser.id,start_date:v.start_date,end_date:v.end_date,destination:v.destination,reason:v.reason});
    } else if(form.dataset.form==='complaint') result=await db.from('complaints').insert({user_id:authUser.id,category:v.category,subject:v.subject,description:v.description});
    else if(form.dataset.form==='announcement') result=await db.from('announcements').insert({title:v.title,category:v.category,body:v.body,author_id:authUser.id});
    else if(form.dataset.form==='room') result=await db.from('rooms').insert({room_number:v.room_number,building:v.building,floor:Number(v.floor),capacity:Number(v.capacity),status:v.status});
    else if(form.dataset.form==='edit-room') result=await db.from('rooms').update({room_number:v.room_number,building:v.building,floor:Number(v.floor),capacity:Number(v.capacity),status:v.status}).eq('id',form.dataset.id);
    else if(form.dataset.form==='edit-person') result=await db.from('profiles').update({full_name:v.full_name,student_id:v.student_id||null,phone:v.phone||null,room_number:v.room_number||null,role:v.role}).eq('id',form.dataset.id);
    if(result?.error){notify(friendlyError(result.error));return;}
    $('modal-root').innerHTML=''; notify('Saved successfully.'); await loadData();
  }
  async function handleAction(kind,el){
    const id=el.dataset.id;
    if(['new-leave','new-complaint','new-announcement','new-room','edit-room','edit-person','new-user'].includes(kind)){showForm(kind,id);return;}
    if(kind==='close-modal'){ $('modal-root').innerHTML='';return; }
    if(kind==='backdrop'&&el.target===el){ $('modal-root').innerHTML='';return; }
    let result;
    if(kind==='leave-status')result=await db.from('leave_requests').update({status:el.dataset.status,reviewed_by:authUser.id}).eq('id',id);
    if(kind==='complaint-status')result=await db.from('complaints').update({status:el.value}).eq('id',id);
    if(kind==='delete-room'){if(!confirm('Remove this room?'))return;result=await db.from('rooms').delete().eq('id',id);}
    if(kind==='delete-announcement'){if(!confirm('Remove this announcement?'))return;result=await db.from('announcements').delete().eq('id',id);}
    if(result?.error)notify(friendlyError(result.error));else if(result){notify('Updated successfully.');await loadData();}
  }
  function bind(){
    $('login-form').addEventListener('submit',async e=>{e.preventDefault();if(!db){$('login-error').textContent='Add the Supabase URL and publishable key to supabase-config.js first.';return;}await signIn($('email').value,$('password').value);});
    $('toggle-password').addEventListener('click',e=>{const p=$('password');p.type=p.type==='password'?'text':'password';e.currentTarget.textContent=p.type==='password'?'Show':'Hide';});
    $('logout-button').addEventListener('click',signOut);
    $('profile-button').addEventListener('click',()=>$('profile-menu').classList.toggle('hidden'));
    $('mobile-menu').addEventListener('click',()=>{$('sidebar').classList.add('open');$('mobile-overlay').classList.add('show');});
    document.addEventListener('click',e=>{const nav=e.target.closest('[data-page]');if(nav){page=nav.dataset.page;$('sidebar').classList.remove('open');$('mobile-overlay').classList.remove('show');renderShell();renderPage();return;}const a=e.target.closest('[data-action]');if(a){handleAction(a.dataset.action,a);return;}});
    document.addEventListener('submit',e=>{if(e.target.matches('form[data-form]')){e.preventDefault();submitForm(e.target);}});
    document.addEventListener('input',e=>{if(e.target.id==='room-search'||e.target.id==='room-filter')filterRooms();if(e.target.id==='complaint-search'||e.target.id==='complaint-filter')filterComplaints();if(e.target.id==='people-search')filterPeople();if(e.target.id==='announcement-search')filterAnnouncements();});
    document.addEventListener('change',e=>{if(e.target.id==='room-filter')filterRooms();if(e.target.id==='complaint-filter')filterComplaints();if(e.target.id==='announcement-filter')filterAnnouncements();if(e.target.classList.contains('inline-status'))handleAction('complaint-status',e.target);});
  }
  function filterRooms(){const term=($('room-search')?.value||'').toLowerCase(),status=$('room-filter')?.value||'all';$('room-grid').innerHTML=roomCards(data.rooms.filter(r=>(`${r.room_number} ${r.building}`.toLowerCase().includes(term))&&(status==='all'||r.status===status)));}
  function filterComplaints(){const term=($('complaint-search')?.value||'').toLowerCase(),status=$('complaint-filter')?.value||'all';$('complaint-rows').innerHTML=complaintRows(data.complaints.filter(x=>(`${x.subject} ${x.category} ${personName(x.user_id)}`.toLowerCase().includes(term))&&(status==='all'||x.status===status)));}
  function filterPeople(){const term=($('people-search')?.value||'').toLowerCase();const rows=data.profiles.filter(p=>`${p.full_name} ${p.email} ${p.student_id} ${p.room_number}`.toLowerCase().includes(term));const tbody=document.querySelector('#page-content tbody');if(tbody)tbody.innerHTML=rows.map(p=>`<tr><td>${esc(p.full_name||'—')}</td><td>${esc(p.email||'—')}</td><td>${esc(p.student_id||'—')}</td><td>${esc(p.room_number||'—')}</td><td>${statusBadge(p.role)}</td><td><button class="table-action" data-action="edit-person" data-id="${p.id}">Edit details</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty-state">No profiles found.</td></tr>';}
  async function start(){
    $('app').insertAdjacentHTML('beforeend','<div class="mobile-overlay" id="mobile-overlay"></div>');bind();
    if(!window.supabase?.createClient){showLogin('Could not load the Supabase client library. Check your internet connection and refresh.');return;}
    if(!config.url||config.url.includes('PASTE_')||!config.publishableKey||config.publishableKey.includes('PASTE_')){showLogin('Add the Project URL and Publishable key to supabase-config.js, then refresh this page.');return;}
    db=window.supabase.createClient(config.url,config.publishableKey);
    const {data:sessionData}=await db.auth.getSession();
    if(sessionData.session)await enterApp(sessionData.session.user);
    db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')showLogin();else if(event==='SIGNED_IN'&&session?.user)setTimeout(()=>enterApp(session.user),0);});
  }
  start();
})();
