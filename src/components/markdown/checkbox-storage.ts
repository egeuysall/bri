'use client';

// Storage key for all markdown checkboxes
const STORAGE_KEY = 'markdownCheckboxes';

/**
 * Get the checkbox state for a specific post and index
 * Returns the stored value if it exists, otherwise returns the default value
 */
export function getCheckboxState(postId: string, index: number, defaultChecked: boolean): boolean {
  if (typeof window === 'undefined') {
    return defaultChecked;
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return defaultChecked;

    const checkboxes = JSON.parse(data);
    const postCheckboxes = checkboxes[postId];

    // If this checkbox has been explicitly set, return the stored value
    if (postCheckboxes && postCheckboxes[index] !== undefined) {
      return postCheckboxes[index];
    }

    // Otherwise return the default value
    return defaultChecked;
  } catch (error) {
    console.error('Error reading checkbox state:', error);
    return defaultChecked;
  }
}

/**
 * Update the checkbox state for a specific post and index
 * Only stores values that differ from the default to minimize storage
 */
export function updateCheckboxState(postId: string, index: number, checked: boolean, defaultChecked: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const checkboxes = data ? JSON.parse(data) : {};

    // Initialize post object if it doesn't exist
    if (!checkboxes[postId]) {
      checkboxes[postId] = {};
    }

    // Only store if different from default
    // If it's the same as default, remove it from storage to save space
    if (checked !== defaultChecked) {
      checkboxes[postId][index] = checked;
    } else {
      // Remove the key if it exists and matches default
      delete checkboxes[postId][index];

      // Clean up empty post objects
      if (Object.keys(checkboxes[postId]).length === 0) {
        delete checkboxes[postId];
      }
    }

    // Only write to localStorage if there's data to store
    if (Object.keys(checkboxes).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkboxes));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error updating checkbox state:', error);
  }
}

/**
 * Clean up storage by removing empty post objects
 */
export function cleanupCheckboxStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;

    const checkboxes = JSON.parse(data);
    let modified = false;

    // Remove empty post objects
    for (const postId in checkboxes) {
      if (Object.keys(checkboxes[postId]).length === 0) {
        delete checkboxes[postId];
        modified = true;
      }
    }

    // Update storage if modified
    if (modified) {
      if (Object.keys(checkboxes).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(checkboxes));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (error) {
    console.error('Error cleaning up checkbox storage:', error);
  }
}
