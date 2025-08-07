// import { initializeTTS, stopSpeaking, manualStopSpeaking } from './textToSpeech.js';
// import { manuallyCloseMicButton } from './speechToText.js';
// These functions are used in copyPaste.js but should come from htmlUtils module
import { removeHamDanTags, removeMarkTags } from './utils.js';
// copyPaste.js - Copy/Paste Functionality Module

// Function to detect if the user is on a mobile device
function isMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile;
}

// Function to replace colons with semicolons for mobile devices
function processTextForMobile(text) {
    const isMobile = isMobileDevice();

    if (isMobile) {
        const processed = text.replace(/:/g, ';');
        return processed;
    } else {
        return text;
    }
}

// Function to process HTML content for mobile devices
function processHtmlForMobile(html) {
    const isMobile = isMobileDevice();

    if (!isMobile) {
        return html;
    }

    // Create a temporary container to parse and modify the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Process text nodes to replace colons with semicolons
    const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    let replacementsMade = 0;
    let nodesProcessed = 0;

    while (node = walker.nextNode()) {
        nodesProcessed++;
        const oldContent = node.textContent;

        node.textContent = node.textContent.replace(/:/g, ';');

        if (oldContent !== node.textContent) {
            replacementsMade++;
        }
    }

    const processedHtml = tempDiv.innerHTML;
    return processedHtml;
}

// UPDATED quillHtmlToPlainTextWithParagraphs function 
// This handles &nbsp; paragraphs specially for proper plain text spacing
function quillHtmlToPlainTextWithParagraphs(html) {
    // Log HTML structure analysis
    const tagMatches = html.match(/<([a-z0-9]+)[\s>]/gi);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // *** NEW *** PRE-PROCESS &nbsp;-only paragraphs before text conversion
    const nbspParagraphs = tempDiv.querySelectorAll('p');
    let nbspParagraphsProcessed = 0;

    nbspParagraphs.forEach((p, index) => {
        const innerHTML = p.innerHTML.trim();
        const textContent = p.textContent.trim();

        // Check if this paragraph contains ONLY &nbsp; (which becomes a space in textContent)
        const isNbspOnly = (
            innerHTML === '&nbsp;' ||
            innerHTML === '&nbsp' ||
            (textContent === ' ' && innerHTML.includes('&nbsp;'))
        );

        if (isNbspOnly) {
            // Replace with a special marker that we'll handle differently
            p.setAttribute('data-empty-line', 'true');
            p.innerHTML = ''; // Make it truly empty for text processing
            nbspParagraphsProcessed++;
        }
    });

    // Count and log BR elements
    const brElements = tempDiv.querySelectorAll('br');

    // Clean up specific <p><br></p> after <strong>
    (function cleanInitialEmptyParagraphAfterStrong() {
        const children = Array.from(tempDiv.childNodes);

        if (children.length >= 2) {
            if (
                children[0].nodeType === Node.ELEMENT_NODE &&
                children[0].tagName === 'STRONG' &&
                children[1].tagName === 'P'
            ) {
                const firstParagraph = children[1];

                if (firstParagraph.childNodes.length === 1) {
                    if (firstParagraph.firstChild.tagName === 'BR') {
                        tempDiv.removeChild(firstParagraph);
                    }
                }
            }
        }
    })();

    // Create a string to hold our processed content
    let plainTextContent = '';

    // Track list state
    let inList = false;
    let listLevel = 0;
    let bulletFormats = [' • ', ' - ', ' * ']; // Different bullet styles for nesting

    // *** UPDATED *** Map of elements with SPECIAL handling for empty-line paragraphs
    const blockElements = {
        'H1': { before: '\n\n', after: '\n\n', process: text => text.toUpperCase() },
        'H2': { before: '\n\n', after: '\n\n', process: text => text },
        'H3': { before: '\n\n', after: '\n\n', process: text => text },
        'H4': { before: '\n\n', after: '\n\n', process: text => text },
        'H5': { before: '\n\n', after: '\n\n', process: text => text },
        'H6': { before: '\n\n', after: '\n\n', process: text => text },
        'P': {
            before: node => {
                // *** SPECIAL HANDLING *** for empty-line paragraphs
                if (node.hasAttribute('data-empty-line')) {
                    return '\n';  // Just one newline for spacing
                }
                return '\n';  // Normal paragraph start
            },
            after: node => {
                // *** SPECIAL HANDLING *** for empty-line paragraphs  
                if (node.hasAttribute('data-empty-line')) {
                    return '\n';  // Just one newline after
                }
                return '\n\n';  // Normal paragraph end with double newline
            },
            process: text => text
        },
        'DIV': { before: '', after: '\n', process: text => text },
        'BLOCKQUOTE': { before: '\n\n> ', after: '\n\n', process: text => text },
        'UL': {
            before: '\n',
            after: '\n',
            process: text => text,
            onEnter: () => { inList = true; listLevel++; },
            onExit: () => { inList = listLevel > 1; listLevel--; }
        },
        'OL': {
            before: '\n',
            after: '\n',
            process: text => text,
            onEnter: () => { inList = true; listLevel++; },
            onExit: () => { inList = listLevel > 1; listLevel--; }
        },
        'LI': {
            before: node => {
                // Calculate indentation safely (never negative)
                if (node.parentNode.tagName === 'OL') {
                    // For ordered lists: indent = listLevel * 2 (clamped ≥ 0)
                    const indent = Math.max(0, listLevel * 2);
                    const listItems = Array.from(node.parentNode.children);
                    const index = listItems.indexOf(node) + 1;
                    const result = `\n${' '.repeat(indent)}${index}. `;
                    return result;
                } else {
                    // For unordered lists: indent = (listLevel - 1)*2, but ≥ 0
                    const rawIndent = (listLevel - 1) * 2;
                    const indent = Math.max(0, rawIndent);
                    // Bullet index also clamped ≥ 0
                    const bulletIndex = Math.max(0, Math.min(listLevel - 1, bulletFormats.length - 1));
                    const bulletStyle = bulletFormats[bulletIndex];
                    const result = `\n${' '.repeat(indent)}${bulletStyle}`;
                    return result;
                }
            },
            after: '',
            process: text => text
        },
        'TR': { before: '', after: '\n', process: text => text },
        'TD': { before: '', after: '\t', process: text => text },
        'TH': { before: '', after: '\t', process: text => text.toUpperCase() },
        'TABLE': { before: '\n\n', after: '\n\n', process: text => text },
        'STRONG': { before: '', after: '', process: text => text },
        'B': { before: '', after: '', process: text => text },
        'EM': { before: '', after: '', process: text => text },
        'I': { before: '', after: '', process: text => text },
        'CODE': { before: ' `', after: '` ', process: text => text },
        'PRE': { before: '\n```\n', after: '\n```\n', process: text => text },
        'SPAN': { before: '', after: '', process: text => text },
        'MARK': { before: '', after: '', process: text => text },
        'A': { before: '', after: '', process: text => text },
    };

    // Recursive function to process nodes
    function processNode(node, depth = 0) {
        if (!node) {
            return;
        }

        // Skip script and style tags
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
            return;
        }

        // Handle element nodes
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toUpperCase();
            const elementConfig = blockElements[tagName];

            // Handle block elements with special formatting
            if (elementConfig) {
                // Add the "before" formatting
                if (typeof elementConfig.before === 'function') {
                    const beforeResult = elementConfig.before(node);
                    plainTextContent += beforeResult;
                } else {
                    plainTextContent += elementConfig.before;
                }

                // Call onEnter if exists
                if (elementConfig.onEnter) {
                    elementConfig.onEnter();
                }

                // Special handling for headings
                if (/^H[1-6]$/.test(tagName)) {
                    const headingText = node.textContent.trim();
                    const processedText = elementConfig.process(headingText);
                    plainTextContent += processedText;
                } else if (tagName === 'P' && node.hasAttribute('data-empty-line')) {
                    // *** SPECIAL HANDLING *** for empty-line paragraphs - don't process children
                } else {
                    // Process children recursively
                    for (let i = 0; i < node.childNodes.length; i++) {
                        processNode(node.childNodes[i], depth + 1);
                    }
                }

                // Call onExit if exists
                if (elementConfig.onExit) {
                    elementConfig.onExit();
                }

                // Add the "after" formatting
                if (typeof elementConfig.after === 'function') {
                    const afterResult = elementConfig.after(node);
                    plainTextContent += afterResult;
                } else {
                    plainTextContent += elementConfig.after;
                }
            } else {
                // For other elements, just process their children
                for (let i = 0; i < node.childNodes.length; i++) {
                    processNode(node.childNodes[i], depth + 1);
                }
            }
        }
        // Handle text nodes
        else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent; // ✅ DON'T trim() - preserves intentional spaces

            if (text) {
                // Add the text content
                plainTextContent += text;

                // Check parent and next sibling for inline context
                const parentTagName = node.parentNode.tagName ? node.parentNode.tagName.toUpperCase() : '';
                const isInlineParent = ['SPAN', 'STRONG', 'EM', 'B', 'I', 'MARK', 'A'].includes(parentTagName);

                // Check if next sibling is an inline element
                const nextSibling = node.nextSibling;
                const nextIsInline = nextSibling &&
                    nextSibling.nodeType === Node.ELEMENT_NODE &&
                    ['SPAN', 'STRONG', 'EM', 'B', 'I', 'MARK', 'A'].includes(nextSibling.tagName.toUpperCase());

                // ✅ ENHANCED CONDITION: Only add space if not in inline context
                const shouldAddSpace = !inList &&
                    !isInlineParent &&
                    !nextIsInline &&
                    !['LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'CODE', 'PRE'].includes(parentTagName) &&
                    !text.endsWith(' ') && // Don't double-add spaces
                    !text.endsWith('\n');

                if (shouldAddSpace) {
                    plainTextContent += ' ';
                }
            }
        }
    }

    // Start processing from the root
    processNode(tempDiv);

    // Replace the BR placeholders with actual newlines
    const brPlaceholderCount = (plainTextContent.match(/__BR_PLACEHOLDER__/g) || []).length;
    plainTextContent = plainTextContent.replace(/__BR_PLACEHOLDER__/g, '\n');

    // Post-processing cleanup
    const beforeCleanup = plainTextContent.length;

    plainTextContent = plainTextContent
        // Cleanup multiple consecutive newlines (more than 2)
        .replace(/\n{3,}/g, '\n\n')
        // Remove excessive spaces
        .replace(/ {2,}/g, ' ')
        // Fix spacing around list indicators
        .replace(/\n([ ]*)(•|-|\*|\d+\.) {2,}/g, '\n$1$2 ')
        // Trim leading/trailing whitespace
        .trim();

    const afterCleanup = plainTextContent.length;

    return plainTextContent;
}

function processHtmlForCopy(htmlContent, context = 'unknown') {
    // Step 1: Apply removeHamDanTags first
    try {
        if (typeof removeHamDanTags === 'function') {
            htmlContent = removeHamDanTags(htmlContent);
        }
    } catch (error) {
        console.log('removeHamDanTags not available');
    }

    // Step 2: Apply removeMarkTags
    try {
        if (typeof removeMarkTags === 'function') {
            htmlContent = removeMarkTags(htmlContent);
        }
    } catch (error) {
        console.log('removeMarkTags not available');
    }
    
    try {
        htmlContent = normalizeEmojisInHtml(htmlContent);
    } catch (error) { 
        console.log('normalizeEmojisInHtml failed');
    }

    // Step 3: Apply bullet list conversion
    try {
        htmlContent = convertBulletListToUlForCopy(htmlContent);
    } catch (error) {
        console.log('convertBulletListToUlForCopy failed');
    }

    // Step 4: *** CRITICAL *** UNIVERSAL HTML SPACING FIX
    try {
        htmlContent = makeUniversalSpacingCompatible(htmlContent);
    } catch (error) {
        console.log('makeUniversalSpacingCompatible failed');
    }

    return htmlContent;
}

function processQuillContentForCopy(quillInstance) {
    // Get the editor container element
    const editorContainer = quillInstance.container.querySelector('.ql-editor');

    if (!editorContainer) {
        return { html: '', text: '' };
    }

    // Log Quill's formats and content details
    try {
        const formats = quillInstance.getFormat();
        const contentLength = quillInstance.getLength();
        const selection = quillInstance.getSelection();
    } catch (error) {
        console.log('Error getting Quill details');
    }

    // Check for headings in the Quill content
    const deltaContents = quillInstance.getContents();

    // Look for header formats in the delta
    let hasHeaders = false;
    let headerContents = [];
    if (deltaContents && deltaContents.ops) {
        deltaContents.ops.forEach((op, index) => {
            // Check for headers in the attributes
            if (op.attributes && op.attributes.header) {
                hasHeaders = true;

                // Try to find the content for this header
                if (index > 0 && deltaContents.ops[index - 1].insert && typeof deltaContents.ops[index - 1].insert === 'string') {
                    const headerContent = {
                        level: op.attributes.header,
                        text: deltaContents.ops[index - 1].insert.trim()
                    };
                    headerContents.push(headerContent);
                }
            }
        });
    }

    // Get the initial HTML content
    let htmlContent = editorContainer.innerHTML;

    try {
        if (typeof removeMarkTags === 'function') {
            htmlContent = removeMarkTags(htmlContent);
        }
    } catch (error) {
        console.log('removeMarkTags not available');
    }

    // *** USE THE NEW CENTRAL PROCESSING FUNCTION ***
    htmlContent = processHtmlForCopy(htmlContent, 'full-content');

    // Now create tempDiv with the processed HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Remove paragraph tags with only BR tags that follow heading tags
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    let totalParagraphsRemoved = 0;

    headingTags.forEach(hTag => {
        const headings = tempDiv.querySelectorAll(hTag);

        headings.forEach((heading, index) => {
            // Check if the next sibling is a paragraph
            const nextSibling = heading.nextElementSibling;

            if (nextSibling && nextSibling.tagName === 'P') {
                // Check if paragraph only contains a BR tag
                const onlyBrChild = nextSibling.childNodes.length === 1 &&
                    nextSibling.firstChild &&
                    nextSibling.firstChild.nodeType === Node.ELEMENT_NODE &&
                    nextSibling.firstChild.tagName === 'BR';

                const onlyBrInnerHTML = nextSibling.innerHTML.trim() === '<br>' ||
                    nextSibling.innerHTML.trim() === '<br/>' ||
                    nextSibling.innerHTML.trim() === '<br />';

                if (onlyBrChild || onlyBrInnerHTML) {
                    // Remove the paragraph with BR
                    nextSibling.parentNode.removeChild(nextSibling);
                    totalParagraphsRemoved++;
                }
            }
        });
    });

    // Remove Quill UI elements that shouldn't be copied
    const quillUiElements = tempDiv.querySelectorAll('.ql-ui');

    quillUiElements.forEach((el, index) => {
        el.parentNode.removeChild(el);
    });

    // Count headings before conversion for debug
    const headingCounts = {};
    headingTags.forEach(hTag => {
        const count = tempDiv.querySelectorAll(hTag).length;
        if (count > 0) {
            headingCounts[hTag] = count;
        }
    });

    // Store heading texts before transformation so we can ensure they appear in plain text
    const headingTexts = [];
    headingTags.forEach(hTag => {
        const headings = tempDiv.querySelectorAll(hTag);

        headings.forEach((heading, index) => {
            const text = heading.textContent.trim();
            headingTexts.push(text);
        });
    });

    // Convert all h tags (h1-h6) to strong tags
    let totalHeadingsConverted = 0;

    headingTags.forEach(hTag => {
        const headings = tempDiv.querySelectorAll(hTag);

        headings.forEach((heading, idx) => {
            const strongElement = document.createElement('strong');
            strongElement.innerHTML = heading.innerHTML;
            heading.parentNode.replaceChild(strongElement, heading);
            totalHeadingsConverted++;
        });
    });

    // Check if headings were properly replaced
    const remainingHeadings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (remainingHeadings.length > 0) {
        remainingHeadings.forEach((heading, index) => {
            console.log('Remaining heading found');
        });
    }

    // Remove background color, font size, and font family from all elements
    const allElements = tempDiv.querySelectorAll('*');

    let styleModifications = 0;
    allElements.forEach((el, index) => {
        const beforeStyle = el.getAttribute('style');

        el.style.backgroundColor = '';
        el.style.fontSize = '';
        el.style.fontFamily = '';

        // Also remove these properties from the style attribute
        if (el.hasAttribute('style')) {
            let style = el.getAttribute('style');
            const originalStyle = style;

            style = style.replace(/background(-color)?:[^;]+;?/gi, '');
            style = style.replace(/font-size:[^;]+;?/gi, '');
            style = style.replace(/font-family:[^;]+;?/gi, '');
            style = style.replace(/color:[^;]+;?/gi, ''); // Remove font color

            if (style.trim() === '') {
                el.removeAttribute('style');
            } else {
                el.setAttribute('style', style);
            }

            const afterStyle = el.getAttribute('style') || '';
            if (beforeStyle !== afterStyle) {
                styleModifications++;
            }
        }
    });

    // Clean root level styles
    if (tempDiv.style) {
        const rootStylesBefore = {
            backgroundColor: tempDiv.style.backgroundColor,
            fontSize: tempDiv.style.fontSize,
            fontFamily: tempDiv.style.fontFamily,
            color: tempDiv.style.color
        };

        tempDiv.style.backgroundColor = '';
        tempDiv.style.fontSize = '';
        tempDiv.style.fontFamily = '';
        tempDiv.style.color = '';
    }

    // Get the final processed HTML
    htmlContent = tempDiv.innerHTML;

    // Log list structure for debugging
    const finalOlCount = tempDiv.querySelectorAll('ol').length;
    const finalUlCount = tempDiv.querySelectorAll('ul').length;

    // Log other structural elements
    const finalCounts = {
        p: tempDiv.querySelectorAll('p').length,
        strong: tempDiv.querySelectorAll('strong').length,
        em: tempDiv.querySelectorAll('em').length,
        span: tempDiv.querySelectorAll('span').length,
        div: tempDiv.querySelectorAll('div').length
    };

    let textContent = quillHtmlToPlainTextWithParagraphs(htmlContent);

    // Check if we need to manually add heading text that might have been lost
    if (hasHeaders && headingTexts.length > 0) {
        let missingHeadings = [];

        for (const headingText of headingTexts) {
            const isPresent = textContent.includes(headingText);

            if (!isPresent) {
                missingHeadings.push(headingText);
            }
        }

        // If any headings are missing, add them at the beginning
        if (missingHeadings.length > 0) {
            let newTextContent = '';

            for (const headingText of missingHeadings) {
                newTextContent += headingText + '\n\n';
            }

            newTextContent += textContent;
            textContent = newTextContent;
        }
    }

    // For mobile devices, replace colons with semicolons
    if (isMobileDevice()) {
        const htmlBefore = htmlContent.length;
        const textBefore = textContent.length;

        htmlContent = processHtmlForMobile(htmlContent);
        textContent = processTextForMobile(textContent);
    }

    return {
        html: htmlContent,
        text: textContent
    };
}

// Your existing convertBulletListToUlForCopy function
function convertBulletListToUlForCopy(htmlString) {
    const parser = new DOMParser();

    const doc = parser.parseFromString(htmlString, 'text/html');

    const olElements = [...doc.querySelectorAll('ol')];

    let totalUlsCreated = 0;
    let totalLisMoved = 0;
    let totalOlsReplaced = 0;

    olElements.forEach((ol, olIndex) => {
        const ul = document.createElement('ul');
        let liMoved = false;
        let bulletLisFound = 0;
        let totalLisInOl = ol.children.length;

        [...ol.children].forEach((li, liIndex) => {
            const dataList = li.getAttribute('data-list');

            if (dataList === 'bullet') {
                li.removeAttribute('data-list');
                ul.appendChild(li.cloneNode(true));
                li.remove();
                liMoved = true;
                bulletLisFound++;
                totalLisMoved++;
            }
        });

        if (liMoved) {
            totalUlsCreated++;

            // If all lis were bullets, just replace the entire ol
            if (ol.children.length === 0) {
                ol.replaceWith(ul);
                totalOlsReplaced++;
            } else {
                // Otherwise, insert ul before ol and keep ol for numbered items
                ol.parentNode.insertBefore(ul, ol);
            }
        }
    });

    const resultHtml = doc.body.innerHTML;

    // Final verification
    const finalOlCount = doc.querySelectorAll('ol').length;
    const finalUlCount = doc.querySelectorAll('ul').length;

    return resultHtml;
}

function setupQuillCopyHandler(quillInstance) {
    // Get the editor element
    const editorElement = quillInstance.container;

    if (!editorElement) {
        return;
    }

    // Listen for copy events on the editor
    editorElement.addEventListener('copy', (e) => {
        // Get the actual DOM selection (not Quill's selection)
        const domSelection = window.getSelection();

        if (domSelection.rangeCount === 0 || domSelection.isCollapsed) {
            return;
        }

        // Check if the selection is within our Quill editor
        const quillEditor = quillInstance.container.querySelector('.ql-editor');

        const range = domSelection.getRangeAt(0);

        // Check if the selection is within the Quill editor
        const isWithinEditor = quillEditor.contains(range.commonAncestorContainer) ||
            range.commonAncestorContainer === quillEditor;

        if (!isWithinEditor) {
            return;
        }

        try {
            // *** EXTRACT THE ACTUAL SELECTED HTML STRUCTURE ***

            // Clone the selected content as a document fragment
            const selectedFragment = range.cloneContents();

            // Create a temporary div to hold the fragment and get its HTML
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(selectedFragment);

            let selectedHtml = tempDiv.innerHTML;

            try {
                if (typeof removeMarkTags === 'function') {
                    selectedHtml = removeMarkTags(selectedHtml);
                }
            } catch (error) {
                console.log('removeMarkTags not available');
            }

            // If we got empty or minimal content, try a different approach
            if (!selectedHtml.trim()) {
                // Alternative: Create a new range and try again
                const newRange = document.createRange();
                newRange.selectNodeContents(range.commonAncestorContainer);
                const altFragment = newRange.cloneContents();
                const altDiv = document.createElement('div');
                altDiv.appendChild(altFragment);
                selectedHtml = altDiv.innerHTML;
            }

            // Get the plain text version for comparison
            const selectedText = domSelection.toString();

            if (!selectedText || selectedText.trim() === '') {
                return;
            }

            // *** APPLY UPDATED UNIVERSAL HTML PROCESSING ***
            selectedHtml = processHtmlForCopy(selectedHtml, 'selection');

            // Process the selected HTML content
            const processDiv = document.createElement('div');
            processDiv.innerHTML = selectedHtml;

            // Check for formatting types in the selected content
            const hasHeadings = /h[1-6]/i.test(selectedHtml);
            const hasBulletList = /data-list="bullet"/i.test(selectedHtml) || processDiv.querySelector('ul');
            const hasNumberedList = /data-list="ordered"/i.test(selectedHtml) || processDiv.querySelector('ol');
            const hasTables = processDiv.querySelector('table') !== null;

            const formattingAnalysis = {
                headings: hasHeadings,
                bullets: hasBulletList,
                numbered: hasNumberedList,
                tables: hasTables
            };

            // Apply transformations while preserving structure

            // 1. Convert headings to strong tags (preserve your existing logic)
            const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
            let totalHeadingsConverted = 0;

            headingTags.forEach(hTag => {
                const headings = processDiv.querySelectorAll(hTag);

                headings.forEach((heading, index) => {
                    const strongElement = document.createElement('strong');
                    strongElement.innerHTML = heading.innerHTML;
                    heading.parentNode.replaceChild(strongElement, heading);
                    totalHeadingsConverted++;
                });
            });

            // 2. Remove empty paragraphs after strong tags (preserve your existing logic)
            const strongElements = processDiv.querySelectorAll('strong');
            let emptyParagraphsRemoved = 0;

            strongElements.forEach((strong, index) => {
                const nextSibling = strong.nextElementSibling;

                if (nextSibling && nextSibling.tagName === 'P') {
                    const isEmpty = (nextSibling.childNodes.length === 1 &&
                        nextSibling.firstChild &&
                        nextSibling.firstChild.nodeType === Node.ELEMENT_NODE &&
                        nextSibling.firstChild.tagName === 'BR') ||
                        nextSibling.innerHTML.trim() === '<br>' ||
                        nextSibling.innerHTML.trim() === '<br/>' ||
                        nextSibling.innerHTML.trim() === '<br />';

                    if (isEmpty) {
                        nextSibling.parentNode.removeChild(nextSibling);
                        emptyParagraphsRemoved++;
                    }
                }
            });

            // 3. Clean up styles (preserve your existing logic)
            const allElements = processDiv.querySelectorAll('*');

            let styleModifications = 0;
            allElements.forEach((el, index) => {
                const beforeStyle = el.getAttribute('style');

                // Remove unwanted styles but preserve table structure
                el.style.backgroundColor = '';
                el.style.fontSize = '';
                el.style.fontFamily = '';
                el.style.color = '';

                if (el.hasAttribute('style')) {
                    let style = el.getAttribute('style');
                    const originalStyle = style;

                    style = style.replace(/background(-color)?:[^;]+;?/gi, '');
                    style = style.replace(/font-size:[^;]+;?/gi, '');
                    style = style.replace(/font-family:[^;]+;?/gi, '');
                    style = style.replace(/color:[^;]+;?/gi, '');

                    if (style.trim() === '') {
                        el.removeAttribute('style');
                    } else {
                        el.setAttribute('style', style);
                    }

                    if (originalStyle !== (el.getAttribute('style') || '')) {
                        styleModifications++;
                    }
                }
            });

            // Get the processed HTML
            let htmlContent = processDiv.innerHTML;

            // *** UPDATED *** Generate text with universal spacing
            let textContent = quillHtmlToPlainTextWithParagraphs(htmlContent);

            // Generate better formatted plain text if we have formatting
            if (hasHeadings || hasBulletList || hasNumberedList || hasTables) {
                textContent = quillHtmlToPlainTextWithParagraphs(htmlContent);
            }

            // Apply mobile processing if needed (preserve your existing logic)
            if (isMobileDevice()) {
                const htmlBefore = htmlContent.length;
                const textBefore = textContent.length;

                htmlContent = processHtmlForMobile(htmlContent);
                textContent = processTextForMobile(textContent);
            }

            // Set the clipboard data
            e.clipboardData.setData('text/html', htmlContent);
            e.clipboardData.setData('text/plain', textContent);

            // Prevent default copy behavior
            e.preventDefault();

        } catch (error) {
            // Let default behavior happen on error
            return;
        }
    });
}

// Handle copy button click for Quill
const handleQuillCopy = async () => {
    try {
        // Get the content from Quill
        const { html: htmlContent, text: textContent } = processQuillContentForCopy(window.quill1);

        // For modern browsers, use the clipboard API
        if (navigator.clipboard && navigator.clipboard.write) {
            try {
                const clipboardItems = [
                    new ClipboardItem({
                        'text/html': new Blob([htmlContent], { type: 'text/html' }),
                        'text/plain': new Blob([textContent], { type: 'text/plain' })
                    })
                ];

                await navigator.clipboard.write(clipboardItems);

            } catch (clipboardError) {
                throw clipboardError; // Re-throw to fall back to alternative method
            }
        } else {
            throw new Error('Modern clipboard API not supported');
        }

        // Update the copy button
        updateCopyButton(true);
        setTimeout(() => {
            updateCopyButton(false);
        }, 2000);

    } catch (err) {
        try {
            // Fallback method for browsers without clipboard API support
            const tempElement = document.createElement('div');
            tempElement.setAttribute('contenteditable', 'true');
            tempElement.innerHTML = htmlContent;
            tempElement.style.position = 'absolute';
            tempElement.style.left = '-9999px';
            tempElement.style.top = '-9999px';
            document.body.appendChild(tempElement);

            // Select the content
            const range = document.createRange();
            range.selectNodeContents(tempElement);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Execute copy command
            const copySuccess = document.execCommand('copy');

            // Clean up
            selection.removeAllRanges();
            document.body.removeChild(tempElement);

            if (copySuccess) {
                updateCopyButton(true);
                setTimeout(() => updateCopyButton(false), 2000);
            } else {
                throw new Error('execCommand copy failed');
            }

        } catch (fallbackErr) {
            try {
                await navigator.clipboard.writeText(window.quill1.getText());
                updateCopyButton(true);
                setTimeout(() => updateCopyButton(false), 2000);
            } catch (textOnlyError) {
                console.log('All copy methods failed');
            }
        }
    }
};

const updateCopyButton = (copied) => {
    const copyButton = document.getElementById('copyBtn');

    if (!copyButton) {
        return;
    }

    const beforeHTML = copyButton.innerHTML;

    if (copied) {
        copyButton.innerHTML = `<svg width="19" height="16" viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.717 2.4933C18.0728 3.41378 17.5739 4.044 16.6082 4.66478C15.8291 5.16566 14.8364 5.70829 13.7846 6.63598C12.7535 7.54541 11.7472 8.64078 10.8529 9.71889C9.96223 10.7926 9.20522 11.8218 8.67035 12.5839C8.32471 13.0764 7.84234 13.8109 7.84234 13.8109C7.50218 14.3491 6.89063 14.6749 6.23489 14.6667C5.57901 14.6585 4.97657 14.3178 4.65113 13.7711C3.81924 12.3735 3.1773 11.8216 2.88226 11.6234C2.09282 11.0928 1.1665 11.0144 1.1665 9.77812C1.1665 8.79631 1.99558 8.0004 3.0183 8.0004C3.74035 8.02706 4.41149 8.31103 5.00613 8.71063C5.38625 8.96607 5.78891 9.30391 6.20774 9.74862C6.69929 9.07815 7.29164 8.30461 7.95566 7.5041C8.91998 6.34155 10.0582 5.09441 11.2789 4.0178C12.4788 2.95945 13.8662 1.96879 15.3367 1.445C16.2956 1.10347 17.3613 1.57281 17.717 2.4933Z" stroke="#414141" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg> Kopieret!`;
    } else {
        copyButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clip-path="url(#clip0_373_2280)">
                <path d="M7.5 12.5C7.5 10.143 7.5 8.96447 8.23223 8.23223C8.96447 7.5 10.143 7.5 12.5 7.5L13.3333 7.5C15.6904 7.5 16.8689 7.5 17.6011 8.23223C18.3333 8.96447 18.3333 10.143 18.3333 12.5V13.3333C18.3333 15.6904 18.3333 16.8689 17.6011 17.6011C16.8689 18.3333 15.6904 18.3333 13.3333 18.3333H12.5C10.143 18.3333 8.96447 18.3333 8.23223 17.6011C7.5 16.8689 7.5 15.6904 7.5 13.3333L7.5 12.5Z" stroke="#414141" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14.1665 7.49984C14.1646 5.03559 14.1273 3.75918 13.41 2.88519C13.2715 2.71641 13.1167 2.56165 12.9479 2.42314C12.026 1.6665 10.6562 1.6665 7.91663 1.6665C5.17706 1.6665 3.80727 1.6665 2.88532 2.42314C2.71654 2.56165 2.56177 2.71641 2.42326 2.88519C1.66663 3.80715 1.66663 5.17694 1.66663 7.9165C1.66663 10.6561 1.66663 12.0259 2.42326 12.9478C2.56177 13.1166 2.71653 13.2714 2.88531 13.4099C3.7593 14.1271 5.03572 14.1645 7.49996 14.1664" stroke="#414141" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <defs>
                <clipPath id="clip0_373_2280">
                    <rect width="20" height="20" fill="white"/>
                </clipPath>
            </defs>
        </svg>
        <span>Kopier</span>`;
    }

    const afterHTML = copyButton.innerHTML;
};

// Initialize the copy functionality
function initQuillCopy() {
    // Check if quill1 is available
    if (typeof window.quill1 === 'undefined') {
        console.log('quill1 not available');
    } else {
        console.log('quill1 available for copy functionality');
    }

    // Set up copy handler for Quill
    try {
        setupQuillCopyHandler(window.quill1);
    } catch (error) {
        console.log('Error setting up copy handler:', error);
    }

    // Add event listener to the copy button
    const copyButton = document.getElementById('copyBtn');

    if (copyButton) {
        copyButton.addEventListener('click', handleQuillCopy);
    } else {
        console.log('Copy button not found');
    }
}

// Universal fix that works across ALL platforms without breaking existing functionality
function makeUniversalSpacingCompatible(htmlContent) {
    // Create a temporary div to work with the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Find all paragraphs that ONLY contain BR tags (empty line spacing)
    const paragraphs = tempDiv.querySelectorAll('p');
    let emptyParagraphsFound = 0;
    let emptyParagraphsModified = 0;

    paragraphs.forEach((p, index) => {
        // VERY SPECIFIC CHECK: Only target paragraphs that are truly empty spacing
        const isEmptySpacing = (
            // Exact BR variations
            p.innerHTML.trim() === '<br>' ||
            p.innerHTML.trim() === '<br/>' ||
            p.innerHTML.trim() === '<br />' ||
            // Single BR child node
            (p.childNodes.length === 1 &&
                p.firstChild.nodeType === Node.ELEMENT_NODE &&
                p.firstChild.tagName === 'BR' &&
                p.textContent.trim() === '')
        );

        if (isEmptySpacing) {
            emptyParagraphsFound++;

            // UNIVERSAL SOLUTION: Use non-breaking space
            p.innerHTML = '&nbsp;';

            emptyParagraphsModified++;
        } else if (p.textContent.trim() === '' && p.innerHTML.trim() === '') {
            // Handle completely empty paragraphs (edge case)
            p.innerHTML = '&nbsp;';
            emptyParagraphsModified++;
        }
    });

    const result = tempDiv.innerHTML;

    return result;
}

// Add this function to normalize emojis before copying
function normalizeEmojisInHtml(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Find all emoji img elements and replace with Unicode
    const emojiImages = tempDiv.querySelectorAll('img.emoji, img[role="img"]');

    emojiImages.forEach(img => {
        const altText = img.getAttribute('alt');

        // If alt text contains an emoji, replace the img with the emoji
        if (altText && /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(altText)) {
            const textNode = document.createTextNode(altText);
            img.parentNode.replaceChild(textNode, img);
        }
    });

    return tempDiv.innerHTML;
}

// Enhanced paste handling function
async function handlePaste(clearExisting = false, moveToEnd = true) {
    // Import required functions from main file
    const { stopSpeaking, manuallyCloseMicButton, resetNavText, resetSidebar, handleClear } = window;
    stopSpeaking();
    manuallyCloseMicButton('micButton1');
    resetNavText();

    console.log('handlePaste function called, clearExisting:', clearExisting);

    try {
        /* ──────────────────── (1) optional editor clear ──────────────────── */
        if (clearExisting) {
            console.log('Clearing the editor…');
            window.quill1.setText('');
            resetSidebar();
            handleClear();
        }

        let html = null;
        let text = '';

        /* ──────────────────── (2) read clipboard items ──────────────────── */
        if (navigator.clipboard.read) {
            try {
                const items = await navigator.clipboard.read();
                console.log('Clipboard items found:', items.length);

                let processedContent = false;

                for (const item of items) {
                    // skip pure image blobs
                    if (item.types.some(t => t.startsWith('image/') && !t.includes('docs')) &&
                        item.types.length === 1) {
                        console.log('Skipping image file:', item.types);
                        continue;
                    }

                    /* ───── HTML branch ───── */
                    if (item.types.includes('text/html')) {
                        const blob = await item.getType('text/html');
                        const htmlText = await blob.text();
                        console.log('%c[Original Pasted HTML]:', 'color: blue; font-weight: bold;', htmlText);

                        // Thorough clean-up (images, background images, SVG, <picture>, base64)
                        const cleanedHTML = htmlText
                            .replace(/<img[^>]*>/gi, '')
                            .replace(/background-image\s*:\s*url\([^)]+\)/gi, '')
                            .replace(/<svg[^>]*>.*?<\/svg>/gis, '')
                            .replace(/<picture[^>]*>.*?<\/picture>/gis, '')
                            .replace(/data:image\/[^;]+;base64,[^\s'"]+/gi, '');

                        console.log('%c[Cleaned HTML for insertion]:', 'color: green; font-weight: bold;', cleanedHTML);

                        const isEmpty = window.quill1.getText().trim().length === 0;
                        const selection = window.quill1.getSelection();
                        const insertIndex = selection ? selection.index : window.quill1.getLength();
                        const selectionLength = selection ? selection.length : 0;

                        // delete current selection if any
                        if (selectionLength > 0) {
                            window.quill1.deleteText(insertIndex, selectionLength);
                        }

                        if (cleanedHTML.trim()) {
                            if (isEmpty) {
                                // wipe Quill's auto-<p><br></p>
                                if (window.quill1.root.innerHTML === '<p><br></p>') window.quill1.setText('');

                                window.quill1.clipboard.dangerouslyPasteHTML(0, cleanedHTML, 'user');

                                // FIXED: Calculate correct cursor position for empty editor
                                const newLength = window.quill1.getLength();
                                window.quill1.setSelection(newLength - 1, 0);
                            } else {
                                const pasteIndex = selection ? selection.index : window.quill1.getLength();

                                // Store the length before pasting to calculate the pasted content length
                                const lengthBeforePaste = window.quill1.getLength();

                                window.quill1.clipboard.dangerouslyPasteHTML(pasteIndex, cleanedHTML, 'user');

                                // FIXED: Calculate the correct cursor position
                                const lengthAfterPaste = window.quill1.getLength();
                                const pastedContentLength = lengthAfterPaste - lengthBeforePaste;
                                const newCursorPosition = pasteIndex + pastedContentLength;

                                window.quill1.setSelection(newCursorPosition, 0);
                            }
                        }
                        // Scroll to show the pasted content
                        setTimeout(() => scrollAfterPaste(), 100);
                        window.quill1.focus();
                        processedContent = true;
                        break;      // done with HTML branch
                    }
                }

                /* ───── Plain-text fallback ───── */
                if (!processedContent) {
                    for (const item of items) {
                        if (item.types.some(t => t.startsWith('image/') && !t.includes('docs')) &&
                            item.types.length === 1) continue;   // skip pure images

                        if (item.types.includes('text/plain')) {
                            const blob = await item.getType('text/plain');
                            text = await blob.text();
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error('navigator.clipboard.read failed:', err);
                try { text = await navigator.clipboard.readText(); }
                catch (rtErr) { console.error('readText fallback failed:', rtErr); }
            }
        } else {
            try { text = await navigator.clipboard.readText(); }
            catch (rtErr) { console.error('readText fallback failed:', rtErr); }
        }

        /* ──────────────────── (3) insert plain text ──────────────────── */
        if (text) {
            console.log('%c[Pasted Plain Text]:', 'color: orange; font-weight: bold;', text);

            const isEmpty = window.quill1.getText().trim().length === 0;
            if (text.trim()) {
                if (isEmpty) {
                    // Delete the auto-inserted empty paragraph if present
                    if (window.quill1.root.innerHTML === '<p><br></p>') window.quill1.setText('');

                    window.quill1.insertText(0, text, 'user');
                    // FIXED: Set cursor at the end of pasted text for empty editor
                    window.quill1.setSelection(text.length, 0);
                } else {
                    const selection = window.quill1.getSelection();
                    const insertIndex = selection ? selection.index : window.quill1.getLength();
                    const selectionLength = selection ? selection.length : 0;

                    if (selectionLength > 0) window.quill1.deleteText(insertIndex, selectionLength);

                    window.quill1.insertText(insertIndex, text, 'user');

                    // FIXED: Set cursor at the end of pasted content, not end of document
                    const newCursorPosition = insertIndex + text.length;
                    window.quill1.setSelection(newCursorPosition, 0);
                }
            }
            // Scroll to show the pasted content
            setTimeout(() => scrollAfterPaste(), 100);
            window.quill1.focus();
        }

        /* ─────────────── (4) No heading-conversion step anymore ─────────────── */
        const finalSel = window.quill1.getSelection();
        console.log('%c[Final cursor position]:', 'color: red; font-weight: bold;', finalSel);

    } catch (err) {
        console.error('Clipboard handling failed:', err);
    } finally {
        console.log('handlePaste function finished');
    }
}

// Function to scroll to the end of the page after pasting text
function scrollAfterPaste() {
    // Wait longer for Quill to fully update its content
    setTimeout(() => {
        // First, scroll the Quill editor itself to the bottom
        const quillContainer = document.querySelector('.ql-container');
        const quillEditor = document.querySelector('.ql-editor');

        if (quillEditor) {
            // Scroll the Quill editor to its bottom
            quillEditor.scrollTop = quillEditor.scrollHeight;
        }

        // Then scroll the window to the bottom
        const scrollHeight = Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );

        window.scrollTo({
            top: scrollHeight,
            behavior: 'smooth'
        });

        // Final fallback to ensure we're at the absolute bottom
        setTimeout(() => {
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }, 200); // Increased timeout to 200ms for Quill to update
}

// ── Updated helper function ──────────────────────────────────────────────
function moveCaretToEnd() {
    const newLength = window.quill1.getLength();
    window.quill1.setSelection(newLength - 1, 0);
}

// Export all functions for use in main file
export {
    isMobileDevice,
    processTextForMobile,
    processHtmlForMobile,
    quillHtmlToPlainTextWithParagraphs,
    processHtmlForCopy,
    processQuillContentForCopy,
    setupQuillCopyHandler,
    handleQuillCopy,
    updateCopyButton,
    initQuillCopy,
    convertBulletListToUlForCopy,
    makeUniversalSpacingCompatible,
    normalizeEmojisInHtml,
    handlePaste,
    scrollAfterPaste,
    moveCaretToEnd
};