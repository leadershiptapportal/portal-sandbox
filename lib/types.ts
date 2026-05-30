export interface Organization {
  id: string;
  name: string;
  domain?: string;
}

export interface Human {
  id: string;
  fullName?: string;
  preferredName?: string;
  firstName?: string;
  lastName?: string;
  workEmail?: string;
  role?: string;
  organizationName?: string;
  profilePhoto?: string;    // Airtable "Profile Photo" attachment (first URL)
  timeAtOrganization?: string;   // text field
  coachIds?: string[];      // linked record IDs → Coach(es)
  teamLeadIds?: string[];   // linked record IDs → Team Lead(s)

  // Coaching context
  quickNotes?: string;

  // Personality & Strengths (lookup fields — read only)
  enneagramType?: string;            // "Enneagram Type (from Enneagram)"
  enneagramDescriptor?: string;      // "Descriptor (from Enneagram)"
  mbtiType?: string;                 // "MBTI (from MBTI)" or similar lookup
  mbtiDescriptor?: string;           // "Descriptor (from MBTI)"
  conflictPosture?: string;
  conflictPostureDescriptor?: string;
  apologyLanguage?: string;
  apologyLanguageDescriptor?: string;
  strengths?: Array<{ name: string; domain?: string }>;

  // Org / Team
  teamMemberIds?: string[];    // linked record IDs — team members

  // Session count via linked record field (avoids email matching)
  associatedMeetingIds?: string[]   // "Associated Meetings" linked field → Portal Calendar Events

  // Raw linked record IDs — used by edit forms to pre-select current values
  enneagramIds?: string[]
  mbtiIds?: string[]
  conflictPostureIds?: string[]
  apologyLanguageIds?: string[]
  strengthIds?: string[]
  organizationLinkedIds?: string[]   // from the "Organization" linked field

  // Extra contact fields
  birthday?: string             // "Birthday"
  workCellNumber?: string       // "Work Cell Number"
  personalCellNumber?: string   // "Personal Cell Number"

  // Legacy / misc
  enneagram?: string;
  mbti?: string;
  title?: string;        // maps to Airtable "Title" (distinct from "Job Title")
  startDate?: string;
  theme?: 'light' | 'dark' | 'system';  // User's preferred UI theme
}

export interface Interaction {
  id: string;
  providerEventId?: string; // "Provider Event ID" — stable external calendar ID
  title: string;
  startTime: string; // ISO 8601
  endTime?: string;
  timezone?: string; // IANA timezone from the calendar event (e.g. "America/New_York")
  senderEmail?: string;
  participantEmails: string[];
  notes?: string;
  // Set during calendar sync when a participant matches a known Relationship Context
  humanName?: string;
  relationshipContextId?: string;
  interactionType?: string;
  source?: string;
}


export interface Note {
  id: string;
  content: string;
  inkImageUrl?: string;
  date: string;
  humanId?: string;
  coachName?: string;
  authorPersonId?: string;
  subjectPersonId?: string;
  interactionId?: string;
  noteType?: 'general_note' | 'interaction_note' | 'ink_note' | 'prep_note' | 'quick_notes';
  visibility: 'private_to_author';
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'Complete' | 'Cancelled'

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate?: string;
  humanId?: string;
  notes?: string;
  relationshipContextId?: string;
  createdByPersonId?: string;
  assignedToPersonId?: string;
  taskType: 'personal_reminder' | 'assignment';
  visibility: 'private_to_author' | 'shared_with_target';
}

export interface Message {
  id: string;
  messageName: string;
  subject?: string;
  body?: string;
  status: 'Pending' | 'Sent';
  created?: string;
  sentAt?: string;
  interactionId?: string; // first linked Calendar Events record ID
  userIds?: string[];  // linked Users record IDs
}
