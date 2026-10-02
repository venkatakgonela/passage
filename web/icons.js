const shapes = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  theme: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z',
  print: 'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6Z',
  plus: 'M12 4v16M4 12h16',
  minus: 'M4 12h16',
  outline: 'M9 5h11M9 12h11M9 19h11M3 5h1M3 12h1M3 19h1',
};

export function setupIcons() {
  for (const [identifier, name, label] of [['navtog', 'menu', 'Toggle documents'], ['theme', 'theme', 'Change theme'], ['print', 'print', 'Print'], ['add', 'plus', 'Add folder'], ['rm', 'minus', 'Remove folder'], ['toctog', 'outline', 'Toggle outline']]) {
    const button = document.getElementById(identifier);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${shapes[name]}"/></svg>`;
    button.setAttribute('aria-label', label);
    button.title = label;
  }
}
