// ─────────────────────────────────────────────────────────────────────────────
//  AIRTABLE TABLE + FIELD IDS
// ─────────────────────────────────────────────────────────────────────────────
//  Values are stable Airtable IDs. Renames in Airtable no longer break the
//  portal. Field names are preserved as comments for review.
//
//  Reads: every Airtable GET goes through airtableFetch() in client.ts which
//  appends `returnFieldsByFieldId=true`, so the response is keyed by ID.
//  Code accesses fields via `record.fields[FIELDS.X.Y]` which matches.
//
//  Writes: Airtable accepts both names and IDs in request bodies. Existing
//  write payloads using literal name keys still work; new code can use IDs.
//
//  To regenerate after schema changes:
//    npx tsx scripts/dump-airtable-schema.ts
//
//  Schema reference (with all 258 fields): lib/airtable/schema.generated.ts
// ─────────────────────────────────────────────────────────────────────────────

export const TABLES = {
  PEOPLE: 'tblD4Pttofq0sDl2R',                  // "People"
  ORGANIZATIONS: 'tbl56SmsLjb0odxag',           // "Organizations"
  ORG_MEMBERSHIPS: 'tbl6Ld2QCBAN4EI62',         // "Organization Memberships"
  PERMISSION_PROFILES: 'tbl1XeWzXjE41fSSE',     // "Permission Profiles"
  CONNECTED_CALENDARS: 'tblJs7uabNEOsgyoF',     // "Connected Calendars"
  RELATIONSHIP_CONTEXTS: 'tblYdLi7dp2RmhNjh',   // "Relationship Contexts"
  INTERACTIONS: 'tblUm3dEvQqQBhxSE',            // "Interactions" (formerly "Meetings")
  MEETINGS: 'tblUm3dEvQqQBhxSE',                // alias → INTERACTIONS, kept for backwards compatibility
  NOTES: 'tblSTELdCWLYk5dq4',                   // "Notes"
  TASKS: 'tbleG9GWJEB9jd6yt',                   // "Tasks"
  COACH_SESSION: 'tblPFj41wHQXZVzzZ',           // "Coach Session"
  COACH_PERSON_CONTEXT: 'tbly1SOW603Qhd2nJ',    // "Coach-Person Context" — legacy, table may not exist; reads return null gracefully
  MESSAGES: 'tbl8VGHVCU8cXyAis',                // "Messages"
} as const

export const FIELDS = {
  RELATIONSHIP_CONTEXTS: {
    PERSON: 'fldvNEiXLMymiyCTj',                // "Person"
    LEAD: 'fld1f2J50eTmLoSXG',                  // "Lead"
    TYPE: 'fldjEfITRItxf7OLl',                  // "Relationship Type"
    PERMISSION_LEVEL: 'fldbZwRLGEz5mAsws',      // "Permission Level"
    STATUS: 'fldm3QrrCbs34ai2F',                // "Status"
    START_DATE: 'fld3bTwZSm3lQNi9N',            // "Start Date"
    END_DATE: 'fldeAxACxxeiULgZr',              // "End Date"
    TASKS_LINKED: 'fld9UnUYXwKCEBKrT',          // "Tasks" (linked → Tasks)
    NOTES_LINKED: 'fld3omA1BHtk6k1cK',          // "Notes" (linked → Notes)
  },
  MEETINGS: {
    TITLE: 'fldAk4BCE60mYBv4I',                 // "Subject"
    START: 'fldvUrf7tG2xQ8Q1E',                 // "Start Time"
    END: 'fldfdh1Tq2Xmsp68X',                   // "End Time"
    PROVIDER_EVENT_ID: 'fldcugcsHlIPbEgna',     // "Provider Event ID"
    ATTENDEES: 'fldpCCYTuIOXuqqCd',             // "Attendees"
    CALENDAR_OWNER: 'fld790fAzn86Lquig',        // "Calendar Owner" (text email)
    CALENDAR_OWNER_PERSON: 'fldj13l8IStVOJeq1', // "Calendar Owner Person" (linked → People)
    CLIENT_NAME: 'fldK2TOXuqUOSWdk9',           // "Client Name"
    RELATIONSHIP_CONTEXT: 'fldwLPj5ahMVI9mam',  // "Relationship Context" (linked)
    TIMEZONE: 'fld0MYHtXEbwJ0EFe',              // "Timezone"
    MEETING_STATUS: 'fldj6d4eqytFAjg56',        // "Meeting Status"
    CALENDAR_PROVIDER: 'fldBhVB6jjJZVER4o',     // "Calendar Provider"
    NOTES_TEXT: 'fldyTf8tVlyfmNT5S',            // "Notes" (coach-written notes — multilineText)
    NOTE_NAME: 'fldhYmaFzYM86fi1O',             // "Note Name" (auto-set by sync as YYYY-MM-DD // Attendee)
    ICAL_UID: 'fldFCmcfx1vGgXdBl',              // "iCal UID"
    INTERACTION_TYPE: 'fldqlSsJO1b5DMhRu',      // "Interaction Type" (singleSelect: "Calendar Event" | "Email" | "Text" | "In-Person" | "Phone Call" | "Video Call" | "Mail" | "Other")
    SOURCE: 'fld3ypgDTQTDV36KX',                // "Source" (singleSelect: "Synced" | "Manual")
  },
  NOTES: {
    BODY: 'fldCT8P7Da1INkG0T',                  // "Content" (primary text field)
    DATE: 'fldnOSv13VmCbOtEY',                  // "Date"
    CLIENT: 'fldDLBsX8zXpJInAD',                // "Client" (linked → People)
    COACH_NAME: 'fld4QwJB7HdqZPQZt',            // "Coach Name"
    AUTHOR_PERSON: 'fldWJgq54h0A2OvCy',         // "Author Person" (linked → People)
    SUBJECT_PERSON: 'fldzCJbxYI9Ny5nwj',        // "Subject Person" (linked → People)
    MEETING: 'flduXwHTvTUjaZ9Fz',               // "Meeting" (singleLineText — legacy)
    MEETING_LINK: 'fldb4rVcTf0mrkvFf',          // "Meeting Link" (linked → Meetings — preferred)
    NOTE_TYPE: 'fldRCz98Sppbgbq5e',             // "Note Type"
    VISIBILITY: 'fldan9xqdso86TKBv',            // "Visibility"
    RELATIONSHIP_CONTEXT: 'fldltUsIa9P0U73li',  // "Relationship Context" (linked)
  },
  TASKS: {
    TITLE: 'fldRgrskNdZharknP',                 // "Title"
    STATUS: 'fldtsgD1YZ6t1mwpm',                // "Status"
    DUE_DATE: 'fldrSWXmgm4vSuLyV',              // "Due Date"
    CLIENT: 'flduy2wmhQfarU9yP',                // "Client"
    NOTES: 'fldPjSEnJ22a10vfw',                 // "Notes"
    RELATIONSHIP_CONTEXT: 'fldQbgGA2WfAXXVuV',  // "Relationship Context"
    CREATED_BY_PERSON: 'fldVIIP6weGTTYB07',     // "Created By Person"
    ASSIGNED_TO_PERSON: 'fldFOgzUG94oxI4jU',    // "Assigned To Person"
    TASK_TYPE: 'fldhJUxdZGKijHSKX',             // "Task Type"
    VISIBILITY: 'fldOpVCxStZP5tMhP',            // "Visibility"
  },
  COACH_SESSION: {
    COACH: 'fldMKmrbXmxpXV3Y5',                 // "Coach"
    CALENDAR_EVENT: 'fldoHpg3OxFnuKeJ5',        // "Calendar Event"
    FOCAL_PERSON: 'fldz6kvciTYm30gNq',          // "Focal Person"
    SESSION_NOTES: 'fldEy7rDjvvIG13Af',         // "Session Notes"
    ACTION_ITEMS: 'fldVJ8aeHxjrHd1Gh',          // "Action Items"
    LAST_UPDATED: 'fld5Veqq1nQpQkdaG',          // "Last Updated"
  },
  USERS: {
    CLERK_USER_ID: 'fldFADxRhS8Jx8oEr',                            // "Clerk User ID"
    PERMISSION_PROFILE: 'fldKCYbCstGpxPqDh',                       // "Portal Permission Profile" (linked)
    LAST_PORTAL_LOGIN: 'fldHRzhxghjtyXBbt',                        // "Last Portal Login"
    FULL_NAME: 'fldH8rST4tjq0gis7',                                // "Full Name"
    PREFERRED_NAME: 'fld3HX06VuQWQYCM1',                           // "Preferred Name"
    FIRST_NAME: 'fldOGveomFlCV6DjD',                               // "First Name"
    LAST_NAME: 'fldJh2vuJqYkyyZqx',                                // "Last Name"
    EMAIL: 'Email',                                                // does not exist in schema; read returns undefined
    WORK_EMAIL: 'fldlL8HrXCnd3K4KL',                               // "Work Email"
    JOB_TITLE: 'Job Title',                                        // does not exist in schema; read returns undefined
    TITLE: 'fldVwZtWoJjZp920l',                                    // "Title"
    ROLE: 'fldaSnC1UCEukV8Um',                                     // "Role"
    COMPANY_ID: 'Company ID',                                      // does not exist in schema
    COMPANY_NAME: 'fldHd3omMw7PUAWNJ',                             // "Company Name (from Company)" lookup
    AVATAR_URL: 'Avatar URL',                                      // does not exist in schema
    PROFILE_PHOTO: 'fldHj7YBmed6S8s58',                            // "Profile Photo"
    TIME_AT_COMPANY: 'fldi1Ez09JdS0tjnb',                          // "Time at Company"
    COACH: 'fld4kKouAYi5plNVL',                                    // "Coach"
    TEAM_LEAD: 'fldRyJGLnzfoZlIpN',                                // "Team Lead"
    QUICK_NOTES: 'fldduqJaVzxE9u6IP',                              // "Quick Notes"
    FAMILY_DETAILS: 'fldZb1F9kHhHPjqLk',                           // "Family Details"
    ENNEAGRAM_TYPE_FROM_ENNEAGRAM: 'fld3NTWw3EmFRVBRY',            // "Enneagram Type (from Enneagram)"
    DESCRIPTOR_FROM_ENNEAGRAM: 'fldfTiZfRCarNCvUe',                // "Descriptor (from Enneagram)"
    MBTI_FROM_MBTI: 'fldetFbWFerHgk3Ai',                           // "MBTI (from MBTI)"
    DESCRIPTOR_FROM_MBTI: 'fld3rOcdWcI0jexPr',                     // "Descriptor (from MBTI)"
    DESCRIPTOR_FROM_CONFLICT_POSTURE: 'fldW64peeLXRGtaMt',         // "Descriptor (from Conflict Posture)"
    APOLOGY_LANGUAGE_FROM_APOLOGY_LANGUAGE: 'fldz2XhOUPxcU3W0O',   // "Apology Language (from Apology Language)"
    DESCRIPTOR_FROM_APOLOGY_LANGUAGE: 'fldcmyFlWikFNyR53',         // "Descriptor (from Apology Language)"
    STRENGTH_NAME_FROM_STRENGTHS: 'fldm4MrDJsj8BZHRz',             // "Strength Name (from Strengths)"
    DOMAIN_FROM_STRENGTHS: 'fldG84OLoi5HtKagW',                    // "Domain (from Strengths)"
    ASSOCIATED_MEETINGS: 'fld1t3bIXyBxHEh4B',                      // "Associated Meetings"
    MANAGER: 'Manager',                                            // does not exist in schema
    DIRECT_REPORTS: 'Direct Reports',                              // does not exist in schema
    TEAM_MEMBERS: 'fldbpthkjaXy7mU0R',                             // "Team Members"
    ENNEAGRAM: 'fldSQ11YFsWjlkREZ',                                // "Enneagram"
    MBTI: 'fldyjw72Zx7bbbSqQ',                                     // "MBTI"
    CONFLICT_POSTURE: 'fldCD4HvwKE5SXXLE',                         // "Conflict Posture"
    APOLOGY_LANGUAGE: 'fldVEQ4DZuTARM3ST',                         // "Apology Language"
    STRENGTHS: 'fldcQe5diYYsoThxi',                                // "Strengths"
    COMPANY: 'fldUu6I5aaiIhTVj6',                                  // "Company"
    PERSONAL_EMAIL: 'fldsARb1wJcJauPAx',                           // "Personal Email"
    BIRTHDAY: 'flde4V2mmmYv0dMME',                                 // "Birthday"
    WORK_DESK_NUMBER: 'fldZIvMj9ggKNAHwO',                         // "Work Desk Number"
    WORK_CELL_NUMBER: 'fldoMP21FCwAemPEW',                         // "Work Cell Number"
    PERSONAL_CELL_NUMBER: 'fldV3990UGnVEdSQL',                     // "Personal Cell Number"
    DEPARTMENT: 'Department',                                      // does not exist in schema
    START_DATE: 'Start Date',                                      // does not exist in schema
    HIRE_DATE: 'fldQPh2SMs4SXjp6Q',                                // "Hire Date"
    ENGAGEMENT_LEVEL: 'Engagement Level',                          // does not exist in schema
    COACH_NOTES: 'Coach Notes',                                    // does not exist in schema
    INTERNAL_NOTES: 'Internal Notes',                              // does not exist in schema
    // Linked record fields on People (not the singleLineText lookup variants)
    MEETINGS_LINKED: 'fldPvW5FXxWUiiI8F',                         // "Meetings" (multipleRecordLinks → Meetings)
    NOTES_LINKED: 'fldtaUHrHe079g2iz',                            // "Notes" (multipleRecordLinks → Notes)
    TASKS_LINKED: 'fldeWGoSfUIqV3CbE',                            // "Tasks" (multipleRecordLinks → Tasks)
    CONNECTED_CALENDARS: 'fld7aipXZ3XzINu0p',                     // "Connected Calendars" (multipleRecordLinks)
    RELATIONSHIP_CONTEXTS_CLIENT: 'fldXDcLMxY0q87gwE',            // "Relationship Contexts (Client)" — person is coachee
    RELATIONSHIP_CONTEXTS_COACH: 'fldFabqxT4dx63zeK',             // "Relationship Contexts (Coach)" — person is lead
    LAST_MODIFIED: 'fldAAzvWFfJSpUs93',                           // "Last Modified" (lastModifiedTime)
  },
  COMPANIES: {
    NAME: 'fldl7bZkR5JCKyLHk',                  // "Company Name"
    STATUS: 'fldk33AceBzzND138',                // "Status"
    ORGANIZATION_TYPE: 'fldkxkzOX87KZctuL',     // "Organization Type"
    LOGO: 'fldgW4xeX2hkieVb2',                  // "Company Logo" (url)
    DOMAIN_NAME: 'fldKGWHDCJJZEGorT',           // "Company Domain Name"
  },
  ENNEAGRAM: {
    NAME: 'fldDHEcTx28Dpnccp',                  // "Name"
  },
  PERSONALITIES_16: {
    NAME: 'fldPBfoiEuRsDFQr9',                  // "Name"
  },
  CONFLICT_POSTURES: {
    NAME: 'fldtdKv50CBpFe7V8',                  // "Conflict Posture"
  },
  APOLOGY_LANGUAGES: {
    NAME: 'fldS441fSkXjaFdO9',                  // "Apology Language"
  },
  STRENGTHS: {
    NAME: 'fldO3GPrkGxC1ldZi',                  // "Strength"
  },
  COACH_PERSON_CONTEXT: {
    COACH: 'fldMidd750nvVaOuD',                 // "Coach"
    PERSON: 'fldgP7Hn2EnOCeEOn',                // "Person"
    QUICK_NOTES: 'fldeCsw5wQ9cJJJte',           // "Quick Notes"
    FAMILY_DETAILS: 'fldICfOOjlBgwXLzI',        // "Family Details"
    RELATIONSHIP_FLAGS: 'fldkaBmcetVEbGD02',    // "Relationship Flags"
    LAST_UPDATED: 'fldV5RnOV6h0IkPkR',          // "Last Updated"
  },
  CONNECTED_CALENDARS: {
    CONNECTION_NAME: 'fldjj4sUqh1Rdz34T',       // "Connection Name" (primary)
    PERSON: 'fldaS5RFjObe3O40j',                // "Person" (linked → People)
    PROVIDER: 'fldFdmevMOuaMCJGS',              // "Provider" (singleSelect: "Outlook", "Google")
    PROVIDER_ACCOUNT_EMAIL: 'fld6WDIroNlUQb5TN', // "Provider Account Email"
    PROVIDER_USER_ID: 'fldk7m4uHjglWykbP',      // "Provider User ID"
    PROVIDER_TENANT_ID: 'fld5Q7HpW8RrrZcFC',    // "Provider Tenant ID"
    CALENDAR_ID: 'fld0ac0bykZDneFsV',           // "Calendar ID"
    ACCESS_TOKEN: 'fldUIhHaasR612tPN',          // "Access Token" (multilineText)
    REFRESH_TOKEN: 'fldHmWIXLsjYFZDcl',         // "Refresh Token" (multilineText)
    TOKEN_EXPIRES_AT: 'flduBUEM43LTfY6j0',      // "Token Expires At" (dateTime)
    SCOPES: 'fldau0POzcX3lAhj5',                // "Scopes" (multilineText)
    DELTA_LINK: 'fld0p9fniyXx1xee8',            // "Delta Link" (multilineText — Outlook incremental sync)
    SYNC_STATUS: 'fldh0yPUYzkBR5U2a',           // "Sync Status" (singleSelect: "Connected" | "Needs Reauth" | "Error" | "Paused" | "Disconnected" | "Active")
    LAST_SYNCED_AT: 'fldGpI3ftPAQLYXwP',        // "Last Synced At" (dateTime)
    LAST_SYNC_ERROR: 'fldQrI8nZci0u00BV',       // "Last Sync Error" (multilineText)
    ENVIRONMENT: 'fldt01pqCMveUGus4',           // "Environment" (singleSelect: "Production" | "Test" | "Local")
    CLERK_USER_ID: 'fldmQRycM725Y8yGD',         // "Clerk User ID"
    CLERK_EMAIL: 'fld3iesrZfNJhWXXk',           // "Clerk Email"
    SELECTED_CALENDAR_IDS: 'fldNeClDrVmOgM4n3',  // "Selected Calendar IDs" (multilineText — one Graph calendar ID per line)
    SYNC_PAST_DAYS: 'fldzCSP6rq0J38Fjg',         // "Sync Past Days" (number, default 90)
    SYNC_FUTURE_DAYS: 'fldgyEfjN2FJzOoBz',        // "Sync Future Days" (number, default 60)
  },
  PERMISSION_PROFILES: {
    PROFILE_NAME: 'fldnGsXftdue5s0Ws',               // "Profile Name"
    DESCRIPTION: 'fldC4dbMzGt3nRRK6',                // "Description"
    CAN_WRITE_NOTES: 'fldy2Cxmr3Irsa8Bd',            // "Can Write Notes" (checkbox)
    CAN_CREATE_MEETINGS: 'fldsdgjDfBgCkZpE6',         // "Can Create Meetings" (checkbox)
    CAN_VIEW_PERSON_PROFILE: 'fldVT89tY1d0mgPxu',     // "Can View Person Profile" (checkbox)
    CAN_VIEW_DIRECT_REPORTS: 'fldRnf8el6uan7QEt',     // "Can View Direct Reports" (checkbox)
    NOTES_DEFAULT_VISIBILITY: 'fldoio0Bwxso2736X',    // "Notes Default Visibility" (singleSelect)
    RELATIONSHIP_CONTEXTS_LINKED: 'fldqIjUpJFsdVSIsn', // "Relationship Contexts" (linked)
    PEOPLE_LINKED: 'fldMq09F3luFHKdRM',               // "People" (linked)
  },
  MESSAGES: {
    MESSAGE_NAME: 'fldRIXITrwYvnBGyL',          // "Message Name"
    SUBJECT: 'fldnUHEAWC8FcR5eZ',               // "Subject"
    TYPE: 'fldWlN8Hm3TaSrK8b',                  // "Type"
    STATUS: 'fld3tCgsq2nnnLYjT',                // "Status"
    AI_GENERATED_MESSAGE_CONTENT: 'fldSvD7C2yybmEeUf',  // "AI Generated Message Content"
    DRAFT_CONTENT: 'fldd7GyTc2CwGKg6z',         // "Draft Content"
    SENT_MESSAGE: 'fldCCnyA3I5OiWdcK',          // "Sent Message"
    SENT_DATE: 'fldl3gImAEAqahxt4',             // "Sent Date"
    CREATED: 'fldFrjFZVlpUm7Abj',               // "Created"
    MEETING: 'Meeting',                         // singleLineText field on Messages — keep as legacy name (lookup-style)
    CLIENT: 'fldyAJpx9JBLeMNj7',                // "Client"
    ASSOCIATED_MEETINGS: 'fldyyn094584CIz6x',   // "Associated Meetings"
    ATTACHMENTS: 'fldxGMUQVcekiQ0Cj',           // "Attachments"
    RECIPIENT_EMAIL_FINAL: 'fld0EeBYZPVu0PH7j', // "Recipient Email (Final)"
    TOOLS_RESOURCES: 'fldkmBgodxSlz4zPT',       // "Tools & Resources"
  },
} as const
