---
name: Academic Excellence
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#5c3f3d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#916f6c'
  outline-variant: '#e6bdba'
  surface-tint: '#bf031d'
  primary: '#a10016'
  on-primary: '#ffffff'
  primary-container: '#cb1424'
  on-primary-container: '#ffdeda'
  inverse-primary: '#ffb3ad'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#004ba4'
  on-tertiary: '#ffffff'
  tertiary-container: '#0062d2'
  on-tertiary-container: '#dce5ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad7'
  primary-fixed-dim: '#ffb3ad'
  on-primary-fixed: '#410004'
  on-primary-fixed-variant: '#930013'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  unrn-red: '#ED1C24'
  surface-dark: '#1F1F1F'
  border-subtle: '#E2E8F0'
typography:
  display:
    fontFamily: Chivo
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Chivo
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Chivo
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Chivo
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Chivo
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Chivo
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Chivo
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Chivo
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Chivo
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  margin-mobile: 16px
  margin-desktop: 32px
  gutter: 16px
---

## Brand & Style

This design system is built upon a foundation of institutional prestige and modern academic management. The brand personality is authoritative yet accessible, professional, and highly structured. It aims to evoke a sense of reliability and clarity, essential for students and faculty navigating complex academic data.

The visual style follows a **Corporate / Modern** direction with a focus on **Minimalism**. It prioritizes high legibility and clear information hierarchy through generous whitespace and a disciplined use of the institutional palette. The aesthetic is clean and functional, stripping away unnecessary ornamentation to ensure that academic content remains the primary focus.

## Colors

The palette is anchored by a deep, authoritative Burgundy (`primary`), used for key branding moments and primary actions. To maintain a modern feel, a deep Slate Navy (`secondary`) provides a sophisticated neutral base for typography and UI structure. 

A vibrant Blue (`tertiary`) is reserved for secondary interactions, links, and informational accents, ensuring they are distinct from the primary institutional red. The background environment is a very light, cool-toned neutral to reduce eye strain during long study sessions, while the `unrn-red` is kept as a specific named color for high-impact brand expression like headers or splash screens.

## Typography

The design system utilizes **Chivo** as a single-family system to ensure maximum consistency and performance. Chivo’s grotesque qualities offer the necessary weight for strong institutional headlines while maintaining exceptional legibility in dense body text.

The hierarchy is strictly defined to help users parse information-heavy screens like grade reports or schedules. Bold weights are used for semantic signaling and headers, while regular weights with comfortable line heights (1.5x) are used for instructional text. Headlines scale down on mobile devices to prevent excessive line wrapping while maintaining their relative visual weight.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with a base-8 spacing scale. For mobile applications, a 4-column grid is used, transitioning to 12 columns for tablet and desktop views.

Spacing is designed to create a clear "chunking" of information. High-level sections (like different subjects or administrative categories) are separated by `xl` or `xxl` spacing, while related items within a card use `sm` or `md` units. To ensure accessibility, touch targets are never smaller than 48px, utilizing `md` padding around interactive labels.

## Elevation & Depth

This design system uses **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows to denote hierarchy. This approach keeps the interface feeling "flat" and professional, aligned with modern academic software aesthetics.

Depth is communicated through:
1.  **Surface Tiers:** Backgrounds are the lowest layer. Content containers (cards) use a pure white surface.
2.  **Ghost Borders:** Instead of shadows, 1px borders in `border-subtle` (#E2E8F0) define card boundaries.
3.  **Active States:** Interactive elements use a subtle tonal shift (darkening or lightening by 5%) or a primary-colored stroke when focused.
4.  **Overlays:** Modals and bottom sheets use a 40% opacity secondary-color scrim to push the background into the distance without distracting blurs.

## Shapes

The shape language is **Soft**, utilizing a 0.25rem (4px) base radius. This subtle rounding softens the clinical nature of an academic app while maintaining a serious, structured appearance. 

Buttons and input fields follow this 4px standard. Larger containers like cards or dashboard modules use `rounded-lg` (8px) to provide a clear visual container. Circular shapes (pill-shaped) are strictly reserved for status indicators (tags/chips) to distinguish them from actionable buttons.

## Components

### Buttons
Buttons use a solid fill for primary actions (Burgundy) and a 1px outline for secondary actions. They feature 4px rounded corners and `label-lg` typography. Ensure a minimum width of 120px for primary call-to-actions to maintain a strong presence.

### Input Fields
Fields are defined by a `border-subtle` outline. Labels use `label-md` and sit above the field. In error states, the border transitions to a semantic red, but the institutional Burgundy should not be used for errors to avoid brand confusion.

### Cards
Cards are the primary organizational unit for courses, grades, and news. They use a white background, a 1px `border-subtle`, and 8px corner radius. Content within cards should follow the 16px (`md`) internal padding rule.

### Chips & Badges
Used for status (e.g., "Regular," "Promoted," "Pending"). These are pill-shaped with a light tint of the status color and dark text to ensure high contrast and readability.

### Lists & Navigation
Academic records are presented in clean, divider-less lists using white-space to separate items. Navigation uses a persistent bottom bar on mobile with clear icons and `label-md` descriptors for the most frequent tasks: Home, Academic, Schedule, and Profile.