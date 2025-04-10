const API_KEY = "590413f4a652f2004b01cdfb16051ff8";
const GEOCODE_KEY = "870f1bf84e1b46e3ae40d693407a8ec6";


const globe1 = document.getElementById("globe1");
const globe2 = document.getElementById("globe2");
const coord1El = document.getElementById("coord1");
const coord2El = document.getElementById("coord2");

const dpr = window.devicePixelRatio || 1;
const canvasSize = 400;

globe1.width = canvasSize * dpr;
globe1.height = canvasSize * dpr;
globe2.width = canvasSize * dpr;
globe2.height = canvasSize * dpr;

globe1.style.width = globe2.style.width = "100%";
globe1.style.height = globe2.style.height = "auto";

const ctx1 = globe1.getContext("2d");
const ctx2 = globe2.getContext("2d");

ctx1.scale(dpr, dpr);
ctx2.scale(dpr, dpr);

let rotation = [0, 0];
let rotation2 = [180, 0];
let scale = 180;

let world, selectedCoord = null;

const projection1 = d3.geoOrthographic()
  .scale(scale)
  .translate([canvasSize / 2, canvasSize / 2]);

const projection2 = d3.geoOrthographic()
  .scale(scale)
  .translate([canvasSize / 2, canvasSize / 2]);

const path1 = d3.geoPath(projection1, ctx1);
const path2 = d3.geoPath(projection2, ctx2);

function getAntipode([lon, lat]) {
  let antiLon = (lon + 180) % 360;
  if (antiLon > 180) antiLon -= 360;
  return [antiLon, -lat];
}

function draw(ctx, path, projection, marker) {
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = "#e0f7fa";
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.stroke();

  ctx.beginPath();
  path(world);
  ctx.fillStyle = "#90caf9";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  if (marker) {
    const [x, y] = projection(marker);
    const markerSize = Math.max(3, 800 / scale);
    ctx.beginPath();
    ctx.arc(x, y, markerSize, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
  }
}

function updateGlobes() {
  rotation[1] = Math.max(-89, Math.min(89, rotation[1]));

  projection1.rotate(rotation).scale(scale);
  projection2.rotate(rotation2).scale(scale);

  draw(ctx1, path1, projection1, selectedCoord);
  draw(ctx2, path2, projection2, selectedCoord ? getAntipode(selectedCoord) : null);
}

function setupInput(canvas) {
  let isDragging = false;
  let last = null;
  let dragStart = null;
  let lastTouchDist = null;

  canvas.addEventListener("pointerdown", e => {
    isDragging = true;
    last = [e.clientX, e.clientY];
    dragStart = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", e => {
    if (!isDragging || !last) return;
    const dx = e.clientX - last[0];
    const dy = e.clientY - last[1];
    last = [e.clientX, e.clientY];

    const panSpeedFactor = 90 / scale;
    rotation[0] += dx * panSpeedFactor;
    rotation[1] -= dy * panSpeedFactor;
    rotation[1] = Math.max(-89, Math.min(89, rotation[1]));

    updateGlobes();
  });

  canvas.addEventListener("pointerup", (e) => {
    isDragging = false;
    const moveDist = Math.hypot(e.clientX - dragStart[0], e.clientY - dragStart[1]);

    if (moveDist < 5) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const coord = projection1.invert([
        x / rect.width * canvasSize,
        y / rect.height * canvasSize
      ]);
      if (coord) {
        selectedCoord = coord;
        const antipode = getAntipode(coord);
        rotation2 = [-antipode[0], -antipode[1]];
        updateGlobes();

        const [lon, lat] = selectedCoord.map(n => n.toFixed(4));
        const [alon, alat] = antipode.map(n => n.toFixed(4));
        updateInfoBoxes(lat, lon, coord1El);
        updateInfoBoxes(alat, alon, coord2El);
      }
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const newScale = scale * (e.deltaY < 0 ? 1.1 : 0.9);
    scale = Math.max(80, Math.min(2000, newScale));
    updateGlobes();
  });

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      lastTouchDist = getTouchDistance(e);
    }
  });

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && lastTouchDist) {
      e.preventDefault();
      const newDist = getTouchDistance(e);
      const zoomFactor = newDist / lastTouchDist;

      const newScale = Math.min(2000, Math.max(80, scale * zoomFactor));
      if (Math.abs(newScale - scale) > 0.5) {
        scale = newScale;
        updateGlobes();
      }

      lastTouchDist = newDist;
    }
  });

  canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      lastTouchDist = null;
    }
  });

  function getTouchDistance(e) {
    const [t1, t2] = e.touches;
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

async function fetchWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      return {
        temp: Math.round(data.main.temp),
        description: data.weather[0].description
      };
    } else {
      console.warn("Hava durumu alınamadı:", data.message);
      return null;
    }
  } catch (err) {
    console.error("API hatası:", err);
    return null;
  }
}

async function fetchElevation(lat, lon) {
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && data.results && data.results.length > 0) {
      return Math.round(data.results[0].elevation);
    } else {
      console.warn("Rakım alınamadı");
      return null;
    }
  } catch (err) {
    console.error("Rakım API hatası:", err);
    return null;
  }
}


function updateInfoBoxes(lat, lon, el) {
  el.innerHTML = `
    <span class="coord">Lat: ${lat}, Lon: ${lon}</span>
    <span class="location">📍 Yükleniyor...</span>
    <span class="weather">🌡️ Yükleniyor...</span>
  `;

  fetchLocationName(lat, lon).then(loc => {
    if (loc) {
      el.querySelector(".location").textContent = `📍 ${loc}`;
    }
  });

  fetchWeather(lat, lon).then(data => {
    if (data) {
      el.querySelector(".weather").textContent = `🌡️ ${data.temp}°C, ${data.description}`;
      fetchElevation(lat, lon).then(elev => {
        if (elev !== null) {
          const elevationEl = document.createElement("span");
          elevationEl.className = "elevation";
          elevationEl.textContent = `🗻 ${elev} m`;
          el.appendChild(elevationEl);
        }
      });
    }
  });
}



async function loadWorld() {
  const res = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
  const topo = await res.json();
  world = topojson.feature(topo, topo.objects.countries);
  updateGlobes();
}

setupInput(globe1);
loadWorld();


async function fetchLocationName(lat, lon) {
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${GEOCODE_KEY}&language=tr`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && data.results && data.results.length > 0) {
      const comp = data.results[0].components;

      // Eğer deniz/okyanus varsa onu göster
      if (comp.body_of_water) {
        return comp.body_of_water;
      }

      // Şehir + ülke gösterimi (ilçe atlanır)
      const cityOrRegion = comp.city || comp.state_district || comp.state;
      const country = comp.country;

      if (cityOrRegion && country) return `${cityOrRegion}, ${country}`;
      if (country) return country;

      return "Konum bilinmiyor";
    } else {
      console.warn("Yer adı alınamadı.");
      return null;
    }
  } catch (err) {
    console.error("Geocode API hatası:", err);
    return null;
  }
}


