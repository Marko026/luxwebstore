// Sample content for the home page until products come from the database.
// Every label here is placeholder content to be replaced before launch.

export type Photo = {
  src: string;
  alt: string;
  /** Page the photo was taken from (free Unsplash / Pexels licence). */
  source: string;
};

const unsplash = (id: string) => `https://unsplash.com/photos/${id}`;
const pexels = (id: string) => `https://www.pexels.com/photo/${id}/`;

export const photos = {
  hero: {
    src: "/images/home/hero.jpg",
    alt: "A woman in a white dress seated in a panelled room, holding a woven bag on her lap",
    source: unsplash("VXQvz1t7uHk"),
  },
  edWomen: {
    src: "/images/home/ed-women.jpg",
    alt: "A woman in an olive wool suit seated in a copper-lit room with a black leather bag on her lap",
    source: unsplash("vBfwbcGW8tQ"),
  },
  edMen: {
    src: "/images/home/ed-men.jpg",
    alt: "A man in a brown leather jacket standing in low evening light",
    source: unsplash("e1o9oQ0ZnMA"),
  },
  topHandle: {
    src: "/images/home/pk-top-handle.jpg",
    alt: "Black textured leather top-handle bag with a gold zip",
    source: unsplash("nTMd3p_wSXU"),
  },
  satchel: {
    src: "/images/home/pk-satchel.jpg",
    alt: "Cognac leather satchel with two buckled straps",
    source: unsplash("IFlg3kFbR0E"),
  },
  crossbody: {
    src: "/images/home/pk-crossbody.jpg",
    alt: "Black leather camera crossbody bag with a gold zip pocket",
    source: pexels("22432986"),
  },
  shoulder: {
    src: "/images/home/pk-shoulder.jpg",
    alt: "Grey pleated leather shoulder bag with a long strap",
    source: pexels("22432993"),
  },
  appointment: {
    src: "/images/home/svc-appointment.jpg",
    alt: "Black and white shop front with tall dark window frames",
    source: unsplash("SxzipPp8cgg"),
  },
  personalization: {
    src: "/images/home/svc-personalization.jpg",
    alt: "A craftsman tapping a motif into a copper plate with a punch",
    source: unsplash("KOwn5ibC4ZI"),
  },
  collect: {
    src: "/images/home/svc-collect.jpg",
    alt: "Black and white shop front at night with lit windows and bicycles outside",
    source: unsplash("RvgMluP_33o"),
  },
} satisfies Record<string, Photo>;

/** Full-bleed hero: one label and one button. */
export const hero = { label: "Women's Handbags", href: "#", photo: photos.hero };

/** Row of four packshots under the hero. */
export const categoryTiles = [
  { label: "Women's Top-Handle Bags", href: "#", photo: photos.topHandle },
  { label: "Women's Shoulder Bags", href: "#", photo: photos.shoulder },
  { label: "Crossbody Bags", href: "#", photo: photos.crossbody },
  { label: "Men's Bags", href: "#", photo: photos.satchel },
];

/** The two half-width editorial images. */
export const featuredCollections = [
  { label: "Autumn Collection for Women", href: "#", photo: photos.edWomen, position: "50% 60%" },
  { label: "Autumn Collection for Men", href: "#", photo: photos.edMen, position: "50% 30%" },
];

export const services = [
  { title: "Book an Appointment", link: "Choose your visit", href: "#contact", photo: photos.appointment },
  { title: "Personalization", link: "Explore initials", href: "#contact", photo: photos.personalization },
  { title: "Collect in Store", link: "Discover how", href: "#contact", photo: photos.collect },
];

/** Every photo on the page, for the credits list in the footer. */
export const allPhotos: Photo[] = Object.values(photos);
