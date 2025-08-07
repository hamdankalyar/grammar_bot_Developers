// languageDropdown.js

// Language mapping configuration
export const languageMap = {
    'Dansk': 'da',
    'Engelsk': 'en',
    'Tysk': 'ge',
    'Fransk': 'fr',
    'Spansk': 'es'
};

// Internal variables
let currentLanguage = 'da'; // Default language
let updatePlaceholderCallback = null;

/**
 * Get the current selected language code
 * @returns {string} Current language code (e.g., 'da', 'en')
 */
export function getCurrentLanguage() {
    return currentLanguage;
}

/**
 * Set the current language code
 * @param {string} langCode - Language code to set
 */
export function setCurrentLanguage(langCode) {
    currentLanguage = langCode;
    updateDropdownOptions();
}

/**
 * Get language name from language code
 * @param {string} langCode - Language code (e.g., 'da', 'en')
 * @returns {string} Language name or the langCode itself if not found
 */
export function getLanguageName(langCode) {
    const languageName = Object.entries(languageMap).find(([key, value]) => value === langCode)?.[0];
    // Return the language name if found, otherwise return the langCode itself as fallback
    return languageName || langCode || 'da'; // Default fallback to 'da'
}

/**
 * Close all dropdown menus
 */
export function closeAllDropdowns() {
    document.querySelectorAll('.dk-dropdown').forEach(dropdown => {
        dropdown.classList.remove('dk-show');
    });
    document.querySelectorAll('.dk-language-select').forEach(select => {
        select.classList.remove('dk-active');
    });
}

/**
 * Update dropdown options (calls the placeholder update)
 */
export function updateDropdownOptions() {
    if (updatePlaceholderCallback) {
        const languageName = getLanguageName(currentLanguage);
        // Ensure we always pass a valid string to the callback
        if (languageName && typeof languageName === 'string') {
            updatePlaceholderCallback(languageName);
        } else {
            // Fallback to a default language name
            updatePlaceholderCallback('dansk');
        }
    }
}

/**
 * Handle custom language input
 * @param {HTMLInputElement} input - The custom language input element
 * @param {HTMLElement} languageSelect - The language select container
 */
export function handleCustomLanguage(input, languageSelect) {
    const customLanguage = input.value.trim();
    if (!customLanguage) return;

    const languageText = languageSelect.querySelector('.dk-language-text');
    languageText.textContent = customLanguage;
    
    // Update the current language
    // If it's a known language name, use its code, otherwise use the custom input as the code
    currentLanguage = languageMap[customLanguage] || customLanguage.toLowerCase();
    
    input.value = '';
    closeAllDropdowns();
    updateDropdownOptions();
}

/**
 * Handle dropdown item selection
 * @param {HTMLElement} item - The clicked dropdown item
 */
function handleDropdownItemClick(item) {
    if (item.classList.contains('dk-disabled')) return;

    const languageSelect = item.closest('.dk-language-select');
    const languageText = languageSelect.querySelector('.dk-language-text');
    const selectedLang = item.getAttribute('data-lang');

    languageText.textContent = selectedLang;
    
    // Update the current language
    currentLanguage = languageMap[selectedLang] || selectedLang;
    
    updateDropdownOptions();
    closeAllDropdowns();
}

/**
 * Handle language select container click
 * @param {Event} e - Click event
 * @param {HTMLElement} select - Language select container
 */
function handleLanguageSelectClick(e, select) {
    if (e.target.closest('.dk-custom-input')) return;
    e.stopPropagation();
    
    const dropdown = select.querySelector('.dk-dropdown');
    const isOpen = dropdown.classList.contains('dk-show');
    
    closeAllDropdowns();
    
    if (!isOpen) {
        dropdown.classList.add('dk-show');
        select.classList.add('dk-active');
    }
}

/**
 * Handle custom input keypress
 * @param {Event} e - Keypress event
 * @param {HTMLInputElement} customInput - Custom input element
 * @param {HTMLElement} select - Language select container
 */
function handleCustomInputKeypress(e, customInput, select) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleCustomLanguage(customInput, select);
    }
}

/**
 * Handle custom input click (prevent propagation)
 * @param {Event} e - Click event
 */
function handleCustomInputClick(e) {
    e.stopPropagation();
}

/**
 * Handle document click (close dropdowns when clicking outside)
 * @param {Event} e - Click event
 */
function handleDocumentClick(e) {
    const customInput = e.target.closest('.dk-custom-input');
    if (!customInput) {
        const openDropdown = document.querySelector('.dk-dropdown.dk-show');
        if (openDropdown) {
            const input = openDropdown.querySelector('.dk-custom-input');
            if (input && input.value.trim()) {
                handleCustomLanguage(input, openDropdown.closest('.dk-language-select'));
            }
        }
        if (!e.target.closest('.dk-language-select')) {
            closeAllDropdowns();
        }
    }
}

/**
 * Initialize language dropdown functionality
 * @param {string} initialLanguage - Initial language code (optional, defaults to 'da')
 * @param {Function} updatePlaceholderFunction - Callback to update placeholder
 */
export function initLanguageDropdown(initialLanguage = 'da', updatePlaceholderFunction) {
    // Set initial language and callback
    currentLanguage = initialLanguage;
    updatePlaceholderCallback = updatePlaceholderFunction;

    // Add document click listener
    document.addEventListener('click', handleDocumentClick);

    // Initialize all language select containers
    document.querySelectorAll('.dk-language-select').forEach(select => {
        // Add click listener to language select container
        select.addEventListener('click', (e) => handleLanguageSelectClick(e, select));

        // Handle custom input if it exists
        const customInput = select.querySelector('.dk-custom-input');
        if (customInput) {
            customInput.addEventListener('keypress', (e) => 
                handleCustomInputKeypress(e, customInput, select)
            );
            customInput.addEventListener('click', handleCustomInputClick);
        }
    });

    // Initialize all dropdown items
    document.querySelectorAll('.dk-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDropdownItemClick(item);
        });
    });

    console.log('Language dropdown initialized with language:', currentLanguage);
}

/**
 * Get current language code from language name
 * @param {string} languageName - Language name (e.g., 'Dansk', 'Engelsk')
 * @returns {string} Language code or the original name if not found
 */
export function getLanguageCode(languageName) {
    return languageMap[languageName] || languageName;
}

/**
 * Get all available languages
 * @returns {Object} Language mapping object
 */
export function getAvailableLanguages() {
    return { ...languageMap };
}

/**
 * Get current language display name (safe version that always returns a string)
 * @returns {string} Current language display name
 */
export function getCurrentLanguageDisplayName() {
    const languageName = getLanguageName(currentLanguage);
    return languageName || currentLanguage || 'dansk';
}