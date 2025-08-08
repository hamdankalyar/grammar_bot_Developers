// textToSpeech.js

import { getCurrentLanguage } from './languageDropdown';

// TTS State variables
let audio;
let isSpeaking = false;
let isLoading = false;
let audioBlob = null;
let selectedGender = 'female'; // Default gender
let currentFetch = null;

// Initialize TTS system
export function initializeTTS() {
  console.log('TTS initialization starting...');

  // Make sure we have the read button
  const readBtn = document.getElementById('readBtn');
  if (!readBtn) {
    console.error('Read button not found in the DOM');
    return;
  }

  console.log('Read button found:', readBtn);

  // Create gender selection dropdown
  createGenderSelector();

  // Create audio controls
  createAudioControls();

  // Remove any existing click listeners to avoid duplicates
  const newReadBtn = readBtn.cloneNode(true);
  readBtn.parentNode.replaceChild(newReadBtn, readBtn);

  // Add click event listener to the read button
  newReadBtn.addEventListener('click', function (e) {
    console.log('Read button clicked');

    if (isLoading) {
      console.log('Currently loading - canceling fetch');
      cancelFetch();
    } else if (isSpeaking) {
      console.log('Currently speaking - pausing playback');
      pauseSpeaking();
    } else if (audioBlob) {
      console.log('Audio already fetched - resuming playback');
      resumeSpeaking();
    } else {
      console.log('Showing gender selection dropdown');
      showGenderSelector();

      // Ensure the dropdown is visible
      setTimeout(() => {
        const selector = document.getElementById('genderSelector');
        if (selector) {
          console.log('Gender selector display state:', selector.style.display);

          // Force show if needed
          if (selector.style.display !== 'block') {
            selector.style.display = 'block';
          }

          // Make the options clickable
          const maleOption = document.getElementById('maleOption');
          const femaleOption = document.getElementById('femaleOption');

          if (maleOption) {
            console.log('Found male option, ensuring click handler');
            maleOption.onclick = function (event) {
              console.log('Male option clicked');
              event.stopPropagation();
              selectedGender = 'male';
              hideGenderSelector();
              safeTextToSpeech();
            };
          }

          if (femaleOption) {
            console.log('Found female option, ensuring click handler');
            femaleOption.onclick = function (event) {
              console.log('Female option clicked');
              event.stopPropagation();
              selectedGender = 'female';
              hideGenderSelector();
              safeTextToSpeech();
            };
          }
        }
      }, 100);
    }
  });

  // Add page unload and visibility change handlers
  setupPageEventHandlers();

  console.log('TTS initialization complete');
}

// Export stop function for external use
export function stopSpeaking() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio = null;
  }

  isSpeaking = false;
  toggleIcons('idle');
  hideAudioControls();
  audioBlob = null;
}

// Export manual stop function for external use
export function manualStopSpeaking() {
  stopSpeaking();
}

// Create gender selection dropdown
function createGenderSelector() {
  // Remove any existing selector first to avoid duplicates
  const existingSelector = document.getElementById('genderSelector');
  if (existingSelector) {
    existingSelector.remove();
  }

  // Create the dropdown container
  const genderSelector = document.createElement('div');
  genderSelector.id = 'genderSelector';
  genderSelector.className = 'gender-selector';
  genderSelector.style.display = 'none';
  genderSelector.style.position = 'absolute';
  genderSelector.style.backgroundColor = '#fff';
  genderSelector.style.border = '1px solid #B3B3B3';
  genderSelector.style.borderRadius = '4px';
  genderSelector.style.zIndex = '1000';
  genderSelector.style.top = '100%'; // Position right below the parent element
  genderSelector.style.left = '50%'; // Center horizontally
  genderSelector.style.transform = 'translateX(-50%)'; // Adjust to center precisely
  genderSelector.style.marginTop = '5px'; // Small gap between button and dropdown

  // Create the male option with ID for easier selection
  const maleOption = document.createElement('div');
  maleOption.id = 'maleOption'; // Add explicit ID
  maleOption.className = 'gender-option';
  maleOption.style.padding = '8px 15px';
  maleOption.style.cursor = 'pointer';
  maleOption.style.display = 'flex';
  maleOption.style.alignItems = 'center';
  maleOption.style.justifyContent = 'space-between';
  maleOption.style.backgroundColor = '#CDE5FF';
  maleOption.style.marginBottom = '8px';

  const maleIcon = document.createElement('span');
  maleIcon.className = 'gender-icon-divs';
  maleIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 327.54 512">
                        <path fill="#bcbc50" d="M199.17,340.98c1.63.31,3.26.66,4.84,1.14s3.11.97,4.52,1.71c21.22,11.18,42.48,22.42,63.43,34.08,12.64,7.04,25.15,14.25,37.4,21.95,7.29,4.58,20.58,23.21,17.81,32.12-30.31,39.21-72.06,65.4-120.81,75.68l-24.19,4.31h-3c-1.58-.79-3.41-.8-5,0h-2c-1.58-.79-3.41-.8-5,0h-12c-2.24-.84-4.76-.84-7,0-.98-.07-2.02.09-3,0-56.19-5.33-111.08-36.41-145-81-1.18-5.77,4.24-13.64,7.74-18.64,4.46-6.39,9.76-12.06,16.27-16.44l102.97-56.09,2.02,1.18,2.05,1.36c-2.46,52.93,68.51,52.88,65.69-.04l2.26-1.32Z"/>
                        <path fill="#343c4a" d="M188.17,0c4.08,1.59,8.31,2.35,12.36,4.14,29.91,13.24,28.98,50.96,75.13,46.84,8.01-.72,31.17-9.42,36.25-7.25,9.92,4.25.02,24.41-3.56,30.93-6.01,10.95-19.64,27.3-29.17,35.33l-1.63,3.9c-42.23,33.93-96.92,15.5-140.65-4.52-27.62-13.47-54.43-7.2-71.06,19.22-2.71,4.08-5.6,5.55-8.66,4.39-2.49,1.13-7.36-2.4-7.73-4.45-.11-.6,2.58.26-.27,1.45C-5.06,81.12,38.96-10.7,112.37,3.3c7.8,1.49,20.63,8.82,26.31,8.79,5.19-.03,10.01-4.68,14.97-6.11l19.52-5.98h15Z"/>
                        <path fill="#dbd69c" d="M155.17,511.97h-7c1.26-1.65,5.74-1.65,7,0Z"/>
                        <path fill="#c3c464" d="M172.17,511.97h-5c.66-1.58,4.34-1.58,5,0Z"/>
                        <path fill="#dbd79d" d="M179.17,511.97h-5c.66-1.58,4.34-1.58,5,0Z"/>
                        <path fill="#243046" d="M57.17,132.99l2.61-.5c6.19,5.65,12.86,10.51,20.04,14.57,57.43.41,114.85.06,172.25-1.05l24.73-19.7,2.38.68v6c1.97,4.64,1.97,9.36,0,14l-1.66,3.79c-4.74,3.81-9.57,7.38-14.5,10.7l.37,28.53c-1.38,26.54-9.2,35.05-36.27,37.23-15.87,1.28-37.61,1.54-49.23-10.29-2.74-2.79-9.51-10.68-5.73-13.46-.77,0-1.96-.18-2-.68-.69-8.47-1.14-28.65,0-36.63l2-1.19c-1.65,3.28-14.06,3.13-16,0,.78,0,1.97.19,2,.68.34,5.44,1.02,33.28,0,36.63l-2,1.19c.88.2,1.85.7,1.82,1.5-.16,4.18-9.25,14.61-12.91,16.88-9.19,5.68-27.64,5.76-38.41,5.47-43.4-1.19-42.85-21.19-41.05-58.09.88-5.54-.75-9.46-4.87-11.75-5.16-2.79-9.02-6.29-11.57-10.51-2.87-4.33-2.94-9.7,0-14,.02-1-.06-2.01,0-3,.05-.91-.48-2.76.49-2.99,2.55,1.94,4.96,4.07,7.51,5.99Z"/>
                        <path fill="#fecebe" d="M279.17,109.99v17l-26.62,20.87c-57.26,2.64-115.35.33-172.92,1.17-4.45-.61-17.82-12.55-22.46-16.04,6.68-2.86,9.41-9.59,13.97-14.52,34.07-36.8,65.26-8.13,103.26,3.79,37.49,11.76,72.86,14.6,104.76-12.26Z"/>
                        <path fill="#feb09e" d="M317.17,162.99c.48,2.64.82,5.38,0,8-2.74,17.82-11.15,26.71-29,30l-8.45.54c-1.58,1.43-2.12.52-2.55-1.45v-49.65s2.01-3.44,2.01-3.44c0-4.65,0-9.35,0-14,20.37-.47,34.11,10.03,38,30Z"/>
                        <path fill="#dece96" d="M318.17,167.99c-.07,1.75-.93,2.51-1,3v-8c.33,1.71,1.11,2.16,1,5Z"/>
                        <path fill="#feb09e" d="M49.17,132.99c-.08,4.65.02,9.35,0,14,2.2,17.59,2.81,35.28,1.83,53.09-.61,1.37-2.22,2-4.83,1.91-19.9-.72-32.25-11.46-35-31-.83-2.62-.47-5.36,0-8,.21-1.23-.19-2.69.23-4.22,4.73-16.83,20.48-27.1,37.77-25.78Z"/>
                        <path fill="#dece96" d="M11.17,170.99c-.06-.45-.95-1.24-1-3-.08-2.83.72-3.37,1-5v8Z"/>
                        <path fill="#feb09e" d="M198.17,314.98l1,26c-1.85,9.45.17,15.59-4.61,24.89-13.1,25.47-51.16,23.7-62.12-2.66-2.43-5.84-3.08-16.01-3.27-22.23-.04-1.17.96-2.84.94-4.51-.09-7.17-.49-14.31.06-21.49l4.61-.74c19.22,5.26,39.57,5.25,58.79,0l4.6.74Z"/>
                        <path fill="#fecebe" d="M49.17,146.99c2.85,1.87,16.61,11.17,17.51,12.99,2.23,4.54-.41,32.49.94,41.06s6.68,16.76,14.51,20.49c11.03,5.24,50.62,5.43,61.18-.89,4.14-2.48,12.86-12.48,12.86-17.14v-38.5h16v38.5c0,4.51,8.34,14.17,12.25,16.75,9.34,6.15,34.75,5.59,46.29,4.79,39.13-2.71,29.07-35.95,30.62-64.38l17.84-13.66v54s9,0,9,0c-2.79.51-5.54,1.75-9,1,1.18,51.66-31.87,97.78-81,113-22.4,6.94-45.57,6.97-68,0-49.15-15.27-82.16-61.3-81-113-1-.04-2,.04-3,0l3.08-2.44c-.08-17.52-.17-35.06-.08-52.56Z"/>
                        <rect fill="#343c4a" x="83.17" y="164.99" width="58" height="14"/>
                        <rect fill="#343c4a" x="187.17" y="164.99" width="58" height="14"/>
                        <path fill="#343c4a" d="M83.18,193.99l56.37.24c4.8,1.78-.82,13.26-7.11,14.53-6.22,1.26-31.89,1.01-38.77.23-8.4-.96-11.62-6.97-10.49-15Z"/>
                        <path fill="#343c4a" d="M245.16,193.99c1.33,7.76-2.38,14.05-10.47,15.02-6.61.79-32.78.96-38.79-.25-6.3-1.27-11.92-12.78-7.09-14.58l56.36-.18Z"/>
                        <path fill="#feb09e" d="M188.82,245.28c6.44-.35,9.14,6.1,6.84,11.69-5.63,13.69-24.96,21.13-38.85,17.97-9.06-2.06-30.01-14.28-23.69-25.5,6.54-11.62,16.27,6.1,22.36,8.74,8.17,3.54,16.79,1.88,23.23-4.14,3.17-2.96,4.92-8.47,10.11-8.75Z"/>
                        </svg>`;

  const maleText = document.createElement('span');
  maleText.textContent = 'Mads';

  maleOption.appendChild(maleIcon);
  maleOption.appendChild(maleText);

  // Create the female option with ID for easier selection
  const femaleOption = document.createElement('div');
  femaleOption.id = 'femaleOption'; // Add explicit ID
  femaleOption.className = 'gender-option';
  femaleOption.style.padding = '8px 15px';
  femaleOption.style.cursor = 'pointer';
  femaleOption.style.display = 'flex';
  femaleOption.style.alignItems = 'center';
  femaleOption.style.justifyContent = 'space-between';
  femaleOption.style.backgroundColor = '#FFCED9';

  const femaleIcon = document.createElement('span');
  femaleIcon.innerHTML = `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 383.39">
                                    <g>
                                        <path fill="#6c7fd7" d="M51.65,265.87c.62-.41,1.26-.78,1.94-1.06,3.53-1.45,20.39-.72,25.57-.36,1.41.1,2.71.76,3.93,1.43l-1.76,1.82c-8.96.38-17.91.61-26.87.7l18.15,53.93,1.49,1.36c10.56,2.05,12.16,6.88,5.66,15.35l-.2,2,23.1,40.84-.87,1.51H10.48l-.03-79.75c1.23-18.76,16.66-35.05,35.21-37.77.18-.67.43-.65.75,0,1.69.55,3.56.66,5.24,0Z"/>
                                        <path fill="#6c7fd7" d="M216.33,383.39h-74.11l-.97-1.33,23.22-41.1-.32-2.15c-7.26-9.45-3.55-12.8,6.5-15.53,5.67-16.59,11.55-33.2,17.63-49.81l2.59-4.6c5.36-1.01,12.1,5.2,15.75,9.2,6.76,7.4,10.5,17.04,11.22,26.99l-.02,77.43-1.5.91Z"/>
                                        <path fill="#8694dd" d="M180.4,266.62c3.74-.87,16.16-1.2,10.48,2.25-5.99,18.04-12.3,36-18.13,54.1-1.93,4.16-9.43,2.29-10.76,6.5-1.44,4.55,5.21,7.65,3.87,12.03l-23.64,41.9h-11.98c.29-3.88.61-7.79,1.54-11.58,3.67-14.99,7.46-30,11.4-44.92.49-1.87,1.18-3.68,1.89-5.5s1.54-3.6,2.38-5.37l-.83-2.75c4.75-14.9,8.68-29.98,11.78-45.26l1.78-2.14,1.33-1.04c5.84-.26,11.72-.19,17.65.2l1.23,1.59Z"/>
                                        <path fill="#8694dd" d="M96.56,316.02c.85,1.77,1.67,3.55,2.38,5.37s1.4,3.63,1.89,5.5c3.93,14.92,7.73,29.93,11.4,44.92.93,3.79,1.25,7.69,1.54,11.58h-11.98l-23.64-41.9c-1.33-4.37,5.32-7.48,3.87-12.03s-8.84-2.45-10.76-6.5l-18.87-55.99c10.11-1.31,20.85.84,30.68-1.11.21-.65.46-.64.75,0l1.76,2.06c3.1,15.33,7.03,30.47,11.82,45.41l-.85,2.68Z"/>
                                        <path fill="#d4d9f2" d="M147.46,316.02c-5.68,22.46-11.15,45.01-17.22,67.37h-16.47c-6.07-22.36-11.54-44.9-17.22-67.37l.7-1.5h49.29l.91,1.5Z"/>
                                        <path fill="#4f66cf" d="M192.37,265.87l3.74.75c.2-2.08.96-2.47,2.25-.75,3.96,1.26,8.08,1.78,11.96,3.38,12.5,5.18,22.84,18.57,24,32.15l-.03,81.99h-17.96l.03-78.25c-1.2-16.26-10.34-30.03-25.48-36.28.25-.75.35-1.53.75-2.24-3.73-.12-7.5.14-11.23,0-1.1-1.13-.69-1.54.75-.75l10.29-1.48.94,1.48Z"/>
                                        <path fill="#5a5a5a" d="M116.77.14c2.44.6,5.04.63,7.49,0,2.59.01,6.26-.63,8.23.75-.11.74-1.08.45-1.02.45,11.12,1.37,19.75,2.71,30.17,7.38,26.96,12.11,49.61,37.85,56.23,66.85,1.68,7.38,5.34,33.73,1.88,39.18-.33.51-.74.97-1.18,1.41-.81,2.07-6.08,2.26-6.74,0-4.74,2.17-11.84,2.35-16.47,0-15.99,2.29-33.48,2.71-49.4,0-34.78.26-66.09-26.33-69.45-61.82-.71-.56-9.22,6.66-10.57,7.91l-2.32.02-1.32,3.14c-14.11,12.61-23.91,29.28-27.37,47.94l-2,2.81-1.4,1.47c-5.63-.42-10.84,1.65-15.83,3.89l-1.48-.87c3.09-12.03,3.13-24.7,5.46-36.83C28.66,37.15,69.42,2.51,116.77.14Z"/>
                                        <path fill="#5a5a5a" d="M32.93,177.54l1.93,2.29c5.36,26.57,23.13,50.25,47.28,62.6l1.69,2.47c2.43,4.17,2.19,11.4,0,15.72,2.07,1.01,2.18,4.36,0,5.24h-.75c-10.45.31-21-.41-31.44,0-1.66.67-3.57.57-5.24,0-.25.03-.51-.04-.75,0-18.49-2.01-35.48-14.84-42.28-32.2-8.65-22.11,1.86-45.58,3.35-68.1l.8-.6c6.81,5.4,14.14,11.08,23.71,11.07l1.7,1.5Z"/>
                                        <path fill="#444" d="M237.29,168.56c-.58,17.55,9.1,35.63,5.77,54.8-4.16,23.93-21.74,38.02-44.69,42.51-.63.12-1.33.63-2.25.75l-3.74-.75c-3.28-.05-8.21-.44-11.23,0l1.83-1.91c28.12-6.13,45.3-32.35,39.8-60.55l-3.96-24.33,1.25-2.29.66-1.7c5.31-1.44,9.85-3.96,13.38-8.16,2.37-1.85,2.97-1.13,3.18,1.63Z"/>
                                        <path fill="#f79480" d="M218.57,116.16c1.77-2.69,9.63.68,10.48,3.74,13.9,8,18.51,25.81,12.12,40.19-1.51,3.39-3.75,4.43-3.89,8.46-1.16-1.17-.17-2.04-1.87-.75s-2.77,3.09-4.63,4.36c-2.87,1.97-7.31,3.88-10.72,4.63-.83,2.66-6.91,3.19-8.23.75-2.01-1.78-.67-8.16,1.5-9.36-.59-.06-1.48-.27-1.5-.69-.45-11.45-.84-26.54,0-37.8-.47-2.3.03-3.7,1.5-4.18-2.48,0-3.59-8.18-1.5-9.36,2.17.07,4.68-.25,6.74,0Z"/>
                                        <path fill="#fea68e" d="M32.93,116.16l1.35,1.09-1.33,10.55-1.51.72c.59.06,1.48.27,1.5.69.46,11.07.46,24.02,0,35.1l-1.5.89,1.53,1,1.32,10.35-1.36,1c-7.58.21-14.99-2.54-20.9-7.17-.97-.76-4.77-4.08-5.3-4.8-9.82-13.36-6.14-35.46,7.49-44.91,1.72-1.2,8.93-3.75,11.19-4.15,2.54-.46,4.98-.38,7.52-.34Z"/>
                                        <path fill="#444" d="M132.49.89c7.46-.15,16.17,1.87,23.37,3.96,39.67,11.5,69.8,45.88,72.44,87.75.57,9.07-.95,18.37.76,27.31-2.59-1.49-7.54-3.38-10.48-3.74,1.64-12.54.82-26.5-1.86-38.93C208,36.84,169.71,4.54,128.75,1.63c-.05-1.35,2.8-.72,3.74-.74Z"/>
                                        <path fill="#4b4b4b" d="M124.26.14c-1.66,1.28-5.97,1.24-7.49,0,2.47-.12,5.01-.01,7.49,0Z"/>
                                        <path fill="#9aa2c3" d="M51.65,265.87c-.95,1.24-4.29,1.24-5.24,0,1.64-.18,3.53.07,5.24,0Z"/>
                                        <path fill="#fea68e" d="M160.19,260.63c2.2.7,2.33,4.71,0,5.24-1.63,15.01-8.89,34.99-12.73,50.15h-50.9c-3.81-15.05-11.18-35.3-12.73-50.15-.17-1.65.06-3.53,0-5.24l3.53-.22c22.96,8.69,48.44,8.65,70.88-.82l1.95,1.04Z"/>
                                        <path fill="#5a5a5a" d="M220.07,176.79c2.02,19.76,9.3,37.07,1.63,56.65-6.78,17.33-22.46,29.03-40.56,32.43-.35.05-.67.39-.75.75-2.78-.11-5.34-.8-7.86-.82-3.91-.03-8.4,2.14-12.35.07.18-1.64-.06-3.53,0-5.24-2.25-4-2.42-11.78,0-15.72l1.93-2.56c24.7-12.1,42.41-35.31,47.74-62.28l1.98-2.53c2.62.05,5.69-.2,8.23-.75Z"/>
                                        <path fill="#8694dd" d="M196.12,266.62c-1.1.14-3.2.32-3.74-.75,1.2.02,3.11-.45,3.74.75Z"/>
                                        <path fill="#fecdbe" d="M145.96,116.16c16.44.34,32.96-.15,49.4,0,1.71.84,2.14,5.22,2.24,7.26.9,18.37,2.01,41.72-2.06,59.56-8.5,37.31-42.89,70.77-82.52,69.41-.44.33-.89.64-1.38.85-3.06,1.34-25.06-4.2-27.04-6.9-.32-.43-.56-.93-.77-1.44-26.18-12.05-46.36-38.95-50.9-67.37-.52-3.26-1.5-9.47-1.5-12.35v-36.68c0-3.02.98-8.98,1.5-12.35,3.37-21.83,14.19-39.89,30.69-53.89l2.05,1.96c10.3,36.49,44.8,51.55,80.29,51.93Z"/>
                                        <path fill="#feaf9d" d="M211.84,116.16l1.5,9.36v42.67c0,2.06-1.1,6.97-1.5,9.36-4.96,29.74-24.23,54.95-51.65,67.37-5.18,5.38-15.35,7.28-22.89,8.46s-17.71,2.47-24.27-.97c44.4-2.33,80.56-40.05,83.12-84.17.77-13.22.68-30.97,0-44.23-.13-2.6-1.24-5.14-.78-7.83,5.47.05,11.01-.19,16.47,0Z"/>
                                        <path fill="#feaf9d" d="M145.96,116.16c-9.24-.19-17.79-.04-26.97-1.85-26.62-5.24-49.07-25.48-55.37-52.05,4.49-3.81,8.76-7.93,14.21-10.48,1.51,30.39,24.83,54.94,53.75,61.91l14.38,2.47Z"/>
                                        <path fill="#f79480" d="M113.03,252.4c16.51,1.71,31.87-.56,47.16-7.49-.11,5.22.17,10.77,0,15.72-4.14.94-7.88,2.95-11.98,4.12-21.29,6.06-43.99,4.26-64.37-4.12-.19-5.19.14-10.5,0-15.72,8.81,4.05,19.55,6.49,29.19,7.49Z"/>
                                        <path fill="#fea698" d="M102.35,183.64c7.59-1.38,6.3,9.41,8.84,13.32,5.73,8.81,20.1,7.72,23.91-2.22,1.59-4.16.12-10.48,6.18-11.06,10.13-.97,5.6,14.45,2.32,19.56-10.51,16.4-36.46,14.42-43.93-3.73-1.91-4.65-4.61-14.54,2.69-15.87Z"/>
                                        <path fill="#5a5a5a" d="M175.69,150.38c-.84.75-2.6.56-2.82,1.45-1.09,4.41,2.64,16.28-5.58,16.79-2.54.16-4.73-1.03-5.67-3.38-1.11-2.77-1.09-15.35-.71-18.79,1.43-12.94,24.02-4.35,14.78,3.92Z"/>
                                        <path fill="#5a5a5a" d="M72.49,151.45c-.53-.59-3.71-.15-4.36-3.49-1.97-10.2,13.19-9.53,15.31-4.83.63,1.4.77,19.17.37,21.3-.86,4.56-8.56,5.84-10.65.95-1.32-3.1.08-13.09-.68-13.93Z"/>
                                        <path fill="#fd8f83" d="M79.12,179.25c2.87,3.41,1.11,9.12-3.3,10.11-2.45.55-15.2.54-17.65,0-5.55-1.24-6.14-10.28,0-11.66,2.67-.6,14.12-.56,17.09-.19,1.16.14,3.14.89,3.86,1.74Z"/>
                                        <path fill="#fd8f83" d="M164.9,179.25c.72-.85,2.7-1.6,3.86-1.74,2.97-.37,14.42-.41,17.09.19,6.14,1.38,5.54,10.42,0,11.66-2.45.55-15.2.55-17.65,0-4.41-.98-6.17-6.7-3.3-10.11Z"/>
                                    </g>
                                    </svg>`;

  const femaleText = document.createElement('span');
  femaleText.textContent = 'Sofie';

  femaleOption.appendChild(femaleIcon);
  femaleOption.appendChild(femaleText);

  // Add options to selector
  genderSelector.appendChild(maleOption);
  genderSelector.appendChild(femaleOption);

  // Create a container that will hold both the read button and the dropdown
  const readBtn = document.getElementById('readBtn');
  if (readBtn) {
    // Make the read button's parent position relative
    const parentElement = readBtn.parentNode;
    parentElement.style.position = 'relative';

    // Add the gender selector to the parent
    parentElement.appendChild(genderSelector);
  } else {
    document.body.appendChild(genderSelector);
  }

  // Add event listeners AFTER appending to DOM
  maleOption.onclick = function (e) {
    console.log('Male option clicked');
    e.stopPropagation(); // Prevent the click from bubbling up
    selectedGender = 'male';
    hideGenderSelector();
    safeTextToSpeech();
  };

  femaleOption.onclick = function (e) {
    console.log('Female option clicked');
    e.stopPropagation(); // Prevent the click from bubbling up
    selectedGender = 'female';
    hideGenderSelector();
    safeTextToSpeech();
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', function (event) {
    const selector = document.getElementById('genderSelector');
    const readButton = document.getElementById('readBtn');

    if (
      selector &&
      selector.style.display === 'block' &&
      event.target !== selector &&
      event.target !== readButton &&
      !selector.contains(event.target) &&
      !readButton.contains(event.target)
    ) {
      hideGenderSelector();
    }
  });
}

function createAudioControls() {
  // Create audio controls container
  const audioControls = document.createElement('div');
  audioControls.id = 'audioControls';
  audioControls.className = 'audio-controls';
  audioControls.style.display = 'none';
  audioControls.style.justifyContent = 'center';
  audioControls.style.alignItems = 'center';
  audioControls.style.backgroundColor = '#F6F6F6';
  audioControls.style.borderRadius = '7px';

  // Pause/Play button
  const pausePlayBtn = document.createElement('button');
  pausePlayBtn.id = 'pausePlayBtn';
  pausePlayBtn.className = 'control-btn';
  pausePlayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 30.46 37.79">
                                <rect fill="#7b7b7b" x="0" y="0" width="10.57" height="37.79" rx="5.09" ry="5.09"/>
                                <rect fill="#7b7b7b" x="19.89" y="0" width="10.57" height="37.79" rx="5.09" ry="5.09"/>
                                </svg>`;
  pausePlayBtn.style.border = 'none';
  pausePlayBtn.style.width = '40px';
  pausePlayBtn.style.height = '40px';
  pausePlayBtn.style.cursor = 'pointer';
  pausePlayBtn.style.display = 'flex';
  pausePlayBtn.style.justifyContent = 'center';
  pausePlayBtn.style.alignItems = 'center';

  // Stop button
  const stopBtn = document.createElement('button');
  stopBtn.id = 'stopBtn';
  stopBtn.className = 'control-btn';
  stopBtn.innerHTML =
    '<svg width="13" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 278.25 278.25"><g> <rect width="278.25" height="278.25" rx="40" ry="40" style="fill: #7b7b7b;"/></g></svg>';

  stopBtn.style.border = 'none';
  stopBtn.style.width = '40px';
  stopBtn.style.height = '40px';
  stopBtn.style.cursor = 'pointer';
  stopBtn.style.display = 'flex';
  stopBtn.style.justifyContent = 'center';
  stopBtn.style.alignItems = 'center';

  // Download button
  const downloadBtn = document.createElement('button');
  downloadBtn.id = 'downloadBtn';
  downloadBtn.className = 'control-btn';
  downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 383.22 381.87">
  <polyline points="283.37 180.62 191.09 272.9 98.81 180.62" fill="none" stroke="#7b7b7b" stroke-linecap="round" stroke-linejoin="round" stroke-width="42px"/>
  <line x1="190.75" y1="262.04" x2="190.75" y2="21" fill="none" stroke="#7b7b7b" stroke-linecap="round" stroke-miterlimit="10" stroke-width="42px"/>
  <path d="M362.22,276.13v20.07c0,35.72-28.96,64.68-64.68,64.68H85.68c-35.72,0-64.68-28.96-64.68-64.68v-20.07" fill="none" stroke="#7b7b7b" stroke-linecap="round" stroke-linejoin="round" stroke-width="42px"/>
</svg>`;

  downloadBtn.style.border = 'none';
  downloadBtn.style.width = '40px';
  downloadBtn.style.height = '40px';
  downloadBtn.style.cursor = 'pointer';
  downloadBtn.style.display = 'flex';
  downloadBtn.style.justifyContent = 'center';
  downloadBtn.style.alignItems = 'center';

  // Add event listeners
  pausePlayBtn.addEventListener('click', function () {
    if (isSpeaking) {
      pauseSpeaking();
    } else {
      resumeSpeaking();
    }
  });

  stopBtn.addEventListener('click', function () {
    stopSpeaking();
  });

  downloadBtn.addEventListener('click', function () {
    downloadAudio();
  });

  // Add buttons to controls
  audioControls.appendChild(pausePlayBtn);
  audioControls.appendChild(stopBtn);
  audioControls.appendChild(downloadBtn);

  // Add controls to document near the read button - we'll replace the read button with this
  const readBtn = document.getElementById('readBtn');
  if (readBtn && readBtn.parentNode) {
    // Adding at the same level as the read button
    readBtn.parentNode.appendChild(audioControls);
  } else {
    document.body.appendChild(audioControls);
  }
}

function showGenderSelector() {
  const genderSelector = document.getElementById('genderSelector');

  if (genderSelector) {
    // Simply display the dropdown that's already properly positioned
    genderSelector.style.display = 'block';
    console.log('Gender selector shown with display:', genderSelector.style.display);
  } else {
    console.error('Gender selector not found');
  }
}

function hideGenderSelector() {
  const genderSelector = document.getElementById('genderSelector');
  if (genderSelector) {
    genderSelector.style.display = 'none';
  }
}

function showAudioControls() {
  const audioControls = document.getElementById('audioControls');
  const readBtn = document.getElementById('readBtn');

  if (audioControls && readBtn) {
    // Hide the read button and show audio controls
    readBtn.style.display = 'none';
    audioControls.style.display = 'flex';
  }
}

function hideAudioControls() {
  const audioControls = document.getElementById('audioControls');
  const readBtn = document.getElementById('readBtn');

  if (audioControls && readBtn) {
    // Show the read button and hide audio controls
    audioControls.style.display = 'none';
    readBtn.style.display = 'flex';
  }
}

function safeTextToSpeech() {
  if (isLoading || isSpeaking) return;

  isLoading = true;
  toggleIcons('loading'); // Show loading icon

  try {
    if (!navigator.onLine) {
      throw new Error('No internet connection');
    }
    textToSpeech();
  } catch (error) {
    handleError(error);
  }
}

function textToSpeech() {
  // Get HTML content, apply removeHamDanTags, then extract text
  const htmlContent = window.quill1.root.innerHTML;

  // Use removeHamDanTags if available globally
  const processedHtml =
    typeof window.removeHamDanTags === 'function'
      ? window.removeHamDanTags(htmlContent)
      : htmlContent;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = processedHtml;
  const textInput = tempDiv.textContent || tempDiv.innerText || '';
  const cleanTextInput = textInput.trim();

  let lang;

  // Use getCurrentLanguage if available globally
  const currentLang = getCurrentLanguage();

  if (currentLang === 'da') {
    lang = 'Danish';
  } else if (currentLang === 'en') {
    lang = 'English';
  } else if (currentLang === 'ge') {
    lang = 'German';
  } else if (currentLang === 'fr') {
    lang = 'French';
  } else if (currentLang === 'es') {
    lang = 'Spanish';
  } else {
    lang = 'English';
  }

  // Create an AbortController to cancel the fetch if needed
  const controller = new AbortController();
  const signal = controller.signal;
  currentFetch = controller;
  console.log('selected gender', selectedGender);

  jQuery.ajax({
    url: window.SB_ajax_object.ajax_url,
    type: 'POST',
    data: {
      action: 'hgf_grammar_bot_tts',
      nonce: window.HGF_ajax_object.nonce,
      text: cleanTextInput,
      lang: lang,
      gender: selectedGender // Make sure to send the selected gender
    },
    xhrFields: {
      responseType: 'blob'
    },
    beforeSend: function (xhr) {
      // Store the XHR object to potentially abort it
      currentFetch.xhr = xhr;
    },
    success: function (audioData) {
      currentFetch = null;
      isLoading = false;
      audioBlob = audioData;
      playAudio(audioData);
    },
    error: function (jqXHR, textStatus, errorThrown) {
      if (textStatus === 'abort') {
        console.log('Request was cancelled');
        isLoading = false;
        currentFetch = null;
        toggleIcons('idle');
      } else {
        handleError(new Error('Speech synthesis failed: ' + textStatus));
      }
    }
  });
}

function cancelFetch() {
  if (currentFetch && currentFetch.xhr) {
    currentFetch.xhr.abort();
    currentFetch = null;
    isLoading = false;
    toggleIcons('idle');
  }
}

function playAudio(audioData) {
  const audioUrl = URL.createObjectURL(audioData);
  audio = new Audio(audioUrl);

  audio.onerror = handleError;
  audio.onended = stopSpeaking;

  audio
    .play()
    .then(() => {
      isSpeaking = true;
      toggleIcons('playing'); // Show pause icon
      showAudioControls();
      updatePausePlayButton();
    })
    .catch(handleError);
}

function pauseSpeaking() {
  if (audio) {
    audio.pause();
    isSpeaking = false;
    updatePausePlayButton();
    toggleIcons('paused');
  }
}

function resumeSpeaking() {
  if (audio) {
    audio
      .play()
      .then(() => {
        isSpeaking = true;
        updatePausePlayButton();
        toggleIcons('playing');
        showAudioControls(); // Make sure controls are visible
      })
      .catch(handleError);
  } else if (audioBlob) {
    playAudio(audioBlob);
  }
}

function downloadAudio() {
  if (audioBlob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(audioBlob);
    a.download = 'text-to-speech.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function updatePausePlayButton() {
  const pausePlayBtn = document.getElementById('pausePlayBtn');

  if (pausePlayBtn) {
    if (isSpeaking) {
      // Show pause icon
      pausePlayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 30.46 37.79">
  <rect fill="#7b7b7b" x="0" y="0" width="10.57" height="37.79" rx="5.09" ry="5.09"/>
  <rect fill="#7b7b7b" x="19.89" y="0" width="10.57" height="37.79" rx="5.09" ry="5.09"/>
</svg>`;
    } else {
      // Show play icon
      pausePlayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="16"   viewBox="0 0 345.03 382.74">
  <path fill="#7b7b7b" d="M312.29,134.11L100.12,9.28C55.83-16.78,0,15.15,0,66.53v249.67c0,51.38,55.83,83.31,100.12,57.26l212.17-124.84c43.66-25.69,43.66-88.82,0-114.51Z"/>
</svg>`;
    }
  }
}

function handleError(error) {
  console.error(error.message);
  isLoading = false;
  isSpeaking = false;
  currentFetch = null;
  toggleIcons('idle');
  hideAudioControls();
}

function toggleIcons(state) {
  const volumeIcon = document.querySelector('.lucide-volume-2');
  const pauseIcon = document.querySelector('.lucide-pause');
  const loader = document.querySelector('.loader');
  const buttonText = document.querySelector('#readBtn span');

  switch (state) {
    case 'loading':
      if (loader) loader.style.display = 'inline-block';
      if (volumeIcon) volumeIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (buttonText) buttonText.textContent = ' Loader...';
      break;
    case 'playing':
      if (loader) loader.style.display = 'none';
      if (volumeIcon) volumeIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'inline';
      if (buttonText) buttonText.textContent = ' Stop';
      break;
    case 'paused':
      if (loader) loader.style.display = 'none';
      if (volumeIcon) volumeIcon.style.display = 'inline';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (buttonText) buttonText.textContent = ' Continue';
      break;
    case 'idle':
      if (loader) loader.style.display = 'none';
      if (volumeIcon) volumeIcon.style.display = 'inline';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (buttonText) buttonText.textContent = 'Læs højt';
      break;
  }
}

function setupPageEventHandlers() {
  // This will detect page unload/navigation events
  window.addEventListener('beforeunload', function () {
    console.log('Page is being unloaded - stopping TTS');
    stopSpeaking(); // Stop any ongoing audio playback
  });

  // This handles cases when the browser tab becomes hidden
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      console.log('Page visibility changed to hidden - stopping TTS');
      stopSpeaking(); // Stop any ongoing audio playback
    }
  });
}
