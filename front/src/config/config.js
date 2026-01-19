const config = {
  api: {
    baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000'
  },
  map: {
    tileServer: process.env.REACT_APP_TILE_SERVER_URL || 'http://localhost:8080/tile/{z}/{x}/{y}.png',
    center: {
      lat: parseFloat(process.env.REACT_APP_MAP_CENTER_LAT) || -18.8792,
      lng: parseFloat(process.env.REACT_APP_MAP_CENTER_LNG) || 47.5079
    },
    zoom: parseInt(process.env.REACT_APP_MAP_ZOOM) || 13,
    maxZoom: 19
  },
  fallbackTileServer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

export default config;
