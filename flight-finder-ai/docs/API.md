# 🔌 API Documentation

Backend REST API dla Flight Finder AI Agent.

## Base URL

```
Development: http://localhost:3001
Production: https://your-domain.com
```

## Authentication

Currently no authentication required (add later for production).

## Endpoints

### 1. Search Flights with AI Agent

**POST** `/api/flights/search`

Używa AI agenta do znalezienia najlepszych opcji lotów na podstawie preferencji.

#### Request Body

```typescript
{
  budget: number;           // Required: Max budget in PLN
  origin: string;           // Required: Origin airport code (WAW, KRK, GDN)
  travelStyle: string;      // Required: adventure | relaxation | culture | party | nature
  weatherPreference: string; // Required: hot | mild | cold | any
  preferredDestinations?: string[]; // Optional: Array of preferred cities
  departureDate?: string;   // Optional: YYYY-MM-DD
  returnDate?: string;      // Optional: YYYY-MM-DD
}
```

#### Example Request

```bash
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 500,
    "origin": "WAW",
    "travelStyle": "culture",
    "weatherPreference": "mild",
    "preferredDestinations": ["Barcelona", "Prague"]
  }'
```

#### Response

```typescript
{
  success: boolean;
  data: {
    recommendations: FlightOffer[];
    reasoning: string;
    alternatives?: FlightOffer[];
    weatherInfo?: WeatherInfo[];
    executionTime: number;
    toolsUsed: string[];
  };
  error?: string;
}
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "FL001",
        "destination": "Barcelona",
        "destinationCode": "BCN",
        "origin": "WAW",
        "price": 380,
        "currency": "PLN",
        "departureDate": "2025-10-17",
        "returnDate": "2025-10-19",
        "airline": "Ryanair",
        "duration": "5h 30m",
        "stops": 0
      }
    ],
    "reasoning": "Based on your preferences for culture and mild weather with a budget of 500 PLN, I recommend Barcelona. The city offers rich cultural experiences with Gaudí's architecture, perfect autumn weather at 22°C, and the flight is well within budget at 380 PLN.",
    "weatherInfo": [
      {
        "destination": "Barcelona",
        "temperature": 22,
        "condition": "Sunny",
        "humidity": 65,
        "forecast": "Perfect beach weather with clear skies"
      }
    ],
    "executionTime": 3542,
    "toolsUsed": ["search_flights", "get_weather"]
  }
}
```

#### Status Codes

- `200 OK` - Successful search
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Server error or AI agent failure

---

### 2. Get Available Destinations

**GET** `/api/destinations`

Pobiera listę popularnych destynacji z opisami.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "city": "Barcelona",
      "country": "Spain",
      "code": "BCN",
      "description": "Vibrant coastal city with stunning architecture",
      "highlights": ["Sagrada Familia", "Park Güell"],
      "bestFor": ["culture", "party", "relaxation"],
      "averageTemp": 22,
      "estimatedBudget": 300
    }
  ]
}
```

---

### 3. Get Weather

**GET** `/api/weather/:destinationCode`

Pobiera informacje o pogodzie dla destynacji.

#### Parameters

- `destinationCode` (path) - Airport code (BCN, PRG, etc.)

#### Example

```bash
curl http://localhost:3001/api/weather/BCN
```

#### Response

```json
{
  "success": true,
  "data": {
    "destination": "Barcelona",
    "temperature": 22,
    "condition": "Sunny",
    "humidity": 65,
    "forecast": "Perfect beach weather with clear skies"
  }
}
```

---

### 4. Health Check

**GET** `/api/health`

Sprawdza status serwera i połączenia z API.

#### Response

```json
{
  "status": "ok",
  "timestamp": "2025-10-08T12:00:00.000Z",
  "services": {
    "anthropic": "connected",
    "database": "connected"
  }
}
```

---

## Error Responses

Wszystkie błędy zwracają consistent format:

```json
{
  "success": false,
  "error": "Error message here",
  "details": {
    "field": "budget",
    "message": "Budget must be positive number"
  }
}
```

### Common Errors

| Code | Message | Description |
|------|---------|-------------|
| 400 | Invalid parameters | Missing or invalid request parameters |
| 401 | Unauthorized | API key missing or invalid (future) |
| 429 | Rate limit exceeded | Too many requests |
| 500 | Internal server error | Server or AI agent failure |
| 503 | Service unavailable | External API (Amadeus, Claude) down |

---

## Rate Limiting

Currently no rate limiting (add in production):

```
Planned limits:
- 100 requests per hour per IP
- 1000 requests per day per user
```

---

## Data Types

### FlightOffer

```typescript
interface FlightOffer {
  id: string;
  destination: string;
  destinationCode: string;
  origin: string;
  price: number;
  currency: string;
  departureDate: string;      // YYYY-MM-DD
  returnDate: string;         // YYYY-MM-DD
  airline: string;
  duration: string;           // "5h 30m"
  stops: number;
}
```

### WeatherInfo

```typescript
interface WeatherInfo {
  destination: string;
  temperature: number;        // Celsius
  condition: string;          // "Sunny", "Cloudy", etc.
  humidity: number;           // Percentage
  forecast: string;
}
```

### UserPreferences

```typescript
interface UserPreferences {
  budget: number;
  origin: string;
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  weatherPreference: 'hot' | 'mild' | 'cold' | 'any';
  preferredDestinations?: string[];
  departureDate?: string;
  returnDate?: string;
}
```

---

## Testing API

### Using curl

```bash
# Search flights
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{"budget": 400, "origin": "WAW", "travelStyle": "culture", "weatherPreference": "mild"}'

# Get destinations
curl http://localhost:3001/api/destinations

# Get weather
curl http://localhost:3001/api/weather/BCN

# Health check
curl http://localhost:3001/api/health
```

### Using JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Search flights
const response = await api.post('/api/flights/search', {
  budget: 400,
  origin: 'WAW',
  travelStyle: 'culture',
  weatherPreference: 'mild'
});

console.log(response.data);
```

---

## Performance

Expected response times:

| Endpoint | Average | Max |
|----------|---------|-----|
| `/api/flights/search` | 2-4s | 10s |
| `/api/destinations` | <100ms | 500ms |
| `/api/weather/:code` | <200ms | 1s |
| `/api/health` | <50ms | 100ms |

**Note:** Search endpoint may be slower due to AI agent processing and multiple tool calls.

---

## Changelog

### v1.0.0 (Current)
- Initial release
- Basic flight search with AI agent
- Mock data for flights and weather
- Health check endpoint

### Planned (v1.1.0)
- Real Amadeus API integration
- User authentication
- Rate limiting
- WebSocket support for real-time updates