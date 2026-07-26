import {
  initDB,
  getAllEntries,
  getEntry,
  addEntry,
  updateEntry,
  deleteEntry,
  getStats
} from './db.js?v=3';

// Lucide global library fallback
if (typeof lucide === 'undefined') {
  window.lucide = {
    createIcons: () => console.warn('Lucide icons library not loaded.')
  };
}

// Initialize Supabase Client
const supabase = window.supabase ? window.supabase.createClient(
  'https://cshuvvpxxzhqhhgaprek.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzaHV2dnB4eHpocWhoZ2FwcmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODI4MDUsImV4cCI6MjEwMDU1ODgwNX0.xbAl5ZGvmCiMRd58bPiw1k_CfeCcC0FcVRHUlr8loVA'
) : null;

// Global App State
let state = {
  entries: [],
  filteredEntries: [],
  selectedCategory: 'all',
  selectedTag: 'all',
  searchQuery: '',
  theme: 'dark',
  
  // Editor State
  editingId: null,
  editorTags: [],
  editorBlocks: [],
  moodsList: [],
  categoriesList: [],
  activeAudioPlayer: null,
  
  // Voice Recording State
  mediaRecorder: null,
  audioChunks: [],
  recordingTimerInterval: null,
  recordingSeconds: 0,
  isRecording: false
};

// DOM Elements
const DOM = {
  themeToggle: document.getElementById('theme-toggle'),
  writeBtn: document.getElementById('write-btn'),
  writeBtnMobile: document.getElementById('write-btn-mobile'),
  editorModal: document.getElementById('editor-modal'),
  editorModalTitle: document.getElementById('editor-modal-title'),
  editorCloseBtn: document.getElementById('editor-close-btn'),
  writeForm: document.getElementById('write-form'),
  entryId: document.getElementById('entry-id'),
  entryTitle: document.getElementById('entry-title'),
  entryDate: document.getElementById('entry-date'),
  tagTextInput: document.getElementById('tag-text-input'),
  editorTagsList: document.getElementById('editor-tags-list'),
  entryContent: document.getElementById('entry-content'),
  
  // Sidebar categories & metadata
  sidebarCategoryList: document.getElementById('sidebar-category-list'),
  entryCategory: document.getElementById('entry-category'),
  entryCategoryCustom: document.getElementById('entry-category-custom'),
  entryCategoryEmoji: document.getElementById('entry-category-emoji'),
  customCategoryGroup: document.getElementById('custom-category-group'),
  entryLocation: document.getElementById('entry-location'),
  locationGpsBtn: document.getElementById('location-gps-btn'),
  
  // Block Editor & Custom Moods
  editorBlocksList: document.getElementById('editor-blocks-list'),
  blockToolboxButtons: document.querySelectorAll('.block-toolbox .tool-btn'),
  editorMoodsContainer: document.getElementById('editor-moods-container'),
  manageMoodsBtn: document.getElementById('manage-moods-btn'),
  moodsModal: document.getElementById('moods-modal'),
  moodsModalClose: document.getElementById('moods-modal-close'),
  addMoodForm: document.getElementById('add-mood-form'),
  newMoodEmoji: document.getElementById('new-mood-emoji'),
  newMoodName: document.getElementById('new-mood-name'),
  moodsListContainer: document.getElementById('moods-list-container'),
  moodChartContainer: document.getElementById('mood-chart-container'),
  
  // Form actions
  formCancelBtn: document.getElementById('form-cancel-btn'),
  formSaveBtn: document.getElementById('form-save-btn'),
  
  // Feed
  entriesFeed: document.getElementById('entries-feed'),
  emptyStateView: document.getElementById('empty-state-view'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  filterTagChips: document.getElementById('filter-tag-chips'),
  filterCategoryChips: document.getElementById('filter-category-chips'),
  
  // Sidebar stats
  statTotalCount: document.getElementById('stat-total-count'),
  statStreak: document.getElementById('stat-streak'),
  toastWrapper: document.getElementById('toast-wrapper'),
  
  // Backup / Restore buttons
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importFileInput: document.getElementById('import-file-input'),
  
  // Supabase Auth DOM elements
  logoutBtn: document.getElementById('logout-btn'),
  authModal: document.getElementById('auth-modal'),
  authForm: document.getElementById('auth-form'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  authSubmitBtn: document.getElementById('auth-submit-btn'),
  authToggleLink: document.getElementById('auth-toggle-link'),
  authErrorMsg: document.getElementById('auth-error-msg'),
  
  // Category Management DOM selectors
  manageCategoriesBtn: document.getElementById('manage-categories-btn'),
  manageCategoriesBtnMobile: document.getElementById('manage-categories-btn-mobile'),
  categoriesModal: document.getElementById('categories-modal'),
  categoriesModalClose: document.getElementById('categories-modal-close'),
  addCategoryForm: document.getElementById('add-category-form'),
  newCatEmoji: document.getElementById('new-cat-emoji'),
  newCatName: document.getElementById('new-cat-name'),
  categoriesListContainer: document.getElementById('categories-list-container'),
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // Init database
  try {
    await initDB();
    showToast('歡迎來到 AuraWrite 寫作空間', 'info');
  } catch (err) {
    showToast('資料庫初始化失敗', 'error');
  }

  // Load theme preference
  setupTheme();
  
  // Register main events
  registerEvents();
  
  // Set default date in editor to today
  setDefaultDate();
  
  // Supabase Auth and Synchronization Initialization
  let authMode = 'login';
  
  if (supabase) {
    // Auth State Monitor
    let isProcessingAuthChange = false;
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Supabase Auth Change Event:', event);
      
      // Skip USER_UPDATED events to prevent infinite loops from updateUser calls
      if (event === 'USER_UPDATED') {
        return;
      }
      
      // Prevent concurrent auth change tasks
      if (isProcessingAuthChange) return;
      isProcessingAuthChange = true;
      
      try {
        if (session) {
          const userId = session.user.id;
          DOM.authModal.classList.add('hidden');
          DOM.authModal.style.display = 'none';
          DOM.logoutBtn.classList.remove('hidden');
          
          await loadMoods();
          await loadCategories();
          await migrateLegacyEntries(userId);
          await syncDatabase();
          await loadData();
          lucide.createIcons();
        } else {
          DOM.authModal.classList.remove('hidden');
          DOM.authModal.style.display = 'flex';
          DOM.logoutBtn.classList.add('hidden');
          
          DOM.entriesFeed.innerHTML = '';
          updateStats();
        }
      } finally {
        isProcessingAuthChange = false;
      }
    });
    
    // Auth Modal toggle mode
    DOM.authToggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      const p = DOM.authModal.querySelector('p');
      const submitSpan = DOM.authSubmitBtn.querySelector('span');
      if (authMode === 'login') {
        authMode = 'signup';
        p.textContent = '註冊您的全新雲端寫作帳號';
        submitSpan.textContent = '註冊';
        DOM.authToggleLink.textContent = '已有帳號？登入';
      } else {
        authMode = 'login';
        p.textContent = '登入您的專屬雲端寫作空間';
        submitSpan.textContent = '登入';
        DOM.authToggleLink.textContent = '尚未有帳號？註冊新帳號';
      }
      DOM.authErrorMsg.classList.add('hidden');
      DOM.authForm.reset();
    });
    
    // Auth Form submit
    DOM.authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = DOM.authEmail.value.trim();
      const password = DOM.authPassword.value;
      
      DOM.authSubmitBtn.disabled = true;
      DOM.authSubmitBtn.querySelector('span').textContent = authMode === 'login' ? '登入中...' : '註冊中...';
      DOM.authErrorMsg.classList.add('hidden');
      
      try {
        if (authMode === 'login') {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          showToast('登入成功！歡迎回來', 'success');
        } else {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          showToast('註冊成功！已自動登入。', 'success');
        }
      } catch (err) {
        console.error('Auth error:', err);
        DOM.authErrorMsg.textContent = `錯誤: ${err.message || err}`;
        DOM.authErrorMsg.classList.remove('hidden');
      } finally {
        DOM.authSubmitBtn.disabled = false;
        DOM.authSubmitBtn.querySelector('span').textContent = authMode === 'login' ? '登入' : '註冊';
      }
    });
    
    // Logout Button click
    DOM.logoutBtn.addEventListener('click', async () => {
      if (confirm('確定要登出您的雲端帳號嗎？')) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          showToast('登出失敗', 'error');
        } else {
          showToast('已安全登出', 'info');
        }
      }
    });
  } else {
    // Supabase failed to load (completely offline fallback)
    DOM.authModal.classList.add('hidden');
    DOM.authModal.style.display = 'none';
    DOM.logoutBtn.classList.add('hidden');
    
    await loadMoods();
    await loadCategories();
    await loadData();
  }
  
  // Initialize Lucide icons
  lucide.createIcons();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered successfully:', reg.scope))
        .catch(err => console.error('Service Worker registration failed:', err));
    });
  }
});

// Theme Setup & Toggle
function setupTheme() {
  const savedTheme = localStorage.getItem('aurawrite-theme') || 'dark';
  state.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton();
}

function updateThemeButton() {
  // Handled by CSS selectors, but we can add icons updates if needed.
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = newTheme;
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('aurawrite-theme', newTheme);
  showToast(newTheme === 'dark' ? '已切換至深色模式' : '已切換至淺色模式', 'info');
}

// Set today's date in editor
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  DOM.entryDate.value = today;
}

// Toast Notifications
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'info') iconName = 'info';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;
  
  DOM.toastWrapper.appendChild(toast);
  lucide.createIcons();
  
  // Fade out and remove
  setTimeout(() => {
    toast.classList.add('fadeOut');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, duration);
}

// Event Listeners Registration
function registerEvents() {
  // Theme Toggle
  DOM.themeToggle.addEventListener('click', toggleTheme);
  
  // Open Editor
  DOM.writeBtn.addEventListener('click', () => openEditor());
  if (DOM.writeBtnMobile) {
    DOM.writeBtnMobile.addEventListener('click', () => openEditor());
  }
  
  // Close Editor
  DOM.editorCloseBtn.addEventListener('click', closeEditor);
  DOM.formCancelBtn.addEventListener('click', closeEditor);
  
  // Category Custom Dropdown toggle
  DOM.entryCategory.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      DOM.customCategoryGroup.classList.remove('hidden');
      DOM.entryCategoryCustom.required = true;
      DOM.entryCategoryCustom.focus();
    } else {
      DOM.customCategoryGroup.classList.add('hidden');
      DOM.entryCategoryCustom.required = false;
      DOM.entryCategoryCustom.value = '';
      DOM.entryCategoryEmoji.value = '';
    }
  });

  // Search & Filters
  DOM.searchInput.addEventListener('input', handleSearch);
  DOM.searchClearBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.searchClearBtn.classList.add('hidden');
    state.searchQuery = '';
    applyFilters();
  });
  
  // Tag Input in Editor
  DOM.tagTextInput.addEventListener('keydown', handleEditorTagInput);
  
  // Form submission
  DOM.writeForm.addEventListener('submit', handleFormSubmit);
  
  // Image attachments
  // Block Editor Toolbox click events
  DOM.blockToolboxButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const blockType = btn.getAttribute('data-type');
      addEditorBlock(blockType);
    });
  });

  // Custom Moods settings handlers
  if (DOM.manageMoodsBtn) {
    DOM.manageMoodsBtn.addEventListener('click', openMoodsModal);
  }
  if (DOM.moodsModalClose) {
    DOM.moodsModalClose.addEventListener('click', closeMoodsModal);
  }
  if (DOM.addMoodForm) {
    DOM.addMoodForm.addEventListener('submit', handleAddMoodSubmit);
  }

  // Custom Category settings handlers
  if (DOM.manageCategoriesBtn) {
    DOM.manageCategoriesBtn.addEventListener('click', openCategoriesModal);
  }
  if (DOM.manageCategoriesBtnMobile) {
    DOM.manageCategoriesBtnMobile.addEventListener('click', openCategoriesModal);
  }
  if (DOM.categoriesModalClose) {
    DOM.categoriesModalClose.addEventListener('click', closeCategoriesModal);
  }
  if (DOM.addCategoryForm) {
    DOM.addCategoryForm.addEventListener('submit', handleAddCategorySubmit);
  }

  // Location Geolocation fetch
  DOM.locationGpsBtn.addEventListener('click', () => fetchGeolocation(true));

  // Backup Export & Import listeners
  if (DOM.exportBtn) DOM.exportBtn.addEventListener('click', exportBackup);
  if (DOM.importBtn) DOM.importBtn.addEventListener('click', () => DOM.importFileInput.click());
  if (DOM.importFileInput) DOM.importFileInput.addEventListener('change', handleImportBackup);
}

// Geolocation Fetch & Reverse Geocode
function fetchGeolocation(isUserTriggered = false) {
  if (!navigator.geolocation) {
    if (isUserTriggered) showToast('您的瀏覽器不支援 GPS 定位功能', 'error');
    return;
  }
  
  if (isUserTriggered) {
    DOM.entryLocation.placeholder = '正在定位中...';
    DOM.entryLocation.value = '';
  }
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude.toFixed(4);
      const lon = position.coords.longitude.toFixed(4);
      const coordText = `📍 北緯 ${lat}°, 東經 ${lon}°`;
      
      // Set coordinates as initial value
      DOM.entryLocation.value = coordText;
      
      // Try reverse-geocoding via OpenStreetMap Nominatim
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh-TW`, {
          headers: {
            'User-Agent': 'AuraWrite/1.0'
          }
        });
        if (response.ok) {
          const data = await response.json();
          const address = data.address;
          let locationName = '';
          if (address) {
            const city = address.city || address.town || address.county || '';
            const suburb = address.suburb || address.village || address.neighbourhood || address.district || '';
            const road = address.road || '';
            locationName = `${city}${suburb}${road}`.trim();
          }
          if (!locationName && data.display_name) {
            locationName = data.display_name.split(',')[0];
          }
          if (locationName) {
            DOM.entryLocation.value = `📍 ${locationName}`;
            if (isUserTriggered) showToast('已成功取得目前定位！', 'success');
          }
        }
      } catch (err) {
        console.warn('Reverse geocoding failed:', err);
        if (isUserTriggered) showToast('定位已取得 (經緯度狀態)', 'info');
      }
    },
    (error) => {
      console.warn('Geolocation failed:', error);
      if (isUserTriggered) {
        let errMsg = '定位取得失敗';
        if (error.code === 1) errMsg = '定位取得失敗，請允許瀏覽器定位權限';
        showToast(errMsg, 'error');
        DOM.entryLocation.placeholder = '請手動輸入地點...';
      }
    },
    { timeout: 6000, enableHighAccuracy: true }
  );
}

// Load Data from Database
async function loadData() {
  try {
    state.entries = await getAllEntries();
    
    // Auto-discover and merge categories from past entries
    let changed = false;
    state.entries.forEach(entry => {
      const catName = entry.category;
      if (catName && !state.categoriesList.some(c => c.name === catName)) {
        const catEmoji = entry.categoryEmoji || getCategorySymbol(catName);
        state.categoriesList.push({ name: catName, emoji: catEmoji });
        changed = true;
      }
    });
    if (changed) {
      await saveCategoriesList(false);
    }
    
    await updateStats();
    applyFilters();
  } catch (err) {
    console.error(err);
    showToast('讀取寫作紀錄失敗', 'error');
  }
}

// Update Stats Widgets
async function updateStats() {
  const stats = await getStats();
  
  // Total entries & Streak
  DOM.statTotalCount.textContent = stats.totalCount;
  DOM.statStreak.textContent = stats.streak;
  
  // Dynamic Mood stats updates
  const maxMoodCount = Math.max(...Object.values(stats.moodStats), 1);
  
  state.moodsList.forEach(mood => {
    const details = getMoodDetails(mood.label);
    const count = stats.moodStats[details.label] || stats.moodStats[details.value] || 0;
    
    const countEl = document.getElementById(`mood-count-${details.value}`);
    const barEl = document.getElementById(`mood-bar-${details.value}`);
    
    if (countEl) countEl.textContent = count;
    if (barEl) {
      const percent = stats.totalCount > 0 ? (count / maxMoodCount) * 100 : 0;
      barEl.style.width = `${percent}%`;
    }
  });
  
  // Render sidebar category filtering list
  renderSidebarCategories(stats.categoryStats, stats.totalCount);
  
  // Render category filter chips on the main timeline feed
  renderFilterCategoryChips(stats.categoryStats);
  
  // Render sidebar filter tags
  renderFilterTagChips(stats.tags);
}

// Render Sidebar Category Filter Navigation List
function renderSidebarCategories(categoryStats, totalCount) {
  const activeCategory = state.selectedCategory;
  
  // Create all-categories item
  DOM.sidebarCategoryList.innerHTML = `
    <button class="category-item ${activeCategory === 'all' ? 'active' : ''}" data-category="all">
      <div class="category-name-wrapper">
        <i data-lucide="folder-open"></i>
        <span>全部文章</span>
      </div>
      <span class="category-count-badge">${totalCount}</span>
    </button>
  `;
  
  // Add other category items
  Object.keys(categoryStats).forEach(cat => {
    const count = categoryStats[cat];
    const button = document.createElement('button');
    button.className = `category-item ${activeCategory === cat ? 'active' : ''}`;
    button.setAttribute('data-category', cat);
    
    const matchedEntry = state.entries.find(e => e.category === cat);
    const emoji = matchedEntry?.categoryEmoji || getCategorySymbol(cat);
    
    button.innerHTML = `
      <div class="category-name-wrapper">
        <span style="margin-right: 0.5rem; font-size: 1.1rem;">${emoji}</span>
        <span>${escapeHTML(cat)}</span>
      </div>
      <span class="category-count-badge">${count}</span>
    `;
    DOM.sidebarCategoryList.appendChild(button);
  });
  
  // Bind category item clicks
  DOM.sidebarCategoryList.querySelectorAll('.category-item').forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.sidebarCategoryList.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      state.selectedCategory = btn.getAttribute('data-category');
      applyFilters();
    });
  });
  
  lucide.createIcons();
}

// Render Category Filters Chip list on the main feed
function renderFilterCategoryChips(categoryStats) {
  const activeCategory = state.selectedCategory;
  
  DOM.filterCategoryChips.innerHTML = `
    <button class="tag-chip ${activeCategory === 'all' ? 'active' : ''}" data-category="all">
      📁 全部文章
    </button>
  `;
  
  Object.keys(categoryStats).forEach(cat => {
    const matchedEntry = state.entries.find(e => e.category === cat);
    const emoji = matchedEntry?.categoryEmoji || getCategorySymbol(cat);
    
    const chip = document.createElement('button');
    chip.className = `tag-chip ${activeCategory === cat ? 'active' : ''}`;
    chip.setAttribute('data-category', cat);
    chip.innerHTML = `${emoji} ${escapeHTML(cat)}`;
    DOM.filterCategoryChips.appendChild(chip);
  });
  
  // Bind click event to category chips
  DOM.filterCategoryChips.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.filterCategoryChips.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedCategory = chip.getAttribute('data-category');
      applyFilters();
      
      // Sync sidebar selection if available
      if (DOM.sidebarCategoryList) {
        DOM.sidebarCategoryList.querySelectorAll('.category-item').forEach(c => {
          if (c.getAttribute('data-category') === state.selectedCategory) {
            c.classList.add('active');
          } else {
            c.classList.remove('active');
          }
        });
      }
    });
  });
}

// Render Tag Filters Chip list
function renderFilterTagChips(tags) {
  const activeTag = state.selectedTag;
  DOM.filterTagChips.innerHTML = `<button class="tag-chip ${activeTag === 'all' ? 'active' : ''}" data-tag="all">全部</button>`;
  
  tags.forEach(tag => {
    const chip = document.createElement('button');
    chip.className = `tag-chip ${activeTag === tag ? 'active' : ''}`;
    chip.setAttribute('data-tag', tag);
    chip.textContent = `#${tag}`;
    DOM.filterTagChips.appendChild(chip);
  });
  
  // Bind click event to chips
  DOM.filterTagChips.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      DOM.filterTagChips.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedTag = chip.getAttribute('data-tag');
      applyFilters();
    });
  });
}

// Search and Filter Handling
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  state.searchQuery = query;
  
  if (query.length > 0) {
    DOM.searchClearBtn.classList.remove('hidden');
  } else {
    DOM.searchClearBtn.classList.add('hidden');
  }
  
  applyFilters();
}

function applyFilters() {
  const { entries, selectedCategory, selectedTag, searchQuery } = state;
  
  state.filteredEntries = entries.filter(entry => {
    // 1. Category Filter
    const matchesCategory = selectedCategory === 'all' || (entry.category === selectedCategory);
    
    // 2. Tag Filter
    const matchesTag = selectedTag === 'all' || (entry.tags && entry.tags.includes(selectedTag));
    
    // 3. Search Query Filter
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || 
      entry.title.toLowerCase().includes(query) || 
      (entry.content && entry.content.toLowerCase().includes(query)) ||
      (entry.category && entry.category.toLowerCase().includes(query)) ||
      (entry.location && entry.location.toLowerCase().includes(query)) ||
      (entry.tags && entry.tags.some(tag => tag.toLowerCase().includes(query))) ||
      (entry.blocks && entry.blocks.some(block => block.value && block.value.toLowerCase().includes(query)));
      
    return matchesCategory && matchesTag && matchesSearch;
  });
  
  renderFeed();
}

// Helper to get different symbols/emojis for different folder categories
function getCategorySymbol(category) {
  const cat = (category || '').trim();
  if (cat === '生活隨筆') return '📝';
  if (cat === '代間') return '🌳';
  if (cat === '影音觸動') return '🎬';
  if (cat === '美食記趣') return '🍕';
  if (cat === '旅行足跡') return '✈️';
  if (cat === '心情宣洩') return '🌪️';
  if (cat === '靈感筆記') return '💡';
  return '📂'; // Default folder icon
}

// Render Writing Timeline Feed
function renderFeed() {
  const feedContainer = DOM.entriesFeed;
  
  const existingCards = feedContainer.querySelectorAll('.diary-card');
  existingCards.forEach(card => card.remove());
  
  if (state.filteredEntries.length === 0) {
    DOM.emptyStateView.classList.remove('hidden');
    return;
  }
  
  DOM.emptyStateView.classList.add('hidden');
  
  state.filteredEntries.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'diary-card glass-panel animate-fade-in';
    card.setAttribute('data-id', entry.id);
    
    const dateObj = new Date(entry.date);
    const day = dateObj.getDate();
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const month = months[dateObj.getMonth()];
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[dateObj.getDay()];
    
    // 8 Mood maps with emoji, label, and tag styles
    const moodMap = {
      happy: { emoji: '😊', label: '開心', class: 'mood-happy-tag' },
      calm: { emoji: '😌', label: '平靜', class: 'mood-calm-tag' },
      tired: { emoji: '😴', label: '疲倦', class: 'mood-tired-tag' },
      sad: { emoji: '🥺', label: '憂鬱', class: 'mood-sad-tag' },
      grief: { emoji: '😢', label: '悲傷', class: 'mood-grief-tag' },
      fatigue: { emoji: '🥱', label: '疲勞', class: 'mood-fatigue-tag' },
      angry: { emoji: '😡', label: '憤怒', class: 'mood-angry-tag' },
      excited: { emoji: '🤩', label: '興奮', class: 'mood-excited-tag' }
    };
    
    // Support dynamic multi-mood rendering
    const moods = entry.moods || (entry.mood ? [entry.mood] : []);
    const moodBadgesHtml = moods.map(m => {
      const details = getMoodDetails(m);
      return `
        <div class="diary-mood-tag ${details.class}">
          <span>${details.emoji}</span>
          <span>${details.label}</span>
        </div>
      `;
    }).join('');

    const tagsHtml = (entry.tags || []).map(tag => `<span class="diary-tag-item">#${tag}</span>`).join(' ');
    
    // Notion-style blocks renderer
    let bodyHtml = '';
    const blocks = entry.blocks || [];
    
    if (blocks.length > 0) {
      bodyHtml = blocks.map(block => {
        if (block.type === 'text') {
          return `<p class="card-block-text">${escapeHTML(block.value || '')}</p>`;
        } else if (block.type === 'image') {
          const imgUrl = block.imageBlob ? URL.createObjectURL(block.imageBlob) : block.imagePath;
          if (imgUrl) {
            return `
              <div class="card-block-image">
                <img src="${imgUrl}" alt="附圖" loading="lazy">
                ${block.caption ? `<div class="card-block-caption">${escapeHTML(block.caption)}</div>` : ''}
              </div>
            `;
          }
        } else if (block.type === 'video') {
          const vidUrl = block.videoBlob ? URL.createObjectURL(block.videoBlob) : block.videoPath;
          if (vidUrl) {
            return `
              <div class="card-block-video">
                <video src="${vidUrl}" controls preload="metadata"></video>
                ${block.caption ? `<div class="card-block-caption">${escapeHTML(block.caption)}</div>` : ''}
              </div>
            `;
          }
        } else if (block.type === 'audio') {
          const audioUrl = block.audioBlob ? URL.createObjectURL(block.audioBlob) : block.audioPath;
          if (audioUrl) {
            return `
              <div class="card-block-audio">
                <div class="custom-mini-player" data-audio-src="${audioUrl}">
                  <button type="button" class="mini-play-btn timeline-play-btn">
                    <i data-lucide="play" class="timeline-play-icon"></i>
                  </button>
                  <div class="progress-bar-slider timeline-progress-slider">
                    <div class="progress-fill timeline-progress-fill"></div>
                  </div>
                  <span class="player-time-display timeline-time-display">0:00 / 0:00</span>
                  <audio class="timeline-audio-element" src="${audioUrl}"></audio>
                </div>
              </div>
            `;
          }
        } else if (block.type === 'link') {
          if (block.url) {
            const embedUrl = getYouTubeEmbedUrl(block.url);
            if (embedUrl) {
              const match = block.url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
              const videoId = match ? match[2] : '';
              const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
              return `
                <div class="card-block-youtube" data-video-url="${escapeHTML(block.url)}" data-embed-url="${embedUrl}">
                  <div class="youtube-preview-card" style="background-image: url('${thumbUrl}');" onclick="playYouTubeVideo(this, event)">
                    <div class="youtube-overlay">
                      <div class="youtube-play-btn">
                        <i data-lucide="play" style="fill: #fff;"></i>
                      </div>
                      <div class="youtube-title-banner">
                        <span class="youtube-tag">YouTube</span>
                        <span class="youtube-card-title">${escapeHTML(block.title || '在 YouTube 上觀看影片')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }
            
            const displayTitle = block.title || block.url;
            const descText = block.description || '點擊以開啟外部連結';
            const hasImg = block.image ? `<div class="bookmark-img-box"><img src="${escapeHTML(block.image)}" alt="預覽圖" loading="lazy"></div>` : '';
            return `
              <div class="card-block-link">
                <a href="${escapeHTML(block.url)}" target="_blank" rel="noopener noreferrer" class="bookmark-card">
                  <div class="bookmark-content">
                    <div class="bookmark-title">${escapeHTML(displayTitle)}</div>
                    <div class="bookmark-desc">${escapeHTML(descText)}</div>
                    <div class="bookmark-url-wrapper">
                      <i data-lucide="link"></i>
                      <span class="bookmark-url">${escapeHTML(block.url)}</span>
                    </div>
                  </div>
                  ${hasImg}
                </a>
              </div>
            `;
          }
        }
        return '';
      }).join('');
    } else {
      // Backward compatibility plain content
      bodyHtml = `<p class="card-block-text">${escapeHTML(entry.content || '')}</p>`;
      
      const imgUrl = entry.imageBlob ? URL.createObjectURL(entry.imageBlob) : entry.imagePath;
      if (imgUrl) {
        bodyHtml += `
          <div class="card-block-image">
            <img src="${imgUrl}" alt="附圖" loading="lazy">
          </div>
        `;
      }
      
      const audioUrl = entry.audioBlob ? URL.createObjectURL(entry.audioBlob) : entry.audioPath;
      if (audioUrl) {
        bodyHtml += `
          <div class="card-block-audio">
            <div class="custom-mini-player" data-audio-src="${audioUrl}">
              <button type="button" class="mini-play-btn timeline-play-btn">
                <i data-lucide="play" class="timeline-play-icon"></i>
              </button>
              <div class="progress-bar-slider timeline-progress-slider">
                <div class="progress-fill timeline-progress-fill"></div>
              </div>
              <span class="player-time-display timeline-time-display">0:00 / 0:00</span>
              <audio class="timeline-audio-element" src="${audioUrl}"></audio>
            </div>
          </div>
        `;
      }
    }
    
    const catName = entry.category || '生活隨筆';
    const catSymbol = entry.categoryEmoji || getCategorySymbol(catName);
    
    card.innerHTML = `
      <div class="diary-card-header">
        <div class="diary-meta-left">
          <div class="diary-date-badge">
            <span class="diary-date-day">${day}</span>
            <span class="diary-date-month">${month}</span>
          </div>
          <div class="diary-title-area">
            <h2 class="diary-title">${escapeHTML(entry.title)}</h2>
            <div class="diary-subtitle-group">
              <span class="diary-meta-time">${weekday} · ${entry.date}</span>
              <span class="diary-meta-details">
                <span class="diary-meta-category">${catSymbol} ${escapeHTML(catName)}</span>
                ${entry.location ? `<span class="diary-meta-location" style="display: inline-flex; align-items: center; gap: 0.25rem; color: var(--accent-primary); background: var(--accent-glow); padding: 0.15rem 0.5rem; border-radius: 6px; margin-left: 0.5rem; font-size: 0.72rem; white-space: normal; word-break: break-word; line-height: 1.2;">📍 ${escapeHTML(entry.location)}</span>` : ''}
              </span>
            </div>
          </div>
        </div>
        
        <div class="diary-meta-right" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <div class="diary-mood-badges" style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${moodBadgesHtml}
          </div>
          
          <div class="diary-card-actions">
            <button type="button" class="card-action-btn edit-entry-btn" title="編輯項目">
              <i data-lucide="edit-3"></i>
            </button>
            <button type="button" class="card-action-btn delete delete-entry-btn" title="刪除項目">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      </div>
      
      <div class="diary-card-body">
        ${bodyHtml}
      </div>
      
      <div class="diary-tags-list">
        ${tagsHtml}
      </div>
    `;
    
    feedContainer.appendChild(card);
    
    card.querySelector('.edit-entry-btn').addEventListener('click', () => openEditor(entry.id));
    card.querySelector('.delete-entry-btn').addEventListener('click', () => confirmDelete(entry.id));
    
    // Bind all timeline players in this card
    card.querySelectorAll('.custom-mini-player').forEach(playerEl => {
      setupTimelineAudioPlayer(playerEl);
    });
  });
  
  lucide.createIcons();
}

// Setup custom timeline audio player event bindings
function setupTimelineAudioPlayer(playerEl) {
  const playBtn = playerEl.querySelector('.timeline-play-btn');
  const playIcon = playerEl.querySelector('.timeline-play-icon');
  const audio = playerEl.querySelector('.timeline-audio-element');
  const slider = playerEl.querySelector('.timeline-progress-slider');
  const fill = playerEl.querySelector('.timeline-progress-fill');
  const timeDisplay = playerEl.querySelector('.timeline-time-display');
  
  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Click Play
  playBtn.addEventListener('click', () => {
    // Pause other playing audios on feed first
    document.querySelectorAll('.timeline-audio-element').forEach(otherAudio => {
      if (otherAudio !== audio && !otherAudio.paused) {
        otherAudio.pause();
        const otherPlayer = otherAudio.closest('.custom-mini-player');
        const otherPlayIcon = otherPlayer ? otherPlayer.querySelector('.timeline-play-icon') : null;
        if (otherPlayIcon) {
          otherPlayIcon.setAttribute('data-lucide', 'play');
        }
      }
    });
    
    if (audio.paused) {
      audio.play().then(() => {
        playIcon.setAttribute('data-lucide', 'pause');
        lucide.createIcons({ attrs: { class: 'timeline-play-icon' } });
      }).catch(err => console.error('Audio play failed:', err));
    } else {
      audio.pause();
      playIcon.setAttribute('data-lucide', 'play');
      lucide.createIcons({ attrs: { class: 'timeline-play-icon' } });
    }
  });
  
  // Time updates
  audio.addEventListener('timeupdate', () => {
    const pct = (audio.currentTime / audio.duration) * 100;
    fill.style.width = `${pct}%`;
    timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  });
  
  // Load metadata to get duration initially
  audio.addEventListener('loadedmetadata', () => {
    timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
  });
  
  // If browser cached metadata and event already fired
  if (audio.readyState >= 1) {
    timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
  }
  
  // Click timeline slider to seek
  slider.addEventListener('click', (e) => {
    const rect = slider.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;
    audio.currentTime = ratio * audio.duration;
  });
  
  // Audio finished
  audio.addEventListener('ended', () => {
    playIcon.setAttribute('data-lucide', 'play');
    lucide.createIcons({ attrs: { class: 'timeline-play-icon' } });
    fill.style.width = '0%';
  });
}

// Open Editor Modal (Create or Edit mode)
async function openEditor(id = null) {
  // Clear previous states
  DOM.writeForm.reset();
  state.editingId = id;
  state.editorTags = [];
  state.editorBlocks = [];
  
  // Render dynamic mood checkboxes in editor modal
  renderEditorMoodSelectionGrid();
  
  // Reset Category inputs
  DOM.entryCategory.value = '生活隨筆';
  DOM.entryCategoryCustom.value = '';
  DOM.entryCategoryEmoji.value = '';
  DOM.customCategoryGroup.classList.add('hidden');
  DOM.entryCategoryCustom.required = false;
  
  // Reset mood checkboxes
  const moodCheckboxes = DOM.writeForm.querySelectorAll('input[name="entry-moods"]');
  moodCheckboxes.forEach(cb => cb.checked = false);
  
  setDefaultDate();
  
  if (id) {
    // EDIT MODE
    try {
      const entry = await getEntry(id);
      if (!entry) {
        showToast('無法取得日記資料', 'error');
        return;
      }
      
      DOM.editorModalTitle.textContent = '編輯紀錄';
      DOM.entryId.value = entry.id;
      DOM.entryTitle.value = entry.title;
      DOM.entryDate.value = entry.date;
      
      // Category Setup
      const entryCategory = entry.category || '生活隨筆';
      const entryCategoryEmoji = entry.categoryEmoji || '';
      const selectHasOption = Array.from(DOM.entryCategory.options).some(opt => opt.value === entryCategory);
      
      if (selectHasOption) {
        DOM.entryCategory.value = entryCategory;
      } else {
        DOM.entryCategory.value = 'custom';
        DOM.entryCategoryCustom.value = entryCategory;
        DOM.entryCategoryEmoji.value = entryCategoryEmoji;
        DOM.customCategoryGroup.classList.remove('hidden');
        DOM.entryCategoryCustom.required = true;
      }
      
      // Select multi-mood checkboxes (resolve dynamically)
      let moods = entry.moods || (entry.mood ? [entry.mood] : []);
      // Map old english values to chinese labels if needed
      moods = moods.map(m => getMoodDetails(m).label);
      moodCheckboxes.forEach(cb => {
        if (moods.includes(cb.value)) {
          cb.checked = true;
        }
      });
      
      // Set tags
      state.editorTags = [...(entry.tags || [])];
      renderEditorTags();
      
      // Load blocks and handle backward compatibility
      state.editorBlocks = entry.blocks ? JSON.parse(JSON.stringify(entry.blocks)) : [];
      if (state.editorBlocks.length === 0) {
        if (entry.content) {
          state.editorBlocks.push({ id: 'b_t', type: 'text', value: entry.content });
        }
        if (entry.imageBlob || entry.imagePath) {
          state.editorBlocks.push({
            id: 'b_i',
            type: 'image',
            imageBlob: entry.imageBlob || null,
            imagePath: entry.imagePath || null,
            caption: '附圖'
          });
        }
        if (entry.audioBlob || entry.audioPath) {
          state.editorBlocks.push({
            id: 'b_a',
            type: 'audio',
            audioBlob: entry.audioBlob || null,
            audioPath: entry.audioPath || null,
            audioName: entry.audioName || '音檔'
          });
        }
      }
      
      renderEditorBlocks();
      
      // Location Setup
      DOM.entryLocation.value = entry.location || '';
      DOM.entryLocation.placeholder = '自行輸入地點...';
    } catch (err) {
      console.error(err);
      showToast('載入編輯內容失敗', 'error');
      return;
    }
  } else {
    // CREATE MODE
    DOM.editorModalTitle.textContent = '開始寫作';
    DOM.entryId.value = '';
    
    // Check first mood option by default
    if (moodCheckboxes.length > 0) {
      moodCheckboxes[0].checked = true;
    }
    
    // Reset Location for new entry and start auto geolocate
    DOM.entryLocation.value = '';
    DOM.entryLocation.placeholder = '正在自動獲取定位，或可自行輸入...';
    fetchGeolocation(false);
    
    // Initialize with a single text block
    state.editorBlocks = [{ id: 'block_init', type: 'text', value: '' }];
    renderEditorBlocks();
    
    renderEditorTags();
  }
  
  // Show Modal
  DOM.editorModal.classList.remove('hidden');
  DOM.editorModal.style.display = 'flex';
  DOM.editorModal.style.opacity = '1';
  DOM.editorModal.style.pointerEvents = 'auto';
  
  // Bulletproof iOS scroll locking
  state.scrollPos = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${state.scrollPos}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  
  lucide.createIcons();
}

// Close Editor Modal
function closeEditor() {
  // Check if recording is active and stop it
  if (state.isRecording) {
    stopVoiceRecording();
  }
  
  DOM.editorModal.classList.add('hidden');
  DOM.editorModal.style.display = 'none';
  DOM.editorModal.style.opacity = '0';
  DOM.editorModal.style.pointerEvents = 'none';
  
  // Restore iOS scroll state
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  if (state.scrollPos !== undefined) {
    window.scrollTo(0, state.scrollPos);
  }
  
  // Pause editor player if playing
  if (DOM.audioPreviewElement) {
    DOM.audioPreviewElement.pause();
  }
  if (state.activeAudioPlayer) {
    state.activeAudioPlayer.pause();
    state.activeAudioPlayer = null;
  }
}

// Delete Confirmation & Action
async function confirmDelete(id) {
  if (confirm('確定要刪除這筆寫作紀錄嗎？此動作無法復原。')) {
    try {
      await deleteEntry(id);
      trackDeletion(id);
      showToast('紀錄已成功刪除');
      await loadData();
      await attemptServerDelete(id);
    } catch (err) {
      console.error(err);
      showToast('刪除失敗', 'error');
    }
  }
}

// Tags Management inside Editor
function handleEditorTagInput(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const tagVal = DOM.tagTextInput.value.trim().toLowerCase().replace(/^[#＃]/, '');
    
    if (tagVal.length === 0) return;
    
    if (state.editorTags.includes(tagVal)) {
      DOM.tagTextInput.value = '';
      showToast('標籤已存在', 'info');
      return;
    }
    
    state.editorTags.push(tagVal);
    DOM.tagTextInput.value = '';
  renderEditorTags();
  }
}

function renderEditorTags() {
  DOM.editorTagsList.innerHTML = '';
  
  state.editorTags.forEach(tag => {
    const badge = document.createElement('span');
    badge.className = 'editor-tag-badge';
    badge.innerHTML = `
      <span>#${tag}</span>
      <button type="button" class="remove-tag-btn" data-tag="${tag}">
        <i data-lucide="x"></i>
      </button>
    `;
    DOM.editorTagsList.appendChild(badge);
    
    // Bind remove event
    badge.querySelector('.remove-tag-btn').addEventListener('click', () => {
      state.editorTags = state.editorTags.filter(t => t !== tag);
      renderEditorTags();
    });
  });
  
  lucide.createIcons();
}

// Dynamic Custom Moods Loading and Saving
async function loadMoods() {
  state.moodsList = [...DEFAULT_MOODS];
  
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user.raw_user_meta_data && session.user.raw_user_meta_data.customMoods) {
        state.moodsList = session.user.raw_user_meta_data.customMoods;
        localStorage.setItem('aurawrite-custom-moods', JSON.stringify(state.moodsList));
      } else {
        const localMoods = localStorage.getItem('aurawrite-custom-moods');
        if (localMoods) {
          state.moodsList = JSON.parse(localMoods);
        }
      }
    } catch (e) {
      console.warn('Failed to load custom moods from Supabase:', e);
    }
  } else {
    const localMoods = localStorage.getItem('aurawrite-custom-moods');
    if (localMoods) {
      state.moodsList = JSON.parse(localMoods);
    }
  }
  
  renderEditorMoodSelectionGrid();
  renderMoodChartTemplate();
}

const DEFAULT_CATEGORIES = [
  { name: '生活隨筆', emoji: '📝' },
  { name: '靈感創作', emoji: '💡' },
  { name: '工作學習', emoji: '🌲' },
  { name: '讀書筆記', emoji: '📚' },
  { name: '旅行雜記', emoji: '✈️' }
];

async function loadCategories() {
  state.categoriesList = [...DEFAULT_CATEGORIES];
  
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user.raw_user_meta_data && session.user.raw_user_meta_data.customCategories) {
        state.categoriesList = session.user.raw_user_meta_data.customCategories;
        localStorage.setItem('aurawrite-custom-categories', JSON.stringify(state.categoriesList));
      } else {
        const localCats = localStorage.getItem('aurawrite-custom-categories');
        if (localCats) {
          state.categoriesList = JSON.parse(localCats);
        }
      }
    } catch (e) {
      console.warn('Failed to load custom categories from Supabase:', e);
    }
  } else {
    const localCats = localStorage.getItem('aurawrite-custom-categories');
    if (localCats) {
      state.categoriesList = JSON.parse(localCats);
    }
  }
  
  populateCategoryDropdown();
}

async function saveCategoriesList(shouldReloadData = true) {
  localStorage.setItem('aurawrite-custom-categories', JSON.stringify(state.categoriesList));
  
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.updateUser({
          data: { customCategories: state.categoriesList }
        });
      }
    } catch (err) {
      console.warn('Syncing categories to Supabase metadata failed:', err);
    }
  }
  
  populateCategoryDropdown();
  if (shouldReloadData) {
    await loadData();
  }
}

function populateCategoryDropdown() {
  const currentVal = DOM.entryCategory ? DOM.entryCategory.value : '';
  if (!DOM.entryCategory) return;
  DOM.entryCategory.innerHTML = '';
  
  state.categoriesList.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    DOM.entryCategory.appendChild(opt);
  });
  
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = '+ 新增分類...';
  DOM.entryCategory.appendChild(customOpt);
  
  if (state.categoriesList.some(c => c.name === currentVal)) {
    DOM.entryCategory.value = currentVal;
  } else {
    DOM.entryCategory.value = state.categoriesList[0]?.name || '生活隨筆';
  }
}

const DEFAULT_MOODS = [
  { emoji: '😊', label: '開心', value: 'happy', class: 'mood-happy-tag', halo: 'happy-halo' },
  { emoji: '😌', label: '平靜', value: 'calm', class: 'mood-calm-tag', halo: 'calm-halo' },
  { emoji: '😴', label: '疲倦', value: 'tired', class: 'mood-tired-tag', halo: 'tired-halo' },
  { emoji: '🥺', label: '憂鬱', value: 'sad', class: 'mood-sad-tag', halo: 'sad-halo' },
  { emoji: '😢', label: '悲傷', value: 'grief', class: 'mood-grief-tag', halo: 'grief-halo' },
  { emoji: '🥱', label: '疲勞', value: 'fatigue', class: 'mood-fatigue-tag', halo: 'fatigue-halo' },
  { emoji: '😡', label: '憤怒', value: 'angry', class: 'mood-angry-tag', halo: 'angry-halo' },
  { emoji: '🤩', label: '興奮', value: 'excited', class: 'mood-excited-tag', halo: 'excited-halo' }
];

function getMoodDetails(label) {
  const cleanLabel = label.trim();
  const found = state.moodsList.find(m => m.label === cleanLabel);
  if (found) {
    const engVal = found.value || found.label;
    const clsName = found.class || `mood-custom-tag`;
    const haloName = found.halo || `custom-halo`;
    return { emoji: found.emoji, label: found.label, class: clsName, halo: haloName, value: engVal };
  }
  
  // Backward compatibility check for old English labels
  const enMapping = {
    happy: { emoji: '😊', label: '開心', class: 'mood-happy-tag', halo: 'happy-halo' },
    calm: { emoji: '😌', label: '平靜', class: 'mood-calm-tag', halo: 'calm-halo' },
    tired: { emoji: '😴', label: '疲倦', class: 'mood-tired-tag', halo: 'tired-halo' },
    sad: { emoji: '🥺', label: '憂鬱', class: 'mood-sad-tag', halo: 'sad-halo' },
    grief: { emoji: '😢', label: '悲傷', class: 'mood-grief-tag', halo: 'grief-halo' },
    fatigue: { emoji: '🥱', label: '疲勞', class: 'mood-fatigue-tag', halo: 'fatigue-halo' },
    angry: { emoji: '😡', label: '憤怒', class: 'mood-angry-tag', halo: 'angry-halo' },
    excited: { emoji: '🤩', label: '興奮', class: 'mood-excited-tag', halo: 'excited-halo' }
  };
  
  if (enMapping[cleanLabel]) {
    return { ...enMapping[cleanLabel], value: cleanLabel };
  }
  
  return { emoji: '📝', label: cleanLabel, class: 'mood-happy-tag', halo: 'custom-halo', value: cleanLabel };
}

function renderEditorMoodSelectionGrid() {
  if (!DOM.editorMoodsContainer) return;
  DOM.editorMoodsContainer.innerHTML = state.moodsList.map(mood => {
    const details = getMoodDetails(mood.label);
    return `
      <label class="mood-option">
        <input type="checkbox" name="entry-moods" value="${escapeHTML(details.label)}">
        <div class="mood-option-box ${details.halo}">
          <span class="emoji">${details.emoji}</span>
          <span class="text">${escapeHTML(details.label)}</span>
        </div>
      </label>
    `;
  }).join('');
}

function renderMoodChartTemplate() {
  if (!DOM.moodChartContainer) return;
  DOM.moodChartContainer.innerHTML = state.moodsList.map(mood => {
    const details = getMoodDetails(mood.label);
    return `
      <div class="mood-bar-wrapper">
        <span class="mood-emoji" title="${escapeHTML(details.label)}">${details.emoji}</span>
        <div class="mood-bar-container">
          <div class="mood-bar" id="mood-bar-${escapeHTML(details.value)}" style="width: 0%"></div>
        </div>
        <span class="mood-bar-count" id="mood-count-${escapeHTML(details.value)}">0</span>
      </div>
    `;
  }).join('');
}

// Moods Settings Modal UI Actions
function openMoodsModal() {
  if (!DOM.moodsModal) return;
  DOM.moodsModal.classList.remove('hidden');
  DOM.moodsModal.style.display = 'flex';
  DOM.moodsModal.style.opacity = '1';
  DOM.moodsModal.style.pointerEvents = 'auto';
  renderMoodsModalList();
}

function closeMoodsModal() {
  if (!DOM.moodsModal) return;
  DOM.moodsModal.classList.add('hidden');
  DOM.moodsModal.style.display = 'none';
}

function renderMoodsModalList() {
  if (!DOM.moodsListContainer) return;
  DOM.moodsListContainer.innerHTML = state.moodsList.map((mood, idx) => {
    return `
      <div class="mood-manager-item">
        <div class="mood-item-left">
          <span class="mood-item-emoji">${mood.emoji}</span>
          <span class="mood-item-name">${escapeHTML(mood.label)}</span>
        </div>
        <button type="button" class="mood-item-del-btn" onclick="deleteCustomMood(${idx})" title="刪除此心情選項">
          <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
        </button>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

window.deleteCustomMood = async function(index) {
  if (state.moodsList.length <= 1) {
    showToast('至少需要保留一個心情選項', 'error');
    return;
  }
  
  if (confirm(`確定要刪除「${state.moodsList[index].emoji} ${state.moodsList[index].label}」嗎？已儲存的舊日記標籤不受影響。`)) {
    state.moodsList.splice(index, 1);
    await saveMoodsList();
  }
};

async function handleAddMoodSubmit(e) {
  e.preventDefault();
  const emoji = DOM.newMoodEmoji.value.trim();
  const label = DOM.newMoodName.value.trim();
  
  if (!emoji || !label) return;
  
  if (state.moodsList.some(m => m.label === label)) {
    showToast('已有同名心情選項', 'error');
    return;
  }
  
  state.moodsList.push({
    emoji,
    label,
    value: label,
    class: 'mood-custom-tag'
  });
  
  DOM.newMoodEmoji.value = '';
  DOM.newMoodName.value = '';
  
  await saveMoodsList();
  showToast('心情選項新增成功！');
}

// Categories Settings Modal UI Actions
function openCategoriesModal() {
  if (!DOM.categoriesModal) return;
  DOM.categoriesModal.classList.remove('hidden');
  DOM.categoriesModal.style.display = 'flex';
  DOM.categoriesModal.style.opacity = '1';
  DOM.categoriesModal.style.pointerEvents = 'auto';
  renderCategoriesModalList();
}

function closeCategoriesModal() {
  if (!DOM.categoriesModal) return;
  DOM.categoriesModal.classList.add('hidden');
  DOM.categoriesModal.style.display = 'none';
}

function renderCategoriesModalList() {
  if (!DOM.categoriesListContainer) return;
  DOM.categoriesListContainer.innerHTML = state.categoriesList.map((cat, idx) => {
    return `
      <div class="mood-manager-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.01); margin-bottom: 0.25rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.10rem;">${cat.emoji}</span>
          <span style="font-size: 0.95rem; font-weight: 500;">${escapeHTML(cat.name)}</span>
        </div>
        <div style="display: flex; gap: 0.35rem;">
          <button type="button" class="mood-item-del-btn" onclick="editCustomCategory(${idx})" title="修改名稱" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px;">
            <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
          </button>
          <button type="button" class="mood-item-del-btn" onclick="deleteCustomCategory(${idx})" title="刪除分類" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px;">
            <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

async function handleAddCategorySubmit(e) {
  e.preventDefault();
  const name = DOM.newCatName.value.trim();
  const emoji = DOM.newCatEmoji.value.trim() || '📁';
  
  if (!name) return;
  
  if (state.categoriesList.some(c => c.name === name)) {
    showToast('此分類名稱已存在', 'error');
    return;
  }
  
  state.categoriesList.push({ name, emoji });
  DOM.newCatName.value = '';
  DOM.newCatEmoji.value = '';
  
  await saveCategoriesList();
  renderCategoriesModalList();
  showToast('文章分類新增成功！');
}

window.editCustomCategory = async function(index) {
  const cat = state.categoriesList[index];
  if (!cat) return;
  
  const newName = prompt(`請輸入分類「${cat.name}」的新名稱：`, cat.name);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) {
    showToast('分類名稱不能為空', 'error');
    return;
  }
  
  if (trimmed !== cat.name && state.categoriesList.some(c => c.name === trimmed)) {
    showToast('該分類名稱已存在', 'error');
    return;
  }
  
  const newEmoji = prompt(`請輸入分類「${trimmed}」的新圖示 (Emoji)：`, cat.emoji);
  if (newEmoji === null) return;
  const trimmedEmoji = newEmoji.trim() || '📁';
  
  const oldName = cat.name;
  cat.name = trimmed;
  cat.emoji = trimmedEmoji;
  
  state.entries.forEach(entry => {
    if (entry.category === oldName) {
      entry.category = trimmed;
      entry.categoryEmoji = trimmedEmoji;
      entry.synced = false;
    }
  });
  
  await saveCategoriesList();
  
  const localEntries = await getAllEntries();
  for (const local of localEntries) {
    if (local.category === oldName) {
      local.category = trimmed;
      local.categoryEmoji = trimmedEmoji;
      local.synced = false;
      await updateEntry(local);
    }
  }
  
  renderCategoriesModalList();
  showToast('分類修改成功，已套用至所有相關日記！');
}

window.deleteCustomCategory = async function(index) {
  if (state.categoriesList.length <= 1) {
    showToast('至少需要保留一個文章分類', 'error');
    return;
  }
  
  const cat = state.categoriesList[index];
  if (confirm(`確定要刪除「${cat.emoji} ${cat.name}」嗎？相關日記的分類標記會保留。`)) {
    state.categoriesList.splice(index, 1);
    await saveCategoriesList();
    renderCategoriesModalList();
    showToast('文章分類已刪除！');
  }
}

async function saveMoodsList() {
  localStorage.setItem('aurawrite-custom-moods', JSON.stringify(state.moodsList));
  
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.updateUser({
          data: { customMoods: state.moodsList }
        });
        if (error) throw error;
      }
    } catch (err) {
      console.warn('Syncing moods to Supabase user metadata failed:', err);
    }
  }
  
  renderEditorMoodSelectionGrid();
  renderMoodChartTemplate();
  renderMoodsModalList();
  await loadData();
}

// ==========================================
// NOTION-STYLE BLOCK EDITOR CORE UTILITIES
// ==========================================

// Add a new block to the editor list
window.addEditorBlock = function(type, initialData = null) {
  const blockId = `block_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const block = {
    id: blockId,
    type: type,
    value: initialData ? initialData.value : '',
    caption: initialData ? initialData.caption : '',
    imagePath: initialData ? initialData.imagePath : null,
    imageBlob: initialData ? initialData.imageBlob : null,
    audioPath: initialData ? initialData.audioPath : null,
    audioBlob: initialData ? initialData.audioBlob : null,
    audioName: initialData ? initialData.audioName : null,
    videoPath: initialData ? initialData.videoPath : null,
    videoBlob: initialData ? initialData.videoBlob : null,
    url: initialData ? initialData.url : '',
    title: initialData ? initialData.title : ''
  };
  
  state.editorBlocks.push(block);
  renderEditorBlocks();
  
  // Auto-focus new text block textarea
  if (type === 'text') {
    setTimeout(() => {
      const items = DOM.editorBlocksList.querySelectorAll('.block-text-input');
      if (items.length > 0) {
        const lastEl = items[items.length - 1];
        lastEl.focus();
      }
    }, 50);
  }
};

// Render block editor list inside editor modal
function renderEditorBlocks() {
  if (!DOM.editorBlocksList) return;
  DOM.editorBlocksList.innerHTML = '';
  
  state.editorBlocks.forEach((block, idx) => {
    const item = document.createElement('div');
    item.className = 'editor-block-item';
    item.setAttribute('data-id', block.id);
    
    // Add Reorder / Delete controller buttons
    item.innerHTML = `
      <div class="block-controls">
        <button type="button" class="block-control-btn" onclick="moveBlock('${block.id}', 'up')" title="上移">⬆️</button>
        <button type="button" class="block-control-btn" onclick="moveBlock('${block.id}', 'down')" title="下移">⬇️</button>
        <button type="button" class="block-control-btn delete" onclick="deleteBlock('${block.id}')" title="刪除">🗑️</button>
      </div>
    `;
    
    const contentBox = document.createElement('div');
    contentBox.className = 'block-content-box';
    
    if (block.type === 'text') {
      contentBox.innerHTML = `
        <textarea class="block-text-input" placeholder="寫點什麼段落文字吧..." oninput="autoResizeTextarea(this); updateBlockValue('${block.id}', this.value);">${escapeHTML(block.value || '')}</textarea>
      `;
    } else if (block.type === 'image') {
      const imgUrl = block.imageBlob ? URL.createObjectURL(block.imageBlob) : block.imagePath;
      if (imgUrl) {
        contentBox.innerHTML = `
          <div class="block-media-preview-container" style="display: flex; flex-direction: column; align-items: center;">
            <img src="${imgUrl}" style="max-height: 220px; border-radius: 8px; max-width: 100%;">
            <input type="text" class="block-caption-input" placeholder="輸入圖片說明 (選填)..." value="${escapeHTML(block.caption || '')}" oninput="updateBlockCaption('${block.id}', this.value);">
          </div>
        `;
      } else {
        contentBox.innerHTML = `
          <div class="file-dropzone" onclick="triggerBlockFileInput('${block.id}')" style="padding: 1.25rem; border: 1px dashed var(--border-color); border-radius: 8px; text-align: center; cursor: pointer;">
            <input type="file" id="file-input-${block.id}" accept="image/*" class="hidden" onchange="handleBlockImageSelect('${block.id}', this.files);">
            <i data-lucide="image" style="width: 28px; height: 28px; color: var(--text-secondary);"></i>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.35rem 0 0 0;">點擊選擇或拖曳圖片至此</p>
          </div>
        `;
      }
    } else if (block.type === 'video') {
      const vidUrl = block.videoBlob ? URL.createObjectURL(block.videoBlob) : block.videoPath;
      if (vidUrl) {
        contentBox.innerHTML = `
          <div class="block-media-preview-container" style="display: flex; flex-direction: column; align-items: center;">
            <video src="${vidUrl}" controls style="max-height: 220px; border-radius: 8px; max-width: 100%;"></video>
            <input type="text" class="block-caption-input" placeholder="輸入影片說明 (選填)..." value="${escapeHTML(block.caption || '')}" oninput="updateBlockCaption('${block.id}', this.value);">
          </div>
        `;
      } else {
        contentBox.innerHTML = `
          <div class="file-dropzone" onclick="triggerBlockFileInput('${block.id}')" style="padding: 1.25rem; border: 1px dashed var(--border-color); border-radius: 8px; text-align: center; cursor: pointer;">
            <input type="file" id="file-input-${block.id}" accept="video/*" class="hidden" onchange="handleBlockVideoSelect('${block.id}', this.files);">
            <i data-lucide="video" style="width: 28px; height: 28px; color: var(--text-secondary);"></i>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.35rem 0 0 0;">點擊選擇或拖曳影片至此</p>
          </div>
        `;
      }
    } else if (block.type === 'audio') {
      const audioUrl = block.audioBlob ? URL.createObjectURL(block.audioBlob) : block.audioPath;
      if (audioUrl) {
        contentBox.innerHTML = `
          <div class="block-media-preview-container" style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; width: 100%;">
            <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); width: 100%;">
              <i data-lucide="music" style="color: var(--accent-primary);"></i>
              <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(block.audioName || '音檔')}</span>
              <audio src="${audioUrl}" controls style="height: 32px; max-width: 200px;"></audio>
            </div>
          </div>
        `;
      } else {
        contentBox.innerHTML = `
          <div class="audio-block-creator" style="display: flex; gap: 0.5rem; width: 100%;">
            <button type="button" class="tool-btn" onclick="triggerBlockFileInput('${block.id}')" style="flex: 1; justify-content: center; height: 42px;">
              <i data-lucide="file-audio"></i>
              <span>選擇音檔</span>
            </button>
            <input type="file" id="file-input-${block.id}" accept="audio/*" class="hidden" onchange="handleBlockAudioSelect('${block.id}', this.files);">
            
            <button type="button" class="tool-btn" id="rec-btn-${block.id}" onclick="toggleBlockRecording('${block.id}')" style="flex: 1; justify-content: center; height: 42px;">
              <i data-lucide="radio"></i>
              <span id="rec-text-${block.id}">開始錄音</span>
            </button>
          </div>
          <div class="recording-state hidden" id="rec-state-${block.id}" style="margin-top: 0.5rem; padding: 0.5rem 0.85rem; border-radius: 8px; background: rgba(239, 68, 68, 0.05); display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <span style="font-size: 0.85rem; color: #ef4444; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
              <span class="record-icon-pulse" style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block;"></span>
              錄音中... <span id="rec-timer-${block.id}">00:00</span>
            </span>
            <button type="button" onclick="stopBlockRecording('${block.id}')" style="background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; border: none; cursor: pointer; font-weight: 500;">停止</button>
          </div>
        `;
      }
    } else if (block.type === 'link') {
      contentBox.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
          <input type="url" class="block-url-input" placeholder="輸入網頁連結 (例如 https://...)" value="${escapeHTML(block.url || '')}" oninput="updateBlockUrl('${block.id}', this.value);">
          <input type="text" class="block-caption-input" placeholder="自訂連結標題 (選填)..." value="${escapeHTML(block.title || '')}" oninput="updateBlockTitle('${block.id}', this.value);">
        </div>
      `;
    }
    
    item.appendChild(contentBox);
    DOM.editorBlocksList.appendChild(item);
    
    // Auto resize textareas on render
    if (block.type === 'text') {
      const ta = contentBox.querySelector('textarea');
      autoResizeTextarea(ta);
    }
  });
  
  lucide.createIcons();
  setupViewportPinner();
}

// Bind viewport pinner helper to scroll active inputs above the keyboard
function setupViewportPinner() {
  const inputs = DOM.writeForm.querySelectorAll('input[type="text"], input[type="url"], textarea, select');
  inputs.forEach(inputEl => {
    if (inputEl.dataset.pinnerBound) return;
    inputEl.dataset.pinnerBound = "true";
    
    inputEl.addEventListener('focus', () => {
      setTimeout(() => {
        inputEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 300);
    });
  });
}

// Textarea auto-resize helper
window.autoResizeTextarea = function(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

// Reorder block up/down
window.moveBlock = function(id, direction) {
  const idx = state.editorBlocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  
  if (direction === 'up' && idx > 0) {
    const temp = state.editorBlocks[idx];
    state.editorBlocks[idx] = state.editorBlocks[idx - 1];
    state.editorBlocks[idx - 1] = temp;
  } else if (direction === 'down' && idx < state.editorBlocks.length - 1) {
    const temp = state.editorBlocks[idx];
    state.editorBlocks[idx] = state.editorBlocks[idx + 1];
    state.editorBlocks[idx + 1] = temp;
  }
  
  renderEditorBlocks();
};

// Delete a block
window.deleteBlock = function(id) {
  state.editorBlocks = state.editorBlocks.filter(b => b.id !== id);
  renderEditorBlocks();
};

// Block input bindings
window.updateBlockValue = function(id, val) {
  const block = state.editorBlocks.find(b => b.id === id);
  if (block) block.value = val;
};

window.updateBlockCaption = function(id, caption) {
  const block = state.editorBlocks.find(b => b.id === id);
  if (block) block.caption = caption;
};

let linkPreviewTimeout = null;
window.updateBlockUrl = function(id, url) {
  const block = state.editorBlocks.find(b => b.id === id);
  if (!block) return;
  block.url = url;
  
  // Clear metadata initially
  block.title = '';
  block.description = '';
  block.image = '';
  
  clearTimeout(linkPreviewTimeout);
  
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    linkPreviewTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const preview = await res.json();
          block.title = preview.title;
          block.description = preview.description;
          block.image = preview.image;
          
          const titleInput = document.querySelector(`.editor-block-item[data-id="${id}"] input[placeholder="自訂連結標題 (選填)..."]`);
          if (titleInput && !titleInput.value) {
            titleInput.value = preview.title;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch link preview:', e);
      }
    }, 1000); // 1s debounce
  }
};

window.updateBlockTitle = function(id, title) {
  const block = state.editorBlocks.find(b => b.id === id);
  if (block) block.title = title;
};

// Parse YouTube video URL to get embed link
function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

// Play YouTube video inline on desktop or open in app on mobile
window.playYouTubeVideo = function(cardEl, event) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const container = cardEl.closest('.card-block-youtube');
  if (!container) return;
  const videoUrl = container.getAttribute('data-video-url');
  const embedUrl = container.getAttribute('data-embed-url');
  
  if (isMobile) {
    // Open in native YouTube app/tab directly on mobile
    window.open(videoUrl, '_blank');
  } else {
    // Replace with inline autoplay player on desktop
    event.preventDefault();
    container.innerHTML = `
      <div class="video-ratio-wrapper">
        <iframe src="${embedUrl}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    `;
  }
};

window.triggerBlockFileInput = function(id) {
  const input = document.getElementById(`file-input-${id}`);
  if (input) input.click();
};

// Select Block Media files
window.handleBlockImageSelect = function(id, files) {
  const file = files[0];
  if (file && file.type.startsWith('image/')) {
    const block = state.editorBlocks.find(b => b.id === id);
    if (block) {
      block.imageBlob = file;
      renderEditorBlocks();
    }
  } else {
    showToast('請選擇合法的圖片檔案', 'error');
  }
};

window.handleBlockVideoSelect = function(id, files) {
  const file = files[0];
  if (file && file.type.startsWith('video/')) {
    const block = state.editorBlocks.find(b => b.id === id);
    if (block) {
      block.videoBlob = file;
      renderEditorBlocks();
    }
  } else {
    showToast('請選擇合法的影片檔案', 'error');
  }
};

window.handleBlockAudioSelect = function(id, files) {
  const file = files[0];
  if (file && file.type.startsWith('audio/')) {
    const block = state.editorBlocks.find(b => b.id === id);
    if (block) {
      block.audioBlob = file;
      block.audioName = file.name;
      renderEditorBlocks();
    }
  } else {
    showToast('請選擇合法的音訊檔案', 'error');
  }
};

// Block voice recording core logic
window.toggleBlockRecording = async function(id) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('您的瀏覽器不支援麥克風錄製', 'error');
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    
    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: '' };
    }
    
    state.mediaRecorder = new MediaRecorder(stream, options);
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) state.audioChunks.push(e.data);
    };
    
    state.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType || 'audio/wav' });
      const block = state.editorBlocks.find(b => b.id === id);
      if (block) {
        block.audioBlob = audioBlob;
        block.audioName = `現場錄製_${new Date().toISOString().split('T')[0]}.wav`;
      }
      
      showToast('錄音錄製完成！');
      stream.getTracks().forEach(track => track.stop());
      renderEditorBlocks();
    };
    
    state.mediaRecorder.start();
    state.isRecording = true;
    
    // Hide picker controls and show active recording bar
    const recState = document.getElementById(`rec-state-${id}`);
    if (recState) recState.classList.remove('hidden');
    
    state.recordingSeconds = 0;
    const timerText = document.getElementById(`rec-timer-${id}`);
    if (timerText) timerText.textContent = '00:00';
    
    state.recordingTimerInterval = setInterval(() => {
      state.recordingSeconds++;
      const m = Math.floor(state.recordingSeconds / 60);
      const s = state.recordingSeconds % 60;
      if (timerText) {
        timerText.textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
      }
    }, 1000);
    
    showToast('錄音中，請說話...', 'info');
  } catch (err) {
    console.error('Mic access failed:', err);
    showToast('取得麥克風權限失敗', 'error');
  }
};

window.stopBlockRecording = function(id) {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    clearInterval(state.recordingTimerInterval);
    
    const recState = document.getElementById(`rec-state-${id}`);
    if (recState) recState.classList.add('hidden');
  }
};

// Form Submission / Upload Saving
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const title = DOM.entryTitle.value.trim();
  const date = DOM.entryDate.value;
  
  // Compile fallback plain content from blocks
  const fallbackContent = state.editorBlocks
    .filter(b => b.type === 'text')
    .map(b => b.value)
    .join('\n\n');
  
  // Category & Emoji resolution
  let category = DOM.entryCategory.value;
  let categoryEmoji = '';
  if (category === 'custom') {
    category = DOM.entryCategoryCustom.value.trim();
    categoryEmoji = DOM.entryCategoryEmoji.value.trim() || '📂';
  } else {
    categoryEmoji = getCategorySymbol(category);
  }
  if (!category) category = '生活隨筆';
  
  // Moods checkboxes resolution
  const checkedMoods = [];
  const moodCheckboxes = DOM.writeForm.querySelectorAll('input[name="entry-moods"]:checked');
  moodCheckboxes.forEach(cb => checkedMoods.push(cb.value));
  
  // Fallback if none checked
  if (checkedMoods.length === 0 && state.moodsList.length > 0) {
    checkedMoods.push(state.moodsList[0].label);
  }
  
  if (!title || !date || state.editorBlocks.length === 0) {
    showToast('請填寫標題、日期並新增內容區塊', 'error');
    return;
  }
  
  // Construct entry data object
  const locationValue = DOM.entryLocation.value.trim();

  const entryData = {
    title,
    date,
    content: fallbackContent,
    category,
    categoryEmoji,
    moods: checkedMoods,
    location: locationValue || null,
    tags: state.editorTags,
    blocks: state.editorBlocks,
    imageBlob: null,
    imagePath: null,
    audioBlob: null,
    audioPath: null,
    audioName: null
  };
  
  DOM.formSaveBtn.disabled = true;
  DOM.formSaveBtn.querySelector('span').textContent = '儲存上傳中...';
  
  try {
    let synced = false;
    let serverSavedEntry = null;
    
    // Attempt central server upload
    try {
      const payload = { ...entryData };
      if (state.editingId) {
        payload.id = state.editingId;
      }
      
      // Convert block blobs to base64 for server delivery
      const payloadBlocks = [];
      for (const block of state.editorBlocks) {
        const bPayload = { ...block };
        if (block.imageBlob) {
          bPayload.imageBlobBase64 = await blobToBase64(block.imageBlob);
          delete bPayload.imageBlob;
        }
        if (block.audioBlob) {
          bPayload.audioBlobBase64 = await blobToBase64(block.audioBlob);
          delete bPayload.audioBlob;
        }
        if (block.videoBlob) {
          bPayload.videoBlobBase64 = await blobToBase64(block.videoBlob);
          delete bPayload.videoBlob;
        }
        payloadBlocks.push(bPayload);
      }
      payload.blocks = payloadBlocks;
      
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        serverSavedEntry = await response.json();
        synced = true;
      }
    } catch (err) {
      console.warn('Saving to central server failed (offline mode). Will sync later.', err);
    }
    
    // Save to local IndexedDB (offline-first copy)
    const localPayload = {
      ...entryData,
      synced: synced,
      blocks: serverSavedEntry ? serverSavedEntry.blocks : entryData.blocks
    };
    
    if (state.editingId) {
      localPayload.id = state.editingId;
      await updateEntry(localPayload);
      showToast(synced ? '寫作紀錄已同步更新！' : '紀錄已儲存於本機 (離線模式)');
    } else {
      if (serverSavedEntry) {
        localPayload.id = serverSavedEntry.id;
      }
      await addEntry(localPayload);
      showToast(synced ? '寫作紀錄已發佈並同步！' : '紀錄已發佈於本機 (離線模式)');
    }
    
    closeEditor();
    await loadData();
  } catch (err) {
    console.error(err);
    showToast('儲存失敗，請重試', 'error');
  } finally {
    DOM.formSaveBtn.disabled = false;
    DOM.formSaveBtn.querySelector('span').textContent = '儲存上傳';
    lucide.createIcons();
  }
}

// Utility to convert Blob/File to Base64 data URI
async function blobToBase64(blob) {
  if (!blob) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Track deletions offline
function trackDeletion(id) {
  const deletedIds = JSON.parse(localStorage.getItem('aurawrite-deleted-ids') || '[]');
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    localStorage.setItem('aurawrite-deleted-ids', JSON.stringify(deletedIds));
  }
}

// Attempt to sync a single deletion to the server
async function attemptServerDelete(id) {
  try {
    const response = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    if (response.ok) {
      const deletedIds = JSON.parse(localStorage.getItem('aurawrite-deleted-ids') || '[]');
      localStorage.setItem('aurawrite-deleted-ids', JSON.stringify(deletedIds.filter(dId => dId !== id)));
    }
  } catch (err) {
    console.warn(`Server deletion for ${id} failed (offline). Will retry on next sync.`, err);
  }
}

// Push local offline additions/updates and pull updates from central Python server
// Push local offline additions/updates and pull updates from Supabase Cloud
async function syncDatabase() {
  if (!supabase) {
    console.log('Supabase client not initialized. Offline mode.');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('User not authenticated. Skipping database sync.');
    return;
  }
  const userId = session.user.id;

  try {
    // 1. Process pending offline deletions
    const deletedIds = JSON.parse(localStorage.getItem('aurawrite-deleted-ids') || '[]');
    for (const dId of deletedIds) {
      try {
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('id', dId)
          .eq('user_id', userId);
          
        if (!error) {
          const freshDeletes = JSON.parse(localStorage.getItem('aurawrite-deleted-ids') || '[]');
          localStorage.setItem('aurawrite-deleted-ids', JSON.stringify(freshDeletes.filter(id => id !== dId)));
        }
      } catch (e) {
        console.warn(`Failed to sync delete for ${dId}:`, e);
      }
    }

    // 2. Push local offline edits (synced === false)
    const localEntries = await getAllEntries();
    const unsyncedEntries = localEntries.filter(e => e.synced === false);

    for (const entry of unsyncedEntries) {
      try {
        // Upload entry-level media blobs
        if (entry.imageBlob && !entry.imagePath) {
          const ext = getExtensionFromMime(entry.imageBlob.type, 'jpg');
          const path = `${userId}/${entry.id}_main_img.${ext}`;
          entry.imagePath = await uploadToSupabaseStorage(path, entry.imageBlob);
        }
        if (entry.audioBlob && !entry.audioPath) {
          const ext = getExtensionFromMime(entry.audioBlob.type, 'webm');
          const path = `${userId}/${entry.id}_main_audio.${ext}`;
          entry.audioPath = await uploadToSupabaseStorage(path, entry.audioBlob);
        }

        // Upload block-level media blobs
        const payloadBlocks = [];
        if (entry.blocks && Array.isArray(entry.blocks)) {
          for (const block of entry.blocks) {
            const bCopy = { ...block };
            if (block.imageBlob && !block.imagePath) {
              const ext = getExtensionFromMime(block.imageBlob.type, 'jpg');
              const path = `${userId}/${entry.id}_block_${block.id}.${ext}`;
              bCopy.imagePath = await uploadToSupabaseStorage(path, block.imageBlob);
            }
            if (block.audioBlob && !block.audioPath) {
              const ext = getExtensionFromMime(block.audioBlob.type, 'webm');
              const path = `${userId}/${entry.id}_block_${block.id}.${ext}`;
              bCopy.audioPath = await uploadToSupabaseStorage(path, block.audioBlob);
            }
            if (block.videoBlob && !block.videoPath) {
              const ext = getExtensionFromMime(block.videoBlob.type, 'mp4');
              const path = `${userId}/${entry.id}_block_${block.id}.${ext}`;
              bCopy.videoPath = await uploadToSupabaseStorage(path, block.videoBlob);
            }
            
            // Remove local binary blob reference from JSON payload
            delete bCopy.imageBlob;
            delete bCopy.audioBlob;
            delete bCopy.videoBlob;
            payloadBlocks.push(bCopy);
          }
        }

        // Prepare db record
        const record = {
          id: entry.id,
          title: entry.title,
          date: entry.date,
          content: entry.content,
          category: entry.category,
          category_emoji: entry.categoryEmoji || '',
          moods: entry.moods,
          location: entry.location || null,
          tags: entry.tags || [],
          blocks: payloadBlocks,
          image_path: entry.imagePath || null,
          audio_path: entry.audioPath || null,
          audio_name: entry.audioName || null,
          user_id: userId,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('entries')
          .upsert(record);

        if (!error) {
          entry.synced = true;
          entry.categoryEmoji = record.category_emoji;
          entry.blocks = entry.blocks ? entry.blocks.map((b, idx) => ({
            ...b,
            imagePath: payloadBlocks[idx].imagePath || null,
            audioPath: payloadBlocks[idx].audioPath || null,
            videoPath: payloadBlocks[idx].videoPath || null
          })) : [];
          
          await updateEntry(entry);
        } else {
          console.error('Upsert failed:', error);
        }
      } catch (e) {
        console.warn(`Failed to push unsynced entry ${entry.id}:`, e);
      }
    }

    // 3. Pull latest entries from Supabase Cloud
    const { data: cloudEntries, error: pullError } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId);

    if (pullError) {
      console.error('Failed to pull cloud entries:', pullError);
      return;
    }

    const latestLocal = await getAllEntries();
    const cloudIds = cloudEntries.map(e => e.id);

    // 4. Remove local entries that were deleted on other devices
    for (const local of latestLocal) {
      if (local.synced === true && !cloudIds.includes(local.id)) {
        await deleteEntry(local.id);
      }
    }

    // 5. Populate local IndexedDB with Supabase entries
    for (const cloud of cloudEntries) {
      const existingLocal = latestLocal.find(e => e.id === cloud.id);
      
      // Merge local blobs to prevent re-downloads when offline
      let mergedBlocks = cloud.blocks ? JSON.parse(JSON.stringify(cloud.blocks)) : [];
      if (existingLocal && existingLocal.blocks) {
        mergedBlocks = mergedBlocks.map(sb => {
          const lb = existingLocal.blocks.find(x => x.id === sb.id);
          if (lb) {
            return {
              ...sb,
              imageBlob: lb.imageBlob || null,
              audioBlob: lb.audioBlob || null,
              videoBlob: lb.videoBlob || null
            };
          }
          return sb;
        });
      }

      const entryToStore = {
        id: cloud.id,
        title: cloud.title,
        date: cloud.date,
        content: cloud.content,
        category: cloud.category,
        categoryEmoji: cloud.category_emoji || '',
        moods: cloud.moods || [],
        location: cloud.location,
        tags: cloud.tags || [],
        blocks: mergedBlocks,
        imagePath: cloud.image_path,
        audioPath: cloud.audio_path,
        audioName: cloud.audio_name,
        createdAt: cloud.created_at,
        synced: true,
        imageBlob: existingLocal ? existingLocal.imageBlob : null,
        audioBlob: existingLocal ? existingLocal.audioBlob : null
      };

      if (existingLocal) {
        await updateEntry(entryToStore);
      } else {
        await addEntry(entryToStore);
      }
    }

    console.log('Sync finished successfully.');
  } catch (err) {
    console.error('Error during local sync:', err);
  }
}

// One-time automatic migration of local db.json entries to Supabase cloud
async function migrateLegacyEntries(userId) {
  if (localStorage.getItem('aurawrite-migrated') === 'true') {
    console.log('Legacy migration already completed. Skipping check.');
    return;
  }
  try {
    // Migrate custom moods if they exist on local server
    try {
      const moodsRes = await fetch('data/moods.json');
      if (moodsRes.ok) {
        const legacyMoods = await moodsRes.json();
        if (legacyMoods && legacyMoods.length > 0) {
          state.moodsList = legacyMoods;
          localStorage.setItem('aurawrite-custom-moods', JSON.stringify(state.moodsList));
          
          await supabase.auth.updateUser({
            data: { customMoods: state.moodsList }
          });
          
          renderEditorMoodSelectionGrid();
          renderMoodChartTemplate();
          console.log('Successfully migrated custom moods from server.');
        }
      }
    } catch (me) {
      console.warn('Failed to migrate custom moods:', me);
    }

    const res = await fetch('data/db.json');
    if (!res.ok) return;
    const legacyEntries = await res.json();
    if (!legacyEntries || legacyEntries.length === 0) return;
    
    // Check if Supabase already has entries
    const { data: cloudEntries, error: pullError } = await supabase
      .from('entries')
      .select('id')
      .eq('user_id', userId);
      
    if (pullError) {
      console.warn('Failed to verify cloud entries during migration check:', pullError);
      return;
    }
    
    if (cloudEntries && cloudEntries.length > 0) {
      // Already has entries in the cloud, skip migration to avoid duplicate operations
      return;
    }
    
    console.log('Migrating legacy entries to Supabase cloud...');
    showToast('正在將您的歷史日記同步至雲端...', 'info');
    
    for (const entry of legacyEntries) {
      // Upload media paths from server to Supabase Storage if they exist
      if (entry.imagePath) {
        try {
          const imgBlob = await (await fetch(entry.imagePath)).blob();
          const ext = getExtensionFromMime(imgBlob.type, 'jpg');
          const path = `${userId}/${entry.id}_main_img.${ext}`;
          entry.imagePath = await uploadToSupabaseStorage(path, imgBlob);
        } catch (e) {
          console.warn('Failed to migrate image:', e);
        }
      }
      if (entry.audioPath) {
        try {
          const audBlob = await (await fetch(entry.audioPath)).blob();
          const ext = getExtensionFromMime(audBlob.type, 'webm');
          const path = `${userId}/${entry.id}_main_audio.${ext}`;
          entry.audioPath = await uploadToSupabaseStorage(path, audBlob);
        } catch (e) {
          console.warn('Failed to migrate audio:', e);
        }
      }
      
      if (entry.blocks && Array.isArray(entry.blocks)) {
        for (const block of entry.blocks) {
          if (block.imagePath) {
            try {
              const imgBlob = await (await fetch(block.imagePath)).blob();
              const ext = getExtensionFromMime(imgBlob.type, 'jpg');
              const path = `${userId}/${entry.id}_block_${block.id}.${ext}`;
              block.imagePath = await uploadToSupabaseStorage(path, imgBlob);
            } catch (e) {
              console.warn('Failed to migrate block image:', e);
            }
          }
          if (block.audioPath) {
            try {
              const audBlob = await (await fetch(block.audioPath)).blob();
              const ext = getExtensionFromMime(audBlob.type, 'webm');
              const path = `${userId}/${entry.id}_block_${block.id}.${ext}`;
              block.audioPath = await uploadToSupabaseStorage(path, audBlob);
            } catch (e) {
              console.warn('Failed to migrate block audio:', e);
            }
          }
          if (block.videoPath) {
            try {
              const vidBlob = await (await fetch(block.videoPath)).blob();
              const ext = getExtensionFromMime(vidBlob.type, 'mp4');
              const path = `${userId}/${entry.id}_block_${block.id}.${ext}`;
              block.videoPath = await uploadToSupabaseStorage(path, vidBlob);
            } catch (e) {
              console.warn('Failed to migrate block video:', e);
            }
          }
          // Remove local file references
          delete block.imageBlob;
          delete block.audioBlob;
          delete block.videoBlob;
        }
      }
      
      const record = {
        id: entry.id,
        title: entry.title,
        date: entry.date,
        content: entry.content,
        category: entry.category,
        category_emoji: entry.categoryEmoji || getCategorySymbol(entry.category),
        moods: entry.moods,
        location: entry.location || null,
        tags: entry.tags || [],
        blocks: entry.blocks || [],
        image_path: entry.imagePath || null,
        audio_path: entry.audioPath || null,
        audio_name: entry.audioName || null,
        user_id: userId,
        created_at: entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date().toISOString(),
        updated_at: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : new Date().toISOString()
      };
      
      await supabase.from('entries').upsert(record);
    }
    
    localStorage.setItem('aurawrite-migrated', 'true');
    showToast('您的歷史日記已成功復原至雲端空間！', 'success');
  } catch (err) {
    console.error('Error migrating legacy entries:', err);
  }
}

// Upload file to Supabase storage bucket
async function uploadToSupabaseStorage(path, blob) {
  if (!blob) return null;
  const { data, error } = await supabase.storage
    .from('aurawrite-media')
    .upload(path, blob, { cacheControl: '3600', upsert: true });
    
  if (error) {
    console.error('Storage upload failed:', error);
    throw error;
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('aurawrite-media')
    .getPublicUrl(path);
    
  return publicUrl;
}

// Helper to determine file extension from mime type
function getExtensionFromMime(mimeType, defaultExt = 'bin') {
  if (!mimeType) return defaultExt;
  const parts = mimeType.split('/');
  if (parts.length < 2) return defaultExt;
  let ext = parts[1].split(';')[0];
  if (ext === 'jpeg') ext = 'jpg';
  if (ext === 'svg+xml') ext = 'svg';
  if (ext === 'quicktime') ext = 'mov';
  return ext;
}

// Helper to convert data URI base64 to Blob
async function base64ToBlob(base64Data) {
  if (!base64Data) return null;
  try {
    const response = await fetch(base64Data);
    return await response.blob();
  } catch (err) {
    console.error('Failed to convert base64 to blob:', err);
    return null;
  }
}

// Export database entries to a single local JSON backup file (including media as Base64)
async function exportBackup() {
  try {
    showToast('準備匯出備份中，請稍候...', 'info');
    const entries = await getAllEntries();
    const backupData = [];
    
    for (const entry of entries) {
      const item = { ...entry };
      if (entry.imageBlob) {
        item.imageBlobBase64 = await blobToBase64(entry.imageBlob);
        delete item.imageBlob;
      }
      if (entry.audioBlob) {
        item.audioBlobBase64 = await blobToBase64(entry.audioBlob);
        delete item.audioBlob;
      }
      
      // Convert block-level media blobs to base64
      if (entry.blocks && Array.isArray(entry.blocks)) {
        const itemBlocks = [];
        for (const block of entry.blocks) {
          const b = { ...block };
          if (block.imageBlob) {
            b.imageBlobBase64 = await blobToBase64(block.imageBlob);
            delete b.imageBlob;
          }
          if (block.audioBlob) {
            b.audioBlobBase64 = await blobToBase64(block.audioBlob);
            delete b.audioBlob;
          }
          if (block.videoBlob) {
            b.videoBlobBase64 = await blobToBase64(block.videoBlob);
            delete b.videoBlob;
          }
          itemBlocks.push(b);
        }
        item.blocks = itemBlocks;
      }
      
      backupData.push(item);
    }
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `aurawrite_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadAnchor.remove();
    }, 100);
    
    showToast('備份資料已成功儲存至下載目錄！');
  } catch (err) {
    console.error(err);
    showToast('備份匯出失敗', 'error');
  }
}

// Import database entries from JSON backup file
async function handleImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      showToast('正在解析與載入備份資料...', 'info');
      const backupData = JSON.parse(event.target.result);
      if (!Array.isArray(backupData)) {
        showToast('檔案格式錯誤，無法解析', 'error');
        return;
      }
      
      let importedCount = 0;
      for (const item of backupData) {
        const entry = { ...item };
        if (item.imageBlobBase64) {
          entry.imageBlob = await base64ToBlob(item.imageBlobBase64);
          delete entry.imageBlobBase64;
        }
        if (item.audioBlobBase64) {
          entry.audioBlob = await base64ToBlob(item.audioBlobBase64);
          delete entry.audioBlobBase64;
        }
        
        // Convert block-level media base64 back to Blobs
        if (entry.blocks && Array.isArray(entry.blocks)) {
          const itemBlocks = [];
          for (const block of entry.blocks) {
            const b = { ...block };
            if (block.imageBlobBase64) {
              b.imageBlob = await base64ToBlob(block.imageBlobBase64);
              delete b.imageBlobBase64;
            }
            if (block.audioBlobBase64) {
              b.audioBlob = await base64ToBlob(block.audioBlobBase64);
              delete b.audioBlobBase64;
            }
            if (block.videoBlobBase64) {
              b.videoBlob = await base64ToBlob(block.videoBlobBase64);
              delete b.videoBlobBase64;
            }
            itemBlocks.push(b);
          }
          entry.blocks = itemBlocks;
        }
        
        // Force synced=false so they are uploaded to the sync server on sync
        entry.synced = false;
        
        // Save to local IndexedDB
        if (entry.id) {
          const latestLocal = await getAllEntries();
          const exists = latestLocal.some(e => e.id === entry.id);
          if (exists) {
            await updateEntry(entry);
          } else {
            await addEntry(entry);
          }
        } else {
          await addEntry(entry);
        }
        importedCount++;
      }
      
      showToast(`成功匯入 ${importedCount} 筆資料！開始與電腦同步...`, 'success');
      // Trigger database sync to push imported items to computer
      await syncDatabase();
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('匯入失敗，請確認備份檔是否正確', 'error');
    }
  };
  reader.readAsText(file);
}

// Escape HTML utility to prevent XSS
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
