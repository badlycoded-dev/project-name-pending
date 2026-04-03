/**
 * HTTPS Client Configuration Module
 * 
 * Provides utilities for making HTTPS requests that properly handle
 * certificate validation in both development and production environments.
 * 
 * SECURITY WARNING: 
 * - Development mode bypasses certificate validation (localhost only)
 * - Production MUST use verified certificates
 * 
 * @module httpsClient
 */

const https = require('https');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const logger = console; // Replace with proper logger if available

/**
 * Enum for client types
 */
const ClientType = {
  INSECURE: 'insecure',   // ⚠️ Development only - ignores certificates
  SECURE: 'secure',       // Production - validates certificates
  AUTO: 'auto',           // Smart detection - secure for production, insecure for localhost dev
};

/**
 * Create Axios instance that ignores self-signed certificates
 * 
 * USE ONLY IN DEVELOPMENT with self-signed certificates.
 * NEVER use in production - this is a security risk.
 * 
 * @param {string} baseURL - The base URL for the client
 * @param {object} options - Additional axios options
 * @returns {object} Axios instance with certificate validation disabled
 */
function createInsecureClient(baseURL = '', options = {}) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('❌ SECURITY: Attempted to create insecure client in production!');
    throw new Error('Insecure client not allowed in production');
  }

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  return axios.create({
    baseURL,
    httpsAgent,
    timeout: process.env.AXIOS_TIMEOUT || 10000,
    validateStatus: (status) => status < 500, // Don't throw on 4xx
    ...options,
  });
}

/**
 * Create Axios instance with proper certificate validation
 * 
 * For production use with real TLS certificates.
 * Optionally provide custom CA certificate file.
 * 
 * @param {string} baseURL - The base URL for the client
 * @param {object} options - Additional axios options
 * @returns {object} Axios instance with certificate validation enabled
 */
function createSecureClient(baseURL = '', options = {}) {
  const client = {
    baseURL,
    timeout: process.env.AXIOS_TIMEOUT || 10000,
    validateStatus: (status) => status < 500,
    ...options,
  };

  // Use custom CA certificate if provided
  if (process.env.CA_CERT_PATH) {
    try {
      const caPath = path.resolve(process.env.CA_CERT_PATH);
      if (!fs.existsSync(caPath)) {
        logger.warn(`CA certificate not found: ${caPath}`);
      } else {
        const ca = fs.readFileSync(caPath);
        client.httpsAgent = new https.Agent({ ca });
        logger.info(`Using custom CA certificate: ${caPath}`);
      }
    } catch (err) {
      logger.error('Failed to load CA certificate', err);
    }
  }

  return axios.create(client);
}

/**
 * Intelligently create client based on environment and URL
 * 
 * Rules:
 * - Production: Always use secure client (real certificates)
 * - Development + localhost: Use insecure client (self-signed OK)
 * - Development + public domain: Use secure client
 * 
 * @param {string} baseURL - The base URL for the client
 * @param {string} clientType - 'auto', 'secure', or 'insecure'
 * @param {object} options - Additional axios options
 * @returns {object} Axios instance
 */
function createClient(baseURL = '', clientType = ClientType.AUTO, options = {}) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isLocalhost = baseURL.includes('localhost') || 
                      baseURL.includes('127.0.0.1') || 
                      baseURL.includes('docker.local');

  // Explicit client type requested
  if (clientType === ClientType.INSECURE) {
    return createInsecureClient(baseURL, options);
  }
  if (clientType === ClientType.SECURE) {
    return createSecureClient(baseURL, options);
  }

  // Auto-detect based on environment
  if (isDevelopment && isLocalhost) {
    logger.debug(`Using insecure client for development localhost: ${baseURL}`);
    return createInsecureClient(baseURL, options);
  }

  logger.debug(`Using secure client: ${baseURL}`);
  return createSecureClient(baseURL, options);
}

/**
 * Create a client with automatic request/response interceptors for logging
 * 
 * @param {string} baseURL - The base URL for the client
 * @param {string} serviceName - Name of the service (for logging)
 * @returns {object} Axios instance with interceptors
 */
function createClientWithLogging(baseURL = '', serviceName = 'Service') {
  const client = createClient(baseURL);

  // Log requests
  client.interceptors.request.use(
    (config) => {
      logger.debug(`[${serviceName}] ${config.method.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      logger.error(`[${serviceName}] Request failed`, error.message);
      return Promise.reject(error);
    },
  );

  // Log responses
  client.interceptors.response.use(
    (response) => {
      logger.debug(`[${serviceName}] ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      if (error.response) {
        logger.error(`[${serviceName}] ${error.response.status} ${error.config.url}`);
      } else {
        logger.error(`[${serviceName}] ${error.message}`);
      }
      return Promise.reject(error);
    },
  );

  return client;
}

/**
 * Set up global HTTPS agent configuration
 * 
 * Call this once in your application startup
 */
function configureGlobal() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const ignoreErrors = process.env.IGNORE_CERT_ERRORS === 'true';

  if (isDevelopment && ignoreErrors) {
    // Development mode: allow self-signed certificates
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    logger.warn('⚠️  TLS certificate validation DISABLED - development mode only');
  } else {
    // Production mode: enforce certificate validation
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
  }
}

module.exports = {
  ClientType,
  createInsecureClient,
  createSecureClient,
  createClient,
  createClientWithLogging,
  configureGlobal,
};
