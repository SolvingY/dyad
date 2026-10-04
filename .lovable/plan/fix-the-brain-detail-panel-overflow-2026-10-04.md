# Fix the brain detail panel overflow

## Scope
- Keep the current dashboard layout and content.
- Remove the nested horizontal and vertical scrollbars from the Human, Dyad, and Agent panel beside the brain.
- Fit the Human and Agent metrics into compact two-column grids on desktop while retaining a readable single-column layout where space is narrow.
- Prevent the liquid hover treatment from creating overflow inside this fixed-height dashboard area.

## Validation
- Check the dashboard at desktop and phone widths.
- Confirm the panel has no nested scrollbars, no clipped labels or values, and the page still builds cleanly.
