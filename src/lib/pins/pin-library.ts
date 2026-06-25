import type { PinCategory, PinDefinition, PinTypeId } from "@/types/annotations";

const NAVIGATION: PinDefinition[] = [
  { id: "doorway", category: "navigation", label: "Doorway", icon: "🚪", color: "#2563eb", action: "navigate", defaultLabel: "To next room", requiresTargetScene: true },
  { id: "hallway", category: "navigation", label: "Hallway", icon: "↔️", color: "#2563eb", action: "navigate", requiresTargetScene: true },
  { id: "stairs_up", category: "navigation", label: "Stairs Up", icon: "⬆️", color: "#1d4ed8", action: "navigate", requiresTargetScene: true },
  { id: "stairs_down", category: "navigation", label: "Stairs Down", icon: "⬇️", color: "#1d4ed8", action: "navigate", requiresTargetScene: true },
  { id: "elevator", category: "navigation", label: "Elevator", icon: "🛗", color: "#1e40af", action: "navigate", requiresTargetScene: true },
  { id: "balcony_access", category: "navigation", label: "Balcony", icon: "🌅", color: "#3b82f6", action: "navigate", requiresTargetScene: true },
  { id: "terrace_access", category: "navigation", label: "Terrace", icon: "🏔️", color: "#3b82f6", action: "navigate", requiresTargetScene: true },
  { id: "parking_access", category: "navigation", label: "Parking", icon: "🅿️", color: "#60a5fa", action: "navigate", requiresTargetScene: true },
];

const ARCHITECTURE: PinDefinition[] = [
  { id: "window", category: "architecture", label: "Window", icon: "🪟", color: "#0ea5e9", action: "info", defaultLabel: "Window" },
  { id: "door", category: "architecture", label: "Door", icon: "🚪", color: "#0284c7", action: "info", defaultLabel: "Door" },
  { id: "wall", category: "architecture", label: "Wall", icon: "🧱", color: "#64748b", action: "info" },
  { id: "ceiling", category: "architecture", label: "Ceiling", icon: "⬜", color: "#94a3b8", action: "info" },
  { id: "floor", category: "architecture", label: "Flooring", icon: "🟫", color: "#a16207", action: "info" },
  { id: "column", category: "architecture", label: "Column", icon: "🏛️", color: "#78716c", action: "info" },
  { id: "beam", category: "architecture", label: "Beam", icon: "━", color: "#57534e", action: "info" },
  { id: "arch", category: "architecture", label: "Arch", icon: "⌒", color: "#6b7280", action: "info" },
  { id: "niche", category: "architecture", label: "Niche", icon: "▢", color: "#9ca3af", action: "info" },
  { id: "skylight", category: "architecture", label: "Skylight", icon: "☀️", color: "#fbbf24", action: "info" },
  { id: "railing", category: "architecture", label: "Railing", icon: "〰️", color: "#71717a", action: "info" },
  { id: "fence", category: "architecture", label: "Fence", icon: "🚧", color: "#a1a1aa", action: "info" },
  { id: "gate", category: "architecture", label: "Gate", icon: "🚧", color: "#737373", action: "info" },
  { id: "partition", category: "architecture", label: "Partition", icon: "▮", color: "#a3a3a3", action: "info" },
  { id: "closet", category: "architecture", label: "Closet", icon: "🗄️", color: "#525252", action: "info", defaultLabel: "Closet" },
];

const FIXTURES: PinDefinition[] = [
  { id: "light_ceiling", category: "fixtures", label: "Ceiling Light", icon: "💡", color: "#eab308", action: "info" },
  { id: "light_wall", category: "fixtures", label: "Wall Light", icon: "🔦", color: "#ca8a04", action: "info" },
  { id: "switch", category: "fixtures", label: "Switch", icon: "🔘", color: "#a3a3a3", action: "info" },
  { id: "outlet", category: "fixtures", label: "Outlet", icon: "🔌", color: "#737373", action: "info" },
  { id: "faucet", category: "fixtures", label: "Faucet", icon: "🚰", color: "#06b6d4", action: "info" },
  { id: "toilet", category: "fixtures", label: "Toilet", icon: "🚽", color: "#0891b2", action: "info" },
  { id: "shower", category: "fixtures", label: "Shower", icon: "🚿", color: "#0e7490", action: "info" },
  { id: "bathtub", category: "fixtures", label: "Bathtub", icon: "🛁", color: "#155e75", action: "info" },
  { id: "sink", category: "fixtures", label: "Sink", icon: "🫧", color: "#22d3ee", action: "info" },
  { id: "mirror", category: "fixtures", label: "Mirror", icon: "🪞", color: "#67e8f9", action: "info" },
  { id: "cabinet", category: "fixtures", label: "Cabinet", icon: "🗃️", color: "#78350f", action: "info" },
  { id: "shelf", category: "fixtures", label: "Shelf", icon: "📚", color: "#92400e", action: "info" },
  { id: "counter", category: "fixtures", label: "Counter", icon: "▬", color: "#b45309", action: "info" },
  { id: "backsplash", category: "fixtures", label: "Backsplash", icon: "◫", color: "#d97706", action: "info" },
  { id: "vent", category: "fixtures", label: "Vent", icon: "💨", color: "#9ca3af", action: "info" },
];

const APPLIANCES: PinDefinition[] = [
  { id: "ac", category: "appliances", label: "AC", icon: "❄️", color: "#38bdf8", action: "info" },
  { id: "heater", category: "appliances", label: "Heater", icon: "🔥", color: "#f97316", action: "info" },
  { id: "ceiling_fan", category: "appliances", label: "Ceiling Fan", icon: "🌀", color: "#7dd3fc", action: "info" },
  { id: "stove", category: "appliances", label: "Stove", icon: "🍳", color: "#ef4444", action: "info" },
  { id: "oven", category: "appliances", label: "Oven", icon: "♨️", color: "#dc2626", action: "info" },
  { id: "microwave", category: "appliances", label: "Microwave", icon: "📻", color: "#b91c1c", action: "info" },
  { id: "fridge", category: "appliances", label: "Refrigerator", icon: "🧊", color: "#60a5fa", action: "info" },
  { id: "dishwasher", category: "appliances", label: "Dishwasher", icon: "🫧", color: "#3b82f6", action: "info" },
  { id: "washer", category: "appliances", label: "Washer", icon: "🫧", color: "#818cf8", action: "info" },
  { id: "dryer", category: "appliances", label: "Dryer", icon: "💨", color: "#a78bfa", action: "info" },
  { id: "tv", category: "appliances", label: "TV", icon: "📺", color: "#6366f1", action: "info" },
  { id: "water_heater", category: "appliances", label: "Water Heater", icon: "♨️", color: "#f59e0b", action: "info" },
];

const FURNITURE: PinDefinition[] = [
  { id: "sofa", category: "furniture", label: "Sofa", icon: "🛋️", color: "#a855f7", action: "info" },
  { id: "bed", category: "furniture", label: "Bed", icon: "🛏️", color: "#9333ea", action: "info" },
  { id: "dining_table", category: "furniture", label: "Dining Table", icon: "🍽️", color: "#7e22ce", action: "info" },
  { id: "chair", category: "furniture", label: "Chair", icon: "💺", color: "#6b21a8", action: "info" },
  { id: "desk", category: "furniture", label: "Desk", icon: "🖥️", color: "#581c87", action: "info" },
  { id: "wardrobe", category: "furniture", label: "Wardrobe", icon: "👔", color: "#4c1d95", action: "info" },
  { id: "dresser", category: "furniture", label: "Dresser", icon: "🗄️", color: "#5b21b6", action: "info" },
  { id: "coffee_table", category: "furniture", label: "Coffee Table", icon: "☕", color: "#7c3aed", action: "info" },
  { id: "side_table", category: "furniture", label: "Side Table", icon: "▪️", color: "#8b5cf6", action: "info" },
  { id: "bookshelf", category: "furniture", label: "Bookshelf", icon: "📚", color: "#a78bfa", action: "info" },
  { id: "rug", category: "furniture", label: "Rug", icon: "🟫", color: "#c4b5fd", action: "info" },
  { id: "curtains", category: "furniture", label: "Curtains", icon: "🪟", color: "#ddd6fe", action: "info" },
];

const VIEWS: PinDefinition[] = [
  { id: "city_view", category: "views", label: "City View", icon: "🏙️", color: "#14b8a6", action: "info", defaultLabel: "City skyline" },
  { id: "garden_view", category: "views", label: "Garden View", icon: "🌳", color: "#10b981", action: "info" },
  { id: "pool_view", category: "views", label: "Pool View", icon: "🏊", color: "#06b6d4", action: "info" },
  { id: "mountain_view", category: "views", label: "Mountain View", icon: "⛰️", color: "#059669", action: "info" },
  { id: "water_view", category: "views", label: "Water View", icon: "🌊", color: "#0d9488", action: "info" },
  { id: "street_view", category: "views", label: "Street View", icon: "🛣️", color: "#2dd4bf", action: "info" },
  { id: "courtyard", category: "views", label: "Courtyard", icon: "🏡", color: "#34d399", action: "info" },
  { id: "sunrise_east", category: "views", label: "East Facing", icon: "🌅", color: "#f59e0b", action: "info" },
  { id: "sunset_west", category: "views", label: "West Facing", icon: "🌇", color: "#fb923c", action: "info" },
  { id: "panorama", category: "views", label: "Panorama", icon: "🌐", color: "#22c55e", action: "info" },
];

const AMENITIES: PinDefinition[] = [
  { id: "gym", category: "amenities", label: "Gym", icon: "🏋️", color: "#ec4899", action: "info" },
  { id: "swimming_pool", category: "amenities", label: "Swimming Pool", icon: "🏊", color: "#06b6d4", action: "info" },
  { id: "clubhouse", category: "amenities", label: "Clubhouse", icon: "🏛️", color: "#d946ef", action: "info" },
  { id: "parking", category: "amenities", label: "Parking", icon: "🅿️", color: "#a855f7", action: "info" },
  { id: "security", category: "amenities", label: "Security", icon: "🛡️", color: "#8b5cf6", action: "info" },
  { id: "playground", category: "amenities", label: "Playground", icon: "🛝", color: "#c026d3", action: "info" },
  { id: "garden", category: "amenities", label: "Garden", icon: "🌺", color: "#22c55e", action: "info" },
  { id: "rooftop", category: "amenities", label: "Rooftop", icon: "🏙️", color: "#e879f9", action: "info" },
  { id: "lobby", category: "amenities", label: "Lobby", icon: "🏢", color: "#f472b6", action: "info" },
  { id: "elevator_lobby", category: "amenities", label: "Lift Lobby", icon: "🛗", color: "#db2777", action: "info" },
];

const REAL_ESTATE: PinDefinition[] = [
  { id: "carpet_area", category: "real_estate", label: "Carpet Area", icon: "📐", color: "#f97316", action: "measure" },
  { id: "built_up_area", category: "real_estate", label: "Built-up Area", icon: "📏", color: "#ea580c", action: "measure" },
  { id: "super_built_up", category: "real_estate", label: "Super Built-up", icon: "📊", color: "#c2410c", action: "measure" },
  { id: "facing_north", category: "real_estate", label: "North Facing", icon: "⬆️", color: "#78716c", action: "info" },
  { id: "facing_east", category: "real_estate", label: "East Facing", icon: "➡️", color: "#78716c", action: "info" },
  { id: "facing_south", category: "real_estate", label: "South Facing", icon: "⬇️", color: "#78716c", action: "info" },
  { id: "facing_west", category: "real_estate", label: "West Facing", icon: "⬅️", color: "#78716c", action: "info" },
  { id: "floor_level", category: "real_estate", label: "Floor Level", icon: "🔢", color: "#a8a29e", action: "info" },
  { id: "tower_block", category: "real_estate", label: "Tower / Block", icon: "🏗️", color: "#57534e", action: "info" },
  { id: "unit_number", category: "real_estate", label: "Unit Number", icon: "🏷️", color: "#44403c", action: "info" },
  { id: "possession", category: "real_estate", label: "Possession", icon: "📅", color: "#292524", action: "info" },
  { id: "rera", category: "real_estate", label: "RERA", icon: "⚖️", color: "#1c1917", action: "info" },
];

const MEDIA: PinDefinition[] = [
  { id: "info", category: "media", label: "Info Point", icon: "ℹ️", color: "#6366f1", action: "info", defaultLabel: "Info" },
  { id: "photo_gallery", category: "media", label: "Photo Gallery", icon: "🖼️", color: "#8b5cf6", action: "media" },
  { id: "video", category: "media", label: "Video", icon: "🎬", color: "#a855f7", action: "media" },
  { id: "virtual_tour", category: "media", label: "Virtual Tour", icon: "🌐", color: "#7c3aed", action: "link" },
  { id: "document", category: "media", label: "Document", icon: "📄", color: "#6d28d9", action: "link" },
  { id: "pricing", category: "media", label: "Pricing", icon: "💰", color: "#16a34a", action: "info" },
  { id: "legal_note", category: "media", label: "Legal Note", icon: "⚖️", color: "#15803d", action: "info" },
  { id: "cta_book", category: "media", label: "Book Visit", icon: "📅", color: "#2563eb", action: "cta", defaultLabel: "Book a visit" },
  { id: "cta_callback", category: "media", label: "Request Callback", icon: "📞", color: "#1d4ed8", action: "cta", defaultLabel: "Request callback" },
  { id: "cta_whatsapp", category: "media", label: "WhatsApp", icon: "💬", color: "#22c55e", action: "cta", defaultLabel: "Chat on WhatsApp" },
];

const TOOLS: PinDefinition[] = [
  { id: "dimension", category: "tools", label: "Dimension", icon: "📏", color: "#f59e0b", action: "measure" },
  { id: "area", category: "tools", label: "Area", icon: "⬛", color: "#d97706", action: "measure" },
  { id: "height", category: "tools", label: "Height", icon: "📐", color: "#b45309", action: "measure" },
  { id: "clearance", category: "tools", label: "Clearance", icon: "↕️", color: "#92400e", action: "measure" },
  { id: "material_note", category: "tools", label: "Material", icon: "🧱", color: "#78350f", action: "info" },
  { id: "defect", category: "tools", label: "Defect / Issue", icon: "⚠️", color: "#ef4444", action: "info" },
  { id: "before_after", category: "tools", label: "Before / After", icon: "🔄", color: "#f97316", action: "media" },
  { id: "compare", category: "tools", label: "Compare", icon: "⚖️", color: "#fb923c", action: "info" },
];

const SAFETY: PinDefinition[] = [
  { id: "fire_exit", category: "safety", label: "Fire Exit", icon: "🚨", color: "#dc2626", action: "info" },
  { id: "extinguisher", category: "safety", label: "Extinguisher", icon: "🧯", color: "#b91c1c", action: "info" },
  { id: "smoke_detector", category: "safety", label: "Smoke Detector", icon: "🔔", color: "#991b1b", action: "info" },
  { id: "sprinkler", category: "safety", label: "Sprinkler", icon: "💧", color: "#7f1d1d", action: "info" },
  { id: "first_aid", category: "safety", label: "First Aid", icon: "🏥", color: "#ef4444", action: "info" },
  { id: "emergency", category: "safety", label: "Emergency", icon: "🆘", color: "#f87171", action: "info" },
];

const CUSTOM_ICONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const CUSTOM: PinDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  id: `custom_${i + 1}` as PinTypeId,
  category: "custom" as PinCategory,
  label: `Custom ${i + 1}`,
  icon: CUSTOM_ICONS[i] ?? "📌",
  color: "#64748b",
  action: "info" as const,
  defaultLabel: `Tag ${i + 1}`,
}));

export const PIN_LIBRARY: PinDefinition[] = [
  ...NAVIGATION,
  ...ARCHITECTURE,
  ...FIXTURES,
  ...APPLIANCES,
  ...FURNITURE,
  ...VIEWS,
  ...AMENITIES,
  ...REAL_ESTATE,
  ...MEDIA,
  ...TOOLS,
  ...SAFETY,
  ...CUSTOM,
];

export const PIN_BY_ID = new Map(PIN_LIBRARY.map((p) => [p.id, p]));

export const PIN_CATEGORIES: { id: PinCategory; label: string }[] = [
  { id: "navigation", label: "Navigation" },
  { id: "architecture", label: "Architecture" },
  { id: "fixtures", label: "Fixtures" },
  { id: "appliances", label: "Appliances" },
  { id: "furniture", label: "Furniture" },
  { id: "views", label: "Views" },
  { id: "amenities", label: "Amenities" },
  { id: "real_estate", label: "Real Estate" },
  { id: "media", label: "Media & CTAs" },
  { id: "tools", label: "Tools" },
  { id: "safety", label: "Safety" },
  { id: "custom", label: "Custom" },
];

export function getPin(typeId: PinTypeId): PinDefinition {
  return PIN_BY_ID.get(typeId) ?? PIN_BY_ID.get("info")!;
}

export function pinsForCategory(category: PinCategory): PinDefinition[] {
  return PIN_LIBRARY.filter((p) => p.category === category);
}

export function isNavigationPin(typeId: PinTypeId): boolean {
  const pin = PIN_BY_ID.get(typeId);
  return pin?.action === "navigate" || pin?.requiresTargetScene === true;
}
