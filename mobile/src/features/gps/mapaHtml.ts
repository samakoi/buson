/**
 * Página do mapa (Leaflet + OpenStreetMap), igual no celular (WebView) e no navegador
 * (iframe). O app chama window.atualizar(dados) para desenhar o ônibus e as paradas.
 * Mapa gratuito, sem chave: respeite a política de uso dos tiles do OpenStreetMap
 * (atribuição e uso moderado); para muito tráfego, troque EXPO_PUBLIC_MAPA_TILES.
 */

export type TipoMarcador = "ONIBUS" | "PONTO" | "INSTITUICAO" | "DESTINO";

export interface MarcadorMapa {
  id: string;
  latitude: number;
  longitude: number;
  rotulo: string;
  tipo: TipoMarcador;
}

export interface DadosMapa {
  marcadores: MarcadorMapa[];
  /** Trajeto percorrido [latitude, longitude] */
  trajeto?: [number, number][];
  /** Reenquadra o mapa (senão só no primeiro desenho, para não brigar com o zoom do usuário) */
  ajustar?: boolean;
}

const TILES = process.env.EXPO_PUBLIC_MAPA_TILES ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
// Centro de Imperatriz-MA enquanto não há posição
const CENTRO = [-5.5263, -47.4777];

export function mapaHtml() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#m{margin:0;height:100%;background:#E8EEF5;font-family:system-ui,sans-serif}
  .onibus{width:38px;height:38px;border-radius:19px;background:#1E5AA8;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:20px}
  .parada{width:16px;height:16px;border-radius:8px;border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)}
  .PONTO{background:#137047}.INSTITUICAO{background:#0D2F52}.DESTINO{background:#E07B00;width:22px;height:22px;border-radius:11px}
  .leaflet-tooltip{font-weight:600}
</style></head>
<body><div id="m"></div>
<script>
  var mapa = L.map('m', { zoomControl: true }).setView(${JSON.stringify(CENTRO)}, 13);
  L.tileLayer(${JSON.stringify(TILES)}, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mapa);
  var camada = L.layerGroup().addTo(mapa);
  var ajustado = false;
  function icone(tipo) {
    if (tipo === 'ONIBUS') return L.divIcon({ className: '', html: '<div class="onibus">🚌</div>', iconSize: [38, 38], iconAnchor: [19, 19] });
    var t = tipo === 'DESTINO' ? 22 : 16;
    return L.divIcon({ className: '', html: '<div class="parada ' + tipo + '"></div>', iconSize: [t, t], iconAnchor: [t / 2, t / 2] });
  }
  window.atualizar = function (d) {
    camada.clearLayers();
    var limites = [];
    if (d.trajeto && d.trajeto.length > 1) {
      L.polyline(d.trajeto, { color: '#1E5AA8', weight: 5, opacity: 0.7 }).addTo(camada);
      d.trajeto.forEach(function (p) { limites.push(p); });
    }
    (d.marcadores || []).forEach(function (m) {
      var mk = L.marker([m.latitude, m.longitude], { icon: icone(m.tipo), zIndexOffset: m.tipo === 'ONIBUS' ? 1000 : 0 }).addTo(camada);
      mk.bindTooltip(m.rotulo, { direction: 'top', offset: [0, m.tipo === 'ONIBUS' ? -18 : -8], permanent: m.tipo === 'ONIBUS' || m.tipo === 'DESTINO' });
      limites.push([m.latitude, m.longitude]);
    });
    if ((!ajustado || d.ajustar) && limites.length) {
      if (limites.length === 1) mapa.setView(limites[0], 16);
      else mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 16 });
      ajustado = true;
    }
  };
</script></body></html>`;
}
