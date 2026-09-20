import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  region: MapRegion;
  markers?: MapMarker[];
  driverMarkers?: MapMarker[];
  polyline?: { lat: number; lng: number }[];
  polylineDashed?: boolean;
  style?: ViewStyle;
};

// Free, no-API-key map: OpenStreetMap tiles rendered by Leaflet inside a
// WebView, in place of react-native-maps (which needs a billed Google
// Maps Platform project on Android). react-native-webview's postMessage
// bridge drives marker/polyline updates without reloading the page (which
// would reset pan/zoom).
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #0B1F3A; }
    .driver-pin {
      width: 26px; height: 26px; border-radius: 13px; background: #2FD675;
      border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
    .pin-dot {
      width: 18px; height: 18px; border-radius: 9px; border: 3px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([41.6367, 25.3773], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    var pinMarkers = {};
    var driverMarkers = {};
    var driverAnim = {};
    var polylineLayer = null;
    var hasCentered = false;

    function driverIcon() {
      return L.divIcon({ className: '', html: '<div class="driver-pin"></div>', iconSize: [26, 26], iconAnchor: [13, 13] });
    }
    function pinIcon(color) {
      return L.divIcon({ className: '', html: '<div class="pin-dot" style="background:' + color + '"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    }

    function setRegion(lat, lng, latDelta) {
      var zoom = Math.round(Math.log2(360 / Math.max(latDelta, 0.001)));
      if (!hasCentered) {
        map.setView([lat, lng], Math.max(11, Math.min(zoom, 17)));
        hasCentered = true;
      }
    }

    function setPins(list) {
      var seen = {};
      list.forEach(function (m) {
        seen[m.id] = true;
        if (pinMarkers[m.id]) {
          pinMarkers[m.id].setLatLng([m.lat, m.lng]);
        } else {
          pinMarkers[m.id] = L.marker([m.lat, m.lng], { icon: pinIcon(m.color || '#2FD675') }).addTo(map);
        }
      });
      Object.keys(pinMarkers).forEach(function (id) {
        if (!seen[id]) { map.removeLayer(pinMarkers[id]); delete pinMarkers[id]; }
      });
    }

    function animateDriver(id) {
      var state = driverAnim[id];
      var marker = driverMarkers[id];
      if (!state || !marker) return;
      var t = Math.min(1, (Date.now() - state.startedAt) / 1000);
      marker.setLatLng([
        state.fromLat + (state.toLat - state.fromLat) * t,
        state.fromLng + (state.toLng - state.fromLng) * t,
      ]);
      if (t < 1) requestAnimationFrame(function () { animateDriver(id); });
    }

    function setDrivers(list) {
      var seen = {};
      list.forEach(function (m) {
        seen[m.id] = true;
        if (driverMarkers[m.id]) {
          var current = driverMarkers[m.id].getLatLng();
          driverAnim[m.id] = { fromLat: current.lat, fromLng: current.lng, toLat: m.lat, toLng: m.lng, startedAt: Date.now() };
          animateDriver(m.id);
        } else {
          driverMarkers[m.id] = L.marker([m.lat, m.lng], { icon: driverIcon() }).addTo(map);
        }
      });
      Object.keys(driverMarkers).forEach(function (id) {
        if (!seen[id]) { map.removeLayer(driverMarkers[id]); delete driverMarkers[id]; delete driverAnim[id]; }
      });
    }

    function setPolyline(points, dashed) {
      if (polylineLayer) { map.removeLayer(polylineLayer); polylineLayer = null; }
      if (!points || points.length < 2) return;
      polylineLayer = L.polyline(points.map(function (p) { return [p.lat, p.lng]; }), {
        color: dashed ? '#9FB0C9' : '#2FD675',
        weight: dashed ? 2 : 4,
        dashArray: dashed ? '6 6' : null,
      }).addTo(map);
    }

    function onMessage(event) {
      var data = JSON.parse(event.data);
      if (data.type === 'region') setRegion(data.latitude, data.longitude, data.latitudeDelta);
      if (data.type === 'pins') setPins(data.markers);
      if (data.type === 'drivers') setDrivers(data.markers);
      if (data.type === 'polyline') setPolyline(data.points, data.dashed);
    }
    document.addEventListener('message', onMessage);
    window.addEventListener('message', onMessage);
  </script>
</body>
</html>`;

export function LeafletMap({ region, markers = [], driverMarkers = [], polyline = [], polylineDashed, style }: Props) {
  const webviewRef = useRef<WebView>(null);

  function post(message: Record<string, unknown>) {
    webviewRef.current?.postMessage(JSON.stringify(message));
  }

  function syncAll() {
    post({ type: 'region', ...region });
    post({ type: 'pins', markers });
    post({ type: 'drivers', markers: driverMarkers });
    post({ type: 'polyline', points: polyline, dashed: !!polylineDashed });
  }

  useEffect(() => {
    post({ type: 'region', ...region });
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  useEffect(() => {
    post({ type: 'pins', markers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers)]);

  useEffect(() => {
    post({ type: 'drivers', markers: driverMarkers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(driverMarkers)]);

  useEffect(() => {
    post({ type: 'polyline', points: polyline, dashed: !!polylineDashed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(polyline), polylineDashed]);

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html: HTML }}
      style={[styles.flex, style]}
      onMessage={() => undefined}
      onLoadEnd={syncAll}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
