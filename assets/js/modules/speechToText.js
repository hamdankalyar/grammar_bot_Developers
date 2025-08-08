// speechToText.js

// STT State variables
let microphoneInstances = {}; // Store microphone instances for each button
let socketInstances = {}; // Store socket instances for each button
let isListening = {}; // Store listening state for each button
let reconnectAttempts = {}; // Store reconnection attempts for each button
let shouldReconnect = {}; // Control reconnection for each button
const MAX_RECONNECT_ATTEMPTS = 3;

// Global variable to store cursor position for Quill inputText
let quillCursorPosition = null;

// Map buttons to their respective text areas
const buttonTextMap = {
  micButton1: 'inputText',
  micButton2: 'custom_rewrite_input'
};

// Server configuration
const SERVER_URL = 'wss://tale-skrivsikkert.dk/stt-ws';
const API_KEY = 'stt-prod-a7f39d4e82c61b5c';

// Initialize STT system
export function initializeSTT() {
  console.log('STT initialization starting...');

  // Initialize event listeners for microphone buttons
  Object.keys(buttonTextMap).forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      // Special handling for Quill inputText button to prevent focus loss
      if (buttonTextMap[buttonId] === 'inputText') {
        // Prevent default behavior and maintain focus
        button.addEventListener('mousedown', function (e) {
          e.preventDefault(); // Prevents focus loss

          // Store current cursor position before starting STT
          const selection = window.quill1.getSelection();
          if (selection) {
            quillCursorPosition = selection.index;
          } else {
            // If no selection, use current length - 1 (before the trailing newline)
            quillCursorPosition = window.quill1.getLength() - 1;
          }
        });

        button.addEventListener('click', function (e) {
          e.preventDefault();

          // Keep Quill focused
          window.quill1.focus();

          // Restore cursor position if we have one
          if (quillCursorPosition !== null) {
            window.quill1.setSelection(quillCursorPosition, 0);
          }

          // Call the toggle recording function
          toggleRecording(buttonId);
        });
      } else {
        // Standard click handler for other buttons
        button.addEventListener('click', () => toggleRecording(buttonId));
      }
    }
  });

  // Track cursor position changes in Quill for better insertion accuracy
  if (window.quill1) {
    window.quill1.on('selection-change', function (range, oldRange, source) {
      if (range) {
        quillCursorPosition = range.index;
      }
    });
  }

  console.log('STT initialization complete');
}

// Export function to manually close microphone
export function manuallyCloseMicButton(micId) {
  const buttonId = micId;

  console.log(`Manually closing microphone for ${buttonId}...`);
  try {
    // Prevent reconnection and close the microphone
    shouldReconnect[buttonId] = false;

    // Call the closeMicrophone function
    closeMicrophone(buttonId);

    // Update the icon and state
    updateMicIcon(buttonId, false);
    isListening[buttonId] = false;

    console.log(`Microphone for ${buttonId} successfully closed.`);
  } catch (error) {
    console.error(`Error manually closing microphone for ${buttonId}:`, error);
  }
}

async function getMicrophone() {
  try {
    const userMedia = await navigator.mediaDevices.getUserMedia({ audio: true });
    return new MediaRecorder(userMedia);
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw new Error('Unable to access microphone. Please check permissions.');
  }
}

async function openMicrophone(buttonId) {
  try {
    await connectToSpeechServer(buttonId);
    const microphone = microphoneInstances[buttonId];

    return new Promise((resolve, reject) => {
      const checkSocket = setInterval(() => {
        const socket = socketInstances[buttonId];
        if (socket && socket.readyState === WebSocket.OPEN) {
          clearInterval(checkSocket);
          microphone.start(500);
          microphone.ondataavailable = e => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(e.data);
                //console.log(`Sent audio chunk: ${e.data.size} bytes`);
              } catch (error) {
                console.error('Error sending audio data:', error);
                handleWebSocketError(buttonId);
              }
            }
          };
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkSocket);
        reject(new Error('Timeout waiting for WebSocket connection'));
      }, 10000);
    });
  } catch (error) {
    console.error('Error in openMicrophone:', error);
    throw error;
  }
}

async function closeMicrophone(buttonId) {
  shouldReconnect[buttonId] = false; // Prevent reconnection

  const microphone = microphoneInstances[buttonId];
  if (microphone) {
    if (microphone.state !== 'inactive') {
      microphone.stop();
    }

    const tracks = microphone.stream?.getTracks();
    if (tracks) {
      tracks.forEach(track => track.stop());
    }

    microphone.ondataavailable = null;
    microphone.onerror = null;
    microphone.onstop = null;

    //console.log(`Microphone instance for ${buttonId} stopped and media stream tracks released.`);
  }

  await closeWebSocketConnection(buttonId);
  delete microphoneInstances[buttonId];

  // Reset cursor position when microphone closes for inputText
  if (buttonTextMap[buttonId] === 'inputText') {
    quillCursorPosition = null;
  }
}

async function toggleRecording(buttonId) {
  try {
    // Close all other microphones first
    await Promise.all(
      Object.keys(isListening).map(async id => {
        if (id !== buttonId && isListening[id]) {
          await closeMicrophone(id);
          updateMicIcon(id, false);
          isListening[id] = false;
        }
      })
    );

    // Toggle the microphone for the clicked button
    if (!isListening[buttonId]) {
      shouldReconnect[buttonId] = true; // Allow reconnection for this session
      const microphone = await getMicrophone();
      microphoneInstances[buttonId] = microphone;
      await openMicrophone(buttonId);
      updateMicIcon(buttonId, true);
      isListening[buttonId] = true;

      // Maintain focus on Quill inputText if this is the inputText button
      if (buttonTextMap[buttonId] === 'inputText' && window.quill1) {
        window.quill1.focus();
        if (quillCursorPosition !== null) {
          window.quill1.setSelection(quillCursorPosition, 0);
        }
      }
    } else {
      await closeMicrophone(buttonId);
      updateMicIcon(buttonId, false);
      isListening[buttonId] = false;
    }
  } catch (error) {
    console.error(`Error in toggleRecording for ${buttonId}:`, error);
    updateMicIcon(buttonId, false);
    isListening[buttonId] = false;
    alert('Error: ' + error.message);
  }
}

function updateMicIcon(buttonId, listening) {
  const micIcon = document.querySelector(`#${buttonId} .lucide-mic`);
  if (micIcon) {
    const paths = micIcon.querySelectorAll('path');
    paths.forEach(path => {
      if (listening) {
        path.setAttribute('stroke', '#28a745'); // Green color for listening
      } else {
        path.setAttribute('stroke', '#929292'); // Default gray color
      }
    });

    if (listening) {
      micIcon.classList.add('listening-glow');
    } else {
      micIcon.classList.remove('listening-glow');
    }
  }
}

async function connectToSpeechServer(buttonId) {
  try {
    // Close existing connection if any
    if (socketInstances[buttonId]) {
      await closeWebSocketConnection(buttonId);
    }

    // Get selected language
    const language = getSelectedLanguage();

    // Create connection to your custom Speech-to-Text server
    const socket = new WebSocket(
      `${SERVER_URL}?api_key=${API_KEY}&language=${language}&model=nova-2&interim_results=false `
    );
    socketInstances[buttonId] = socket;

    return new Promise((resolve, reject) => {
      socket.onopen = () => {
        console.log(`Connected to Speech Server for ${buttonId}`);
        reconnectAttempts[buttonId] = 0;
        resolve();
      };

      socket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

          // Handle status messages
          if (data.status || data.error || data.warning) {
            console.log(`Server message: ${data.message || JSON.stringify(data)}`);
            return;
          }

          // Handle transcripts
          if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
            const transcript = data.channel.alternatives[0].transcript;
            if (transcript && transcript.trim() !== '') {
              console.log(`Transcript received: ${transcript}`);
              const inputTextId = buttonTextMap[buttonId];
              const inputText = document.getElementById(inputTextId);

              if (inputText) {
                if (inputText.id === 'inputText') {
                  // Insert text at stored cursor position instead of always at the end
                  let insertPosition;

                  if (quillCursorPosition !== null) {
                    // Use stored cursor position
                    insertPosition = quillCursorPosition;
                  } else {
                    // Fallback: get current selection or end of document
                    const selection = window.quill1.getSelection();
                    insertPosition = selection ? selection.index : window.quill1.getLength() - 1;
                  }

                  // Insert the transcript at the cursor position
                  window.quill1.insertText(insertPosition, transcript + ' ', 'user');

                  // Update cursor position for next insertion
                  const newPosition = insertPosition + transcript.length + 1;
                  quillCursorPosition = newPosition;

                  // Set cursor after the inserted text
                  window.quill1.setSelection(newPosition, 0);

                  // Keep focus on Quill
                  window.quill1.focus();
                } else {
                  inputText.value += transcript + ' ';
                }

                // Trigger input event for any listeners
                const inputEvent = new Event('input', { bubbles: true });
                inputText.dispatchEvent(inputEvent);
              }
            }
          }
        } catch (error) {
          console.error('Error processing message:', error, event.data);
        }
      };

      socket.onerror = error => {
        console.error(`WebSocket Error for ${buttonId}:`, error);
        handleWebSocketError(buttonId);
        reject(error);
      };

      socket.onclose = event => {
        console.log(`WebSocket closed for ${buttonId} with code ${event.code}`);
        handleWebSocketClose(buttonId);

        // Reset cursor position when connection closes for inputText
        if (buttonTextMap[buttonId] === 'inputText') {
          quillCursorPosition = null;
        }
      };
    });
  } catch (error) {
    console.error(`Speech server connection error for ${buttonId}:`, error);
    throw error;
  }
}

async function closeWebSocketConnection(buttonId) {
  const socket = socketInstances[buttonId];
  if (socket) {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    } catch (error) {
      console.error(`Error closing WebSocket for ${buttonId}:`, error);
    }

    return new Promise(resolve => {
      setTimeout(() => {
        delete socketInstances[buttonId];
        resolve();
      }, 1000);
    });
  }
  return Promise.resolve();
}

function handleWebSocketError(buttonId) {
  if (shouldReconnect[buttonId] && reconnectAttempts[buttonId] < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts[buttonId] = (reconnectAttempts[buttonId] || 0) + 1;
    console.log(
      `Attempting to reconnect for ${buttonId} (${reconnectAttempts[buttonId]}/${MAX_RECONNECT_ATTEMPTS})`
    );
    setTimeout(() => {
      connectToSpeechServer(buttonId).catch(error => {
        console.error(`Reconnection failed for ${buttonId}:`, error);
      });
    }, 1000 * reconnectAttempts[buttonId]);
  } else if (!shouldReconnect[buttonId]) {
    console.log(`Reconnection prevented for ${buttonId}.`);
  } else {
    console.error(`Max reconnection attempts reached for ${buttonId}`);
    alert('Connection to speech recognition service failed. Please try again later.');
    closeMicrophone(buttonId);
  }
}

function handleWebSocketClose(buttonId) {
  if (isListening[buttonId] && shouldReconnect[buttonId]) {
    handleWebSocketError(buttonId);
  }
}

function getSelectedLanguage() {
  // Try to find language selection element - adjust selector based on your UI
  const languageSelect = document.getElementsByClassName('dk-language-text')[0];
  console.log(languageSelect);
  if (languageSelect) {
    if (languageSelect.innerText === 'Engelsk') {
      return 'en-US';
    } else if (languageSelect.innerText === 'Dansk') {
      return 'da-DK';
    } else if (languageSelect.innerText === 'Tysk') {
      return 'de-DE';
    } else if (languageSelect.innerText === 'Fransk') {
      return 'fr-FR';
    } else if (languageSelect.innerText === 'Spansk') {
      return 'es';
    }
  }

  // Default to English if no selector found
  return 'en-US';
}
