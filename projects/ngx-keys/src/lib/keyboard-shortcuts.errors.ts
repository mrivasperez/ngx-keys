/**
 * Centralized error messages for keyboard shortcuts service
 * This ensures consistency across the application and makes testing easier
 */
export const KeyboardShortcutsErrors = {
  // Registration errors
  SHORTCUT_ALREADY_REGISTERED: (id: string) => `Shortcut "${id}" already registered`,
  GROUP_ALREADY_REGISTERED: (id: string) => `Group "${id}" already registered`,
  KEY_CONFLICT: (conflictId: string) => `Key conflict with "${conflictId}"`,
  SHORTCUT_IDS_ALREADY_REGISTERED: (ids: string[]) => `Shortcut IDs already registered: ${ids.join(', ')}`,
  DUPLICATE_SHORTCUTS_IN_GROUP: (ids: string[]) => `Duplicate shortcuts in group: ${ids.join(', ')}`,
  KEY_CONFLICTS_IN_GROUP: (conflicts: string[]) => `Key conflicts: ${conflicts.join(', ')}`,
  
  // Operation errors
  SHORTCUT_NOT_REGISTERED: (id: string) => `Shortcut "${id}" not registered`,
  GROUP_NOT_REGISTERED: (id: string) => `Group "${id}" not registered`,
  
  // Activation/Deactivation errors
  CANNOT_ACTIVATE_SHORTCUT: (id: string) => `Cannot activate shortcut "${id}": not registered`,
  CANNOT_DEACTIVATE_SHORTCUT: (id: string) => `Cannot deactivate shortcut "${id}": not registered`,
  CANNOT_ACTIVATE_GROUP: (id: string) => `Cannot activate group "${id}": not registered`,
  CANNOT_DEACTIVATE_GROUP: (id: string) => `Cannot deactivate group "${id}": not registered`,
  
  // Unregistration errors
  CANNOT_UNREGISTER_SHORTCUT: (id: string) => `Cannot unregister shortcut "${id}": not registered`,
  CANNOT_UNREGISTER_GROUP: (id: string) => `Cannot unregister group "${id}": not registered`,
} as const;

/**
 * Error types for type safety
 */
export type KeyboardShortcutsErrorType = keyof typeof KeyboardShortcutsErrors;

/**
 * Custom error class for keyboard shortcuts
 */
export class KeyboardShortcutError extends Error {
  constructor(
    public readonly errorType: KeyboardShortcutsErrorType,
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'KeyboardShortcutError';
  }
}

/**
 * Error factory for creating consistent errors
 */
export class KeyboardShortcutsErrorFactory {
  static shortcutAlreadyRegistered(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'SHORTCUT_ALREADY_REGISTERED',
      KeyboardShortcutsErrors.SHORTCUT_ALREADY_REGISTERED(id),
      { shortcutId: id }
    );
  }

  static groupAlreadyRegistered(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'GROUP_ALREADY_REGISTERED',
      KeyboardShortcutsErrors.GROUP_ALREADY_REGISTERED(id),
      { groupId: id }
    );
  }

  static keyConflict(conflictId: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'KEY_CONFLICT',
      KeyboardShortcutsErrors.KEY_CONFLICT(conflictId),
      { conflictId }
    );
  }

  static shortcutIdsAlreadyRegistered(ids: string[]): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'SHORTCUT_IDS_ALREADY_REGISTERED',
      KeyboardShortcutsErrors.SHORTCUT_IDS_ALREADY_REGISTERED(ids),
      { duplicateIds: ids }
    );
  }

  static duplicateShortcutsInGroup(ids: string[]): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'DUPLICATE_SHORTCUTS_IN_GROUP',
      KeyboardShortcutsErrors.DUPLICATE_SHORTCUTS_IN_GROUP(ids),
      { duplicateIds: ids }
    );
  }

  static keyConflictsInGroup(conflicts: string[]): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'KEY_CONFLICTS_IN_GROUP',
      KeyboardShortcutsErrors.KEY_CONFLICTS_IN_GROUP(conflicts),
      { conflicts }
    );
  }

  static shortcutNotRegistered(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'SHORTCUT_NOT_REGISTERED',
      KeyboardShortcutsErrors.SHORTCUT_NOT_REGISTERED(id),
      { shortcutId: id }
    );
  }

  static groupNotRegistered(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'GROUP_NOT_REGISTERED',
      KeyboardShortcutsErrors.GROUP_NOT_REGISTERED(id),
      { groupId: id }
    );
  }

  static cannotActivateShortcut(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'CANNOT_ACTIVATE_SHORTCUT',
      KeyboardShortcutsErrors.CANNOT_ACTIVATE_SHORTCUT(id),
      { shortcutId: id }
    );
  }

  static cannotDeactivateShortcut(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'CANNOT_DEACTIVATE_SHORTCUT',
      KeyboardShortcutsErrors.CANNOT_DEACTIVATE_SHORTCUT(id),
      { shortcutId: id }
    );
  }

  static cannotActivateGroup(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'CANNOT_ACTIVATE_GROUP',
      KeyboardShortcutsErrors.CANNOT_ACTIVATE_GROUP(id),
      { groupId: id }
    );
  }

  static cannotDeactivateGroup(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'CANNOT_DEACTIVATE_GROUP',
      KeyboardShortcutsErrors.CANNOT_DEACTIVATE_GROUP(id),
      { groupId: id }
    );
  }

  static cannotUnregisterShortcut(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'CANNOT_UNREGISTER_SHORTCUT',
      KeyboardShortcutsErrors.CANNOT_UNREGISTER_SHORTCUT(id),
      { shortcutId: id }
    );
  }

  static cannotUnregisterGroup(id: string): KeyboardShortcutError {
    return new KeyboardShortcutError(
      'CANNOT_UNREGISTER_GROUP',
      KeyboardShortcutsErrors.CANNOT_UNREGISTER_GROUP(id),
      { groupId: id }
    );
  }
}
