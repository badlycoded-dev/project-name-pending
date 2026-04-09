const useHttps = process.env.REACT_APP_USE_HTTPS === 'true';

const config = {
  // Base API URL — picks HTTPS variant when USE_HTTPS=true
  API_URL: useHttps
    ? (process.env.REACT_APP_API_URL_S || 'https://localhost:4043/api')
    : (process.env.REACT_APP_API_URL   || 'http://localhost:4040/api'),

  // RTC signaling URL
  RTC_URL: useHttps
    ? (process.env.REACT_APP_RTC_URL_S || 'https://localhost:5051')
    : (process.env.REACT_APP_RTC_URL   || 'http://localhost:5050'),

  // WebRTC test backend
  WEBRTC_URL: process.env.REACT_APP_WEBRTC_URL || 'http://localhost:5001',
};

export default config;