/**
 * GROUP DELETE FUNCTIONALITY TEST PLAN
 * ====================================
 * 
 * New Feature: Complete Group Deletion
 * 
 * BACKEND ENDPOINT:
 * DELETE /api/chats/:chatId
 * - Only system admins (user.role === 'Admin') can delete groups
 * - Deletes all messages in the group
 * - Deletes the group chat itself
 * - Returns success message
 * 
 * FRONTEND FEATURES:
 * 1. GroupManagementModal:
 *    - New "Danger Zone" section at bottom
 *    - Red warning box with delete button
 *    - Double confirmation dialogs for safety
 *    - Only visible to system admins
 * 
 * 2. ChatWindow:
 *    - Updated handleChatUpdate to handle group deletions
 *    - Removes deleted group from chat list
 *    - Clears active chat if deleted group was selected
 *    - Returns to empty state after deletion
 * 
 * USER FLOW:
 * 1. Admin opens group management modal
 * 2. Scrolls to bottom to see "Danger Zone"
 * 3. Clicks "Delete Group Permanently" button
 * 4. Gets first confirmation dialog with details
 * 5. Gets second confirmation dialog for final safety
 * 6. Group and all messages are permanently deleted
 * 7. User is returned to main chat view
 * 8. Deleted group no longer appears in chat list
 * 
 * SAFETY FEATURES:
 * - Two confirmation dialogs
 * - Clear warning about permanent deletion
 * - Detailed explanation of what will be deleted
 * - Only accessible to system admins
 * - Visual warning with red styling
 * 
 * TESTING STEPS:
 * 1. Login as Admin user
 * 2. Open any group chat
 * 3. Click group info/settings
 * 4. Scroll to bottom to see "Danger Zone"
 * 5. Click "Delete Group Permanently"
 * 6. Confirm both dialogs
 * 7. Verify group is completely removed
 * 8. Verify all messages are deleted
 * 
 * NON-ADMIN USERS:
 * - Cannot see delete option
 * - Cannot access group management for deletion
 * - Regular users only see group info, not management
 */

export const deleteGroupTestConfig = {
  endpoint: 'DELETE /api/chats/:chatId',
  adminOnly: true,
  confirmations: 2,
  deletesMessages: true,
  deletesGroup: true,
  irreversible: true
};