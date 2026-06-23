# Innlegg Design System

## 1. Color Palette

### Primary Colors
- **Primary**: #6366F1 (Indigo) - Main brand color
- **Primary Foreground**: #FFFFFF - Text on primary
- **Secondary**: #8B5CF6 (Purple) - Accent color
- **Secondary Foreground**: #FFFFFF - Text on secondary

### Semantic Colors
- **Success**: #10B981 (Green) - Positive actions
- **Warning**: #F59E0B (Amber) - Caution/alerts
- **Destructive**: #EF4444 (Red) - Dangerous actions
- **Info**: #3B82F6 (Blue) - Information

### Neutral Colors
- **Background**: #FFFFFF - Main background
- **Foreground**: #1F2937 - Primary text
- **Muted Foreground**: #6B7280 - Secondary text
- **Border**: #E5E7EB - Borders and dividers
- **Muted**: #F3F4F6 - Subtle backgrounds
- **Card**: #FFFFFF - Card backgrounds
- **Card Foreground**: #1F2937 - Card text

### Gradients
- **Purple Gradient**: from-purple-500 to-pink-500
- **Blue Gradient**: from-blue-500 to-cyan-500
- **Green Gradient**: from-green-500 to-emerald-500

## 2. Typography System

### Font Family
- **Primary Font**: Inter (sans-serif)
- **Fallback**: system-ui, -apple-system, sans-serif

### Font Sizes & Weights

#### Headings
- **H1**: 36px (2.25rem) | Bold (700)
- **H2**: 30px (1.875rem) | Bold (700)
- **H3**: 24px (1.5rem) | Semibold (600)
- **H4**: 20px (1.25rem) | Semibold (600)
- **H5**: 18px (1.125rem) | Semibold (600)
- **H6**: 16px (1rem) | Semibold (600)

#### Body Text
- **Body Large**: 18px (1.125rem) | Regular (400) | Line height: 1.75
- **Body Medium**: 16px (1rem) | Regular (400) | Line height: 1.5
- **Body Small**: 14px (0.875rem) | Regular (400) | Line height: 1.5
- **Body Extra Small**: 12px (0.75rem) | Regular (400) | Line height: 1.5

#### Labels
- **Label Medium**: 14px (0.875rem) | Medium (500)
- **Label Small**: 12px (0.75rem) | Medium (500) | Uppercase

## 3. Spacing System (4px Grid)

### Spacing Scale
- **xs**: 4px (0.25rem)
- **sm**: 8px (0.5rem)
- **md**: 12px (0.75rem)
- **lg**: 16px (1rem)
- **xl**: 24px (1.5rem)
- **2xl**: 32px (2rem)
- **3xl**: 48px (3rem)
- **4xl**: 64px (4rem)

### Padding Guidelines
- **Compact Cards**: 12px (md)
- **Standard Cards**: 16px (lg)
- **Spacious Cards**: 24px (xl)
- **Page Padding**: 32px (2xl) desktop, 16px (lg) mobile

### Gap Guidelines
- **Tight**: 8px (sm)
- **Normal**: 12px (md)
- **Loose**: 16px (lg)
- **Extra Loose**: 24px (xl)

## 4. Component Styling

### Cards
- **Border**: 1px solid border color
- **Border Radius**: 8px
- **Shadow**: 0 1px 3px rgba(0, 0, 0, 0.1)
- **Hover Shadow**: 0 4px 12px rgba(0, 0, 0, 0.15)
- **Transition**: all 200ms ease-in-out

### Buttons
- **Border Radius**: 6px
- **Padding**: 8px 16px (py-2 px-4)
- **Font Size**: 14px
- **Font Weight**: Medium (500)
- **Transition**: all 200ms ease-in-out
- **Focus Ring**: 2px ring with 2px offset

### Buttons - Variants
- **Primary**: bg-primary text-white hover:bg-primary/90
- **Secondary**: bg-secondary text-white hover:bg-secondary/90
- **Outline**: border border-border text-foreground hover:bg-muted
- **Ghost**: text-foreground hover:bg-muted
- **Danger**: bg-destructive text-white hover:bg-destructive/90

### Form Inputs
- **Border**: 1px solid border
- **Border Radius**: 6px
- **Padding**: 8px 12px (py-2 px-3)
- **Font Size**: 14px
- **Focus**: ring-2 ring-ring ring-offset-2
- **Placeholder**: text-muted-foreground
- **Transition**: colors 200ms ease-in-out

### Badges
- **Border Radius**: 9999px (full)
- **Padding**: 4px 10px (py-0.5 px-2.5)
- **Font Size**: 12px
- **Font Weight**: Medium (500)
- **Variants**: Primary, Secondary, Success, Warning, Danger

## 5. Shadows

### Shadow Levels
- **Shadow-sm**: 0 1px 2px rgba(0, 0, 0, 0.05)
- **Shadow-md**: 0 4px 6px rgba(0, 0, 0, 0.1)
- **Shadow-lg**: 0 10px 15px rgba(0, 0, 0, 0.1)
- **Shadow-xl**: 0 20px 25px rgba(0, 0, 0, 0.1)

## 6. Border Radius

### Radius Scale
- **sm**: 4px
- **md**: 6px
- **lg**: 8px
- **xl**: 12px
- **full**: 9999px

## 7. Animations & Transitions

### Transition Durations
- **Fast**: 150ms
- **Base**: 200ms
- **Slow**: 300ms
- **Extra Slow**: 500ms

### Easing Functions
- **ease-in-out**: cubic-bezier(0.4, 0, 0.2, 1)
- **ease-in**: cubic-bezier(0.4, 0, 1, 1)
- **ease-out**: cubic-bezier(0, 0, 0.2, 1)

### Animation Keyframes
- **fadeIn**: 0.3s ease-in-out
- **slideInUp**: 0.3s ease-in-out
- **slideInDown**: 0.3s ease-in-out
- **pulse-subtle**: 2s infinite

## 8. Accessibility

### Focus States
- **Focus Ring**: 2px solid ring-ring with 2px offset
- **Visible on all interactive elements**

### Color Contrast
- **WCAG AA**: Minimum 4.5:1 for text
- **WCAG AAA**: Minimum 7:1 for text

### Keyboard Navigation
- **Tab Order**: Logical, left-to-right, top-to-bottom
- **Focus Visible**: Always visible on keyboard navigation

## 9. Responsive Breakpoints

### Tailwind Breakpoints
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Mobile First Approach
- Design for mobile first
- Add features for larger screens
- Test on: 320px, 375px, 768px, 1024px, 1440px

## 10. Loading States

### Skeleton Loaders
- **Skeleton**: Base animated placeholder
- **SkeletonText**: Multi-line text placeholder
- **SkeletonCard**: Full card placeholder
- **Animation**: pulse 2s infinite

### Loading Spinners
- **Size**: 12px, 16px, 24px, 32px
- **Color**: Primary color
- **Animation**: spin 1s linear infinite

## 11. Empty States

### Empty State Components
- **Icon**: 64px, muted-foreground color
- **Title**: Heading-4, foreground color
- **Description**: Body-sm, muted-foreground color
- **Action Button**: Primary or secondary button

## 12. Error States

### Error Messages
- **Color**: Destructive color
- **Font Size**: 12px (body-xs)
- **Margin Top**: 4px
- **Icon**: Optional, 16px

### Error Toasts
- **Background**: Destructive color
- **Text**: White
- **Duration**: 4000ms
- **Position**: Top-right

## 13. Success States

### Success Messages
- **Color**: Success color
- **Font Size**: 12px (body-xs)
- **Margin Top**: 4px

### Success Toasts
- **Background**: Success color
- **Text**: White
- **Duration**: 3000ms
- **Position**: Top-right

## Implementation Guidelines

1. **Always use design tokens** - Never hardcode colors, sizes, or spacing
2. **Maintain consistency** - Use the same components across pages
3. **Test accessibility** - Ensure WCAG AA compliance
4. **Mobile first** - Design for small screens first
5. **Performance** - Optimize animations and transitions
6. **Responsive** - Test on all breakpoints
7. **User feedback** - Show loading, success, and error states clearly
