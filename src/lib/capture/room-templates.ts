export type PropertyTemplate = "residential" | "office" | "rental" | "luxury" | "commercial";

export const ROOM_TEMPLATES: Record<PropertyTemplate, { label: string; rooms: string[] }> = {
  residential: {
    label: "Apartment / Home (12 scenes)",
    rooms: [
      "Entrance", "Living Room", "Dining Area", "Kitchen", "Pantry",
      "Master Bedroom", "Master Bath", "Bedroom 2", "Bedroom 3", "Guest Bath",
      "Balcony", "Utility",
    ],
  },
  luxury: {
    label: "Luxury Villa (24 scenes)",
    rooms: [
      "Grand Entrance", "Foyer", "Living Room", "Formal Dining", "Family Room",
      "Gourmet Kitchen", "Butler Pantry", "Wine Cellar", "Home Office",
      "Master Suite", "Master Closet", "Master Bath", "Bedroom 2", "Bedroom 3",
      "Bedroom 4", "Guest Suite", "Guest Bath", "Media Room", "Gym",
      "Terrace", "Pool Deck", "Garden", "Garage", "Rooftop",
    ],
  },
  commercial: {
    label: "Commercial / Retail (20 scenes)",
    rooms: [
      "Exterior", "Main Entrance", "Lobby", "Reception", "Showroom",
      "Sales Floor", "Display Area 1", "Display Area 2", "Fitting Room",
      "Checkout", "Back Office", "Manager Office", "Staff Room",
      "Storage", "Loading Dock", "Restroom", "Corridor A", "Corridor B",
      "Parking", "Rooftop View",
    ],
  },
  office: {
    label: "Office / Corporate (15 scenes)",
    rooms: [
      "Reception", "Lobby", "Open Workspace", "Private Office 1", "Private Office 2",
      "Meeting Room A", "Meeting Room B", "Boardroom", "Breakout Area",
      "Pantry", "Cafeteria", "Corridor", "Server Room", "Parking", "Terrace",
    ],
  },
  rental: {
    label: "Rental Property (10 scenes)",
    rooms: [
      "Exterior", "Entrance Hall", "Living Room", "Kitchen", "Bedroom",
      "Bathroom", "Balcony", "Parking", "Laundry", "Neighborhood View",
    ],
  },
};

/** Legacy discrete angles — sphere capture uses continuous rotation instead. */
export const CAPTURE_ANGLES = [
  { id: "front", label: "Front", hint: "Face the main view of the room" },
  { id: "right", label: "Right", hint: "Turn slowly to your right" },
  { id: "back", label: "Back", hint: "Turn to face behind you" },
  { id: "left", label: "Left", hint: "Turn to your left" },
  { id: "doorway", label: "Doorway", hint: "Capture the doorway to the next area", optional: true },
] as const;

export type CaptureAngleId = (typeof CAPTURE_ANGLES)[number]["id"];
