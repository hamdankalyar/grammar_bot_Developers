import { removeHamDanTags, removeMarkTags } from './utils.js';
import { processQuillContentForCopy } from './copyPaste.js';
// quillDownloader.js - Download functionality for Quill editor
// Handles PDF, DOCX, and TXT exports

// ======================= UTILITY FUNCTIONS =======================
function getCleanPlainTextFromQuillSimple(quillInstance) {
  const { text } = processQuillContentForCopy(quillInstance);
  return text;
}

function removeInlineStyles(htmlString) {
  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  // Select all elements within the parsed HTML
  const elements = tempDiv.querySelectorAll('*');

  // Remove the style attribute from each element
  elements.forEach(element => {
    element.removeAttribute('style');
  });

  // Return the cleaned HTML as a string
  return tempDiv.innerHTML;
}

function sanitizeHtmlContentForDownload(rawHtml) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = rawHtml;

  // 1. Convert all h1-h6 tags to <strong>
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(hTag => {
    const headings = tempDiv.querySelectorAll(hTag);
    headings.forEach(heading => {
      const strongElement = document.createElement('strong');
      strongElement.innerHTML = heading.innerHTML;
      heading.parentNode.replaceChild(strongElement, heading);
    });
  });

  // 2. Remove <p><br></p> after <strong>
  const strongElements = tempDiv.querySelectorAll('strong');
  strongElements.forEach(strong => {
    const nextSibling = strong.nextElementSibling;
    if (nextSibling && nextSibling.tagName === 'P') {
      if (
        (nextSibling.childNodes.length === 1 &&
          nextSibling.firstChild &&
          nextSibling.firstChild.nodeType === Node.ELEMENT_NODE &&
          nextSibling.firstChild.tagName === 'BR') ||
        nextSibling.innerHTML.trim().toLowerCase() === '<br>' ||
        nextSibling.innerHTML.trim().toLowerCase() === '<br/>' ||
        nextSibling.innerHTML.trim().toLowerCase() === '<br />'
      ) {
        nextSibling.parentNode.removeChild(nextSibling);
      }
    }
  });

  // 3. Convert bullet-point <ol> items with data-list="bullet" to <ul>
  const olElements = [...tempDiv.querySelectorAll('ol')];
  olElements.forEach(ol => {
    const ul = document.createElement('ul');
    let liMoved = false;

    [...ol.children].forEach(li => {
      const dataList = li.getAttribute('data-list');
      if (dataList === 'bullet') {
        li.removeAttribute('data-list');
        ul.appendChild(li.cloneNode(true));
        li.remove();
        liMoved = true;
      }
    });

    if (liMoved) {
      if (ol.children.length === 0) {
        ol.replaceWith(ul);
      } else {
        ol.parentNode.insertBefore(ul, ol);
      }
    }
  });

  return tempDiv.innerHTML;
}

function getDocumentTitle() {
  // This function will be called with quill1 from main.js
  const html = removeInlineStyles(
    removeHamDanTags(removeMarkTags(sanitizeHtmlContentForDownload(quill1.root.innerHTML)))
  );

  // Create temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Find the first element (not text node)
  const firstElement = tempDiv.querySelector('*');

  if (firstElement) {
    const tagName = firstElement.tagName.toLowerCase();

    // Check if first tag is strong or h1-h6
    if (tagName === 'strong' || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      return firstElement.textContent.trim();
    }
  }

  // Find the first p tag with actual content (skip empty ones)
  const allPTags = tempDiv.querySelectorAll('p');
  for (let pTag of allPTags) {
    const pText = pTag.textContent.trim();

    // Skip empty p tags (or those with only br tags)
    if (pText && pText.length > 0) {
      const pWords = pText.split(/\s+/).filter(word => word.length > 0);

      if (pWords.length <= 9) {
        return pText;
      }
      // If first non-empty p has more than 9 words, break and go to fallback
      break;
    }
  }

  // Fallback: return first 9 words from all content
  // Get text content properly by adding spaces between elements
  const allElements = tempDiv.querySelectorAll('*');
  let allText = '';

  allElements.forEach((element, index) => {
    const text = element.textContent.trim();
    if (text) {
      allText += (index > 0 ? ' ' : '') + text;
    }
  });

  const words = allText.split(/\s+/).filter(word => word.length > 0);
  return words.slice(0, 9).join(' ');
}

function downloadFile(url) {
  const link = document.createElement('a');
  link.href = url;
  link.download = getDocumentTitle();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ======================= TXT DOWNLOAD =======================

function downloadTxt(content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  downloadFile(url);
}

// ======================= PDF DOWNLOAD =======================

/* Remove Unicode emojis from text */
function removeEmojis(text) {
  // Comprehensive emoji regex that covers most Unicode emoji ranges
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]/gu;

  return text.replace(emojiRegex, '');
}

/* Configure fonts for pdfmake */
function configurePdfMakeFonts(fontChoice = 'Roboto') {
  if (fontChoice === 'Helvetica') {
    // Use Standard 14 fonts (smaller file size, English only)
    pdfMake.fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      },
      Times: {
        normal: 'Times-Roman',
        bold: 'Times-Bold',
        italics: 'Times-Italic',
        bolditalics: 'Times-BoldItalic'
      },
      Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
        italics: 'Courier-Oblique',
        bolditalics: 'Courier-BoldOblique'
      }
    };
    console.log('✅ Configured Standard 14 fonts');
    return 'Helvetica';
  } else {
    // Use default Roboto font
    console.log('✅ Using default Roboto font');
    return 'Roboto';
  }
}

async function downloadPdfWithPdfMake(formattedText) {
  const rawHtml = quill1.root.innerHTML.trim();
  if (!rawHtml || rawHtml === '<p><br></p>') {
    alert('No content to export.');
    return;
  }

  try {
    console.log('🔄 Starting PDF generation (removing emojis for clean output)...');

    // Step 1: Configure fonts
    const font = configurePdfMakeFonts('Roboto');

    // Step 2: Clean HTML (remove custom tags AND emojis)
    const cleanedHtml = removeEmojis(formattedText);

    // Step 3: Convert to pdfmake document definition
    const docDefContent = htmlToPdfmake(cleanedHtml, {
      window
    });

    // Step 4: Create PDF configuration
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: docDefContent,
      defaultStyle: {
        fontSize: 12,
        lineHeight: 1.4,
        font: font
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 16,
          bold: true,
          margin: [0, 10, 0, 5]
        },
        normal: {
          fontSize: 12,
          margin: [0, 0, 0, 5]
        }
      }
    };

    // Step 5: Generate & download PDF
    console.log(`📄 Generating clean PDF with ${font} font (emojis removed)...`);
    pdfMake.createPdf(docDefinition).download(`${getDocumentTitle()}.pdf`);
    console.log('✅ Clean PDF created successfully (no emojis)!');
  } catch (err) {
    console.error('❌ PDF generation failed:', err);
    alert('Unable to create PDF. Please check the console for details.');
  }
}

// ======================= DOCX DOWNLOAD =======================

// Remove every op that Quill marked as { attributes: { "grammar-removed": true } }
function stripGrammarRemoved(delta) {
  // Works on either a Delta instance or a plain { ops: [...] } object
  const cleanedOps = delta.ops.filter(op => !(op.attributes && op.attributes['grammar-removed']));

  // Return the same shape we got in (Delta-compatible)
  return { ops: cleanedOps };
}

// Perfect DOCX with fixed font and perfect lists
async function downloadDocx() {
  try {
    // ① Grab the editor's raw Delta
    const originalDelta = quill1.getContents();
    console.log('Before cleaning:', JSON.stringify(originalDelta, null, 2));

    // ② Drop the grammar-removed segments
    const cleanedDelta = stripGrammarRemoved(originalDelta);
    console.log('Cleaned Delta for DOCX:', JSON.stringify(cleanedDelta, null, 2));

    // ③ Build the paragraphs and doc exactly as before
    const paragraphs = deltaToDocxParagraphs(cleanedDelta);
    // Create document with list support
    const doc = new docx.Document({
      numbering: {
        config: [
          {
            reference: 'bullet-numbering',
            levels: [
              {
                level: 0,
                format: docx.LevelFormat.BULLET,
                text: '•',
                alignment: docx.AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 }
                  }
                }
              },
              {
                level: 1,
                format: docx.LevelFormat.BULLET,
                text: '○',
                alignment: docx.AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 1440, hanging: 360 }
                  }
                }
              }
            ]
          },
          {
            reference: 'ordered-numbering',
            levels: [
              {
                level: 0,
                format: docx.LevelFormat.DECIMAL,
                text: '%1.',
                alignment: docx.AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 }
                  }
                }
              },
              {
                level: 1,
                format: docx.LevelFormat.LOWER_LETTER,
                text: '%2.',
                alignment: docx.AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 1440, hanging: 360 }
                  }
                }
              }
            ]
          }
        ]
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720
              }
            }
          },
          children: paragraphs
        }
      ]
    });

    // Generate blob
    const blob = await docx.Packer.toBlob(doc);

    // Download
    saveAs(blob, `${getDocumentTitle()}.docx`);

    console.log('Perfect DOCX created with fixed font and lists');
  } catch (error) {
    console.error('Error creating DOCX:', error);
  }
}

// Convert Delta to DOCX paragraphs with proper list ending spacing
function deltaToDocxParagraphs(delta) {
  const paragraphs = [];
  let currentRuns = [];
  let previousWasList = false;

  delta.ops.forEach((op, index) => {
    if (typeof op.insert === 'string') {
      const text = op.insert;
      const attributes = op.attributes || {};
      const isCurrentList = !!attributes.list;

      // Handle line breaks and paragraphs
      if (text.includes('\n')) {
        const parts = text.split('\n');

        parts.forEach((part, partIndex) => {
          if (part) {
            currentRuns.push(createTextRun(part, attributes));
          }

          // Create paragraph if not the last part
          if (partIndex < parts.length - 1) {
            // Check if we need spacing after list ends
            const needsListEndSpacing = previousWasList && !isCurrentList;

            paragraphs.push(createParagraph(currentRuns, attributes, needsListEndSpacing));
            currentRuns = [];
            previousWasList = isCurrentList;
          }
        });
      } else if (text) {
        currentRuns.push(createTextRun(text, attributes));
      }
    }
  });

  // Add final paragraph if there are remaining runs
  if (currentRuns.length > 0) {
    paragraphs.push(createParagraph(currentRuns, {}, false));
  }

  // Ensure at least one paragraph
  if (paragraphs.length === 0) {
    paragraphs.push(
      new docx.Paragraph({
        children: [createTextRun(' ', {})]
      })
    );
  }

  return paragraphs;
}

// Create text run with FIXED FONT (Calibri 11pt always)
function createTextRun(text, attributes) {
  const formatting = {
    text: text,
    font: 'Calibri',
    size: 22, // Always 11pt (22 half-points)
    color: '000000' // Always black
  };

  // Only handle basic formatting
  if (attributes.bold) {
    formatting.bold = true;
  }

  if (attributes.italic) {
    formatting.italics = true;
  }

  if (attributes.underline) {
    formatting.underline = {};
  }

  if (attributes.strike) {
    formatting.strike = true;
  }

  // Superscript/Subscript
  if (attributes.script) {
    if (attributes.script === 'super') {
      formatting.superScript = true;
    } else if (attributes.script === 'sub') {
      formatting.subScript = true;
    }
  }

  return new docx.TextRun(formatting);
}

// Create paragraph with perfect list support and 20px spacing
function createParagraph(runs, attributes, needsListEndSpacing = false) {
  const paragraphProps = {
    children: runs.length > 0 ? runs : [createTextRun(' ', {})],
    spacing: {
      after: 300, // 20px = 15pt = 300 twips (matches your QuillJS margin)
      before: 0
    }
  };

  // Handle lists perfectly
  if (attributes.list) {
    const indentLevel = attributes.indent || 0;

    // Remove spacing for list items
    paragraphProps.spacing = {
      after: 0,
      before: 0
    };

    if (attributes.list === 'bullet') {
      paragraphProps.numbering = {
        reference: 'bullet-numbering',
        level: indentLevel
      };
    } else if (attributes.list === 'ordered') {
      paragraphProps.numbering = {
        reference: 'ordered-numbering',
        level: indentLevel
      };
    }
  } else {
    // Add extra spacing if this paragraph comes after a list
    if (needsListEndSpacing) {
      paragraphProps.spacing.before = 300; // Add 20px before this paragraph
    }

    // Handle regular indentation (not lists)
    if (attributes.indent) {
      paragraphProps.indent = {
        left: attributes.indent * 720 // Convert to twips
      };
    }

    // Text alignment for non-list items
    if (attributes.align) {
      const alignmentMap = {
        left: docx.AlignmentType.LEFT,
        center: docx.AlignmentType.CENTER,
        right: docx.AlignmentType.RIGHT,
        justify: docx.AlignmentType.JUSTIFIED
      };
      paragraphProps.alignment = alignmentMap[attributes.align];
    }
  }

  return new docx.Paragraph(paragraphProps);
}

// ======================= DOWNLOAD BUTTON SETUP =======================

function initializeDownloadButton() {
  const downloadBtn = document.getElementById('downloadBtnQuill');

  if (!downloadBtn) {
    console.error('Download button not found');
    return;
  }

  const dropdownHTML = `
      <div id="downloadDropdown" class="download-dropdown" style="display: none; position: absolute;">
        <div class="download-option" data-type="docx">
          <span>Word (.docx)</span>
        </div>
        <div class="download-option" data-type="pdf">
          <span>PDF (.pdf)</span>
        </div>
        <div class="download-option" data-type="txt">
          <span>Tekstfil (.txt)</span>
        </div>
      </div>
    `;

  // Create container for button and dropdown
  const container = document.createElement('div');
  container.classList.add('download-container');
  container.style.position = 'relative';
  container.style.display = 'inline-block';

  // Wrap button in container
  downloadBtn.parentNode.insertBefore(container, downloadBtn);
  container.appendChild(downloadBtn);
  container.insertAdjacentHTML('beforeend', dropdownHTML);

  const dropdown = document.getElementById('downloadDropdown');

  downloadBtn.addEventListener('click', () => {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });

  // Dropdown handlers
  document.querySelectorAll('.download-option').forEach(option => {
    option.addEventListener('click', async () => {
      const type = option.getAttribute('data-type');

      // Get HTML content (with formatting) - these functions are from main.js
      const formattedContent = removeInlineStyles(
        removeHamDanTags(removeMarkTags(sanitizeHtmlContentForDownload(quill1.root.innerHTML)))
      );
      console.log('text going inside the downloads', formattedContent);

      // Get plain text (structure preserved) - this function is from main.js
      const plainTextContent = getCleanPlainTextFromQuillSimple(quill1);

      try {
        switch (type) {
          case 'txt':
            downloadTxt(plainTextContent);
            break;
          case 'docx':
            await downloadDocx();
            break;
          case 'pdf':
            await downloadPdfWithPdfMake(formattedContent);
            break;
        }
      } finally {
        dropdown.style.display = 'none';
      }
    });
  });

  document.addEventListener('click', e => {
    if (!downloadBtn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

// ======================= EXPORT FUNCTIONS =======================

// Export all functions that need to be accessible from main.js
export {
  initializeDownloadButton,
  downloadTxt,
  downloadPdfWithPdfMake,
  downloadDocx,
  getDocumentTitle,
  removeInlineStyles,
  sanitizeHtmlContentForDownload
};
