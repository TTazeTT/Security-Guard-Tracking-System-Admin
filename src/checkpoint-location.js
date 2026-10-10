import {beginLoading} from './feedback';
import L from 'leaflet';

export function setupCheckpointLocation(el, {point, center, tile}) {
  const find = selector => el.querySelector(selector);
  const lat = find('#cp-lat'), lng = find('#cp-lng'), radius = find('#cp-radius');
  const button = find('#cp-locate'), status = find('#cp-location-status');
  const initial = point || center || {lat: 14.5995, lng: 120.9842};
  const picker = L.map(find('#cp-map'), {
    zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
    scrollWheelZoom: false,
  }).setView(initial, 18);
  tile(picker);
  const marker = L.marker(initial, {
    draggable: true, autoPan: true,
    title: 'Drag to set the checkpoint location',
    icon: L.divIcon({
      className: 'checkpoint-location-arrow', iconSize: [44, 44], iconAnchor: [22, 22],
      html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-6.5 18-3.6-7.9L3 9.5Z"/></svg>',
    }),
  }).addTo(picker);
  marker.getElement().setAttribute('aria-label', 'Checkpoint location arrow. Drag to move, or enter coordinates below.');
  const circle = L.circle(initial, {
    radius: Number(radius.value), color: '#eb7944', fillOpacity: 0.12, weight: 2,
    interactive: false,
  }).addTo(picker);
  let requestVersion = 0, finishLoading;

  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }
  function stopWaiting() {
    finishLoading?.();
    finishLoading = null;
    requestVersion++;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
  function selectPoint(location, recenter = false) {
    // Normalize longitude after panning across the international date line.
    const selected = L.latLng(location).wrap();
    lat.value = selected.lat.toFixed(6);
    lng.value = selected.lng.toFixed(6);
    marker.setLatLng(selected);
    circle.setLatLng(selected);
    if (recenter) picker.setView(selected, 18);
  }
  function manualSelection(location) {
    stopWaiting();
    selectPoint(location);
    message('Checkpoint location selected. Drag the arrow to adjust it.');
  }
  // A starter arrow is visible, but coordinates stay required until selected.
  if (point) selectPoint(point);
  marker.on('dragstart', stopWaiting);
  marker.on('drag', () => selectPoint(marker.getLatLng()));
  marker.on('dragend', () => manualSelection(marker.getLatLng()));
  picker.on('click', event => manualSelection(event.latlng));
  for (const input of [lat, lng]) input.addEventListener('input', () => {
    stopWaiting();
    message('');
    if (lat.value && lng.value && lat.validity.valid && lng.validity.valid) {
      const location = L.latLng(Number(lat.value), Number(lng.value));
      marker.setLatLng(location);
      circle.setLatLng(location);
      picker.panTo(location);
    }
  });
  radius.addEventListener('input', () => {
    if (radius.value && radius.validity.valid) circle.setRadius(Number(radius.value));
  });
  button.onclick = () => {
    if (!window.isSecureContext) {
      message('Location access requires HTTPS. Open the secure website, or select a location on the map.', true);
      return;
    }
    if (!navigator.geolocation) {
      message('This browser does not support location access. Select a location on the map or enter coordinates.', true);
      return;
    }
    stopWaiting();
    finishLoading = beginLoading('Finding your location…');
    const version = ++requestVersion;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    message('Finding your location… Turn on location services and choose Allow if prompted.');
    const current = () => el.isConnected && version === requestVersion;
    const fail = error => {
      if (!current()) return;
      stopWaiting();
      const errors = {
        1: 'Location access is blocked. Allow location for this site in your browser settings and turn on device location services, then try again.',
        2: 'Your location is unavailable. Turn on device location services and try again, preferably outdoors.',
        3: 'Finding your location timed out. Check that location services are on, then try again.',
      };
      message((errors[error.code] || 'Could not get your location. Please try again.') + ' You can also drag the arrow or enter coordinates.', true);
    };
    try {
      navigator.geolocation.getCurrentPosition(position => {
        if (!current()) return;
        stopWaiting();
        selectPoint({lat: position.coords.latitude, lng: position.coords.longitude}, true);
        message(`Current location selected (accuracy ±${Math.round(position.coords.accuracy)} m). Drag the arrow to fine-tune the checkpoint.`);
      }, fail, {enableHighAccuracy: true, timeout: 15000, maximumAge: 0});
    } catch (error) {
      fail(error);
    }
  };
  const observer = new MutationObserver(() => {
    if (!el.isConnected) {
      stopWaiting();
      picker.remove();
      observer.disconnect();
    }
  });
  observer.observe(document.body, {childList: true});
}
