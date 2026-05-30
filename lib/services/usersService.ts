// Re-exports from humansService.ts — kept for backwards compatibility during rename.
// Update imports to use @/lib/services/humansService directly.
export {
  getHumans as getUsers,
  getHumanById as getUserById,
  getHumansByRelationship,
  getPortalCoaches,
} from "@/lib/services/humansService";
