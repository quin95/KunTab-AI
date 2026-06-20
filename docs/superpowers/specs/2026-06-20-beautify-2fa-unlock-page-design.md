# 2FA Lock/Unlock Page Redesign Design Spec

This design document outlines the UI/UX changes for the 2FA Vault Lock/Unlock/Create Page. The goal is to replace the existing dual-column layout with a sleek, centered single-card layout, removing redundant lock icons and cloud settings button, and placing the FAQ section into a collapsible accordion under the card.

## Proposed Changes

### Component Structure: [TwoFactorPage.tsx](file:///Users/quentin/Documents/me/code-open/kuntab-ai/entrypoints/newtab/TwoFactorPage.tsx)

- Add state `showIntro` to toggle the visibility of the FAQ/introduction content.
- Update the localization dictionary `TEXT['zh-CN']` and `TEXT['en-US']` to add the toggle button text `introHelpTitle` (`使用帮助与安全说明` and `Help & Security Guide`).
- Replace the `.two-factor-auth-shell` grid structure with `.two-factor-auth-container` to center the lock card and helper collapsible sections.
- Remove the lock icon visual container (`.two-factor-lock-visual`) and the secondary Cloud Settings button next to the primary button.
- Implement the collapsible helper accordion container (`.two-factor-help-accordion`) beneath the central card.

### Styles: [newtab.css](file:///Users/quentin/Documents/me/code-open/kuntab-ai/entrypoints/newtab/newtab.css)

- Add `.two-factor-auth-container` style (max-width `420px`, centered margin, flex display).
- Update `.two-factor-unlock-card.centered-card` style for a modern centered card layout, including premium shadow, borders, and margins.
- Style the collapsible button `.two-factor-help-toggle` and accordion content `.modern-accordion-content` with a clean transition effect.
- Style the `.primary.full-width` button to stretch fully across the card width.
- Ensure dark mode and scenic background overrides work seamlessly.

## Verification Plan

### Manual Verification
- Check the visual layout of the 2FA page in locked state (for both vault creation and unlocking) to verify it is correctly centered.
- Test the help section accordion to ensure it expands and collapses smoothly when clicked.
- Check dark mode compatibility by toggling the theme.
- Verify that the layout remains responsive on mobile screens.
