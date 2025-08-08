export function removeHamDanTags(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return htmlContent;
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  // Select every <ham-dan> element once, snapshotting into an array so we can modify safely
  Array.from(tempDiv.querySelectorAll('ham-dan')).forEach(hamDan => {
    if (hamDan.classList.contains('grammar-correction-removed')) {
      // ① If it’s marked for removal, drop the entire element (and anything inside it)
      hamDan.remove();
    } else {
      // ② Otherwise unwrap it, preserving its children
      const fragment = document.createDocumentFragment();
      while (hamDan.firstChild) {
        fragment.appendChild(hamDan.firstChild);
      }
      hamDan.replaceWith(fragment);
    }
  });

  return tempDiv.innerHTML;
}
export function removeMarkTags(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return htmlContent;
  }

  // Work in a detached DOM tree
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  // Snapshot the list first so we can mutate safely while iterating
  Array.from(tempDiv.querySelectorAll('mark')).forEach(markEl => {
    const fragment = document.createDocumentFragment();
    while (markEl.firstChild) {
      fragment.appendChild(markEl.firstChild);
    }
    markEl.replaceWith(fragment); // unwrap <mark>, keep its children
  });

  return tempDiv.innerHTML;
}
