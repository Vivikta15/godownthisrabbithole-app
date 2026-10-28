import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/dm-sans';
import '@fontsource/dm-mono/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import './styles.css';
import './meadow.css';

// Time-of-day theme from the device clock: dawn 5-8, day 8-17, dusk 17-20, night 20-5.
// ?daypart= overrides it for testing. No location or weather data is read or sent anywhere.
function applyDaypart() {
  const q = new URLSearchParams(window.location.search).get('daypart');
  const h = new Date().getHours();
  const dp = q === 'dawn' || q === 'day' || q === 'dusk' || q === 'night' ? q : h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
  document.documentElement.dataset.daypart = dp;
}
applyDaypart();
// ?weather=cloudy|rain|mist previews a sky layer for testing; real weather only ever comes from the signed-in user's saved city.
{ const w = new URLSearchParams(window.location.search).get('weather'); if (w === 'cloudy' || w === 'rain' || w === 'mist') document.documentElement.dataset.weather = w; }
window.setInterval(applyDaypart, 15 * 60 * 1000);

createRoot(document.getElementById('root')!).render(<App />);
