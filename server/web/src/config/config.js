const useHttps = process.env.REACT_APP_USE_HTTPS === 'true';

const config = {
  BASE_URL: useHttps
    ? (process.env.REACT_APP_API_URL_S || 'https://localhost:4043/api')
    : (process.env.REACT_APP_API_URL   || 'http://localhost:4040/api'),
  SECRET: 'Z3H@u8E#375Q[hKxAprDFGmERb05',
};

export default config;