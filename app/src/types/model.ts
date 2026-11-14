// Data model from SPEC.md sections 3 and 5.
// Court coordinates are stored in metres (FIBA, origin at the centre of the court).

export type Role = 'owner' | 'coach' | 'viewer';

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  createdAt: string;
}

export interface Membership {
  userId: string;
  teamId: string;
  role: Role;
}

/** `teamId: null` means local content without an account (browser only). */
export type TeamId = string | null;

export interface Season {
  id: string;
  teamId: TeamId;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  archived: boolean;
  updatedAt: string;
}

export interface BlockType {
  id: string;
  teamId: TeamId;
  name: string;
  icon: string;
  color: string; // hex
}

export interface Point {
  x: number;
  y: number;
}

export type CourtElement =
  | {
      id: string;
      type: 'offense' | 'defense' | 'coach' | 'ball' | 'cone';
      x: number;
      y: number;
      label?: string;
      color?: string;
      rotation?: number;
      /** Ball only: id of the player the ball follows. */
      attachedTo?: string;
    }
  | {
      id: string;
      type: 'pass' | 'dribble' | 'cut' | 'screen' | 'handoff' | 'shot' | 'slide';
      points: Point[];
      curved: boolean;
      fromElementId?: string;
      order?: number;
      color?: string;
    }
  | { id: string; type: 'text'; x: number; y: number; text: string; size: number }
  | {
      id: string;
      type: 'zone';
      shape: 'rect' | 'ellipse';
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }
  | { id: string; type: 'freehand'; points: Point[]; color: string };

export interface Diagram {
  id: string;
  court: 'half' | 'full';
  caption?: string;
  elements: CourtElement[];
}

export interface ImageAttachment {
  id: string;
  fileName: string;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  caption?: string;
  /** Key in the `images` table in IndexedDB. */
  localBlobId?: string;
  /** URL on the server once the team syncs. */
  url?: string;
}

export interface Block {
  id: string;
  /** `section` = heading row without time, e.g. "Uppvärmning". */
  kind: 'block' | 'section';
  title: string;
  /** Minutes, 0–240. */
  duration: number;
  blockTypeId?: string;
  instructions: string;
  material?: string;
  playersNeeded?: string;
  diagrams: Diagram[];
  images: ImageAttachment[];
  sourceDrillId?: string;
}

export interface Session {
  id: string;
  teamId: TeamId;
  /** null = stand-alone session in the Library. */
  seasonId: string | null;
  title: string;
  date?: string; // YYYY-MM-DD
  startTime: string; // "18:00"
  location?: string;
  participants?: number;
  coach?: string;
  focus?: string;
  description?: string;
  /** Optional max length for the hall in minutes; a warning shows when exceeded. */
  maxDuration?: number;
  items: Block[];
  fromTemplateId?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface Drill {
  id: string;
  teamId: TeamId;
  title: string;
  tags: string[];
  defaultDuration: number;
  blockTypeId?: string;
  instructions: string;
  material?: string;
  playersNeeded?: string;
  diagrams: Diagram[];
  images: ImageAttachment[];
  updatedAt: string;
}

export type SessionContent = Omit<Session, 'id' | 'teamId' | 'seasonId'>;

export interface SeasonTemplate {
  name: string;
  weeks: number;
  sessionsPerWeek: number;
  sessions: SessionContent[];
}

export interface Template {
  id: string;
  /** null + builtIn = ships with the app. */
  teamId: TeamId;
  /** Built-in templates are read-only. */
  builtIn: boolean;
  kind: 'season' | 'session' | 'drill';
  name: string;
  description?: string;
  tags: string[];
  content: SeasonTemplate | SessionContent | Omit<Drill, 'id' | 'teamId'>;
}

/** Binary image data, referenced from ImageAttachment.localBlobId. */
export interface StoredImage {
  id: string;
  blob: Blob;
  createdAt: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}
