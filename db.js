const DB_NAME = 'AuraWriteDB';
const DB_VERSION = 2;
const STORE_NAME = 'entries';

let dbInstance = null;

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      let store;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      } else {
        store = request.transaction.objectStore(STORE_NAME);
      }

      // Upgrade/Create indexes
      if (!store.indexNames.contains('date')) {
        store.createIndex('date', 'date', { unique: false });
      }
      if (!store.indexNames.contains('category')) {
        store.createIndex('category', 'category', { unique: false });
      }
      if (!store.indexNames.contains('moods')) {
        store.createIndex('moods', 'moods', { unique: false, multiEntry: true });
      }
      if (!store.indexNames.contains('tags')) {
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      }
      if (store.indexNames.contains('mood')) {
        store.deleteIndex('mood');
      }
    };
  });
}

/**
 * Helper to perform database transactions.
 * @param {string} mode - 'readonly' or 'readwrite'
 * @returns {Promise<{store: IDBObjectStore, transaction: IDBTransaction}>}
 */
async function getStore(mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, mode);
  const store = transaction.objectStore(STORE_NAME);
  return { store, transaction };
}

/**
 * Gets all entries sorted by date descending.
 * @returns {Promise<Array>}
 */
export async function getAllEntries() {
  const { store } = await getStore('readonly');
  
  return new Promise((resolve, reject) => {
    // Retrieve using the date index
    const index = store.index('date');
    const request = index.openCursor(null, 'prev'); // 'prev' sorts descending (newest first)
    const results = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Gets a single entry by its ID.
 * @param {number} id
 * @returns {Promise<object>}
 */
export async function getEntry(id) {
  const { store } = await getStore('readonly');
  
  return new Promise((resolve, reject) => {
    const request = store.get(Number(id));
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Adds a new entry to the database.
 * @param {object} entry - { title, content, date, moods: [], category, tags: [], imageBlob, audioBlob }
 * @returns {Promise<number>} - Inserted entry ID
 */
export async function addEntry(entry) {
  const { store } = await getStore('readwrite');
  
  return new Promise((resolve, reject) => {
    // Format tags: lowercase, unique, trimmed, remove '#' prefix if present
    const formattedTags = Array.from(new Set(
      (entry.tags || []).map(t => t.trim().toLowerCase().replace(/^[#＃]/, '')).filter(t => t.length > 0)
    ));

    const newEntry = {
      title: entry.title.trim(),
      content: entry.content.trim(),
      date: entry.date, // YYYY-MM-DD
      category: entry.category || '生活隨筆',
      moods: entry.moods || ['happy'],
      location: entry.location || null,
      tags: formattedTags,
      imageBlob: entry.imageBlob || null, // Blob/File data
      imagePath: entry.imagePath || null,
      audioBlob: entry.audioBlob || null, // Blob/File data
      audioPath: entry.audioPath || null,
      audioName: entry.audioName || null,
      synced: entry.synced !== undefined ? entry.synced : true,
      blocks: entry.blocks || [],
      createdAt: entry.createdAt || new Date().toISOString()
    };

    if (entry.id) {
      newEntry.id = Number(entry.id);
    }

    const request = store.add(newEntry);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Updates an existing entry.
 * @param {object} entry - Entry object with `id`
 * @returns {Promise<void>}
 */
export async function updateEntry(entry) {
  const { store } = await getStore('readwrite');
  
  // Fetch existing entry to preserve createdAt
  const existing = await new Promise((resolve) => {
    const req = store.get(Number(entry.id));
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => resolve(null);
  });

  return new Promise((resolve, reject) => {
    const formattedTags = Array.from(new Set(
      (entry.tags || []).map(t => t.trim().toLowerCase().replace(/^[#＃]/, '')).filter(t => t.length > 0)
    ));

    const updatedEntry = {
      id: Number(entry.id),
      title: entry.title.trim(),
      content: entry.content.trim(),
      date: entry.date,
      category: entry.category || '生活隨筆',
      moods: entry.moods || ['happy'],
      location: entry.location || null,
      tags: formattedTags,
      imageBlob: entry.imageBlob || null,
      imagePath: entry.imagePath || null,
      audioBlob: entry.audioBlob || null,
      audioPath: entry.audioPath || null,
      audioName: entry.audioName || null,
      synced: entry.synced !== undefined ? entry.synced : true,
      blocks: entry.blocks || [],
      createdAt: (existing && existing.createdAt) ? existing.createdAt : (entry.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString()
    };

    const request = store.put(updatedEntry);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Deletes an entry by ID.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
  const { store } = await getStore('readwrite');
  
  return new Promise((resolve, reject) => {
    const request = store.delete(Number(id));
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Calculates statistics from all entries.
 * @returns {Promise<{totalCount: number, streak: number, moodStats: object, tags: Array<string>, categoryStats: object}>}
 */
export async function getStats() {
  const entries = await getAllEntries();
  
  // Total Count
  const totalCount = entries.length;

  // Mood counts (including new user moods)
  const moodStats = {};

  // Category counts
  const categoryStats = {};

  // Collect all unique tags
  const tagsSet = new Set();

  // Dates for streak calculation (sorted descending)
  const dates = [];

  entries.forEach(entry => {
    // Multi-mood mapping with backwards compatibility
    const moods = entry.moods || (entry.mood ? [entry.mood] : ['happy']);
    moods.forEach(m => {
      moodStats[m] = (moodStats[m] || 0) + 1;
    });

    // Category aggregation
    const cat = entry.category || '生活隨筆';
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;

    (entry.tags || []).forEach(t => tagsSet.add(t));
    if (entry.date) {
      dates.push(entry.date);
    }
  });

  // Calculate Streak
  let streak = 0;
  if (dates.length > 0) {
    const uniqueDates = Array.from(new Set(dates)).sort((a, b) => new Date(b) - new Date(a));
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
      streak = 1;
      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const curr = new Date(uniqueDates[i]);
        const next = new Date(uniqueDates[i + 1]);
        const diffTime = Math.abs(curr - next);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          streak++;
        } else if (diffDays > 1) {
          break; // Streak broken
        }
      }
    }
  }

  return {
    totalCount,
    streak,
    moodStats,
    categoryStats,
    tags: Array.from(tagsSet).sort()
  };
}
