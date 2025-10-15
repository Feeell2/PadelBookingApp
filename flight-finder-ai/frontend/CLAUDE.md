# Frontend - Claude Development Guide

React 19 + Vite frontend for Flight Finder AI with semantic CSS architecture.

## Quick Start

```bash
npm run dev        # Development server (Vite)
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint check
```

## Stack

- **Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.7
- **Language**: TypeScript 5.9
- **HTTP Client**: Axios 1.12.2
- **Icons**: Lucide React 0.545.0
- **Styling**: Semantic CSS (NO Tailwind)

## Critical Rules

### 1. Use Semantic CSS Classes Only (NO Tailwind)

```tsx
✅ <button className="search-button">Search</button>
✅ <div className="flight-card">...</div>
✅ <span className="weather-badge weather-badge-sunny">Sunny</span>

❌ <button className="px-6 py-3 bg-blue-500 rounded-lg">  // Never use utility classes
❌ <div className="flex flex-col gap-4">
```

**Why**: Better maintainability, centralized styling, easier theming, cleaner JSX.

### 2. All Styles Go in `index.css`

```css
/* ✅ Good: Semantic classes in index.css */
.search-button {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
}

.flight-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

/* ❌ Bad: Inline styles or Tailwind classes */
```

### 3. Use TypeScript Types from `types/index.ts`

```typescript
✅ import type { UserPreferences, AgentResponse, FlightOffer } from './types'

// Use types for props and state
const [results, setResults] = useState<AgentResponse | null>(null);

function FiltersBar({ onSearch, loading }: FiltersBarProps) {
  // ...
}
```

## Architecture

### File Structure

```
src/
├── App.tsx                      # Main app, state management, error handling
├── main.tsx                     # React entry point, StrictMode
├── index.css                    # All styles (golden ratio design system)
├── components/
│   ├── FiltersBar.tsx          # Budget, origin, style, weather inputs
│   ├── AgentThinking.tsx       # Loading animation
│   ├── ResultsSection.tsx      # AI reasoning + flight grid
│   ├── FlightCard.tsx          # Individual flight with weather
│   └── WeatherBadge.tsx        # Weather condition badge
├── services/
│   └── api.ts                  # Axios client, API calls
└── types/
    └── index.ts                # TypeScript interfaces
```

### Component Flow

```
App.tsx
    ↓ State: loading, results, error
    ├─→ FiltersBar.tsx
    │     ↓ User fills form
    │     ↓ onSearch(preferences)
    │         ↓ api.searchFlights()
    │             ↓ POST /api/flights/search
    │
    ├─→ AgentThinking.tsx (if loading)
    │
    ├─→ ResultsSection.tsx (if results)
    │     ↓ Displays reasoning (markdown)
    │     ↓ Maps over recommendations
    │         ↓ FlightCard.tsx (for each flight)
    │               ↓ WeatherBadge.tsx (weather icon/temp)
    │
    └─→ Error State (if error)
```

## Components

### App.tsx

**Purpose**: Root component with state management and error handling.

**State**:
```typescript
const [loading, setLoading] = useState(false);
const [results, setResults] = useState<AgentResponse | null>(null);
const [error, setError] = useState<string | null>(null);
```

**Key Functions**:
```typescript
handleSearch(preferences: UserPreferences)  // API call, state updates
handleReset()                               // Clear results and errors
```

### FiltersBar.tsx

**Purpose**: User input form for search preferences.

**Inputs**:
- Budget (0-50000 PLN) with range slider
- Origin airport (WAW, KRK, GDN, MAD)
- Travel style (adventure, relaxation, culture, party, nature)
- Optional: Preferred destinations (comma-separated)
- Optional: Departure/return dates

**Validation**:
- Budget must be > 0
- Origin must be selected
- Travel style must be selected

### AgentThinking.tsx

**Purpose**: Loading animation while AI processes request.

**Features**:
- Animated plane icon
- Pulsing glow effect
- Loading message with dots animation
- Average processing time: 2-4 seconds

### ResultsSection.tsx

**Purpose**: Display AI reasoning and flight recommendations.

**Structure**:
```tsx
<ResultsSection results={results}>
  {/* AI Reasoning - Markdown formatted */}
  <div className="reasoning-box">
    {results.reasoning}  {/* Why these flights? Budget analysis, etc. */}
  </div>

  {/* Flight Grid */}
  <div className="flight-grid">
    {results.recommendations.map(flight => (
      <FlightCard key={flight.id} flight={flight} />
    ))}
  </div>

  {/* Execution Stats */}
  <div className="stats-bar">
    Execution time: {results.executionTime}ms
    Tools used: {results.toolsUsed.join(', ')}
  </div>
</ResultsSection>
```

### FlightCard.tsx

**Purpose**: Individual flight offer with weather information.

**Data Displayed**:
- Destination city + country
- Price in PLN
- Airline
- Departure/return dates
- Duration
- Stops (Direct / 1 stop / 2 stops)
- Weather: Temperature, condition, precipitation

**Interactive**:
- Hover effects (lift + shadow)
- Click to expand (future feature)

### WeatherBadge.tsx

**Purpose**: Visual weather indicator with icon and temperature.

**Conditions**:
- Sunny → Sun icon, orange gradient
- Rainy → Cloud + rain icon, blue gradient
- Cloudy → Cloud icon, gray gradient
- Snowy → Snowflake icon, white gradient

## Services

### api.ts

**Purpose**: Centralized API client with error handling.

**Configuration**:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,  // 60s for AI processing
});
```

**Functions**:
```typescript
searchFlights(preferences: UserPreferences): Promise<AgentResponse>
healthCheck(): Promise<boolean>
```

**Error Handling**:
- Axios errors → Extract message from response
- Network errors → Show friendly message
- Timeout errors → "Request took too long"

## Types

### UserPreferences

```typescript
interface UserPreferences {
  budget: number;
  origin: string;
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  preferredDestinations?: string[];
  departureDate?: string;
  returnDate?: string;
}
```

### AgentResponse

```typescript
interface AgentResponse {
  recommendations: FlightOffer[];
  reasoning: string;           // Markdown
  executionTime: number;       // Milliseconds
  toolsUsed: string[];
}
```

### FlightOffer

```typescript
interface FlightOffer {
  id: string;
  destination: string;
  destinationCode: string;
  origin: string;
  price: number;
  currency: string;
  departureDate: string;       // YYYY-MM-DD
  returnDate: string;          // YYYY-MM-DD
  airline: string;
  duration: string;            // "5h 30m"
  stops: number;
  weatherData?: WeatherData;
}
```

## Design System

### Color Palette

```css
/* Primary Gradient (AI Theme) */
--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--color-primary: #667eea;
--color-primary-dark: #764ba2;

/* Semantic Colors */
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-info: #3b82f6;

/* Neutrals */
--color-background: #f8fafc;
--color-surface: #ffffff;
--color-text: #1e293b;
--color-text-secondary: #64748b;
```

### Spacing (Golden Ratio: φ ≈ 1.618)

```css
/* Base: 16px, then multiply/divide by φ */
--space-xs: 0.618rem;   /* 10px */
--space-sm: 1rem;       /* 16px */
--space-md: 1.618rem;   /* 26px */
--space-lg: 2.618rem;   /* 42px */
--space-xl: 4.236rem;   /* 68px */
```

### Typography

```css
/* Font Sizes (Golden Ratio Scale) */
--font-xs: 0.75rem;     /* 12px */
--font-sm: 0.875rem;    /* 14px */
--font-base: 1rem;      /* 16px */
--font-lg: 1.25rem;     /* 20px */
--font-xl: 1.618rem;    /* 26px */
--font-2xl: 2.618rem;   /* 42px */
--font-3xl: 4.236rem;   /* 68px */
```

### Border Radius

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

## Environment Variables

Create `frontend/.env`:

```bash
# Backend API URL
VITE_API_URL=http://localhost:3001

# Optional: Analytics, feature flags, etc.
```

**Critical**: Use `VITE_` prefix for Vite to expose variables to client.

## Common Issues

### 1. API Connection Refused

**Problem**: Backend not running or wrong URL

**Solution**:
```bash
# Check backend is running
cd backend && npm run dev

# Verify .env has correct URL
VITE_API_URL=http://localhost:3001  # Not 5173!
```

### 2. Tailwind Classes Not Working

**Problem**: Tailwind is NOT installed (by design)

**Solution**: Use semantic classes from `index.css`:
```tsx
// Change this:
<div className="flex gap-4 p-6">

// To this:
<div className="content-container">  // Define in index.css
```

### 3. TypeScript Errors on Import

**Problem**: Missing type definitions

**Solution**:
```typescript
// Add to types/index.ts
export interface YourInterface {
  // ...
}

// Import with 'type' keyword
import type { YourInterface } from './types'
```

### 4. Axios Timeout on Search

**Problem**: AI processing takes longer than default timeout

**Solution**: Already handled (60s timeout), but if needed:
```typescript
const apiClient = axios.create({
  timeout: 90000,  // Increase to 90s
});
```

## Performance

- **Initial load**: <500ms (Vite dev server)
- **Production build**: ~1MB gzipped
- **API response**: 2-4s (AI processing)
- **UI update**: <16ms (60 FPS)

## Development Tips

1. **Hot Module Replacement**: Vite automatically reloads on file changes
2. **React DevTools**: Install browser extension for debugging
3. **Network Tab**: Monitor API calls in browser DevTools
4. **Console Errors**: Check browser console for runtime errors
5. **Type Safety**: Let TypeScript catch errors before runtime

## Testing API Integration

```typescript
// Test API connection
import { healthCheck } from './services/api';

const isHealthy = await healthCheck();
console.log('Backend health:', isHealthy);

// Test search
import { searchFlights } from './services/api';

const results = await searchFlights({
  budget: 500,
  origin: 'WAW',
  travelStyle: 'culture',
});

console.log('Recommendations:', results.recommendations);
console.log('Reasoning:', results.reasoning);
```

## Documentation

- **[../docs/API.md](../docs/API.md)** - Backend API reference
- **[../docs/CLAUDE.md](../docs/CLAUDE.md)** - Project-wide guidance
- **[../docs/CHANGELOG.md](../docs/CHANGELOG.md)** - Version history
