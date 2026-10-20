// Shared by the gallery (client) and the page skeleton (server); a constant exported from a
// "use client" file would reach a server component as a client reference, not a string.
/**
 * Square on a phone (the packshots are square, so no empty bands above and below, and the swipe row keeps one height);
 * on desktop each image fills the screen under the 72px header, so a one-image product needs no scroll.
 */
export const frame = "aspect-square lg:aspect-auto lg:h-[calc(100svh-4.5rem)] lg:min-h-120";
