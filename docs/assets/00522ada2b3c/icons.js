const paths = {
    horizontal: '<path d="M3 13h18M6 9l-4 4 4 4m12-8 4 4-4 4M5 6c3 0 3 12 7 12S17 6 21 6"/>',
    slope: '<path d="M4 20 20 4m-9 0h9v9M4 15v5h5"/>',
    double: '<circle cx="8" cy="8" r="4"/><circle cx="17" cy="17" r="4"/><path d="m2 22 20-20"/>',
    obstacle: '<path d="m12 2 10 10-10 10L2 12Z"/><path d="m9 9 6 6m0-6-6 6"/>',
    spark: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/>',
    crossing: '<path d="m3 5 18 14M3 19 21 5M3 5v14M21 5v14"/><circle cx="12" cy="12" r="3"/>',
    unstable: '<path d="m12 2 10 19H2Z"/><path d="m12 8 4 9H8Z"/><circle cx="12" cy="14" r="1"/>',
    orbit: '<ellipse cx="12" cy="12" rx="10" ry="6" transform="rotate(-30 12 12)"/><path d="m16 4 3 1-1 3"/><circle cx="12" cy="12" r="1.3"/>',
    retry: '<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4Zm13 1 5 5m0-5-5 5"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
    lab: '<path d="M9 3h6m-5 0v6L4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3M7 15h10"/><circle cx="11" cy="17" r=".6"/>',
    shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    trophy: '<path d="M7 3h10v5c0 4-2 6-5 6s-5-2-5-6ZM7 5H3v3c0 3 3 4 5 4m9-7h4v3c0 3-3 4-5 4M12 14v6m-4 1h8"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const worlds = ['horizontal', 'slope', 'double', 'obstacle', 'spark', 'crossing', 'unstable', 'orbit'];
export const worldIcon = (world) => icon(worlds[world]);
