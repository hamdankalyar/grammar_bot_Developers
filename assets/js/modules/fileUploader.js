// fileUploader.js - File Upload & Processing Module

// Set file limits
const MAX_IMAGES = 5;
const MAX_DOCUMENTS = 1;

// Store dependencies passed during initialization
let deps = {};

// Function to compress an image using the server endpoint
async function compressImageOnServer(file) {
  try {
    console.log('inside compressImageOnServer');
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('https://tale-skrivsikkert.dk/converter/api', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    console.log('called file got !');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const compressedImageBlob = await response.blob();

    const compressedFile = new File([compressedImageBlob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg'
    });
    console.log('this is compressed file ');
    return compressedFile;
  } catch (error) {
    console.error('Image compression error:', error);
    return file;
  }
}

// Mobile device detection for image processing
function isMobileDeviceForImageForImage() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Enhanced OCR function for mobile camera images
async function processImageWithOCR(file) {
  try {
    if (file.type.toLowerCase().includes('image')) {
      if (
        isMobileDeviceForImageForImage() ||
        file.type.toLowerCase().includes('heic') ||
        file.type.toLowerCase().includes('heif')
      ) {
        try {
          console.log('mobile check is passed');
          file = await compressImageOnServer(file);
        } catch (compressionError) {
          console.error('Compression error, continuing with original file:', compressionError);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async function () {
        try {
          const img = new Image();

          img.onload = async function () {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              let targetWidth = img.width;
              let targetHeight = img.height;

              if (img.width > 1200) {
                targetWidth = 1200;
                targetHeight = (img.height * targetWidth) / img.width;
              }

              canvas.width = targetWidth;
              canvas.height = targetHeight;

              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

              try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];

                  const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                  const contrast = 3;
                  const midpoint = 128;

                  let newVal = 255 / (1 + Math.exp((-contrast * (gray - midpoint)) / 128));
                  newVal = newVal < 180 ? 0 : 255;

                  data[i] = data[i + 1] = data[i + 2] = newVal;
                }

                ctx.putImageData(imageData, 0, 0);
              } catch (err) {
                console.error('Error applying enhanced contrast:', err);
              }

              const processedImage = canvas.toDataURL('image/png', 0.8);

              const enhancedConfig = {
                tessedit_ocr_engine_mode: 3,
                tessedit_pageseg_mode: 7,
                preserve_interword_spaces: 1,
                textord_min_linesize: 2.5
              };

              const result = await Tesseract.recognize(processedImage, 'dan+eng', enhancedConfig);

              resolve({
                text: result.data.text,
                selectedMethod: 'Enhanced',
                selectedConfidence: result.data.confidence
              });
            } catch (error) {
              console.error('Error during OCR processing:', error);
              resolve({
                text: '',
                selectedMethod: 'Error',
                selectedConfidence: 0,
                error: error.message
              });
            }
          };

          img.onerror = function (err) {
            console.error('Image loading error:', err);
            resolve({
              text: '',
              selectedMethod: 'Error',
              selectedConfidence: 0,
              error: 'Image loading failed'
            });
          };

          img.src = reader.result;
        } catch (error) {
          console.error('OCR preprocessing error:', error);
          resolve({
            text: '',
            selectedMethod: 'Error',
            selectedConfidence: 0,
            error: 'Preprocessing failed'
          });
        }
      };

      reader.onerror = function (error) {
        console.error('FileReader error:', error);
        resolve({
          text: '',
          selectedMethod: 'Error',
          selectedConfidence: 0,
          error: 'FileReader failed'
        });
      };

      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Top-level OCR error:', error);
    return {
      text: '',
      selectedMethod: 'Error',
      selectedConfidence: 0,
      error: 'Top-level error: ' + error.message
    };
  }
}

// Function to check if an image has EXIF data (likely from a mobile camera)
async function checkForExifData(file) {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.onload = function (e) {
      const arrayBuffer = e.target.result;

      try {
        const tempImg = document.createElement('img');

        tempImg.onload = function () {
          EXIF.getData(tempImg, function () {
            const allTags = EXIF.getAllTags(this);
            const hasExifData = Object.keys(allTags).length > 0;

            const hasCameraData =
              allTags.Make || allTags.Model || allTags.DateTimeOriginal || allTags.Orientation;

            console.log('EXIF data detected:', hasExifData);
            if (hasExifData) {
              console.log('Camera-specific EXIF data:', hasCameraData);
            }

            resolve(hasCameraData || hasExifData);
          });
        };

        tempImg.onerror = function () {
          console.error('Failed to load image for EXIF extraction');
          resolve(false);
        };

        tempImg.src = URL.createObjectURL(file);
      } catch (error) {
        console.error('Error checking EXIF data:', error);
        resolve(false);
      }
    };

    reader.onerror = function () {
      console.error('FileReader error during EXIF check');
      resolve(false);
    };

    reader.readAsArrayBuffer(file);
  });
}

// Function to check if text content is meaningful
function isTextMeaningful(text) {
  const cleanText = text.trim().replace(/\s+/g, ' ');
  return cleanText.length > 50;
}

// Extract images from PDF page for OCR processing
async function extractImagesFromPDFPage(page) {
  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  try {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      let contrast = gray < 128 ? 2.5 : 3.5;
      const midpoint = 128;

      let newVal = 255 / (1 + Math.exp((-contrast * (gray - midpoint)) / 128));

      if (Math.abs(gray - midpoint) < 60) {
        newVal = newVal < 160 ? 0 : 255;
      }

      data[i] = data[i + 1] = data[i + 2] = newVal;
    }

    context.putImageData(imageData, 0, 0);
  } catch (err) {
    console.error('Error applying image enhancement to PDF page:', err);
  }

  return canvas.toDataURL('image/png', 1.0);
}

// Original OCR function specifically for PDF images
async function processImageWithOCRForPDF(file) {
  if (typeof file === 'string') {
    try {
      const {
        data: { text }
      } = await Tesseract.recognize(file, 'dan');
      return text;
    } catch (error) {
      console.error('OCR Error:', error);
      return '';
    }
  } else {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    return new Promise(resolve => {
      reader.onload = async function () {
        try {
          const {
            data: { text }
          } = await Tesseract.recognize(reader.result, 'dan');
          resolve(text);
        } catch (error) {
          console.error('OCR Error:', error);
          resolve('');
        }
      };
    });
  }
}

// Enhanced PDF processing function
async function processEnhancedPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pagesToParse = Math.min(pdf.numPages, 20);
    let combinedText = '';
    let usedOCR = false;

    for (let i = 1; i <= pagesToParse; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');

      if (isTextMeaningful(pageText)) {
        combinedText += pageText + '\n\n';
        console.log(`Page ${i}: Used direct text extraction`);
      } else {
        usedOCR = true;
        console.log(`Page ${i}: Using OCR (no meaningful direct text found)`);

        try {
          const imageData = await extractImagesFromPDFPage(page);

          if (imageData) {
            console.log(`Extracted image data from page ${i}, processing with OCR`);

            const enhancedConfig = {
              tessedit_ocr_engine_mode: 3,
              tessedit_pageseg_mode: 6,
              preserve_interword_spaces: 1,
              textord_min_linesize: 2.5,
              tessedit_char_whitelist:
                'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZæøåÆØÅ0123456789.,;:!?(){}[]<>@#$%^&*+=-_\'"`~§°€/\\|'
            };

            const {
              data: { text }
            } = await Tesseract.recognize(imageData, 'dan', enhancedConfig);

            if (text && isTextMeaningful(text)) {
              console.log(`OCR extracted meaningful text from page ${i}`);
              combinedText += text + '\n\n';
            } else {
              console.log(`OCR failed to extract meaningful text from page ${i}`);

              const fallbackConfig = {
                tessedit_ocr_engine_mode: 3,
                tessedit_pageseg_mode: 3
              };

              try {
                const fallbackResult = await Tesseract.recognize(imageData, 'dan', fallbackConfig);

                if (fallbackResult.data.text && isTextMeaningful(fallbackResult.data.text)) {
                  console.log(`Fallback OCR extracted meaningful text from page ${i}`);
                  combinedText += fallbackResult.data.text + '\n\n';
                }
              } catch (fallbackError) {
                console.error(`Fallback OCR failed for page ${i}:`, fallbackError);
              }
            }
          }
        } catch (imgError) {
          console.error(`Error processing images on page ${i}:`, imgError);
        }
      }
    }

    combinedText = combinedText
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*(?=[A-ZÆØÅ])/g, '$1\n\n')
      .trim();

    if (combinedText.length > 24000) {
      combinedText = combinedText.substring(0, 24000);
    }

    return {
      text: combinedText.trim(),
      usedOCR: usedOCR
    };
  } catch (error) {
    console.error('Enhanced PDF processing error:', error);
    throw new Error('Der opstod en fejl under behandling af PDF-filen.');
  }
}

// Function to process DOCX files
async function processDOCXFile(file) {
  try {
    const FIVE_PAGE_LIMIT = 20000;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function (e) {
        try {
          const arrayBuffer = e.target.result;

          const options = {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Title'] => h1:fresh",
              "p[style-name='Subtitle'] => h2:fresh"
            ]
          };

          const result = await mammoth.convertToHtml({ arrayBuffer }, options);
          console.log('this is result', result);

          let content = result.value;
          console.log('this is result', content);

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          const plainTextLength = (tempDiv.textContent || tempDiv.innerText || '').length;

          if (plainTextLength > FIVE_PAGE_LIMIT) {
            content = limitHtmlContent(content, FIVE_PAGE_LIMIT);
            console.log(
              `DOCX content limited to approximately 5 pages (from ${plainTextLength} to ~${FIVE_PAGE_LIMIT} characters)`
            );
          }

          resolve(content.trim());
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    console.error('DOCX processing error:', error);
    throw new Error('Error processing Word document');
  }
}

// Helper function to limit HTML content while preserving structure
function limitHtmlContent(htmlContent, characterLimit) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;

  let characterCount = 0;
  let result = '';

  function traverseAndLimit(node) {
    if (characterCount >= characterLimit) {
      return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const remainingChars = characterLimit - characterCount;

      if (text.length <= remainingChars) {
        result += text;
        characterCount += text.length;
        return true;
      } else {
        let truncatedText = text.substring(0, remainingChars);
        const lastSpace = truncatedText.lastIndexOf(' ');

        if (lastSpace > remainingChars * 0.8) {
          truncatedText = text.substring(0, lastSpace);
        }

        result += truncatedText;
        characterCount += truncatedText.length;
        return false;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      const attributes = Array.from(node.attributes)
        .map(attr => `${attr.name}="${attr.value}"`)
        .join(' ');

      result += `<${tagName}${attributes ? ' ' + attributes : ''}>`;

      let continueProcessing = true;
      for (const child of node.childNodes) {
        continueProcessing = traverseAndLimit(child);
        if (!continueProcessing) break;
      }

      const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link'];
      if (!selfClosingTags.includes(tagName)) {
        result += `</${tagName}>`;
      }

      return continueProcessing;
    }

    return true;
  }

  for (const child of body.childNodes) {
    const continueProcessing = traverseAndLimit(child);
    if (!continueProcessing) break;
  }

  return result;
}

// Function to handle OCR improvement call
function OCRImproveCall(text) {
  if (!deps.showLoader || !deps.hideLoader) {
    console.error('Required loader functions not available');
    return;
  }

  deps.showLoader('.textarea-wrapper', 'Uploader tekst...');
  const uploadImg = document.getElementById('uploadImg');
  if (uploadImg) uploadImg.disabled = true;

  const formData = new FormData();
  formData.append('action', 'hgf_korrektur_OCR');
  formData.append('text', text);
  formData.append(
    'translateTo',
    deps.getLanguageName
      ? deps.getLanguageName(deps.getCurrentLanguage ? deps.getCurrentLanguage() : 'da')
      : 'Danish'
  );

  fetch(deps.SB_ajax_object.ajax_url, {
    method: 'POST',
    credentials: 'same-origin',
    body: new URLSearchParams(formData)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        const translatedContent = data.data;
        if (deps.displayResponse) {
          deps.displayResponse(translatedContent);
        }
        setTimeout(() => {
          if (deps.scrollAfterPaste) {
            deps.scrollAfterPaste();
          }
        }, 100);
        if (uploadImg) uploadImg.disabled = true;
      } else {
        throw new Error(data.data?.message || 'Translation failed');
      }
    })
    .catch(error => {
      console.error('Translation request failed:', error);
      alert('Der er et problem med dit internet. Prøv igen.');
    })
    .finally(() => {
      deps.hideLoader('.textarea-wrapper');
      if (uploadImg) uploadImg.disabled = false;
    });
}

// Format extracted text
function formatExtractedText(text) {
  text = text.replace(/\n+/g, '\n');
  text = text.replace(/[●○]/g, '•');
  text = text.replace(/(•|\d+\.)\s*/g, '\n$1 ');
  text = text.replace(/(•|\d+\.)([^\s])/g, '$1 $2');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/([.!?])([A-ZÆØÅ])/g, '$1\n$2');

  return text.trim();
}

// Display PDF text
function displayPDF(text) {
  console.log('--- Raw Text with \\n markers ---');
  console.log(text.replace(/\n/g, '\\n\n'));
  console.log('--------------------------------');

  // Get quill instance from global scope
  if (window.quill1) {
    window.quill1.setText(text);
  }
}

// Initialize file upload functionality
function initializeFileUpload(dependencies) {
  // Store dependencies for use throughout the module
  deps = dependencies || {};

  const uploadImg = document.getElementById('uploadImg');
  const imageUpload = document.getElementById('imageUpload');

  if (!uploadImg || !imageUpload) {
    console.error('File upload elements not found');
    return;
  }

  // Set file input constraints
  imageUpload.setAttribute('multiple', 'true');
  imageUpload.setAttribute(
    'accept',
    'image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  // Upload button click handler
  uploadImg.addEventListener('click', function () {
    imageUpload.click();
    if (deps.manuallyCloseMicButton) {
      deps.manuallyCloseMicButton('micButton1');
    }
  });

  // Main file processing handler
  imageUpload.addEventListener('change', async function (event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      if (deps.handleClear) {
        deps.handleClear();
      }
      if (deps.showLoader) {
        deps.showLoader('.textarea-wrapper', 'Uploader tekst...');
      }
      uploadImg.disabled = true;

      const imageFiles = files.filter(file => file.type.toLowerCase().includes('image/'));
      const pdfFiles = files.filter(file => file.type.toLowerCase() === 'application/pdf');
      const docxFiles = files.filter(
        file =>
          file.type.toLowerCase() ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      if (imageFiles.length > MAX_IMAGES) {
        throw new Error(`Du kan maksimalt uploade ${MAX_IMAGES} billeder ad gangen.`);
      }

      if (pdfFiles.length > MAX_DOCUMENTS || docxFiles.length > MAX_DOCUMENTS) {
        throw new Error('Du kan kun uploade ét dokument ad gangen.');
      }

      let extractedText = '';
      let ocrUsed = false;

      // Process images
      if (imageFiles.length > 0) {
        ocrUsed = true;
        let combinedImageText = '';
        for (let i = 0; i < imageFiles.length; i++) {
          const hasExifData = await checkForExifData(imageFiles[i]);

          let imageText = '';
          if (
            hasExifData ||
            imageFiles[i].type.toLowerCase().includes('heic') ||
            imageFiles[i].type.toLowerCase().includes('heif')
          ) {
            const imageTextResult = await processImageWithOCR(imageFiles[i]);
            imageText = imageTextResult.text;
          } else {
            imageText = await processImageWithOCRForPDF(imageFiles[i]);
          }

          combinedImageText += imageText + '\n\n';
        }
        extractedText += combinedImageText;
      }

      // Process PDF
      if (pdfFiles.length > 0) {
        const pdfResult = await processEnhancedPDF(pdfFiles[0]);
        extractedText += pdfResult.text;

        if (pdfResult.usedOCR) {
          ocrUsed = true;
        }

        console.log('PDF processing result:', pdfResult);
        console.log('OCR used in PDF:', pdfResult.usedOCR);
      }

      // Process DOCX
      if (docxFiles.length > 0) {
        const docxText = await processDOCXFile(docxFiles[0]);
        console.log('DOCX text extracted:', docxText);
        extractedText += docxText;
      }

      // Process the extracted text based on whether OCR was used
      if (extractedText) {
        if (ocrUsed) {
          console.log('OCR was used, calling OCRImproveCall');
          OCRImproveCall(extractedText);
        } else {
          console.log('No OCR was used, displaying text directly');

          if (pdfFiles.length > 0) {
            const formattedText = formatExtractedText(extractedText);
            displayPDF(formattedText);
            setTimeout(() => {
              if (deps.scrollAfterPaste) {
                deps.scrollAfterPaste();
              }
            }, 100);
          } else if (docxFiles.length > 0) {
            if (deps.displayResponse) {
              deps.displayResponse(extractedText);
            }
            setTimeout(() => {
              if (deps.scrollAfterPaste) {
                deps.scrollAfterPaste();
              }
            }, 100);
          }

          if (deps.hideLoader) {
            deps.hideLoader('.textarea-wrapper');
          }
          uploadImg.disabled = false;
        }
      } else {
        throw new Error('Ingen tekst kunne udtrækkes fra filen.');
      }

      event.target.value = '';
    } catch (error) {
      console.error('Processing Error:', error);
      alert('Der opstod en fejl under behandling af filen: ' + error.message);
      uploadImg.disabled = false;
      if (deps.hideLoader) {
        deps.hideLoader('.textarea-wrapper');
      }
      event.target.value = '';
    }
  });

  console.log('File upload functionality initialized');
}

// Export functions
export {
  // Core functions
  initializeFileUpload,

  // Image processing
  processImageWithOCR,
  processImageWithOCRForPDF,
  checkForExifData,
  compressImageOnServer,
  isMobileDeviceForImageForImage,

  // PDF processing
  processEnhancedPDF,
  extractImagesFromPDFPage,

  // DOCX processing
  processDOCXFile,
  limitHtmlContent,

  // Text processing
  isTextMeaningful,
  formatExtractedText,
  displayPDF,
  OCRImproveCall,

  // Constants
  MAX_IMAGES,
  MAX_DOCUMENTS
};
