import { APP_NAME } from './config.js';
import { select } from './dom.js';
import { setupTheme } from './theme.js';
import { setupSearch } from './search.js';
import { setupWorkspace, loadRoots } from './workspace.js';
import { setupNavigation } from './navigation.js';
import { openDocument } from './rendering.js';
import { setupIcons } from './icons.js';

document.title = APP_NAME;
select('#crumb').textContent = APP_NAME;
setupIcons();
setupTheme();
setupSearch();
setupWorkspace();
setupNavigation();
loadRoots().then(openDocument);
