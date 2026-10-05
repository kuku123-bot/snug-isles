import { App } from './app.js';
import { lockZoom } from './engine/nozoom.js';

lockZoom();

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('.load-sub').textContent = 'Something went wrong: ' + (e && e.message ? e.message : e);
});
