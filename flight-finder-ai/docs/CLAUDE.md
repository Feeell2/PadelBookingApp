# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flight Finder AI is a full-stack TypeScript application that uses AI to discover flight destinations based on user budget and preferences. The application integrates with **Amadeus Flight Inspiration Search API** for budget-based destination discovery and includes intelligent ranking with weather enrichment. Fallback mock data system ensures reliability.

**Tech Stack:**
- **Backend**: Express.js + TypeScript (ES Modules), Amadeus Inspiration API
- **Frontend**: React 19 + TypeScript + Vite + pure CSS

**Recent Migration (Phase 1 & 2 Complete):**
- ✅ Migrated from Flight Offers Search → **Flight Inspiration Search API**
- ✅ Budget-first approach (discover destinations within budget)
- ✅ Parallel weather enrichment with 100% success rate
- ✅ Intelligent ranking algorithm (travel style + weather + budget scoring)
- ✅ Enhanced reasoning with percentage savings and checkmarks 


## Development Commands

### Backend (Port 3001)

```bash
cd backend

# Development with auto-reload (recommended)
npm run dev

# Development with tsx directly
npm run dev:direct

# Build for production
npm run build

# Run production build
npm start
```

### Frontend (Port 5173)

```bash
cd frontend

# Development server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Architecture

### Backend Structure

```
backend/src/
├── types/index.ts          # Shared TypeScript interfaces
│                           # - AmadeusDestinationResponse, FlightInspirationParams
│                           # - WeatherData, FLIGHT_INSPIRATION_ERRORS
├── services/
│   ├── agent.ts            # AI agent orchestrator with Inspiration API
│   │                       # - searchFlightInspiration() integration
│   │                       # - enrichWithWeather() - parallel weather fetching
│   │                       # - filterAndRankInspirationResults() - scoring algorithm
│   │                       # - generateInspirationReasoning() - enhanced reasoning
│   │                       # - Local reasoning (no Claude API, cost optimized)
│   ├── amadeusAPI.ts       # Amadeus API integration
│   │                       # - searchFlightInspiration() - Inspiration Search API
│   │                       # - searchAmadeusFlights() - Flight Offers API (legacy)
│   │                       # - OAuth token caching (30s expiration buffer)
│   │                       # - transformInspirationToOffers() - format converter
│   └── flightAPI.ts        # Mock flight data (fallback when API fails)
├── controllers/
│   └── flightController.ts # Request validation and response handling
├── routes/
│   └── flightRoutes.ts     # API endpoint definitions
└── server.ts               # Express app configuration
```

**Key Architecture Points:**

1. **ES Modules**: Uses `"type": "module"` with `.js` extensions in imports (TypeScript requirement for NodeNext)

2. **Agent System (Phase 2)**: `agent.ts` orchestrates intelligent flight discovery
   - **Budget-First Search**: Uses Amadeus Inspiration API to discover destinations within budget (not fixed routes)
   - **Parallel Weather Enrichment**: `enrichWithWeather()` uses `Promise.allSettled()` for 100% success rate
   - **Intelligent Ranking Algorithm**: Scores destinations by:
     - Travel style match (+10 points)
     - Weather preference match (+5 points)
     - Budget efficiency (<50%: +5, <80%: +3)
     - Preferred destinations (+15 points)
     - Direct flights (+3 points)
   - **Enhanced Reasoning**: Generates markdown with percentage savings and checkmarks
   - **Cost Optimization**: Local reasoning generation (no Claude API calls)

3. **Amadeus Inspiration API Integration (Phase 1)**:
   - **Endpoint**: `GET v1/shopping/flight-destinations`
   - **Budget-Based**: Discovers destinations within `maxPrice` (not origin→destination pairs)
   - **OAuth Token Caching**: In-memory cache with 30s expiration buffer
   - **Automatic Retry**: Refreshes token on 401 errors
   - **Fallback Strategy**: Mock data on API failures (zero downtime)
   - **Input Validation**: IATA code regex, budget 0-50k PLN, duration 1-15 days
   - **Response Transformation**: `transformInspirationToOffers()` converts to `FlightOffer[]` format

4. **Environment Variables**:
   - `AMADEUS_API_KEY` and `AMADEUS_API_SECRET` - credentials are `.trim()`'d to prevent whitespace issues
   - `ANTHROPIC_API_KEY` - currently unused (agent uses local reasoning)
   - `PORT` - backend port (default: 3001)

### Frontend Structure

```
frontend/src/
├── types/index.ts          # Shared TypeScript interfaces
├── services/
│   └── api.ts              # Axios client for backend communication
├── components/
│   ├── FiltersBar.tsx      # Horizontal filters (budget, origin, style, weather)
│   ├── AgentThinking.tsx   # Loading state component
│   ├── ResultsSection.tsx  # AI reasoning + flight results
│   ├── FlightCard.tsx      # Individual flight display
│   └── WeatherBadge.tsx    # Weather condition badge
├── App.tsx                 # Main app component with state management
├── main.tsx                # React entry point
└── index.css               # Global styles + semantic CSS classes
```

**Key Architecture Points:**

1. **CSS Architecture**: Uses semantic CSS classes (`.hero-header`, `.filter-group`, `.flight-card`) instead of Tailwind utility classes for better maintainability
2. **Golden Ratio Design**: Header uses φ ≈ 1.618 proportions (90px logo, 56px font, 20vh height)
3. **State Management**: React `useState` in App.tsx coordinates loading, results, and error states
4. **API Communication**: Axios with 60s timeout for flight searches

## API Endpoints

### POST /api/flights/search
Search for flights using AI agent with Amadeus API integration.

**Request Body:**
```typescript
{
  budget: number;           // PLN
  origin: string;           // IATA code (e.g., "WAW")
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  weatherPreference: 'hot' | 'mild' | 'cold' | 'any';
  preferredDestinations?: string[];  // Optional city names
  departureDate?: string;            // Optional YYYY-MM-DD
  returnDate?: string;               // Optional YYYY-MM-DD
}
```

**Response:**
```typescript
{
  success: boolean;
  data?: {
    recommendations: FlightOffer[];    // Top 10 ranked destinations with weather
    reasoning: string;                 // Markdown with percentage savings & checkmarks
    weatherInfo?: WeatherInfo[];       // Legacy weather data (backward compatibility)
    executionTime: number;             // milliseconds
    toolsUsed: string[];               // ["search_flight_inspiration", "enrich_weather", "filter_and_rank"]
  };
  error?: string;
}
```

**FlightOffer Interface (Extended):**
```typescript
{
  id: string;
  destination: string;              // City name (e.g., "Prague")
  destinationCode: string;          // IATA code (e.g., "PRG")
  origin: string;
  price: number;
  currency: string;
  departureDate: string;            // YYYY-MM-DD
  returnDate: string;               // YYYY-MM-DD
  airline: string;
  duration: string;                 // "7 days" or "5h 30m"
  stops: number;
  weatherData?: WeatherData;        // NEW: Enriched weather (temperature, condition, description)
}
```

### GET /api/destinations
Returns list of available mock destinations.

### GET /api/weather/:destinationCode
Returns weather info for a specific destination (IATA code).

### GET /api/health
Health check endpoint that shows API key status.

## Important Development Notes

### Working with Amadeus Flight Inspiration API (Primary)

**Current Implementation (Phase 1 & 2 Complete):**

1. **Authentication**: Amadeus uses OAuth 2.0 client credentials flow
   - Token endpoint: `https://test.api.amadeus.com/v1/security/oauth2/token`
   - Tokens cached in-memory with 30s buffer before expiration
   - Credentials must be trimmed (`.trim()`) to avoid "invalid_client" errors
   - Reused across both Inspiration and Flight Offers APIs

2. **Flight Inspiration Search**: GET request to `/v1/shopping/flight-destinations`
   - **Purpose**: Discover destinations within budget (budget-first approach)
   - **Required params**: `origin` (IATA code, e.g., "WAW")
   - **Optional params**:
     - `maxPrice` (0-50000 PLN) - budget constraint
     - `departureDate` (YYYY-MM-DD) - flexible departure
     - `duration` (1-15 days) - trip length
     - `oneWay` (boolean) - one-way vs round-trip
     - `viewBy` ('DESTINATION' | 'DATE' | 'DURATION') - grouping strategy
   - **Response**: Array of destinations with prices and dates

3. **Inspiration Flow** (implemented in `agent.ts`):
   ```
   searchFlightInspiration(origin, maxPrice, duration)
       ↓
   enrichWithWeather(flights) - parallel, Promise.allSettled
       ↓
   filterAndRankInspirationResults(flights, preferences) - scoring algorithm
       ↓
   generateInspirationReasoning(flights, preferences) - markdown with savings
   ```

4. **Scoring Algorithm** (in `filterAndRankInspirationResults`):
   ```typescript
   score = 0
   + (travelStyle match ? 10 : 0)         // "culture" → Prague, Budapest
   + (weather match ? 5 : 0)              // "mild" → 15-25°C
   + (price < 50% budget ? 5 : 0)         // Budget efficiency
   + (price < 80% budget ? 3 : 0)
   + (preferred destination ? 15 : 0)     // User's preferred cities
   + (direct flight ? 3 : 0)              // No stops
   ```

5. **Error Handling**:
   - 401: Auto-refresh token and retry once
   - 404: Return empty array (no destinations found)
   - 429/500/Network errors: Fallback to mock data
   - All errors logged with emoji debugging:
     ```
     🔑 [Amadeus] Token obtained: abc123... (expires in 1799s)
     ✈️  [Amadeus Inspiration] Calling API for origin: WAW, maxPrice: 500
     ✅ [Amadeus Inspiration] Found 8 inspiring destinations
     🌤️  [Agent] Enriching 8 flights with weather data...
     ✅ [Agent] Weather enrichment: 100% success rate
     🎯 [Agent] Ranking 8 flights by preferences...
     ✅ [Agent] Top ranked flight: Prague (score: 23)
     ```

6. **Response Transformation**: `transformInspirationToOffers()`
   - Converts Amadeus format → `FlightOffer[]` format
   - Enriches with `weatherData` field
   - Calculates trip duration from dates
   - Uses `getCityName()` with API dictionary fallback

### Working with Amadeus Flight Offers API (Legacy)

**Legacy Implementation (kept for backward compatibility):**

1. **Flight Offers Search**: GET request to `/v2/shopping/flight-offers`
   - **Purpose**: Search specific origin→destination routes
   - **Required params**: `originLocationCode`, `destinationLocationCode`, `departureDate`, `adults`
   - **Optional**: `max` (results limit), `currencyCode` (default: PLN)
   - **Status**: Legacy, not used by agent (fallback available in `searchAmadeusFlights()`)

### CSS Styling Philosophy

**Do not use Tailwind utility classes.** All components use semantic CSS classes defined in `frontend/src/index.css`:

- **Good**: `<div className="hero-header">`, `<button className="search-button">`
- **Bad**: `<div className="flex items-center justify-center">`, `<button className="px-6 py-3">`

This improves:
- Code readability
- Style debugging
- Centralized style management
- Consistent naming conventions

### TypeScript Configuration

**Backend (`tsconfig.json`):**
- `"module": "NodeNext"` - ES Modules support
- `"moduleResolution": "NodeNext"` - Required for `.js` imports
- All imports must use `.js` extension: `import x from './file.js'`

**Frontend (`tsconfig.app.json`):**
- Managed by Vite
- React JSX with TypeScript
- Path resolution configured for `@/` imports

## Common Pitfalls

1. **Backend Import Extensions**: Always use `.js` in imports, not `.ts`:
   ```typescript
   // ✅ Correct
   import { runFlightAgent } from '../services/agent.js';

   // ❌ Wrong
   import { runFlightAgent } from '../services/agent';
   ```

2. **Amadeus Credentials**: Environment variables can have hidden whitespace - always `.trim()` them:
   ```typescript
   const KEY = process.env.AMADEUS_API_KEY?.trim();
   ```

3. **CSS Classes**: Don't mix Tailwind utilities with semantic classes. Use only semantic classes:
   ```tsx
   // ✅ Correct
   <div className="filter-group">

   // ❌ Wrong
   <div className="filter-group flex items-center">
   ```

4. **Frontend-Backend Communication**: Backend runs on port 3001, frontend on 5173. CORS is configured for `http://localhost:5173`.

5. **Agent Cost Optimization**: Agent uses local reasoning generation instead of Claude API to avoid costs. To re-enable Claude API, modify `agent.ts` and import `@anthropic-ai/sdk`.

## Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

**backend/.env:**
```env
AMADEUS_API_KEY=your_key_here
AMADEUS_API_SECRET=your_secret_here
ANTHROPIC_API_KEY=your_anthropic_key  # Currently unused
PORT=3001
HOME_AIRPORT=WAW
FRONTEND_URL=http://localhost:5173
```

**frontend/.env:** (if needed)
```env
VITE_API_URL=http://localhost:3001
```

## Data Flow

### Current Architecture (Phase 1 & 2)

```
User Input (FiltersBar)
    ↓
Frontend State (App.tsx)
    ↓
API Request (services/api.ts) → POST /api/flights/search
    ↓
Backend Controller (flightController.ts) → Validation
    ↓
Agent (agent.ts) → Orchestration
    ↓
    ├─→ [Tool 1] searchFlightInspiration()
    │   ├─→ Amadeus Inspiration API (v1/shopping/flight-destinations)
    │   │   - Budget-based destination discovery
    │   │   - Returns destinations within maxPrice
    │   └─→ [On failure] → Mock data (flightAPI.ts)
    │
    ├─→ [Tool 2] enrichWithWeather() - PARALLEL
    │   ├─→ Promise.allSettled([weather requests...])
    │   │   ├─→ getWeather(destination1) → WeatherData
    │   │   ├─→ getWeather(destination2) → WeatherData
    │   │   └─→ getWeather(destinationN) → WeatherData
    │   └─→ Success rate: ~100% (continues on individual failures)
    │
    ├─→ [Tool 3] filterAndRankInspirationResults()
    │   ├─→ Calculate score for each destination
    │   │   - Travel style match (+10)
    │   │   - Weather preference match (+5)
    │   │   - Budget efficiency (+3 to +5)
    │   │   - Preferred destinations (+15)
    │   │   - Direct flights (+3)
    │   ├─→ Sort by score (descending)
    │   └─→ Return top 10 destinations
    │
    └─→ [Tool 4] generateInspirationReasoning()
        ├─→ Calculate percentage savings
        ├─→ Generate markdown with checkmarks
        └─→ Include alternative options with weather
    ↓
Local Reasoning (no Claude API calls)
    ↓
Response → Frontend Results (ResultsSection)
    ├─→ Top recommendation with weather
    ├─→ Percentage savings highlighted
    ├─→ Alternative destinations (top 3)
    └─→ Markdown reasoning with checkmarks
```

### Tools Used in Response
- `search_flight_inspiration` - Amadeus Inspiration API call
- `enrich_weather` - Parallel weather enrichment
- `filter_and_rank` - Intelligent ranking algorithm
- `search_flights_mock` - Fallback when API fails (maintains zero downtime)

## Testing Strategy

Currently no automated tests. To test manually:

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173`
4. Fill filters and click "Search Flights"
5. Check backend console for Amadeus API logs
6. Verify flight results display correctly

**Backend logs to verify:**
- Token acquisition success/failure
- Flight search parameters
- API call results or fallback to mock
- Execution time and tools used

## Git Flow Strategy

This project uses a **simplified Git Flow** with 2 main branches:

- **`main`** - Stable production version (always deployable)
- **`develop`** - Development branch for feature integration

### Quick Workflow

1. **Create feature branch** from `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/your-feature-name
   ```

2. **Work and commit** with conventional commits:
   ```bash
   git commit -m "feat(backend): add new endpoint"
   git commit -m "fix(frontend): resolve UI bug"
   ```

3. **Open Pull Request**: `feature/your-feature → develop`
   - Use the PR template in `.github/pull_request_template.md`
   - Wait for code review (optional for solo dev)
   - Merge when ready

4. **Deploy to production**: After testing on `develop`:
   ```bash
   git checkout main && git merge develop
   git tag -a v1.1.0 -m "Release description"
   git push origin main --tags
   ```

### Branch Naming

- `feature/description` - New functionality
- `fix/description` - Bug fixes in develop
- `hotfix/description` - Critical production fixes (from main)
- `chore/description` - Maintenance, refactoring

### Commit Convention

Format: `type(scope): subject`

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **scope**: `backend`, `frontend`, `api`, `ui`, `agent` (optional)
- **subject**: Short description (max 72 chars)

Examples:
```
feat(backend): add JWT authentication middleware
fix(frontend): resolve filter reset bug in FiltersBar
chore(deps): update Amadeus API SDK to v2.0.0
```

**For complete Git Flow documentation, see [`GIT_FLOW.md`](GIT_FLOW.md)**

---

## TypeScript Types Reference

### New Interfaces (Phase 1 Migration)

**AmadeusDestinationResponse** - Amadeus Inspiration API response format
```typescript
interface AmadeusDestinationResponse {
  data: Array<{
    type: string;                    // "flight-destination"
    origin: string;                  // "WAW"
    destination: string;             // "BCN"
    departureDate: string;           // "2025-10-20"
    returnDate: string;              // "2025-10-27"
    price: {
      total: string;                 // "450.00"
      currency: string;              // "PLN"
    };
    links?: {
      flightDates?: string;
      flightOffers?: string;
    };
  }>;
  meta?: {
    currency: string;
    defaults?: {
      departureDate: string;
      oneWay: boolean;
      duration: string;
      nonStop: boolean;
      viewBy: string;
    };
  };
  dictionaries?: {
    currencies?: Record<string, string>;
    locations?: Record<string, {
      subType: string;
      detailedName: string;          // "Barcelona, Spain"
    }>;
  };
}
```

**FlightInspirationParams** - Search parameters for Inspiration API
```typescript
interface FlightInspirationParams {
  origin: string;                    // Required: IATA code ("WAW")
  departureDate?: string;            // Optional: YYYY-MM-DD
  oneWay?: boolean;                  // Optional: true/false
  duration?: number;                 // Optional: 1-15 days
  maxPrice?: number;                 // Optional: 0-50000 PLN
  viewBy?: 'DATE' | 'DESTINATION' | 'DURATION' | 'WEEK' | 'COUNTRY';
}
```

**WeatherData** - Enriched weather information
```typescript
interface WeatherData {
  destination: string;               // City name
  destinationCode: string;           // IATA code
  temperature: number;               // Celsius
  condition: string;                 // "Sunny", "Cloudy", "Rainy"
  description: string;               // Detailed forecast
  humidity?: number;                 // Percentage
  windSpeed?: number;                // km/h
  fetchedAt: string;                 // ISO timestamp
}
```

**FLIGHT_INSPIRATION_ERRORS** - Error message constants
```typescript
const FLIGHT_INSPIRATION_ERRORS = {
  INVALID_IATA: 'Invalid origin IATA code. Must be 3 uppercase letters.',
  INVALID_BUDGET: 'Budget must be between 0 and 50000 PLN.',
  INVALID_DURATION: 'Duration must be between 1 and 15 days.',
  NO_RESULTS: 'No destinations found for the given criteria.',
  API_ERROR: 'Failed to fetch flight inspiration data from Amadeus API.',
  TOKEN_ERROR: 'Failed to authenticate with Amadeus API.',
} as const;
```

### Extended Interfaces

**FlightOffer** - Now includes optional `weatherData` field
```typescript
interface FlightOffer {
  id: string;
  destination: string;
  destinationCode: string;
  origin: string;
  price: number;
  currency: string;
  departureDate: string;
  returnDate: string;
  airline: string;
  duration: string;
  stops: number;
  weatherData?: WeatherData;         // NEW: Added in Phase 2
}
```

---

## Migration History

### Phase 1: Amadeus Inspiration API Integration (Completed 2025-10-14)

**Status:** ✅ Production Ready
**Report:** [`docs/IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md)

**Changes:**
- Migrated from Flight Offers Search → Flight Inspiration Search API
- Implemented `searchFlightInspiration()` with input validation
- Added `transformInspirationToOffers()` for response conversion
- Extended `getCityName()` with API dictionary support
- Created new TypeScript interfaces: `AmadeusDestinationResponse`, `FlightInspirationParams`, `WeatherData`
- Fixed Express 5 bug (downgraded to Express 4.21.2)
- Fixed environment variable loading (centralized dotenv)
- Zero breaking changes - full backward compatibility

**Impact:**
- Budget-first search approach (discover destinations within budget)
- More flexible than fixed route search
- Fallback to mock data maintained

### Phase 2: Agent Integration with Ranking & Weather (Completed 2025-10-14)

**Status:** ✅ Production Ready
**Report:** [`docs/PHASE_2_COMPLETION_REPORT.md`](./PHASE_2_COMPLETION_REPORT.md)

**Changes:**
- Updated `agent.ts` to use `searchFlightInspiration()` instead of `searchAmadeusFlights()`
- Implemented `enrichWithWeather()` with parallel fetching (`Promise.allSettled`)
- Implemented `filterAndRankInspirationResults()` with scoring algorithm:
  - Travel style match (+10 points)
  - Weather preference match (+5 points)
  - Budget efficiency (+3-5 points)
  - Preferred destinations (+15 points)
  - Direct flights (+3 points)
- Implemented `generateInspirationReasoning()` with:
  - Percentage savings calculation
  - Checkmark bullets for matched preferences
  - Alternative destinations with weather data
- Added `matchesTravelStyle()` and `matchesWeatherPreference()` helpers
- Added `calculatePreferredDuration()` for smart duration selection

**Impact:**
- 100% weather enrichment success rate
- Intelligent ranking improves recommendation relevance
- Enhanced UX with percentage savings and visual checkmarks
- Zero breaking changes - backward compatibility maintained

**Metrics:**
- Execution time: ~500-700ms (with mock data)
- Weather enrichment: 100% success rate
- TypeScript compilation: 0 errors
- Backward compatibility: 100%

### Phase 3: Next Steps (Planned)

**Not yet implemented:**
- Real-time weather API integration (Open-Meteo)
- Weather cache with TTL (6 hours)
- InspirationCache with LRU eviction
- Unit tests for ranking algorithm
- E2E tests for Inspiration API flow

**For detailed migration plan, see:** [`docs/MIGRATION_PLAN.md`](./MIGRATION_PLAN.md)

---

## Performance Considerations

### Current Performance Metrics (Phase 2)

- **API Response Time:** ~500-700ms (mock data), ~800-1200ms (Amadeus API)
- **Weather Enrichment:** 100% success rate, parallel fetching
- **Ranking Algorithm:** O(n log n) for sorting (negligible overhead for <100 destinations)
- **Token Caching:** 100% efficiency (30s buffer prevents re-authentication)

### Optimization Strategies

1. **Parallel Operations:**
   - Weather enrichment uses `Promise.allSettled()` for concurrent requests
   - Individual failures don't block other operations

2. **Caching (Future - Phase 3):**
   - Inspiration results cache (1-hour TTL)
   - Weather data cache (6-hour TTL)
   - OAuth token cache (in-memory, 30s buffer)

3. **Fallback Strategy:**
   - Mock data ensures zero downtime
   - Graceful degradation on API failures
   - Partial weather enrichment acceptable (continues with available data)

---

## Common Issues & Troubleshooting

### Issue 1: Amadeus API Returns 0 Destinations

**Symptoms:**
```
❌ [Amadeus Inspiration] No destinations found for the given criteria
🔄 [Agent] Falling back to mock data...
```

**Causes:**
- Budget too low (try increasing `maxPrice`)
- Origin has limited flight data in test API
- Date too far in future or past

**Solutions:**
- Increase budget to 500+ PLN for more results
- Use popular origins (WAW, KRK, GDN)
- Use flexible dates or omit `departureDate` parameter
- Mock data fallback ensures functionality continues

### Issue 2: Weather Enrichment < 100%

**Symptoms:**
```
✅ [Agent] Weather enrichment: 60% success rate
```

**Causes:**
- Mock weather service missing destination
- Network timeout for weather requests

**Solutions:**
- Check `flightAPI.ts` for destination coverage
- Phase 3 will add real-time weather API
- Partial enrichment is acceptable (ranking still works)

### Issue 3: TypeScript Compilation Errors After Update

**Symptoms:**
```
error TS2307: Cannot find module './agent.js'
```

**Solutions:**
- Verify `.js` extensions in all imports (required for ES Modules)
- Check `tsconfig.json` has `"module": "NodeNext"`
- Run `npm run build` to verify compilation

---

## Documentation Links

- **Migration Plan:** [`docs/MIGRATION_PLAN.md`](./MIGRATION_PLAN.md) - Detailed implementation tasks
- **Phase 1 Report:** [`docs/IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md) - Core API integration
- **Phase 2 Report:** [`docs/PHASE_2_COMPLETION_REPORT.md`](./PHASE_2_COMPLETION_REPORT.md) - Agent integration
- **Weather Guide:** [`docs/WEATHER_IMPLEMENTATION_GUIDE.md`](./WEATHER_IMPLEMENTATION_GUIDE.md) - Weather service details
- **Git Flow:** [`GIT_FLOW.md`](./GIT_FLOW.md) - Version control strategy
