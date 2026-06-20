/**
 * BigQuery Release Notes Radar - Frontend Controller
 * Vanilla JavaScript implementation for high performance & responsiveness
 */

// Application State
const state = {
    releases: [],          // Raw releases array from backend
    stats: {},             // Feed stats
    lastUpdated: '',       // Last sync timestamp
    
    // Filters & Sorting state
    searchQuery: '',
    selectedCategory: 'all', // 'all' or specific category name
    dateRange: 'all',        // 'all', '7', '30'
    sortOrder: 'desc',       // 'desc' (newest first) or 'asc' (oldest first)
    
    // Composer State
    selectedUpdate: null,    // The active update object selected for tweeting
    composerText: '',        // Current text in the tweet textarea
    activePreset: 'tech',    // 'tech', 'summary', 'hype', 'minimal'
    selectedHashtags: new Set(['#BigQuery', '#GoogleCloud']),
    isTextEdited: false      // Has the user manually edited the textarea?
};

// SVG Circular Progress Ring constants
const RING_CIRCUMFERENCE = 2 * Math.PI * 11; // 2 * pi * r (r=11) = 69.115

// DOM Elements
const DOM = {
    refreshBtn: document.getElementById('refresh-btn'),
    syncStatusText: document.getElementById('sync-status-text'),
    syncStatusBadge: document.getElementById('sync-status'),
    lastUpdatedTime: document.getElementById('last-updated-time'),
    
    // Stats elements
    statsTotalVal: document.getElementById('stats-total-val'),
    statsFeaturesVal: document.getElementById('stats-features-val'),
    statsAnnouncementsVal: document.getElementById('stats-announcements-val'),
    statsIssuesVal: document.getElementById('stats-issues-val'),
    statsDeprecatedVal: document.getElementById('stats-deprecated-val'),
    statCards: document.querySelectorAll('.stat-card'),
    
    // Filter controls
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    categoryPillsList: document.getElementById('category-pills-list'),
    dateFilterBtns: document.querySelectorAll('.date-filters button'),
    clearFiltersBtn: document.getElementById('clear-filters-btn'),
    filteredCountVal: document.getElementById('filtered-count-val'),
    totalCountVal: document.getElementById('total-count-val'),
    
    // Timeline elements
    sortOrderBtn: document.getElementById('sort-order-btn'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    feedLoading: document.getElementById('feed-loading'),
    feedError: document.getElementById('feed-error'),
    feedEmpty: document.getElementById('feed-empty'),
    timelineFeed: document.getElementById('release-timeline-feed'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    
    // Composer elements
    composerEmpty: document.getElementById('composer-empty-state'),
    composerActive: document.getElementById('composer-active-state'),
    composerBadgeCat: document.getElementById('composer-badge-cat'),
    composerBadgeDate: document.getElementById('composer-badge-date'),
    composerSourceSummary: document.getElementById('composer-source-summary'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charProgressCircle: document.getElementById('char-progress-circle'),
    charCounterText: document.getElementById('char-counter-text'),
    charCounterWrapper: document.querySelector('.char-counter-wrapper'),
    presetBtns: document.querySelectorAll('.template-chips button'),
    hashtagBtns: document.querySelectorAll('.hashtag-pill'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    sendTweetBtn: document.getElementById('send-tweet-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Check saved theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-sun theme-toggle-icon';
        }
    }
    setupEventListeners();
    fetchReleaseNotes(false);
});

// Setup Event Handlers
function setupEventListeners() {
    // Refresh button click
    DOM.refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    DOM.retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Theme toggle click
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Search event
    DOM.searchInput.addEventListener('input', handleSearchInput);
    DOM.searchClearBtn.addEventListener('click', clearSearch);
    
    // Stats cards click (triggers category filter)
    DOM.statCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.getAttribute('data-category');
            
            // Remove active style from all stat cards
            DOM.statCards.forEach(c => c.classList.remove('active'));
            
            if (category === 'all') {
                selectCategory('all');
            } else {
                card.classList.add('active');
                selectCategory(category);
            }
        });
    });

    // Date filters click
    DOM.dateFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.dateFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.dateRange = btn.getAttribute('data-range');
            renderTimeline();
        });
    });
    
    // Clear filters triggers
    DOM.clearFiltersBtn.addEventListener('click', resetFilters);
    DOM.resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Sorting trigger
    DOM.sortOrderBtn.addEventListener('click', toggleSorting);
    DOM.exportCsvBtn.addEventListener('click', exportToCSV);
    
    // Tweet composer textarea events
    DOM.tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    
    // Tweet style preset buttons
    DOM.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activePreset = btn.getAttribute('data-style');
            state.isTextEdited = false; // Reset manual edit override on style change
            generateTweetText();
        });
    });
    
    // Hashtags select triggers
    DOM.hashtagBtns.forEach(btn => {
        // Toggle selected state visually
        const hashtag = btn.getAttribute('data-hashtag');
        if (state.selectedHashtags.has(hashtag)) {
            btn.classList.add('selected');
        }
        
        btn.addEventListener('click', () => {
            if (state.selectedHashtags.has(hashtag)) {
                state.selectedHashtags.delete(hashtag);
                btn.classList.remove('selected');
            } else {
                state.selectedHashtags.add(hashtag);
                btn.classList.add('selected');
            }
            
            // Re-generate tweet text or append hashtag
            if (!state.isTextEdited) {
                generateTweetText();
            } else {
                appendOrRemoveHashtagFromText(hashtag);
            }
        });
    });
    
    // Copy/Post buttons in composer
    DOM.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    DOM.sendTweetBtn.addEventListener('click', postTweetToX);
}

// Fetch notes from Flask backend
async function fetchReleaseNotes(forceRefresh = false) {
    // Show spinner & loading state
    DOM.refreshBtn.disabled = true;
    const spinner = DOM.refreshBtn.querySelector('.spinner-icon');
    spinner.classList.add('spinning');
    
    DOM.syncStatusBadge.className = 'sync-status-badge loading';
    DOM.syncStatusText.textContent = 'Syncing...';
    
    DOM.feedError.style.display = 'none';
    
    if (state.releases.length === 0) {
        DOM.feedLoading.style.display = 'flex';
        DOM.timelineFeed.style.display = 'none';
        DOM.feedEmpty.style.display = 'none';
    }

    try {
        const url = `/api/releases?refresh=${forceRefresh}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned HTTP status ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status === 'error') {
            throw new Error(data.message);
        }
        
        // Update App State
        state.releases = data.releases;
        state.stats = data.stats;
        state.lastUpdated = data.last_updated;
        
        // Render dashboard statistics & date filter options
        updateStatsUI();
        
        // Hide loading and show Timeline
        DOM.feedLoading.style.display = 'none';
        DOM.timelineFeed.style.display = 'flex';
        
        DOM.syncStatusBadge.className = 'sync-status-badge';
        DOM.syncStatusText.textContent = 'Live Sync Active';
        DOM.lastUpdatedTime.textContent = state.lastUpdated;
        
        // Render timeline
        renderTimeline();
        
    } catch (err) {
        console.error("Fetch release notes error:", err);
        DOM.feedLoading.style.display = 'none';
        
        DOM.syncStatusBadge.className = 'sync-status-badge error';
        DOM.syncStatusText.textContent = 'Sync Failed';
        
        if (state.releases.length === 0) {
            DOM.errorMessage.textContent = err.message || 'Unable to load release notes.';
            DOM.feedError.style.display = 'flex';
            DOM.timelineFeed.style.display = 'none';
        } else {
            showToast('⚠️ Sync failed. Displaying cached version.');
        }
    } finally {
        DOM.refreshBtn.disabled = false;
        spinner.classList.remove('spinning');
    }
}

// Update the Top Stats Summary cards UI
function updateStatsUI() {
    const s = state.stats;
    DOM.statsTotalVal.textContent = s.total_updates || 0;
    DOM.totalCountVal.textContent = s.total_updates || 0;
    
    // Group categories
    DOM.statsFeaturesVal.textContent = (s.categories['Feature'] || 0) + (s.categories['Change'] || 0);
    DOM.statsAnnouncementsVal.textContent = s.categories['Announcement'] || 0;
    DOM.statsDeprecatedVal.textContent = s.categories['Deprecated'] || 0;
    
    // Compute issues + fixes + breaking sum
    const issues = s.categories['Issue'] || 0;
    const fixes = s.categories['Fixed'] || 0;
    const breaking = s.categories['Breaking'] || 0;
    DOM.statsIssuesVal.textContent = (issues + fixes + breaking);
    
    // Rebuild Category Pills dynamically based on elements available in stats
    rebuildCategoryPills(s.categories);
}

// Build Category filter pills list dynamically based on feed content
function rebuildCategoryPills(categoriesObj) {
    DOM.categoryPillsList.innerHTML = '';
    
    // Create an 'All' pill
    const allPill = document.createElement('button');
    allPill.className = `category-pill ${state.selectedCategory === 'all' ? 'active' : ''}`;
    allPill.setAttribute('data-cat', 'all');
    allPill.innerHTML = `<span>All Categories</span> <span class="pill-count">${state.stats.total_updates}</span>`;
    allPill.addEventListener('click', () => selectCategory('all'));
    DOM.categoryPillsList.appendChild(allPill);
    
    // Create pills for each category found in feed
    Object.entries(categoriesObj)
        .sort((a, b) => b[1] - a[1]) // Sort by highest count
        .forEach(([categoryName, count]) => {
            const pill = document.createElement('button');
            pill.className = `category-pill ${state.selectedCategory === categoryName ? 'active' : ''}`;
            pill.setAttribute('data-cat', categoryName);
            pill.innerHTML = `<span>${categoryName}</span> <span class="pill-count">${count}</span>`;
            pill.addEventListener('click', () => selectCategory(categoryName));
            DOM.categoryPillsList.appendChild(pill);
        });
}

// Set active category and filter feed
function selectCategory(category) {
    state.selectedCategory = category;
    
    // Update pills active states
    const pills = DOM.categoryPillsList.querySelectorAll('.category-pill');
    pills.forEach(p => {
        if (p.getAttribute('data-cat') === category) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });
    
    // Also toggle active state of main top stats cards
    DOM.statCards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (cat === category) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
    
    renderTimeline();
}

// Handle keyword searching
function handleSearchInput() {
    state.searchQuery = DOM.searchInput.value.toLowerCase().trim();
    
    // Toggle search clear button visibility
    if (state.searchQuery.length > 0) {
        DOM.searchClearBtn.style.display = 'flex';
    } else {
        DOM.searchClearBtn.style.display = 'none';
    }
    
    renderTimeline();
}

// Clear Search Input
function clearSearch() {
    DOM.searchInput.value = '';
    state.searchQuery = '';
    DOM.searchClearBtn.style.display = 'none';
    renderTimeline();
}

// Reset all filter conditions back to default
function resetFilters() {
    DOM.searchInput.value = '';
    state.searchQuery = '';
    DOM.searchClearBtn.style.display = 'none';
    
    state.selectedCategory = 'all';
    DOM.statCards.forEach(c => c.classList.remove('active'));
    
    state.dateRange = 'all';
    DOM.dateFilterBtns.forEach(b => {
        if (b.getAttribute('data-range') === 'all') {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
    
    // Update pills active state
    const pills = DOM.categoryPillsList.querySelectorAll('.category-pill');
    pills.forEach(p => {
        if (p.getAttribute('data-cat') === 'all') {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });
    
    renderTimeline();
}

// Toggle descending/ascending dates sorting order
function toggleSorting() {
    const btn = DOM.sortOrderBtn;
    const isDesc = btn.getAttribute('data-order') === 'desc';
    
    if (isDesc) {
        btn.setAttribute('data-order', 'asc');
        btn.querySelector('span').textContent = 'Oldest First';
        btn.querySelector('i').className = 'fa-solid fa-arrow-up-wide-short';
        state.sortOrder = 'asc';
    } else {
        btn.setAttribute('data-order', 'desc');
        btn.querySelector('span').textContent = 'Newest First';
        btn.querySelector('i').className = 'fa-solid fa-arrow-down-wide-short';
        state.sortOrder = 'desc';
    }
    
    renderTimeline();
}

// Get currently filtered releases list based on active state
function getFilteredUpdates() {
    const query = state.searchQuery;
    const category = state.selectedCategory;
    const dateRange = state.dateRange;
    const currentDate = new Date();
    const displayList = [];
    
    state.releases.forEach(dayGroup => {
        const dayDateObj = parseDate(dayGroup.updated);
        
        // Date range filtering check
        if (dateRange !== 'all' && dayDateObj) {
            const timeDiff = currentDate.getTime() - dayDateObj.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            if (daysDiff > parseInt(dateRange)) {
                return; // Skip this day group entirely if past range
            }
        }
        
        // Filter updates inside the day
        const matchedUpdates = dayGroup.updates.filter(update => {
            // Category check
            if (category !== 'all') {
                if (category === 'Issue') {
                    // Combine issue, fixed, and breaking inside issue card
                    if (update.category !== 'Issue' && update.category !== 'Fixed' && update.category !== 'Breaking') return false;
                } else if (category === 'Feature') {
                    // Combine feature and change
                    if (update.category !== 'Feature' && update.category !== 'Change') return false;
                } else if (update.category !== category) {
                    return false;
                }
            }
            
            // Search text check
            if (query.length > 0) {
                const titleMatch = dayGroup.day.toLowerCase().includes(query);
                const categoryMatch = update.category.toLowerCase().includes(query);
                const textMatch = update.content_text.toLowerCase().includes(query);
                return titleMatch || categoryMatch || textMatch;
            }
            
            return true;
        });
        
        if (matchedUpdates.length > 0) {
            displayList.push({
                ...dayGroup,
                updates: matchedUpdates
            });
        }
    });
    
    // Apply sorting
    displayList.sort((a, b) => {
        const timeA = parseDate(a.updated)?.getTime() || 0;
        const timeB = parseDate(b.updated)?.getTime() || 0;
        return state.sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    
    return displayList;
}

// Export the filtered release notes to a CSV file
function exportToCSV() {
    const data = getFilteredUpdates();
    if (data.length === 0) {
        showToast('⚠️ No updates to export.');
        return;
    }
    
    const csvRows = [];
    // Header
    csvRows.push(['Date', 'Category', 'Release Update Description', 'Link']);
    
    data.forEach(dayGroup => {
        dayGroup.updates.forEach(update => {
            csvRows.push([
                dayGroup.day,
                update.category,
                update.content_text,
                dayGroup.link || ""
            ]);
        });
    });
    
    // Convert to CSV string, double escaping quotes
    const csvString = csvRows.map(row => 
        row.map(value => `"${(value || '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const dateFormatted = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `bigquery_releases_${dateFormatted}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('<i class="fa-solid fa-file-csv"></i> Exported to CSV!');
}

// Render the Timeline Release Notes dynamically based on state
function renderTimeline() {
    DOM.timelineFeed.innerHTML = '';
    
    const displayList = getFilteredUpdates();
    
    // Count total matched updates
    let filteredCount = 0;
    displayList.forEach(day => {
        filteredCount += day.updates.length;
    });
    
    DOM.filteredCountVal.textContent = filteredCount;
    
    if (filteredCount === 0) {
        DOM.timelineFeed.style.display = 'none';
        DOM.feedEmpty.style.display = 'flex';
        DOM.clearFiltersBtn.style.display = 'inline-block';
        return;
    }
    
    DOM.feedEmpty.style.display = 'none';
    DOM.timelineFeed.style.display = 'flex';
    
    const query = state.searchQuery;
    const category = state.selectedCategory;
    const dateRange = state.dateRange;
    DOM.clearFiltersBtn.style.display = (query || category !== 'all' || dateRange !== 'all') ? 'inline-block' : 'none';
    
    // Construct HTML Nodes
    displayList.forEach(dayGroup => {
        const dayElement = document.createElement('article');
        dayElement.className = 'timeline-day-group';
        
        // Marker circle
        const marker = document.createElement('div');
        marker.className = 'timeline-day-marker';
        dayElement.appendChild(marker);
        
        // Header
        const header = document.createElement('div');
        header.className = 'timeline-day-header';
        header.innerHTML = `
            <i class="fa-regular fa-calendar day-calendar-icon"></i>
            <h3>${dayGroup.day}</h3>
        `;
        dayElement.appendChild(header);
        
        // Updates block
        const listContainer = document.createElement('div');
        listContainer.className = 'day-updates-list';
        
        dayGroup.updates.forEach(update => {
            const card = document.createElement('div');
            card.className = `update-card ${state.selectedUpdate && state.selectedUpdate.id === update.id ? 'selected' : ''}`;
            card.setAttribute('data-id', update.id);
            card.setAttribute('data-cat', update.category);
            
            // Build card header with badge & actions
            const cardHeader = document.createElement('div');
            cardHeader.className = 'update-card-header';
            
            const badge = document.createElement('span');
            badge.className = 'category-badge';
            badge.setAttribute('data-cat', update.category);
            badge.textContent = update.category;
            cardHeader.appendChild(badge);
            
            const actions = document.createElement('div');
            actions.className = 'update-card-actions';
            
            // Tweet trigger button
            const tweetBtn = document.createElement('button');
            tweetBtn.className = 'action-icon-btn btn-action-tweet';
            tweetBtn.title = 'Tweet this Update';
            tweetBtn.ariaLabel = 'Tweet this Update';
            tweetBtn.innerHTML = '<i class="fa-brands fa-x-twitter"></i>';
            tweetBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid parent card clicks double-triggering
                selectUpdateForTweeting(update, dayGroup.day, dayGroup.link);
            });
            actions.appendChild(tweetBtn);
            
            // Copy text trigger button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'action-icon-btn btn-action-copy';
            copyBtn.title = 'Copy raw text';
            copyBtn.ariaLabel = 'Copy raw text';
            copyBtn.innerHTML = '<i class="fa-regular fa-clone"></i>';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyTextToClipboard(update.content_text);
            });
            actions.appendChild(copyBtn);
            
            // Link trigger button
            if (dayGroup.link) {
                const linkBtn = document.createElement('a');
                linkBtn.className = 'action-icon-btn btn-action-link';
                linkBtn.title = 'View original release documentation';
                linkBtn.ariaLabel = 'View original release documentation';
                linkBtn.href = dayGroup.link;
                linkBtn.target = '_blank';
                linkBtn.rel = 'noopener noreferrer';
                linkBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
                linkBtn.addEventListener('click', (e) => e.stopPropagation()); // Avoid selecting card
                actions.appendChild(linkBtn);
            }
            
            cardHeader.appendChild(actions);
            card.appendChild(cardHeader);
            
            // Content html block
            const cardBody = document.createElement('div');
            cardBody.className = 'update-card-body';
            cardBody.innerHTML = update.content_html;
            card.appendChild(cardBody);
            
            // Selecting card trigger
            card.addEventListener('click', () => {
                selectUpdateForTweeting(update, dayGroup.day, dayGroup.link);
            });
            
            listContainer.appendChild(card);
        });
        
        dayElement.appendChild(listContainer);
        DOM.timelineFeed.appendChild(dayElement);
    });
}

// Convert RSS date string to JS Date object
function parseDate(dateStr) {
    if (!dateStr) return null;
    try {
        return new Date(dateStr);
    } catch (e) {
        return null;
    }
}

// Select an update to load into the Tweet Composer
function selectUpdateForTweeting(update, day, link) {
    state.selectedUpdate = {
        ...update,
        day: day,
        link: link
    };
    state.isTextEdited = false;
    
    // Highlight Card in timeline
    const cards = DOM.timelineFeed.querySelectorAll('.update-card');
    cards.forEach(c => {
        if (c.getAttribute('data-id') === update.id) {
            c.classList.add('selected');
        } else {
            c.classList.remove('selected');
        }
    });
    
    // Open Composer active state, hide empty state
    DOM.composerEmpty.style.display = 'none';
    DOM.composerActive.style.display = 'flex';
    
    // Set Composer header info
    DOM.composerBadgeCat.textContent = update.category;
    DOM.composerBadgeCat.setAttribute('data-cat', update.category);
    DOM.composerBadgeDate.textContent = day;
    DOM.composerSourceSummary.textContent = update.content_text;
    
    // Generate tweet text
    generateTweetText();
    
    // Mobile responsive scroll to composer if visible on screen
    if (window.innerWidth <= 1200) {
        DOM.composerActive.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Generate the Tweet Text based on active Style preset and selected Hashtags
function generateTweetText() {
    if (!state.selectedUpdate) return;
    
    const u = state.selectedUpdate;
    const cat = u.category;
    const day = u.day;
    const rawText = u.content_text;
    
    // Main target link or section anchor link
    // Google anchors are capitalized formatted dates like June_17_2026
    const anchor = day.replace(/,/g, '').replace(/ /g, '_');
    const link = `https://docs.cloud.google.com/bigquery/docs/release-notes#${anchor}`;
    
    // Shorten text to fit within standard Twitter limits
    // Twitter limit is 280, but we also include template overhead (approx 100 chars) & link (23 chars)
    // So we limit the text details to ~120 characters to guarantee safety
    const cleanDetailText = truncateString(rawText, 120);
    
    let baseText = '';
    
    switch (state.activePreset) {
        case 'tech':
            baseText = `🚀 New #BigQuery Update (${day} - ${cat}):\n\n"${cleanDetailText}"\n\nRead more here:`;
            break;
            
        case 'summary':
            baseText = `📝 GCP BigQuery Release Notes Summary (${day}):\n\n• Category: ${cat}\n• Detail: ${cleanDetailText}\n\nDocumentation:`;
            break;
            
        case 'hype':
            baseText = `🔥 BigQuery updates are rolling out! (${day})\n\nGoogle Cloud just added this ${cat} support: "${cleanDetailText}"\n\nFull details:`;
            break;
            
        case 'minimal':
            baseText = `Google BigQuery release (${day})\n\n${cat}: ${cleanDetailText}\n\nLink:`;
            break;
    }
    
    // Append link and active hashtags
    const hashtagsStr = Array.from(state.selectedHashtags).join(' ');
    
    let finalText = `${baseText} ${link}`;
    if (hashtagsStr.length > 0) {
        finalText = `${finalText}\n\n${hashtagsStr}`;
    }
    
    state.composerText = finalText;
    DOM.tweetTextarea.value = finalText;
    
    updateCharacterCount();
}

// Handle manual editing of the tweet text inside textarea
function handleTweetTextareaInput() {
    state.composerText = DOM.tweetTextarea.value;
    state.isTextEdited = true;
    updateCharacterCount();
}

// Append or remove a clicked hashtag directly from manual textarea text
function appendOrRemoveHashtagFromText(hashtag) {
    let currentText = DOM.tweetTextarea.value.trim();
    
    if (state.selectedHashtags.has(hashtag)) {
        // Tag was selected (added), append to textarea
        if (!currentText.includes(hashtag)) {
            // Append with proper spacer
            if (currentText.includes('#')) {
                // If there's already tags, just append a space and tag
                DOM.tweetTextarea.value = `${currentText} ${hashtag}`;
            } else {
                // Double newline then append tag
                DOM.tweetTextarea.value = `${currentText}\n\n${hashtag}`;
            }
        }
    } else {
        // Tag was deselected (removed), remove from textarea
        const regex = new RegExp(`\\s*${hashtag}`, 'g');
        let cleaned = currentText.replace(regex, '').trim();
        // Clean trailing newlines if empty
        DOM.tweetTextarea.value = cleaned;
    }
    
    state.composerText = DOM.tweetTextarea.value;
    updateCharacterCount();
}

// Update the character counter circle and label text
function updateCharacterCount() {
    const textLength = state.composerText.length;
    const charsRemaining = 280 - textLength;
    
    // Update labels
    DOM.charCounterText.textContent = charsRemaining;
    
    // Calculate progress ring percentage
    const percent = Math.min(textLength / 280, 1);
    const offset = RING_CIRCUMFERENCE - (percent * RING_CIRCUMFERENCE);
    DOM.charProgressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    DOM.charProgressCircle.style.strokeDashoffset = offset;
    
    // Handle coloring categories
    DOM.charCounterWrapper.classList.remove('warning', 'danger');
    if (charsRemaining <= 0) {
        DOM.charCounterWrapper.classList.add('danger');
    } else if (charsRemaining <= 20) {
        DOM.charCounterWrapper.classList.add('warning');
    }
    
    // Enable/disable Post Tweet button
    if (textLength === 0 || charsRemaining < 0) {
        DOM.sendTweetBtn.disabled = true;
    } else {
        DOM.sendTweetBtn.disabled = false;
    }
}

// Copy Tweet composer text to clipboard
function copyTweetToClipboard() {
    copyTextToClipboard(state.composerText);
}

// Launch Twitter intent web view in a new window tab
function postTweetToX() {
    const text = state.composerText;
    if (text.length === 0 || text.length > 280) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
}

// Helper: General utility copy text logic with showing temporary toast notification
function copyTextToClipboard(text) {
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('<i class="fa-solid fa-circle-check"></i> Copied to Clipboard!');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('<i class="fa-solid fa-circle-check"></i> Copied to Clipboard!');
        } catch (err) {
            showToast('⚠️ Copy failed. Please select text manually.');
        }
        document.body.removeChild(textArea);
    });
}

// Helper: Toast alerts display manager
let toastTimeout;
function showToast(messageHtml) {
    // Remove existing toast alert if present
    let toast = document.querySelector('.toast-alert');
    if (toast) {
        toast.remove();
        clearTimeout(toastTimeout);
    }
    
    // Construct new toast
    toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.innerHTML = messageHtml;
    document.body.appendChild(toast);
    
    // Micro transition trigger
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Dismiss timeout
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Helper: Smart String Truncate
function truncateString(str, num) {
    if (str.length <= num) {
        return str;
    }
    // Truncate at a space boundary to prevent cutting words in half
    const sub = str.slice(0, num);
    const lastSpace = sub.lastIndexOf(' ');
    if (lastSpace > num * 0.7) {
        return `${sub.slice(0, lastSpace).trim()}...`;
    }
    return `${sub.trim()}...`;
}

// Helper: Toggle theme color scheme
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    const icon = DOM.themeToggleBtn.querySelector('i');
    
    if (isLight) {
        if (icon) icon.className = 'fa-solid fa-sun theme-toggle-icon';
        localStorage.setItem('theme', 'light');
        showToast('☀️ Light Theme Enabled');
    } else {
        if (icon) icon.className = 'fa-solid fa-moon theme-toggle-icon';
        localStorage.setItem('theme', 'dark');
        showToast('🌙 Dark Theme Enabled');
    }
}
