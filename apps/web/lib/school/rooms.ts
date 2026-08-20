/**
 * Frost Middle School floor plan — schematic geometry + corridor graph.
 *
 * Traced from the printed Frost building map into a single shared coordinate
 * space (viewBox 0 0 1240 1000). Both floors sit on the same footprint: the
 * perimeter wings (A / B / C / D) are two storeys, the core (E / J, gyms,
 * cafeteria, offices) is single storey.
 *
 * Routing is a plain weighted graph: rooms hang off the nearest corridor node,
 * corridor nodes link to their neighbours, and stairwells link the floors with
 * an extra cost so the router prefers staying on one level when it can.
 */

export type Floor = 1 | 2
export type Wing = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'J' | 'Core'

export interface Room {
  /** Canonical label as it appears on the schedule / map, e.g. "D104", "Gym 2". */
  id: string
  /** Display label drawn inside the box. */
  label: string
  floor: Floor
  wing: Wing
  x: number
  y: number
  w: number
  h: number
  /** Corridor node this room's door opens onto. */
  node: string
  /** Longer name for search results and route steps. */
  name?: string
}

export interface Node {
  id: string
  x: number
  y: number
  floor: Floor
  /** Present on stair nodes — the node id on the other floor. */
  stairTo?: string
  label?: string
}

export const VIEW_W = 1240
export const VIEW_H = 1000

// ── Floor 1 ─────────────────────────────────────────────────────────────────

const F1: Room[] = [
  // Library / maker space / music
  { id: 'LIBRARY', label: 'Library', floor: 1, wing: 'Core', x: 20, y: 20, w: 250, h: 95, node: 'n_nw' },
  { id: 'MAKERSPACE', label: 'Maker Space', floor: 1, wing: 'Core', x: 20, y: 120, w: 105, h: 62, node: 'n_nw' },
  { id: 'J111', label: 'J-111', name: 'Band', floor: 1, wing: 'J', x: 330, y: 20, w: 110, h: 110, node: 'n_j_w' },
  { id: 'J112', label: 'J-112', name: 'Chorus', floor: 1, wing: 'J', x: 445, y: 20, w: 105, h: 110, node: 'n_j_w' },
  { id: 'J113', label: 'J-113', name: 'Orchestra', floor: 1, wing: 'J', x: 555, y: 20, w: 110, h: 110, node: 'n_j_e' },
  { id: 'J114', label: 'J-114', floor: 1, wing: 'J', x: 590, y: 135, w: 75, h: 45, node: 'n_j_e' },
  { id: 'J126', label: 'J-126', floor: 1, wing: 'J', x: 450, y: 195, w: 65, h: 45, node: 'n_j_w' },
  { id: 'J128', label: 'J-128', name: 'Art Lab', floor: 1, wing: 'J', x: 520, y: 195, w: 145, h: 45, node: 'n_j_e' },

  // Gyms / locker rooms / health
  { id: 'WEIGHT', label: 'Weight Rm', floor: 1, wing: 'G', x: 820, y: 45, w: 90, h: 125, node: 'n_gym_w' },
  { id: 'Gym 2', label: 'Gym 2', floor: 1, wing: 'G', x: 915, y: 35, w: 250, h: 140, node: 'n_gym' },
  { id: 'BOYSLOCKER', label: 'Boys Locker', floor: 1, wing: 'G', x: 960, y: 195, w: 105, h: 85, node: 'n_gym' },
  { id: 'GIRLSLOCKER', label: 'Girls Locker', floor: 1, wing: 'G', x: 1075, y: 195, w: 105, h: 85, node: 'n_gym' },
  { id: 'Gym 1', label: 'Gym 1', floor: 1, wing: 'G', x: 945, y: 300, w: 185, h: 140, node: 'n_g_hall' },
  { id: 'G104', label: 'G-104', name: 'After School', floor: 1, wing: 'G', x: 870, y: 292, w: 62, h: 50, node: 'n_g_hall' },
  { id: 'G105', label: 'G-105', name: 'Health Room', floor: 1, wing: 'G', x: 870, y: 348, w: 62, h: 52, node: 'n_g_hall' },
  { id: 'G106', label: 'G-106', name: 'Health Room', floor: 1, wing: 'G', x: 870, y: 406, w: 62, h: 52, node: 'n_g_hall' },
  { id: 'G112', label: 'G-112', name: 'Engineering', floor: 1, wing: 'G', x: 1050, y: 470, w: 78, h: 52, node: 'n_g_south' },
  { id: 'G114', label: 'G-114', floor: 1, wing: 'G', x: 1134, y: 470, w: 78, h: 52, node: 'n_g_south' },

  // D wing (1st) + FACS
  { id: 'D109', label: 'D-109', floor: 1, wing: 'D', x: 20, y: 225, w: 82, h: 55, node: 'n_d_top' },
  { id: 'D108', label: 'D-108', floor: 1, wing: 'D', x: 20, y: 286, w: 82, h: 55, node: 'n_d_top' },
  { id: 'D105', label: 'D-105', floor: 1, wing: 'D', x: 20, y: 347, w: 82, h: 55, node: 'n_d_mid' },
  { id: 'D104', label: 'D-104', name: 'Algebra 1 Honors', floor: 1, wing: 'D', x: 20, y: 408, w: 82, h: 55, node: 'n_d_mid' },
  { id: 'D100', label: 'D-100', floor: 1, wing: 'D', x: 20, y: 469, w: 82, h: 58, node: 'n_d_bot' },
  { id: 'D102', label: 'D-102', name: 'Tech Support', floor: 1, wing: 'D', x: 108, y: 455, w: 46, h: 72, node: 'n_d_bot' },
  { id: 'D111', label: 'D-111', name: 'FACS Sewing Lab', floor: 1, wing: 'D', x: 178, y: 215, w: 140, h: 85, node: 'n_d_top' },
  { id: 'D114', label: 'D-114', name: 'FACS Cooking Lab', floor: 1, wing: 'D', x: 178, y: 306, w: 140, h: 80, node: 'n_d_mid' },
  { id: 'D121', label: 'D-121', floor: 1, wing: 'D', x: 172, y: 394, w: 72, h: 50, node: 'n_d_mid' },
  { id: 'D119', label: 'D-119', name: 'AIA', floor: 1, wing: 'D', x: 172, y: 450, w: 62, h: 46, node: 'n_d_bot' },
  { id: 'D118', label: 'D-118', floor: 1, wing: 'D', x: 248, y: 448, w: 72, h: 52, node: 'n_d_bot' },

  // E wing (core classrooms)
  { id: 'E115', label: 'E-115', name: 'Art Lab', floor: 1, wing: 'E', x: 340, y: 290, w: 88, h: 115, node: 'n_e_nw' },
  { id: 'E113', label: 'E-113', floor: 1, wing: 'E', x: 365, y: 450, w: 90, h: 60, node: 'n_e_n1' },
  { id: 'E112', label: 'E-112', floor: 1, wing: 'E', x: 460, y: 450, w: 90, h: 60, node: 'n_e_n1' },
  { id: 'E111', label: 'E-111', floor: 1, wing: 'E', x: 555, y: 450, w: 90, h: 60, node: 'n_e_n2' },
  { id: 'E110', label: 'E-110', floor: 1, wing: 'E', x: 650, y: 450, w: 90, h: 60, node: 'n_e_n2' },
  { id: 'E109', label: 'E-109', name: 'English 7 AA', floor: 1, wing: 'E', x: 745, y: 450, w: 90, h: 60, node: 'n_e_n3' },
  { id: 'E104', label: 'E-104', floor: 1, wing: 'E', x: 365, y: 560, w: 90, h: 60, node: 'n_e_s1' },
  { id: 'E105', label: 'E-105', floor: 1, wing: 'E', x: 460, y: 560, w: 90, h: 60, node: 'n_e_s1' },
  { id: 'E106', label: 'E-106', name: 'US History 7 AA · TA', floor: 1, wing: 'E', x: 555, y: 560, w: 90, h: 60, node: 'n_e_s2' },
  { id: 'E107', label: 'E-107', floor: 1, wing: 'E', x: 650, y: 560, w: 90, h: 60, node: 'n_e_s2' },
  { id: 'E108', label: 'E-108', floor: 1, wing: 'E', x: 745, y: 560, w: 90, h: 60, node: 'n_e_s3' },
  { id: 'E102', label: 'E-102', floor: 1, wing: 'E', x: 345, y: 632, w: 78, h: 50, node: 'n_e_w' },
  { id: 'E101', label: 'E-101', floor: 1, wing: 'E', x: 345, y: 687, w: 78, h: 50, node: 'n_e_w' },
  { id: 'E100', label: 'E-100', floor: 1, wing: 'E', x: 345, y: 742, w: 78, h: 38, node: 'n_e_w' },

  // C wing (1st) + lecture hall
  { id: 'C114', label: 'C-114', floor: 1, wing: 'C', x: 20, y: 556, w: 82, h: 55, node: 'n_c_top' },
  { id: 'C110', label: 'C-110', name: 'Life Science AA', floor: 1, wing: 'C', x: 20, y: 622, w: 82, h: 55, node: 'n_c_top' },
  { id: 'C108', label: 'C-108', floor: 1, wing: 'C', x: 20, y: 688, w: 82, h: 55, node: 'n_c_mid' },
  { id: 'C105', label: 'C-105', floor: 1, wing: 'C', x: 20, y: 754, w: 82, h: 55, node: 'n_c_mid' },
  { id: 'C104', label: 'C-104', floor: 1, wing: 'C', x: 20, y: 820, w: 82, h: 55, node: 'n_c_bot' },
  { id: 'C119', label: 'C-119', floor: 1, wing: 'C', x: 252, y: 556, w: 58, h: 50, node: 'n_c_top' },
  { id: 'LECTURE', label: 'Lecture Hall', floor: 1, wing: 'C', x: 178, y: 650, w: 140, h: 92, node: 'n_lecture' },
  { id: 'C127', label: 'C-127', floor: 1, wing: 'C', x: 178, y: 780, w: 62, h: 46, node: 'n_c_south' },
  { id: 'C126', label: 'C-126', floor: 1, wing: 'C', x: 246, y: 786, w: 68, h: 50, node: 'n_c_south' },
  { id: 'C102', label: 'C-102', floor: 1, wing: 'C', x: 178, y: 850, w: 62, h: 46, node: 'n_c_south' },
  { id: 'C101', label: 'C-101', floor: 1, wing: 'C', x: 246, y: 856, w: 62, h: 46, node: 'n_c_south' },
  { id: 'C100', label: 'C-100', floor: 1, wing: 'C', x: 314, y: 850, w: 58, h: 46, node: 'n_b_west' },

  // B wing (1st) + student services
  { id: 'B112', label: 'B-112', floor: 1, wing: 'B', x: 400, y: 782, w: 82, h: 50, node: 'n_b_west' },
  { id: 'B111', label: 'B-111', floor: 1, wing: 'B', x: 487, y: 782, w: 86, h: 50, node: 'n_b_mid' },
  { id: 'B108', label: 'B-108', floor: 1, wing: 'B', x: 596, y: 782, w: 66, h: 46, node: 'n_b_mid' },
  { id: 'B107', label: 'B-107', floor: 1, wing: 'B', x: 667, y: 782, w: 52, h: 46, node: 'n_b_mid' },
  { id: 'LEARNSVC', label: 'Learning Svcs', floor: 1, wing: 'B', x: 748, y: 772, w: 96, h: 60, node: 'n_b_east' },
  { id: 'B118', label: 'B-118', floor: 1, wing: 'B', x: 386, y: 862, w: 82, h: 50, node: 'n_b_west' },
  { id: 'StuSer', label: 'Student Svcs', name: 'Student Services Office — Team Designator', floor: 1, wing: 'B', x: 760, y: 858, w: 92, h: 58, node: 'n_stuser' },

  // Cafeteria / stage / F wing / offices
  { id: 'STAGE', label: 'Stage', floor: 1, wing: 'F', x: 962, y: 556, w: 100, h: 48, node: 'n_stage' },
  { id: 'F123', label: 'F-123', floor: 1, wing: 'F', x: 1078, y: 556, w: 62, h: 48, node: 'n_stage' },
  { id: 'F122', label: 'F-122', name: 'Coding & Innovation Tech', floor: 1, wing: 'F', x: 1150, y: 540, w: 66, h: 50, node: 'n_stage' },
  { id: 'Cafeteria', label: 'Cafeteria', floor: 1, wing: 'F', x: 950, y: 640, w: 180, h: 92, node: 'n_caf' },
  { id: 'A131', label: 'A-131', floor: 1, wing: 'A', x: 1120, y: 762, w: 52, h: 36, node: 'n_caf_s' },
  { id: 'MAINOFFICE', label: 'Main Office', floor: 1, wing: 'A', x: 960, y: 840, w: 78, h: 110, node: 'n_office' },
  { id: 'A126', label: 'A-126', name: 'Clinic', floor: 1, wing: 'A', x: 1150, y: 840, w: 74, h: 58, node: 'n_office' },
]

// ── Floor 2 (perimeter wings only) ──────────────────────────────────────────

const F2: Room[] = [
  { id: 'D211', label: 'D-211', floor: 2, wing: 'D', x: 112, y: 190, w: 78, h: 52, node: 'n2_d_top' },
  { id: 'D208', label: 'D-208', floor: 2, wing: 'D', x: 20, y: 225, w: 82, h: 55, node: 'n2_d_top' },
  { id: 'D212', label: 'D-212', name: 'French 1', floor: 2, wing: 'D', x: 112, y: 250, w: 78, h: 52, node: 'n2_d_top' },
  { id: 'D207', label: 'D-207', floor: 2, wing: 'D', x: 20, y: 286, w: 82, h: 55, node: 'n2_d_top' },
  { id: 'D213', label: 'D-213', floor: 2, wing: 'D', x: 112, y: 310, w: 78, h: 52, node: 'n2_d_mid' },
  { id: 'D204', label: 'D-204', floor: 2, wing: 'D', x: 20, y: 347, w: 82, h: 55, node: 'n2_d_mid' },
  { id: 'D214', label: 'D-214', floor: 2, wing: 'D', x: 112, y: 380, w: 78, h: 52, node: 'n2_d_mid' },
  { id: 'D203', label: 'D-203', floor: 2, wing: 'D', x: 20, y: 408, w: 82, h: 55, node: 'n2_d_mid' },
  { id: 'D215', label: 'D-215', floor: 2, wing: 'D', x: 112, y: 440, w: 78, h: 52, node: 'n2_d_bot' },
  { id: 'D200', label: 'D-200', floor: 2, wing: 'D', x: 20, y: 469, w: 82, h: 58, node: 'n2_d_bot' },

  { id: 'C213', label: 'C-213', floor: 2, wing: 'C', x: 20, y: 556, w: 82, h: 55, node: 'n2_c_top' },
  { id: 'C209', label: 'C-209', floor: 2, wing: 'C', x: 20, y: 622, w: 82, h: 55, node: 'n2_c_top' },
  { id: 'C207', label: 'C-207', floor: 2, wing: 'C', x: 20, y: 688, w: 82, h: 55, node: 'n2_c_mid' },
  { id: 'C204', label: 'C-204', floor: 2, wing: 'C', x: 20, y: 754, w: 82, h: 55, node: 'n2_c_mid' },
  { id: 'C203', label: 'C-203', floor: 2, wing: 'C', x: 20, y: 820, w: 82, h: 55, node: 'n2_c_bot' },
  { id: 'C220', label: 'C-220', floor: 2, wing: 'C', x: 112, y: 780, w: 80, h: 50, node: 'n2_c_bot' },
  { id: 'C221', label: 'C-221', floor: 2, wing: 'C', x: 198, y: 780, w: 80, h: 50, node: 'n2_c_bot' },
  { id: 'C201', label: 'C-201', floor: 2, wing: 'C', x: 112, y: 850, w: 80, h: 50, node: 'n2_c_bot' },
  { id: 'C200', label: 'C-200', floor: 2, wing: 'C', x: 198, y: 850, w: 80, h: 50, node: 'n2_c_bot' },

  { id: 'B206', label: 'B-206', floor: 2, wing: 'B', x: 300, y: 782, w: 54, h: 46, node: 'n2_b_west' },
  { id: 'B205', label: 'B-205', floor: 2, wing: 'B', x: 359, y: 782, w: 54, h: 46, node: 'n2_b_west' },
  { id: 'B203', label: 'B-203', floor: 2, wing: 'B', x: 421, y: 778, w: 82, h: 52, node: 'n2_b_west' },
  { id: 'B202', label: 'B-202', floor: 2, wing: 'B', x: 508, y: 778, w: 86, h: 52, node: 'n2_b_mid' },
  { id: 'B201', label: 'B-201', floor: 2, wing: 'B', x: 599, y: 778, w: 86, h: 52, node: 'n2_b_mid' },
  { id: 'B200', label: 'B-200', floor: 2, wing: 'B', x: 690, y: 778, w: 86, h: 52, node: 'n2_b_east' },
  { id: 'B212', label: 'B-212', floor: 2, wing: 'B', x: 290, y: 862, w: 82, h: 50, node: 'n2_b_west' },
  { id: 'B213', label: 'B-213', floor: 2, wing: 'B', x: 377, y: 862, w: 82, h: 50, node: 'n2_b_west' },
  { id: 'B214', label: 'B-214', floor: 2, wing: 'B', x: 464, y: 862, w: 86, h: 50, node: 'n2_b_mid' },
  { id: 'B215', label: 'B-215', floor: 2, wing: 'B', x: 555, y: 862, w: 86, h: 50, node: 'n2_b_mid' },
  { id: 'B216', label: 'B-216', floor: 2, wing: 'B', x: 646, y: 862, w: 86, h: 50, node: 'n2_b_east' },

  { id: 'A200', label: 'A-200', floor: 2, wing: 'A', x: 860, y: 830, w: 62, h: 46, node: 'n2_a' },
  { id: 'A206', label: 'A-206', floor: 2, wing: 'A', x: 1090, y: 830, w: 66, h: 46, node: 'n2_a' },
  { id: 'A201', label: 'A-201', floor: 2, wing: 'A', x: 860, y: 886, w: 62, h: 46, node: 'n2_a' },
  { id: 'A202', label: 'A-202', floor: 2, wing: 'A', x: 927, y: 886, w: 66, h: 46, node: 'n2_a' },
  { id: 'A203', label: 'A-203', floor: 2, wing: 'A', x: 998, y: 886, w: 70, h: 46, node: 'n2_a' },
  { id: 'A205', label: 'A-205', floor: 2, wing: 'A', x: 1090, y: 886, w: 70, h: 46, node: 'n2_a' },
]

export const ROOMS: readonly Room[] = [...F1, ...F2]

// ── Corridor graph ──────────────────────────────────────────────────────────

export const NODES: readonly Node[] = [
  // floor 1
  { id: 'n_nw', x: 150, y: 150, floor: 1, label: 'Library corner' },
  { id: 'n_j_w', x: 400, y: 168, floor: 1 },
  { id: 'n_j_e', x: 700, y: 175, floor: 1 },
  { id: 'n_gym_w', x: 790, y: 190, floor: 1 },
  { id: 'n_gym', x: 1000, y: 195, floor: 1, label: 'Gym lobby' },
  { id: 'n_d_top', x: 140, y: 250, floor: 1 },
  { id: 'n_d_mid', x: 140, y: 385, floor: 1 },
  { id: 'n_d_bot', x: 150, y: 545, floor: 1, stairTo: 'n2_d_bot', label: 'D-wing stairs' },
  { id: 'n_e_nw', x: 335, y: 400, floor: 1 },
  { id: 'n_e_n1', x: 420, y: 428, floor: 1 },
  { id: 'n_e_n2', x: 610, y: 428, floor: 1 },
  { id: 'n_e_n3', x: 800, y: 428, floor: 1 },
  { id: 'n_e_s1', x: 420, y: 536, floor: 1 },
  { id: 'n_e_s2', x: 610, y: 536, floor: 1 },
  { id: 'n_e_s3', x: 800, y: 536, floor: 1 },
  { id: 'n_e_w', x: 330, y: 700, floor: 1 },
  { id: 'n_e_s', x: 610, y: 645, floor: 1 },
  { id: 'n_g_hall', x: 905, y: 370, floor: 1 },
  { id: 'n_g_south', x: 1000, y: 496, floor: 1 },
  { id: 'n_stage', x: 900, y: 545, floor: 1 },
  { id: 'n_caf', x: 900, y: 690, floor: 1 },
  { id: 'n_caf_s', x: 1060, y: 762, floor: 1 },
  { id: 'n_c_top', x: 140, y: 590, floor: 1, stairTo: 'n2_c_top', label: 'C-wing north stairs' },
  { id: 'n_c_mid', x: 140, y: 720, floor: 1 },
  { id: 'n_c_bot', x: 140, y: 930, floor: 1, stairTo: 'n2_c_bot', label: 'C-wing south stairs' },
  { id: 'n_lecture', x: 250, y: 700, floor: 1 },
  { id: 'n_c_south', x: 250, y: 830, floor: 1 },
  { id: 'n_b_west', x: 400, y: 848, floor: 1, stairTo: 'n2_b_west', label: 'B-wing west stairs' },
  { id: 'n_b_mid', x: 600, y: 848, floor: 1 },
  { id: 'n_b_east', x: 790, y: 845, floor: 1, stairTo: 'n2_b_east', label: 'B-wing east stairs' },
  { id: 'n_stuser', x: 830, y: 890, floor: 1 },
  { id: 'n_office', x: 1055, y: 862, floor: 1, stairTo: 'n2_a', label: 'Main office stairs' },

  // floor 2
  { id: 'n2_d_top', x: 210, y: 265, floor: 2 },
  { id: 'n2_d_mid', x: 210, y: 400, floor: 2 },
  { id: 'n2_d_bot', x: 150, y: 545, floor: 2, stairTo: 'n_d_bot', label: 'D-wing stairs' },
  { id: 'n2_c_top', x: 140, y: 590, floor: 2, stairTo: 'n_c_top', label: 'C-wing north stairs' },
  { id: 'n2_c_mid', x: 140, y: 720, floor: 2 },
  { id: 'n2_c_bot', x: 140, y: 930, floor: 2, stairTo: 'n_c_bot', label: 'C-wing south stairs' },
  { id: 'n2_b_west', x: 400, y: 848, floor: 2, stairTo: 'n_b_west', label: 'B-wing west stairs' },
  { id: 'n2_b_mid', x: 600, y: 848, floor: 2 },
  { id: 'n2_b_east', x: 790, y: 845, floor: 2, stairTo: 'n_b_east', label: 'B-wing east stairs' },
  { id: 'n2_a', x: 1055, y: 862, floor: 2, stairTo: 'n_office', label: 'Main office stairs' },
]

/** Undirected corridor adjacency. */
const EDGES: [string, string][] = [
  // floor 1 — north loop
  ['n_nw', 'n_d_top'], ['n_nw', 'n_j_w'], ['n_j_w', 'n_j_e'], ['n_j_e', 'n_gym_w'],
  ['n_gym_w', 'n_gym'], ['n_gym', 'n_g_hall'], ['n_g_hall', 'n_g_south'],
  ['n_j_w', 'n_e_nw'], ['n_j_e', 'n_e_n2'],
  // floor 1 — D column
  ['n_d_top', 'n_d_mid'], ['n_d_mid', 'n_d_bot'], ['n_d_mid', 'n_e_nw'], ['n_d_bot', 'n_e_nw'],
  // floor 1 — E block
  ['n_e_nw', 'n_e_n1'], ['n_e_n1', 'n_e_n2'], ['n_e_n2', 'n_e_n3'], ['n_e_n3', 'n_g_south'],
  ['n_e_n1', 'n_e_s1'], ['n_e_n2', 'n_e_s2'], ['n_e_n3', 'n_e_s3'],
  ['n_e_s1', 'n_e_s2'], ['n_e_s2', 'n_e_s3'], ['n_e_s3', 'n_stage'],
  ['n_e_s1', 'n_e_w'], ['n_e_s2', 'n_e_s'], ['n_e_s', 'n_e_w'], ['n_e_s', 'n_b_mid'],
  ['n_e_w', 'n_lecture'], ['n_e_w', 'n_b_west'],
  // floor 1 — C column
  ['n_d_bot', 'n_c_top'], ['n_c_top', 'n_c_mid'], ['n_c_mid', 'n_c_bot'],
  ['n_c_mid', 'n_lecture'], ['n_c_bot', 'n_c_south'], ['n_c_south', 'n_b_west'],
  ['n_lecture', 'n_c_south'],
  // floor 1 — B corridor + east
  ['n_b_west', 'n_b_mid'], ['n_b_mid', 'n_b_east'], ['n_b_east', 'n_stuser'],
  ['n_b_east', 'n_office'], ['n_stuser', 'n_office'],
  ['n_stage', 'n_caf'], ['n_caf', 'n_caf_s'], ['n_caf_s', 'n_office'], ['n_caf', 'n_b_east'],
  ['n_g_south', 'n_stage'],
  // floor 2
  ['n2_d_top', 'n2_d_mid'], ['n2_d_mid', 'n2_d_bot'], ['n2_d_bot', 'n2_c_top'],
  ['n2_c_top', 'n2_c_mid'], ['n2_c_mid', 'n2_c_bot'], ['n2_c_bot', 'n2_b_west'],
  ['n2_b_west', 'n2_b_mid'], ['n2_b_mid', 'n2_b_east'], ['n2_b_east', 'n2_a'],
]

// ── Scale ───────────────────────────────────────────────────────────────────

/**
 * Metres per SVG unit. The building's long axis is roughly 175 m across the
 * 1240-unit viewBox. Middle-schoolers move down a crowded hall at maybe
 * 1.1 m/s, so ~7.8 units/second.
 */
export const METRES_PER_UNIT = 0.141
export const WALK_SPEED_MPS = 1.1
/** Extra seconds for a flight of stairs, both the climb and the queue for it. */
export const STAIR_SECONDS = 35

const nodeMap = new Map(NODES.map((n) => [n.id, n]))
const roomMap = new Map(ROOMS.map((r) => [normalizeRoomId(r.id), r]))

const adj = (() => {
  const m = new Map<string, { to: string; cost: number }[]>()
  const link = (a: string, b: string, cost: number) => {
    if (!m.has(a)) m.set(a, [])
    m.get(a)!.push({ to: b, cost })
  }
  for (const [a, b] of EDGES) {
    const na = nodeMap.get(a)
    const nb = nodeMap.get(b)
    if (!na || !nb) continue
    const d = Math.hypot(na.x - nb.x, na.y - nb.y)
    link(a, b, d)
    link(b, a, d)
  }
  // Stair links cost the equivalent of STAIR_SECONDS of walking.
  const stairCost = (STAIR_SECONDS * WALK_SPEED_MPS) / METRES_PER_UNIT
  for (const n of NODES) {
    if (n.stairTo && nodeMap.has(n.stairTo)) {
      link(n.id, n.stairTo, stairCost)
    }
  }
  return m
})()

// ── Room lookup ─────────────────────────────────────────────────────────────

/** "D-104", "d104", "D104 " → "D104"; "Gym 2" and "StuSer" pass through. */
export function normalizeRoomId(raw: string): string {
  const s = raw.trim()
  const m = /^([A-Za-z])[-\s]?(\d{3})$/.exec(s)
  if (m) return `${m[1]!.toUpperCase()}${m[2]}`
  return s.replace(/\s+/g, ' ').trim()
}

export function findRoom(raw: string): Room | undefined {
  const key = normalizeRoomId(raw)
  const direct = roomMap.get(key)
  if (direct) return direct
  const lower = key.toLowerCase()
  return ROOMS.find(
    (r) => r.id.toLowerCase() === lower || r.label.toLowerCase() === lower || r.name?.toLowerCase() === lower
  )
}

export function searchRooms(q: string, limit = 12): Room[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const norm = normalizeRoomId(q).toLowerCase()
  return ROOMS.filter((r) => {
    const hay = `${r.id} ${r.label} ${r.name ?? ''} ${r.wing}`.toLowerCase()
    return hay.includes(s) || r.id.toLowerCase().startsWith(norm)
  }).slice(0, limit)
}

export function roomCenter(r: Room): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

// ── Routing ─────────────────────────────────────────────────────────────────

export interface RouteStep {
  /** Human-readable instruction. */
  text: string
  floor: Floor
  /** True when this step is the stair transition. */
  stairs?: boolean
}

export interface Route {
  from: Room
  to: Room
  /** Polyline points in view coordinates, tagged by floor for layered drawing. */
  points: { x: number; y: number; floor: Floor }[]
  /** Metres. */
  distance: number
  /** Seconds, including stair penalty. */
  seconds: number
  floorsCrossed: boolean
  steps: RouteStep[]
}

function dijkstra(from: string, to: string): string[] | null {
  const dist = new Map<string, number>([[from, 0]])
  const prev = new Map<string, string>()
  const seen = new Set<string>()
  const queue = new Set<string>([from])

  while (queue.size) {
    let cur: string | null = null
    let best = Infinity
    for (const id of queue) {
      const d = dist.get(id) ?? Infinity
      if (d < best) { best = d; cur = id }
    }
    if (cur === null) break
    queue.delete(cur)
    if (cur === to) break
    seen.add(cur)
    for (const { to: nxt, cost } of adj.get(cur) ?? []) {
      if (seen.has(nxt)) continue
      const nd = best + cost
      if (nd < (dist.get(nxt) ?? Infinity)) {
        dist.set(nxt, nd)
        prev.set(nxt, cur)
        queue.add(nxt)
      }
    }
  }

  if (!dist.has(to)) return null
  const path: string[] = [to]
  let cur = to
  while (cur !== from) {
    const p = prev.get(cur)
    if (!p) return null
    path.unshift(p)
    cur = p
  }
  return path
}

const WING_NAME: Record<Wing, string> = {
  A: 'A-wing (main office)',
  B: 'B-wing (student services)',
  C: 'C-wing',
  D: 'D-wing',
  E: 'E-wing',
  F: 'F-wing (cafeteria side)',
  G: 'G-wing (gyms)',
  J: 'J-wing (music & art)',
  Core: 'the library core',
}

function compass(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return 'continue'
  const parts: string[] = []
  if (Math.abs(dy) >= 30) parts.push(dy < 0 ? 'north' : 'south')
  if (Math.abs(dx) >= 30) parts.push(dx < 0 ? 'west' : 'east')
  return `head ${parts.join('-')}`
}

/** Shortest walking route between two rooms, with turn-by-turn text. */
export function routeBetween(fromRaw: string, toRaw: string): Route | null {
  const from = findRoom(fromRaw)
  const to = findRoom(toRaw)
  if (!from || !to) return null

  if (from.id === to.id) {
    return {
      from, to, points: [{ ...roomCenter(from), floor: from.floor }],
      distance: 0, seconds: 0, floorsCrossed: false,
      steps: [{ text: `Stay put — you're already in ${from.label}.`, floor: from.floor }],
    }
  }

  const path = dijkstra(from.node, to.node)
  if (!path) return null

  const nodes = path.map((id) => nodeMap.get(id)!).filter(Boolean)
  const points = [
    { ...roomCenter(from), floor: from.floor },
    ...nodes.map((n) => ({ x: n.x, y: n.y, floor: n.floor })),
    { ...roomCenter(to), floor: to.floor },
  ]

  // Distance in units, charging stairs their own penalty rather than geometry.
  let units = 0
  let stairHops = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (a.floor !== b.floor) { stairHops++; continue }
    units += Math.hypot(a.x - b.x, a.y - b.y)
  }
  const distance = units * METRES_PER_UNIT
  const seconds = distance / WALK_SPEED_MPS + stairHops * STAIR_SECONDS

  // ── directions ──
  const steps: RouteStep[] = [
    { text: `Leave ${from.label}${from.name ? ` (${from.name})` : ''} — ${WING_NAME[from.wing]}, floor ${from.floor}.`, floor: from.floor },
  ]
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1]!
    const b = nodes[i]!
    if (a.floor !== b.floor) {
      steps.push({
        text: `Take the ${a.label ?? 'stairs'} ${b.floor > a.floor ? 'up' : 'down'} to floor ${b.floor}.`,
        floor: b.floor,
        stairs: true,
      })
      continue
    }
    const dir = compass(a, b)
    const via = b.label ? ` past ${b.label}` : ''
    steps.push({ text: `${dir[0]!.toUpperCase()}${dir.slice(1)}${via}.`, floor: b.floor })
  }
  steps.push({ text: `Arrive at ${to.label}${to.name ? ` — ${to.name}` : ''}, ${WING_NAME[to.wing]}.`, floor: to.floor })

  return {
    from, to, points, distance, seconds,
    floorsCrossed: stairHops > 0,
    steps: dedupeSteps(steps),
  }
}

function dedupeSteps(steps: RouteStep[]): RouteStep[] {
  const out: RouteStep[] = []
  for (const s of steps) {
    const prev = out[out.length - 1]
    if (prev && prev.text === s.text) continue
    if (prev && !s.stairs && !prev.stairs && s.text === 'Continue.') continue
    out.push(s)
  }
  return out
}
