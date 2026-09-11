import temple from "@/assets/tour-temple.jpg";
import bay from "@/assets/tour-bay.jpg";
import terraces from "@/assets/tour-terraces.jpg";
import oldtown from "@/assets/tour-oldtown.jpg";
import island from "@/assets/tour-island.jpg";
import waterfall from "@/assets/tour-waterfall.jpg";

export type TransportType = "bus" | "train" | "car";

export type Tour = {
  id: string;
  title: string;
  destination: string;
  image: string;
  price: number;
  oldPrice?: number;
  duration: string;
  rating: number;
  reviews: number;
  transport: TransportType;
  combo: boolean;
  categories: string[];
  pickupZone: string;
  summary: string;
  attractions: string[];
  itinerary: { time: string; title: string; detail: string }[];
  included: string[];
  excluded: string[];
  mapPoints: { x: number; y: number; label: string; type: "pickup" | "stop" | "attraction" }[];
};

export const tours: Tour[] = [
  {
    id: "emerald-bay-cruise",
    title: "Emerald Bay Cruise & Cave Discovery",
    destination: "Ha Long Bay",
    image: bay,
    price: 89,
    oldPrice: 119,
    duration: "1 day · 10h",
    rating: 4.9,
    reviews: 2143,
    transport: "bus",
    combo: true,
    categories: ["Nature", "Cruise", "UNESCO"],
    pickupZone: "City Center",
    summary:
      "Sail through limestone karsts on a private day cruise, with kayaking, a cave walk and a seafood lunch on board.",
    attractions: ["Sung Sot Cave entry", "Titop Island viewpoint", "Kayak rental (1h)"],
    itinerary: [
      { time: "06:30", title: "Pickup at Old Quarter", detail: "Meet your guide at the hotel lobby lounge." },
      { time: "09:45", title: "Board the cruise", detail: "Welcome drink and safety briefing at Tuan Chau pier." },
      { time: "11:30", title: "Sung Sot Cave", detail: "Guided walk through the three vaulted chambers." },
      { time: "13:00", title: "Seafood lunch on deck", detail: "Set menu with vegetarian option." },
      { time: "15:00", title: "Kayak & swim stop", detail: "Free time around Luon lagoon." },
      { time: "19:30", title: "Drop-off", detail: "Return to your original pickup point." },
    ],
    included: ["Air-conditioned coach", "Licensed English guide", "Cave & island entry tickets", "Lunch on board"],
    excluded: ["Personal expenses", "Tips", "Travel insurance"],
    mapPoints: [
      { x: 14, y: 72, label: "Old Quarter pickup", type: "pickup" },
      { x: 38, y: 55, label: "Highway rest stop", type: "stop" },
      { x: 62, y: 40, label: "Tuan Chau pier", type: "stop" },
      { x: 84, y: 24, label: "Sung Sot Cave", type: "attraction" },
    ],
  },
  {
    id: "golden-temple-trail",
    title: "Golden Temple Trail & Heritage Walk",
    destination: "Ayutthaya",
    image: temple,
    price: 54,
    duration: "1 day · 8h",
    rating: 4.7,
    reviews: 1382,
    transport: "train",
    combo: true,
    categories: ["Culture", "Heritage", "Temples"],
    pickupZone: "Central Station",
    summary:
      "A slow-travel rail journey to the old capital, with three temple entries and a riverside lunch included.",
    attractions: ["Wat Mahathat entry", "Historical Park pass", "River shuttle boat"],
    itinerary: [
      { time: "07:10", title: "Meet at Central Station", detail: "Guide hands out rail tickets at Gate B." },
      { time: "08:40", title: "Arrive old capital", detail: "Short tuk-tuk transfer to first temple." },
      { time: "09:30", title: "Wat Mahathat", detail: "Guided heritage walk, 90 minutes." },
      { time: "12:30", title: "Riverside lunch", detail: "Local set menu overlooking the river." },
      { time: "16:20", title: "Return train", detail: "Reserved seats in car 4." },
    ],
    included: ["Return rail ticket", "3 temple entries", "Guide", "Lunch"],
    excluded: ["Drinks", "Hotel transfer"],
    mapPoints: [
      { x: 12, y: 68, label: "Central Station", type: "pickup" },
      { x: 40, y: 52, label: "Riverside halt", type: "stop" },
      { x: 70, y: 34, label: "Historical Park", type: "attraction" },
      { x: 88, y: 58, label: "Wat Mahathat", type: "attraction" },
    ],
  },
  {
    id: "highland-terraces",
    title: "Highland Terraces Sunrise Expedition",
    destination: "Sapa Highlands",
    image: terraces,
    price: 132,
    oldPrice: 160,
    duration: "2 days · 1 night",
    rating: 4.8,
    reviews: 908,
    transport: "bus",
    combo: true,
    categories: ["Nature", "Trekking", "Overnight"],
    pickupZone: "North Terminal",
    summary:
      "Overnight sleeper coach to the terraces, sunrise viewpoint access and a guided village trek with a homestay meal.",
    attractions: ["Cat Cat village entry", "Fansipan cable car", "Sunrise viewpoint pass"],
    itinerary: [
      { time: "21:30", title: "Sleeper coach departs", detail: "Reclining berths with blanket and water." },
      { time: "05:40", title: "Sunrise viewpoint", detail: "Arrive before first light for the terrace panorama." },
      { time: "09:00", title: "Village trek", detail: "Moderate 6 km loop with local guide." },
      { time: "13:00", title: "Homestay lunch", detail: "Family-style highland meal." },
      { time: "16:00", title: "Cable car", detail: "Optional summit ride included in combo." },
    ],
    included: ["Sleeper coach both ways", "Homestay night", "Viewpoint & village entries", "2 meals"],
    excluded: ["Trekking poles", "Personal gear"],
    mapPoints: [
      { x: 16, y: 78, label: "North Terminal", type: "pickup" },
      { x: 34, y: 60, label: "Mountain pass stop", type: "stop" },
      { x: 58, y: 38, label: "Sunrise viewpoint", type: "attraction" },
      { x: 82, y: 20, label: "Cable car station", type: "attraction" },
    ],
  },
  {
    id: "lantern-old-town",
    title: "Lantern Old Town Evening & Boat Ride",
    destination: "Hoi An",
    image: oldtown,
    price: 39,
    duration: "Half day · 5h",
    rating: 4.6,
    reviews: 3120,
    transport: "car",
    combo: false,
    categories: ["Culture", "Food", "Evening"],
    pickupZone: "Beach Resorts",
    summary:
      "Private car transfer to the lantern-lit old town with a heritage ticket, street-food tasting and a river boat ride.",
    attractions: ["Old Town heritage ticket", "River boat with lantern"],
    itinerary: [
      { time: "15:30", title: "Hotel pickup", detail: "Private 4-seat car with driver." },
      { time: "16:30", title: "Heritage houses", detail: "Ticket covers five monuments, guide picks three." },
      { time: "18:30", title: "Street-food tasting", detail: "Six local tastings on foot." },
      { time: "20:00", title: "River boat", detail: "30-minute lantern release ride." },
    ],
    included: ["Private car", "Heritage ticket", "Food tastings", "Boat ride"],
    excluded: ["Alcoholic drinks", "Souvenirs"],
    mapPoints: [
      { x: 18, y: 70, label: "Beach resorts pickup", type: "pickup" },
      { x: 48, y: 52, label: "Old Town gate", type: "stop" },
      { x: 76, y: 36, label: "Heritage houses", type: "attraction" },
    ],
  },
  {
    id: "turquoise-island-hop",
    title: "Turquoise Island Hopping & Snorkel Combo",
    destination: "Phu Quoc",
    image: island,
    price: 76,
    duration: "1 day · 9h",
    rating: 4.8,
    reviews: 1744,
    transport: "bus",
    combo: true,
    categories: ["Beach", "Snorkeling", "Family"],
    pickupZone: "Airport Road",
    summary:
      "Three-island speedboat route with snorkel gear, a beach club pass and an all-you-can-eat grill lunch.",
    attractions: ["Snorkel park entry", "Beach club day pass"],
    itinerary: [
      { time: "07:45", title: "Coach pickup", detail: "Shared shuttle from Airport Road hotels." },
      { time: "09:00", title: "Speedboat departs", detail: "Life jackets and snorkel kit provided." },
      { time: "11:00", title: "Coral reef stop", detail: "Guided snorkel with instructor." },
      { time: "13:00", title: "Grill lunch", detail: "Beach club buffet." },
      { time: "17:00", title: "Return", detail: "Drop-off at the pickup point." },
    ],
    included: ["Coach transfer", "Speedboat", "Snorkel gear", "Buffet lunch", "Beach club pass"],
    excluded: ["Diving upgrade", "Underwater camera"],
    mapPoints: [
      { x: 15, y: 66, label: "Airport Road pickup", type: "pickup" },
      { x: 42, y: 48, label: "Marina", type: "stop" },
      { x: 70, y: 30, label: "Coral reef", type: "attraction" },
      { x: 88, y: 56, label: "Beach club", type: "attraction" },
    ],
  },
  {
    id: "jungle-waterfall",
    title: "Jungle Waterfall & Canopy Walk",
    destination: "Da Lat",
    image: waterfall,
    price: 47,
    duration: "1 day · 7h",
    rating: 4.5,
    reviews: 664,
    transport: "car",
    combo: true,
    categories: ["Nature", "Adventure"],
    pickupZone: "City Center",
    summary: "Private car into the highlands for a canopy boardwalk, waterfall pool swim and a forest picnic.",
    attractions: ["National park entry", "Canopy walkway ticket"],
    itinerary: [
      { time: "08:00", title: "Pickup", detail: "Private car, air-conditioned." },
      { time: "09:30", title: "Park entry", detail: "Ranger briefing and trail map." },
      { time: "11:00", title: "Canopy walkway", detail: "600 m suspended boardwalk." },
      { time: "13:00", title: "Waterfall picnic", detail: "Packed picnic by the pool." },
    ],
    included: ["Private car", "Park & canopy tickets", "Picnic", "Guide"],
    excluded: ["Swim gear", "Insurance"],
    mapPoints: [
      { x: 20, y: 74, label: "City Center pickup", type: "pickup" },
      { x: 50, y: 50, label: "Forest gate", type: "stop" },
      { x: 80, y: 28, label: "Waterfall", type: "attraction" },
    ],
  },
];

export const getTour = (id: string) => tours.find((t) => t.id === id);

export const transportLabels: Record<TransportType, string> = {
  bus: "Coach / Bus",
  train: "Train",
  car: "Private Car",
};

export const pickupPoints = [
  { id: "old-quarter", label: "Old Quarter Lobby Lounge", time: "06:30", note: "Free" },
  { id: "central-station", label: "Central Station — Gate B", time: "06:55", note: "Free" },
  { id: "riverside", label: "Riverside Hotel Strip", time: "07:15", note: "+$2" },
  { id: "airport-road", label: "Airport Road Shuttle Bay", time: "07:40", note: "+$4" },
];

export const currencies = ["USD", "VND", "EUR", "SGD"];
export const languages = ["English", "Tiếng Việt", "ไทย", "日本語"];

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
