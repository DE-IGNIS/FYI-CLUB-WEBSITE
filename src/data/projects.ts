import type { Project } from '../types';

// PROJECTS & EXPERIMENTS (RESTORED PREVIEW DATA - CLEARLY MARKED AS DUMMY)
// ============================================================================
export const PROJECTS: Project[] = [
  {
    id: "aether-os",
    number: "001",
    title: "AETHER OS",
    tags: ["DUMMY CONCEPT", "P2P PROTOCOL", "RUST + WASM", "ZERO CENTRAL RELAY"],
    description: "[DUMMY SPECIFICATION] Campus P2P Mesh Protocol. Designed to explore torrent-speed peer-to-peer data distribution across student hostel blocks with zero central server dependencies during high-traffic exam periods.",
    specs: [
      { label: "Mode", value: "Multiplayer" },
      { label: "Genre", value: "Puzzle / Strategy" },
      { label: "Status", value: "Completed" },  
    ],
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    version: "V1.4 • [DUMMY PROTOTYPE]",
    repoUrl: "https://github.com/fyiclub-vitb"
  },
  {
    id: "neurocanvas",
    number: "002",
    title: "NEUROCANVAS",
    tags: ["DUMMY CONCEPT", "CREATIVE AI", "WEBGL SHADERS", "IN-BROWSER ONNX"],
    description: "[DUMMY SPECIFICATION] Zero-Cloud Latent Space Synthesizer. Concept simulation running localized neural diffusion models directly inside client browser memory via WebGL 2.0 at 60fps without cloud server costs.",
    specs: [
      { label: "Focus", value: "Automation" },
      { label: "Use Case", value: "Campus Attendance" },
      { label: "Status", value: "Completed" },  
    ],
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    version: "WEBGL 2.0 • [DUMMY PROTOTYPE]",
    demoUrl: "#"
  },
  {
    id: "pulsebotics",
    number: "003",
    title: "PULSEBOTICS",
    tags: ["DUMMY CONCEPT", "AUTONOMOUS HARDWARE", "LORAWAN", "ROS 2"],
    description: "[DUMMY SPECIFICATION] Autonomous Agro-Field Rover. Low-cost custom carbon-fiber chassis blueprint equipped with multi-spectral crop diagnostic cameras and long-range LoRa sub-GHz telemetry.",
    specs: [
      { label: "Editing", value: "Block-based" },
      { label: "Collaboration", value: "Real-time" },
    ],
    image: "src/assets/images/worklin.webp",
    version: "Web App • Open Source",
    demoUrl: "https://worklin-fyi.vercel.app/"
  },
  {
    id: "schedlyx",
    number: "004",
    title: "Schedlyx",
    tags: ["Web", "Scheduling", "Management", "AI"],
    description: "An open-source platform for scheduling people, managing events, and coordinating registrations, from 1-on-1 meetings to hackathons, workshops, and group sessions.",
    specs: [
      { label: "Scope", value: "Meetings to Events" },
      { label: "Feature", value: "Registrations" },
    ],
    image: "src/assets/images/schedlyx.webp",
    version: "Web App • Open Source",
    demoUrl: "https://schedlyx-fyi.vercel.app/"
  },
  {
    id: "fyi",
    number: "005",
    title: "FYI-WEBSITE",
    tags: ["Web", "Community", "Interactive"],
    description: "The official website of FYI Club at VIT Bhopal, a space for students to explore technology and innovation, and to find the club's projects and events.",
    specs: [
      { label: "Audience", value: "Students" },
      { label: "Host", value: "VIT Bhopal" },
    ],
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80",
    version: "CUSTOM PCB • [DUMMY PROTOTYPE]",
    demoUrl: "#"
  }
];
