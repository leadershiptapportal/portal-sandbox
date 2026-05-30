// Re-exports from humans.ts — kept for backwards compatibility during rename.
// Update imports to use @/lib/airtable/humans directly.
export {
  getAllHumans as getAllUsers,
  getHumanById as getUserById,
  searchHumansByName as searchUsersByName,
  createHumanRecord as createUserRecord,
  patchTeamMembers,
  updateHumanProfile as updateUserProfile,
  updateHumanTheme as updateUserTheme,
  getAdminPortalHumans as getAdminPortalUsers,
  getPortalLoginHumans as getPortalUsers,
  fetchPersonalityOptions,
  fetchProfileOptions,
} from "@/lib/airtable/humans";

export type {
  HumanProfileFields as UserProfileFields,
  AdminPortalHuman as AdminPortalUser,
  ProfileOption,
} from "@/lib/airtable/humans";
