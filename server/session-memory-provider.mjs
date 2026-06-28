/**
 * Abstract session memory provider with Firebase and in-memory implementations
 * Stores active sessions + recent game results, automatically cleans up old results
 */

/**
 * Creates a session memory provider
 * @param {string} type - 'memory' or 'firebase'
 * @param {object} options - Provider-specific options
 * @returns {object} Provider instance with read/write methods
 */
export function createSessionMemoryProvider(type = 'memory', options = {}) {
  if (type === 'firebase') {
    return createFirebaseProvider(options);
  }
  return createInMemoryProvider(options);
}

/**
 * In-memory provider - stores only active sessions and recent results
 */
function createInMemoryProvider(options = {}) {
  const store = {
    sessions: {},
  };

  // Cleanup interval (default 5 minutes to check for expired sessions)
  const cleanupIntervalMs = options.cleanupIntervalMs ?? 5 * 60 * 1000;
  // Keep finished sessions for this duration before cleanup (default 1 hour)
  const resultsRetentionMs = options.resultsRetentionMs ?? 60 * 60 * 1000;
  let cleanupInterval = null;

  function shouldKeepSession(session) {
    // Always keep lobby and running sessions
    if (session.status === 'lobby' || session.status === 'running') {
      return true;
    }

    // Keep finished/cancelled sessions only if results are still fresh
    if (session.status === 'finished' || session.status === 'cancelled') {
      const now = Date.now();
      const endTime = session.endAt ?? session.updatedAt ?? 0;
      const ageMs = now - endTime;
      return ageMs < resultsRetentionMs;
    }

    return false;
  }

  async function initialize() {
   
    // Start cleanup interval
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = setInterval(() => {
      const before = Object.keys(store.sessions).length;
      Object.entries(store.sessions).forEach(([sessionId, session]) => {
        if (!shouldKeepSession(session)) {
          delete store.sessions[sessionId];
        }
      });
      const after = Object.keys(store.sessions).length;
      if (before !== after) {
      }
    }, cleanupIntervalMs);
  }

  async function read() {
    // Clean up inactive sessions before returning
    Object.entries(store.sessions).forEach(([sessionId, session]) => {
      if (!shouldKeepSession(session)) {
        delete store.sessions[sessionId];
      }
    });

    return {
      sessions: { ...store.sessions },
    };
  }

  async function write(data) {
    const sessions = data?.sessions && typeof data.sessions === 'object' ? data.sessions : {};

    // Only store active sessions
    Object.entries(sessions).forEach(([sessionId, session]) => {
      if (shouldKeepSession(session)) {
        store.sessions[sessionId] = session;
      } else {
        delete store.sessions[sessionId];
      }
    });
  }

  function destroy() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }

  return {
    initialize,
    read,
    write,
    destroy,
  };
}

/**
 * Firebase provider - wraps existing Firebase functions
 */
function createFirebaseProvider(options = {}) {
  let firebaseModule = null;

  async function initialize() {
    try {
      firebaseModule = await import('./firebase.mjs');
      await firebaseModule.initializeFirebaseStore();
    } catch (error) {
      throw new Error(`Failed to initialize Firebase: ${error.message}`);
    }
  }

  async function read() {
    if (!firebaseModule) {
      throw new Error('Firebase provider not initialized');
    }
    return firebaseModule.readStoreFromFirebase();
  }

  async function write(data) {
    if (!firebaseModule) {
      throw new Error('Firebase provider not initialized');
    }
    return firebaseModule.writeStoreToFirebase(data);
  }

  function destroy() {
    // No cleanup needed for Firebase
  }

  return {
    initialize,
    read,
    write,
    destroy,
  };
}
