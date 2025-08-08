// cookieManager.js

/**
 * Get a cookie value by name
 * @param {string} name - The name of the cookie
 * @returns {string|null} - The cookie value or null if not found
 */
export const getCookie = name => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
};

/**
 * Set a cookie with name, value and expiration days
 * @param {string} name - The name of the cookie
 * @param {string|boolean|number} value - The value to store
 * @param {number} days - Number of days until expiration
 */
export const setCookie = (name, value, days) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/';
};

/**
 * Delete a cookie by setting its expiration to the past
 * @param {string} name - The name of the cookie to delete
 */
export const deleteCookie = name => {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};

/**
 * Check if a cookie exists
 * @param {string} name - The name of the cookie
 * @returns {boolean} - True if cookie exists, false otherwise
 */
export const cookieExists = name => {
  return getCookie(name) !== null;
};
