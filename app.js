// Fetch movies from db.json
async function fetchMovies() {
  const res = await fetch("db.json");
  const data = await res.json();
  return data.movies;
}

// Render movies
function renderMovies(movies) {
  const list = document.getElementById("movie-list");
  list.innerHTML = "";

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.className = "movie-card";

    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <h2>${movie.title}</h2>
      <p>${movie.genre} | ${movie.showtime}</p>
      <p>${movie.description}</p>
      <p>Tickets Available: <span id="tickets-${movie.id}">${movie.availableTickets}</span></p>
      <button onclick="playTrailer('${movie.trailer}')">Watch Trailer</button>
      <button onclick="bookTicket(${movie.id})">Book Ticket</button>
    `;

    list.appendChild(card);
  });
}

// Trailer
function playTrailer(url) {
  const modal = document.getElementById("trailerModal");
  const frame = document.getElementById("trailerFrame");
  frame.src = url;
  modal.style.display = "flex";

  document.getElementById("closeModal").onclick = () => {
    frame.src = "";
    modal.style.display = "none";
  };
}

// Booking
async function bookTicket(id) {
  let movies = await fetchMovies();
  let movie = movies.find(m => m.id === id);

  if (movie.availableTickets > 0) {
    movie.availableTickets--;

    // Update UI
    document.getElementById(`tickets-${id}`).innerText = movie.availableTickets;

    // Show confirmation
    const confirmBox = document.getElementById("confirmation");
    confirmBox.textContent = `✅ Ticket booked for ${movie.title}!`;
    confirmBox.classList.remove("hidden");

    setTimeout(() => confirmBox.classList.add("hidden"), 3000);
  } else {
    alert("Sorry, no tickets left!");
  }
}

// Search + Filter
async function setupFilters() {
  const search = document.getElementById("search");
  const filter = document.getElementById("filter");
  let movies = await fetchMovies();

  function update() {
    let term = search.value.toLowerCase();
    let genre = filter.value;

    let filtered = movies.filter(m =>
      m.title.toLowerCase().includes(term) &&
      (genre === "all" || m.genre === genre)
    );

    renderMovies(filtered);
  }

  search.addEventListener("input", update);
  filter.addEventListener("change", update);

  renderMovies(movies);
}

// Init
setupFilters();
