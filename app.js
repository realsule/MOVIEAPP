"use strict";
  /* ----------------------------
     Single-file SPA Movie App
     - fetches shows from TVMaze (no-auth)
     - uses event types: click, input, change
     - uses array iteration methods
     - persists bookings to localStorage
     ---------------------------- */

  // ----- Config & State -----
  const API = 'https://api.tvmaze.com/shows'; // no-auth public API
  const MAX_SHOWS = 12; // how many to show in grid
  const defaultTrailer = 'https://www.youtube.com/embed/tgbNymZ7vqY'; // fallback demo trailer
  const appState = {
    shows: [],         // raw shows from API
    filtered: [],      // shows after filter/search
    genres: new Set(),
    selectedShow: null,
    selectedSeats: new Set(), // seat IDs
    occupiedSeatsMap: {},     // showId -> Set of occupied seat indexes
  };

  // ----- DOM Refs -----
  const grid = document.getElementById('grid');
  const searchEl = document.getElementById('search');
  const genreFilter = document.getElementById('genreFilter');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnDeploy = document.getElementById('btn-deploy');

  const modal = document.getElementById('modal');
  const closeModal = document.getElementById('closeModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMeta = document.getElementById('modalMeta');
  const modalSummary = document.getElementById('modalSummary');
  const trailerFrame = document.getElementById('trailerFrame');
  const seatsGrid = document.getElementById('seatsGrid');
  const selectedCount = document.getElementById('selectedCount');
  const confirmBookingBtn = document.getElementById('confirmBooking');
  const bookList = document.getElementById('bookList');

  // ---------- Utilities ----------
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  function shortText(htmlString, max=140){
    if(!htmlString) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlString;
    const text = tmp.textContent || tmp.innerText || '';
    return text.length > max ? text.slice(0, max-1) + '…' : text;
  }

  function saveBookingsToStorage(){
    localStorage.setItem('uc_bookings_v1', JSON.stringify({
      occupiedSeatsMap: Object.fromEntries(
        Object.entries(appState.occupiedSeatsMap).map(([k,s])=>[k,Array.from(s)])
      ),
      bookings: JSON.parse(localStorage.getItem('uc_my_bookings_v1') || '[]')
    }));
  }

  function loadOccupiedFromStorage(){
    const raw = localStorage.getItem('uc_bookings_v1');
    if(!raw) return;
    try{
      const obj = JSON.parse(raw);
      if(obj.occupiedSeatsMap){
        appState.occupiedSeatsMap = Object.fromEntries(Object.entries(obj.occupiedSeatsMap).map(([k,arr])=>[k,new Set(arr)]));
      }
    }catch(e){ console.warn('could not parse storage', e) }
  }

  function loadMyBookings(){
    const raw = localStorage.getItem('uc_my_bookings_v1');
    return JSON.parse(raw || '[]');
  }

  function saveMyBookings(list){
    localStorage.setItem('uc_my_bookings_v1', JSON.stringify(list));
    // also save occupied map
    saveBookingsToStorage();
  }

  // ---------- Rendering ----------
  function setGrid(shows){
    grid.innerHTML = shows.map(show=>{
      const img = show.image?.medium || '';
      const genres = (show.genres || []).join(', ');
      return `
      <article class="card" data-id="${show.id}">
        <div class="poster">
          ${ img ? `<img src="${img}" alt="${escapeHtml(show.name)} poster">` : `<div style="padding:8px;color:var(--muted);font-size:12px">No Image</div>`}
        </div>
        <div class="info">
          <h3 class="title">${escapeHtml(show.name)}</h3>
          <div class="meta">${escapeHtml(genres)} • ${escapeHtml(String(show.rating?.average || 'N/A'))}</div>
          <div class="summary">${escapeHtml(shortText(show.summary, 120))}</div>
          <div class="actions">
            <button class="link btn-details" data-id="${show.id}">Details & Trailer</button>
            <button class="link btn-book" data-id="${show.id}">Reserve</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function escapeHtml(s){
    if(!s) return '';
    return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }

  function renderGenreOptions(){
    // build options from appState.genres
    const arr = Array.from(appState.genres).sort();
    const html = ['<option value="all">All genres</option>', ...arr.map(g=>`<option value="${g}">${g}</option>`)].join('');
    genreFilter.innerHTML = html;
  }

  function renderBookings(){
    const arr = loadMyBookings();
    if(arr.length === 0){
      bookList.innerHTML = `<div class="empty">No bookings yet — select a movie and reserve seats.</div>`;
      return;
    }
    bookList.innerHTML = arr.map(b=>{
      return `<div class="book-item">
        <div style="font-weight:600">${escapeHtml(b.title)}</div>
        <div style="color:var(--muted);font-size:13px">Seats: ${b.seats.join(', ')} • Date: ${b.date}</div>
      </div>`;
    }).join('');
  }

  // ---------- Seat Helpers ----------
  function getSeatId(row, col){ return `${row}-${col}`; }
  function seatIndexFromId(id){ // returns index 0..63 (8x8)
    const [r,c] = id.split('-').map(Number);
    return (r*8) + c;
  }

  function openModalWithShow(show){
    appState.selectedShow = show;
    appState.selectedSeats.clear();
    selectedCount.textContent = '0';
    modalTitle.textContent = show.name;
    modalMeta.textContent = `${(show.genres || []).join(', ')} • Runtime: ${show.runtime || 'N/A'} min`;
    modalSummary.textContent = shortText(show.summary || 'No description available', 100);

    // Trailer logic: TVMaze doesn't provide trailer URL. We'll attempt to use 'externals.imdb' id if available to build a YouTube search fallback.
    // For demo we use the defaultTrailer or if the show has 'officialSite' use it as fallback.
    let trailer = defaultTrailer;
    // Simple heuristic: If show.officialSite contains youtube or video -> try it (rare); else fallback.
    if(show.officialSite && show.officialSite.includes('youtube')) trailer = show.officialSite;
    trailerFrame.src = trailer;

    // Render seats
    renderSeatsForShow(show.id);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  }

  function renderSeatsForShow(showId){
    seatsGrid.innerHTML = '';
    // retrieve occupied set for this show (persisted across bookings)
    if(!appState.occupiedSeatsMap[showId]) appState.occupiedSeatsMap[showId] = new Set();

    const occupied = appState.occupiedSeatsMap[showId];
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const seat = document.createElement('div');
        const id = getSeatId(r,c);
        seat.className = 'seat';
        seat.dataset.seatId = id;
        seat.setAttribute('role','button');
        seat.setAttribute('aria-pressed','false');
        seat.textContent = `${String.fromCharCode(65 + r)}${c+1}`;
        // if occupied
        const idx = seatIndexFromId(id);
        if(occupied.has(String(idx))){
          seat.classList.add('occupied');
          seat.setAttribute('aria-disabled','true');
        } else {
          // click handler will be added via delegated listener
        }
        seatsGrid.appendChild(seat);
      }
    }
    updateSelectedCount();
  }

  function updateSelectedCount(){
    selectedCount.textContent = String(appState.selectedSeats.size);
  }

  // ---------- Event Listeners (distinct types) ----------
  // 1) click - delegated for details, reserve, seat actions, confirm, close
  document.addEventListener('click', (e) => {
    const detailBtn = e.target.closest('.btn-details');
    if(detailBtn){
      const id = detailBtn.dataset.id;
      const show = appState.shows.find(s => String(s.id) === String(id));
      if(show) openModalWithShow(show);
      return;
    }

    const reserveBtn = e.target.closest('.btn-book');
    if(reserveBtn){
      const id = reserveBtn.dataset.id;
      const show = appState.shows.find(s => String(s.id) === String(id));
      if(show) openModalWithShow(show);
      return;
    }

    if(e.target.closest('#closeModal')){
      closeModalHandler();
      return;
    }

    if(e.target.closest('.seat')){
      const seatEl = e.target.closest('.seat');
      if(seatEl.classList.contains('occupied')) return; // cannot select
      const seatId = seatEl.dataset.seatId;
      if(appState.selectedSeats.has(seatId)){
        appState.selectedSeats.delete(seatId);
        seatEl.classList.remove('selected');
        seatEl.setAttribute('aria-pressed','false');
      } else {
        appState.selectedSeats.add(seatId);
        seatEl.classList.add('selected');
        seatEl.setAttribute('aria-pressed','true');
      }
      updateSelectedCount();
      return;
    }

    if(e.target.closest('#confirmBooking')){
      handleConfirmBooking();
      return;
    }

    if(e.target.closest('#btn-refresh')){
      loadAndRenderShows();
      return;
    }

    if(e.target.closest('#btn-deploy')){
      showDeployInstructions();
      return;
    }
  });

  // 2) input - search box (filters the grid on input)
  searchEl.addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    // use array.filter to produce filtered list
    appState.filtered = appState.shows.filter(show => show.name.toLowerCase().includes(q));
    // also apply genre filter if active
    const genre = genreFilter.value;
    if(genre && genre !== 'all'){
      appState.filtered = appState.filtered.filter(s => (s.genres || []).includes(genre));
    }
    setGrid(appState.filtered);
  });

  // 3) change - genre filter change (select)
  genreFilter.addEventListener('change', (ev) => {
    const genre = ev.target.value;
    const q = searchEl.value.trim().toLowerCase();
    if(genre === 'all'){
      appState.filtered = appState.shows.filter(s => s.name.toLowerCase().includes(q));
    } else {
      appState.filtered = appState.shows.filter(s => s.name.toLowerCase().includes(q) && (s.genres || []).includes(genre));
    }
    setGrid(appState.filtered);
  });

  // keyboard: Esc to close modal (extra nicety)
  window.addEventListener('keydown', (ev)=>{
    if(ev.key === 'Escape' && modal.classList.contains('open')){
      closeModalHandler();
    }
  });

  function closeModalHandler(){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    trailerFrame.src = '';
    appState.selectedSeats.clear();
  }

  // ---------- Booking flow ----------
  function handleConfirmBooking(){
    if(!appState.selectedShow) return alert('Select a show first.');
    if(appState.selectedSeats.size === 0) return alert('Please select seats before booking.');

    const showId = String(appState.selectedShow.id);
    // mark occupied seats in map persistently
    if(!appState.occupiedSeatsMap[showId]) appState.occupiedSeatsMap[showId] = new Set();
    const occupied = appState.occupiedSeatsMap[showId];

    // convert seat ids into human readable labels array
    const seatsArr = Array.from(appState.selectedSeats).map(sid=>{
      const [r,c] = sid.split('-').map(Number);
      return `${String.fromCharCode(65+r)}${c+1}`;
    });

    // mark occupied indexes
    appState.selectedSeats.forEach(sid => occupied.add(String(seatIndexFromId(sid))));

    // persist booking record to localStorage 'uc_my_bookings_v1'
    const bookings = loadMyBookings();
    bookings.unshift({
      id: Date.now(),
      showId,
      title: appState.selectedShow.name,
      seats: seatsArr,
      date: new Date().toLocaleString()
    });
    saveMyBookings(bookings);
    // persist occupied map
    saveBookingsToStorage();

    // confirmation UI
    alert(`Success — booked ${seatsArr.length} seat(s) for ${appState.selectedShow.name}.`);
    closeModalHandler();
    renderBookings();
  }

  // ---------- Data Loading ----------
  async function loadAndRenderShows(){
    try{
      grid.innerHTML = `<div style="color:var(--muted);font-size:14px">Loading shows…</div>`;
      const resp = await fetch(API);
      if(!resp.ok) throw new Error('Failed to fetch API');
      const data = await resp.json();

      // Use array methods to take first N and map into minimal show object
      appState.shows = data.slice(0, MAX_SHOWS).map(s => ({
        id: s.id,
        name: s.name,
        summary: s.summary,
        genres: s.genres || [],
        image: s.image,
        runtime: s.runtime,
        rating: s.rating,
        officialSite: s.officialSite || ''
      }));

      // compute genres set
      appState.genres = new Set();
      appState.shows.forEach(s => (s.genres || []).forEach(g => appState.genres.add(g)));

      // initial filtered copy
      appState.filtered = [...appState.shows];

      // render
      setGrid(appState.filtered);
      renderGenreOptions();
      renderBookings();
    }catch(err){
      console.error(err);
      grid.innerHTML = `<div style="color:var(--muted);font-size:14px">Could not load shows. Try refresh.</div>`;
    }
  }

  // ---------- Small UI Helpers ----------
  function showDeployInstructions(){
    const msg = `Deploy options:
1) Create a GitHub repo and push index.html.
2) Use Netlify: drag & drop your repo build or just the index.html in Netlify's site deploy.
3) Use Vercel: import from GitHub and deploy.
(See README for full steps.)`;
    alert(msg);
  }

  // ---------- Init ----------
  (function init(){
    loadOccupiedFromStorage();
    renderBookings();
    loadAndRenderShows();
  })();
