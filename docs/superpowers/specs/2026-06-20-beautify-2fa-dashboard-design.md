# 2FA Authenticator Dashboard Page Redesign Design Spec

This design document outlines the UI/UX changes for the 2FA Authenticator Dashboard (the unlocked code retrieval page). The goal is to replace the scattered card layout with a single, cohesive glassmorphic panel, integrate the search and countdown elements, display action buttons (copy, edit, delete) on account card hover, and compress the cloud sync card into a minimal bottom footer status bar.

## Proposed Changes

### Component Structure: [TwoFactorPage.tsx](file:///Users/quentin/Documents/me/code-open/kuntab-ai/entrypoints/newtab/TwoFactorPage.tsx)

- Wrap the unlocked view in a new unified container `.two-factor-dashboard-panel`.
- Create a header `.dashboard-header` containing the title, description, and top actions (Change Passphrase, Lock Vault, Add Entry).
- Create a control row `.dashboard-control-row` containing the search input `.two-factor-search` and the countdown timer `.two-factor-countdown`.
- Reorder elements in `.two-factor-entry-card` so that `two-factor-entry-actions` (Copy, Edit, Delete) are placed inside `.two-factor-entry-main` or absolute positioned in the top-right corner of the card.
- Simplify the footer sync area into `.dashboard-footer-bar` instead of a standalone card `.two-factor-cloud-card`.

### Styles: [newtab.css](file:///Users/quentin/Documents/me/code-open/kuntab-ai/entrypoints/newtab/newtab.css)

- Style `.two-factor-dashboard-panel` with consistent glassmorphism (`background`, `border`, `box-shadow`, `backdrop-filter`).
- Align controls in `.dashboard-control-row` ensuring the search bar and the countdown timer have identical height and sit seamlessly side-by-side.
- Redesign `.two-factor-entry-card` to support:
  - Absolute positioning of actions in the top-right corner, defaulting to opacity 0 and transitions to opacity 1 on hover.
  - Hover scaling effect (`transform: translateY(-2px)`) and slightly brighter glass background.
  - Distinctive styling for `.two-factor-code` with a monospaced font, neon-like text color, and elegant border/background.
- Style `.dashboard-footer-bar` with a clean divider, aligning text on the left and icon buttons on the right.

## Verification Plan

### Manual Verification
- Verify the layout of the unlocked 2FA page is centered and contained inside a unified glassmorphic panel.
- Ensure the account cards correctly display actions only on hover (or on click for mobile).
- Check that the countdown timer is visually aligned with the search input.
- Test cloud sync functionality using the redesigned minimal footer sync buttons.
- Verify dark/light mode responsiveness and visual aesthetics under both modes.
