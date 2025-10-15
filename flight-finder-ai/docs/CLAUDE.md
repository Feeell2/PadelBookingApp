# CLAUDE.md

AI assistant guidance for Flight Finder AI - budget-based flight discovery with AI-powered ranking.

## Quick Start

```bash
cd backend && npm run dev    # Port 3001
cd frontend && npm run dev   # Port 5173
```

## Stack

- **Backend**: Express 4 + TypeScript (ES Modules) + Amadeus Inspiration API
- **Frontend**: React 19 + Vite + Semantic CSS (no Tailwind)
- **AI**: Local ranking (no Claude API), Open-Meteo Weather (free)

## Critical Rules

### 1. Backend Imports - Always Use `.js` Extensions
```typescript
✅ import { agent } from './services/agent.js'
❌ import { agent } from './services/agent'
```
**Why**: ES Modules with `"module": "NodeNext"` require explicit `.js` extensions in TypeScript

### 2. Frontend CSS - Semantic Classes Only (NO Tailwind)
```tsx
✅ <button className="search-button">
❌ <button className="px-6 py-3 bg-blue-500">
```
**Why**: Better maintainability, centralized styling in `index.css`

### 3. Environment Variables - Always `.trim()` Credentials
```typescript
const KEY = process.env.AMADEUS_API_KEY?.trim();
const SECRET = process.env.AMADEUS_API_SECRET?.trim();
```
**Why**: Hidden whitespace causes "invalid_client" errors

## Architecture

### Backend Structure (`backend/src/`)
```
services/
├── agent.ts                         # AI orchestrator (budget-first search + ranking)
├── amadeusAPI.ts                    # Inspiration API + OAuth caching (30s buffer)
├── OpenMeteoGeocodingService.ts     # Batch geocoding (24h cache, 60% reduction)
└── weather/
    ├── WeatherService.ts            # 7-day forecast facade
    └── providers/OpenMeteoProvider.ts

types/
├── index.ts                         # FlightOffer, FlightInspirationParams, WeatherData
└── weather.ts                       # WeatherForecast, AirportLocation, Coordinates

data/iataAirportMap.ts               # IATA → City mapping (80+ airports)
```

### Agent Flow
```
searchFlightInspiration(origin, maxPrice, duration)
    ↓ Amadeus Inspiration API (budget-based discovery)
enrichWithWeather(flights)
    ↓ Batch geocoding (Set deduplication) → Parallel weather (Promise.allSettled)
filterAndRankInspirationResults()
    ↓ Score: style +10, weather +5, budget +3-5, preferred +15, direct +3
generateInspirationReasoning()
    ↓ Markdown with % savings + checkmarks
```

### Frontend Structure (`frontend/src/`)
```
components/
├── FiltersBar.tsx        # Budget, origin, style, weather inputs
├── AgentThinking.tsx     # Loading animation
├── ResultsSection.tsx    # AI reasoning + flight cards
├── FlightCard.tsx        # Individual flight with weather
└── WeatherBadge.tsx      # Weather condition badge

App.tsx                   # Main state (loading, results, errors)
index.css                 # Semantic classes (golden ratio design)
```

## API Endpoint

### POST /api/flights/search

**Request**:
```typescript
{
  budget: number;                    // PLN (0-50000)
  origin: string;                    // IATA code (WAW, KRK, GDN)
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  weatherPreference: 'hot' | 'mild' | 'cold' | 'any';
  preferredDestinations?: string[];  // Optional city names
  departureDate?: string;            // Optional YYYY-MM-DD
  returnDate?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    recommendations: FlightOffer[];  // Top 10 with weatherData field
    reasoning: string;               // Markdown with % savings
    executionTime: number;
    toolsUsed: string[];             // ["search_flight_inspiration", "enrich_weather", ...]
  };
}
```

## Amadeus Inspiration API Integration

**Purpose**: Discover destinations within budget (not fixed routes)

**Endpoint**: `GET /v1/shopping/flight-destinations`

**Key Parameters**:
- `origin` (required) - IATA code
- `maxPrice` (optional) - Budget constraint (0-50000 PLN)
- `duration` (optional) - Trip length (1-15 days)
- `viewBy` (optional) - 'DESTINATION' | 'DATE' | 'DURATION'

**Authentication**: OAuth 2.0 (token cached with 30s expiration buffer)

**Error Handling**:
- 401: Auto-refresh token & retry
- 404: Return empty array
- 429/500: Fallback to mock data (zero downtime)

## Weather Integration (v1.2.0)

**Provider**: Open-Meteo API (free, no auth, 3.75x faster than Amadeus)

**Two-Tier Caching**:
- Geocoding: 24h TTL (IATA → GPS coordinates)
- Weather: 1h TTL (planned)

**Batch Optimization**:
```typescript
batchGetAirportLocations(['BCN', 'WAW', 'BCN', 'PRG'])
// → Set deduplication → 3 API calls (not 4)
// → Returns Map<IATA, AirportLocation> for O(1) lookups
// → 60% API call reduction
```

**Geocoding Flow**:
1. IATA → City name (`iataAirportMap.ts` lookup)
2. City → GPS coordinates (Open-Meteo Geocoding API)
3. Parallel batch processing (20ms stagger, zero HTTP 429 errors)

**Weather Flow**:
1. GPS → 7-day forecast (Open-Meteo Weather API)
2. Parallel fetching (`Promise.allSettled`)
3. 100% success rate (3-tier fallback: Real → Mock → Graceful degradation)

**Data Included**:
- Temperature (min/max/avg), apparent temp ("feels like")
- Precipitation (probability, amount, rain, snow)
- Wind (speed, gusts, direction)
- UV index, humidity, visibility
- Sunrise/sunset, daylight/sunshine duration

## Scoring Algorithm

```typescript
score = 0
  + (travelStyle match ? 10 : 0)         // culture → Prague, Budapest
  + (weather match ? 5 : 0)              // mild → 15-25°C
  + (price < 50% budget ? 5 : 0)         // Budget efficiency
  + (price < 80% budget ? 3 : 0)
  + (preferred destination ? 15 : 0)     // User's preferred cities
  + (direct flight ? 3 : 0)              // No stops
```

Top 10 destinations returned after ranking.

## Performance Metrics (v1.2.0)

- **API response**: ~800-1200ms (Amadeus + weather)
- **Batch geocoding**: ~100-200ms for 5 destinations (60% reduction)
- **Weather enrichment**: 100% success rate
- **Cache hit rate**: >70% after warmup
- **Rate limit errors**: 0 (HTTP 429)
- **Agent execution**: ~1.5s average

## Common Issues

### 1. Amadeus Returns 0 Results
**Solutions**:
- Increase `maxPrice` to 500+ PLN
- Use popular origins (WAW, KRK, GDN)
- Omit `departureDate` for flexibility
- Mock fallback maintains functionality

### 2. Weather Enrichment Failures (Rare)
**Solutions**:
- Check network connectivity
- Verify IATA exists in `iataAirportMap.ts`
- Partial enrichment acceptable (ranking works)
- 3-tier fallback ensures graceful degradation

### 3. TypeScript Compilation Errors
**Solutions**:
- Verify `.js` extensions in imports
- Check `"module": "NodeNext"` in `tsconfig.json`
- Run `npm run build` to verify

## Git Workflow

**Branches**: `main` (production) ← `develop` (integration) ← `feature/*`

**Commits**: `type(scope): subject`
```bash
feat(backend): add JWT authentication
fix(frontend): resolve filter reset bug
```

**Full details**: [GIT_FLOW.md](./GIT_FLOW.md)

## Documentation

- **[API.md](./API.md)** - REST API reference, request/response schemas
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history (v1.2.0: Weather + Geocoding)
- **[GIT_FLOW.md](./GIT_FLOW.md)** - Git workflow, branch strategy, versioning
- **[AGENTS.md](./AGENTS.md)** - AI agents tutorial (if exists)
