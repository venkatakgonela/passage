export function readingAnchor() {
  const scroller = document.querySelector('#scroller');
  const boundary = scroller.getBoundingClientRect().top;
  const element = [...document.querySelectorAll('#doc h1,#doc h2,#doc h3,#doc h4,#doc p,#doc li')].find(candidate => candidate.getBoundingClientRect().top >= boundary);
  return { element, offset: element?.getBoundingClientRect().top, scroll: scroller.scrollTop };
}

export function restoreAnchor(anchor) {
  const scroller = document.querySelector('#scroller');
  if (anchor.element?.isConnected) scroller.scrollTop += anchor.element.getBoundingClientRect().top - anchor.offset;
}

export function stableChange(change) {
  const anchor = readingAnchor();
  change();
  restoreAnchor(anchor);
}
