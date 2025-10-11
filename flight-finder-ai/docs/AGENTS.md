# 🤖 AI Agents - Kompletny przewodnik

## Czym jest Agent AI?

**Agent AI** to system, który:
1. Otrzymuje zadanie od użytkownika
2. **Samodzielnie planuje** jak je wykonać
3. **Wybiera narzędzia** (funkcje) do użycia
4. **Wykonuje akcje** w pętli
5. Zwraca wynik

### Agent vs Chatbot

| Chatbot | Agent AI |
|---------|----------|
| Tylko odpowiada tekstem | Wykonuje akcje |
| Nie ma dostępu do narzędzi | Może wywoływać funkcje |
| Jednokrotna interakcja | Działa w pętli (agentic loop) |
| Pasywny | Proaktywny |

## 🔧 Komponenty Agenta

### 1. Tools (Narzędzia)

Funkcje które agent może wywoływać:

```typescript
const tools: AgentTool[] = [
  {
    name: 'search_flights',
    description: 'Search for available flights within budget',
    input_schema: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin airport code (e.g., WAW)'
        },
        maxBudget: {
          type: 'number',
          description: 'Maximum budget in PLN'
        }
      },
      required: ['origin', 'maxBudget']
    }
  }
];
```

**Ważne:** Opis (`description`) musi być precyzyjny - agent używa go do decyzji!

### 2. Agentic Loop

```
┌─────────────────────────────────────────────┐
│                                             │
│  User Query                                 │
│      ↓                                      │
│  Agent receives message                     │
│      ↓                                      │
│  Agent thinks: "What should I do?"          │
│      ↓                                      │
│  ┌─ Agent decides: "I need to use tool X"  │
│  │      ↓                                   │
│  │  System executes tool                   │
│  │      ↓                                   │
│  │  Result returned to agent               │
│  │      ↓                                   │
│  └─ Agent thinks: "Do I need more info?"   │
│         ↓                                   │
│    If YES → loop continues                 │
│    If NO  → final response                 │
│                                             │
└─────────────────────────────────────────────┘
```

### 3. Implementation w Claude

```typescript
export async function runAgent(userMessage: string) {
  const messages = [
    { role: 'user', content: userMessage }
  ];
  
  // Initial call
  let response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    tools: tools,
    messages: messages
  });
  
  // Agentic loop
  while (response.stop_reason === 'tool_use') {
    // Extract tool call
    const toolUse = response.content.find(
      block => block.type === 'tool_use'
    );
    
    // Execute tool
    const result = await executeTool(
      toolUse.name, 
      toolUse.input
    );
    
    // Add to conversation
    messages.push({
      role: 'assistant',
      content: response.content
    });
    
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      }]
    });
    
    // Get next response
    response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      tools: tools,
      messages: messages
    });
  }
  
  return response;
}
```

## 🎯 Przykłady Use Cases

### Przykład 1: Prosty agent (1 tool call)

**Input:** "Jaka jest pogoda w Barcelonie?"

```
1. Agent receives query
2. Agent: "Użyję get_weather"
   → calls get_weather('BCN')
3. Result: {temp: 22, condition: 'sunny'}
4. Agent: "W Barcelonie jest słonecznie, 22°C"
```

### Przykład 2: Złożony agent (multiple tool calls)

**Input:** "Znajdź mi tani weekend w ciepłym miejscu do 400 PLN"

```
1. Agent receives query
2. Agent thinks: "Potrzebuję wyszukać loty"
   → calls search_flights(origin: 'WAW', maxBudget: 400)
3. Result: [BCN: 380 PLN, PRG: 210 PLN, LIS: 420 PLN]
4. Agent thinks: "Użytkownik chce ciepło, sprawdzę pogodę"
   → calls get_weather('BCN')
5. Result: {temp: 22, condition: 'sunny'}
   → calls get_weather('PRG')
6. Result: {temp: 15, condition: 'cloudy'}
7. Agent thinks: "Mam wszystkie informacje"
   → Final response: "Polecam Barcelonę - 380 PLN, 
      ciepło (22°C) i słonecznie!"
```

### Przykład 3: Agent z błędem i recovery

**Input:** "Znajdź loty do Tokio za 200 PLN"

```
1. Agent: calls search_flights('WAW', 200)
2. Result: [] (brak wyników)
3. Agent thinks: "Brak lotów w tym budżecie"
   → calls get_destinations()
4. Result: [list of destinations with prices]
5. Agent: "Niestety brak lotów do Tokio za 200 PLN.
    W tym budżecie dostępne są: Praga (210 PLN), 
    Budapeszt (180 PLN)..."
```

## 🛠️ Best Practices dla Agentów

### 1. Dobre opisy narzędzi

❌ **Źle:**
```typescript
{
  name: 'search',
  description: 'Search for stuff'  // zbyt ogólne!
}
```

✅ **Dobrze:**
```typescript
{
  name: 'search_flights',
  description: 'Search for available flights from origin airport within budget. Returns list of flight offers with prices, dates, and airlines. Use this when user asks about flights, trips, or travel options.'
}
```

### 2. Validation w tool execution

```typescript
async function executeTool(name: string, input: any) {
  try {
    // Validate input
    if (name === 'search_flights') {
      if (!input.origin || !input.maxBudget) {
        throw new Error('Missing required parameters');
      }
      if (input.maxBudget < 0) {
        throw new Error('Budget must be positive');
      }
    }
    
    // Execute
    const result = await searchFlights(input);
    
    // Validate result
    if (!result || result.length === 0) {
      return { 
        message: 'No flights found',
        suggestions: ['Try higher budget', 'Different dates']
      };
    }
    
    return result;
  } catch (error) {
    return { 
      error: error.message,
      recoverable: true 
    };
  }
}
```

### 3. Logging dla debugowania

```typescript
console.log(`🔧 Tool called: ${toolName}`);
console.log(`📥 Input:`, JSON.stringify(input, null, 2));
console.log(`⏱️  Execution time: ${duration}ms`);
console.log(`📤 Result:`, result);
```

### 4. Limit na tool calls

```typescript
const MAX_ITERATIONS = 10;
let iterations = 0;

while (response.stop_reason === 'tool_use' && iterations < MAX_ITERATIONS) {
  iterations++;
  // ... execute tool
}

if (iterations >= MAX_ITERATIONS) {
  console.warn('⚠️  Max iterations reached');
}
```

## 🎓 Zaawansowane koncepty

### 1. Parallel Tool Calls

Claude może wywoływać wiele narzędzi równocześnie:

```typescript
const toolCalls = response.content.filter(
  block => block.type === 'tool_use'
);

const results = await Promise.all(
  toolCalls.map(call => executeTool(call.name, call.input))
);
```

### 2. Tool chaining

Wynik jednego narzędzia jako input dla drugiego:

```typescript
// 1. Get destinations
const destinations = await getDestinations();

// 2. For each destination, get weather
const weatherData = await Promise.all(
  destinations.map(d => getWeather(d.code))
);

// 3. Combine data
return destinations.map((d, i) => ({
  ...d,
  weather: weatherData[i]
}));
```

### 3. Context preservation

Agent pamięta poprzednie interakcje:

```typescript
// Conversation state
const conversationHistory = [];

// Each query adds to history
conversationHistory.push({
  role: 'user',
  content: userMessage
});

// Agent can reference previous searches
```

## 🚀 Optymalizacja wydajności

### 1. Caching częstych zapytań

```typescript
const cache = new Map();

async function searchFlightsWithCache(origin, budget) {
  const key = `${origin}-${budget}`;
  
  if (cache.has(key)) {
    console.log('💾 Cache hit!');
    return cache.get(key);
  }
  
  const result = await searchFlights(origin, budget);
  cache.set(key, result);
  return result;
}
```

### 2. Timeout na tool execution

```typescript
async function executeToolWithTimeout(name, input, timeout = 5000) {
  return Promise.race([
    executeTool(name, input),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}
```

### 3. Streaming responses

```typescript
const stream = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  stream: true,
  tools: tools,
  messages: messages
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

## 📊 Monitoring i Analytics

```typescript
interface AgentMetrics {
  totalCalls: number;
  averageToolsUsed: number;
  successRate: number;
  averageResponseTime: number;
  mostUsedTools: Record<string, number>;
}

function trackAgentCall(
  toolsUsed: string[], 
  success: boolean, 
  duration: number
) {
  metrics.totalCalls++;
  metrics.averageResponseTime = 
    (metrics.averageResponseTime + duration) / 2;
  
  toolsUsed.forEach(tool => {
    metrics.mostUsedTools[tool] = 
      (metrics.mostUsedTools[tool] || 0) + 1;
  });
}
```

## 🎯 Testing Agentów

```typescript
describe('Flight Agent', () => {
  it('should search flights within budget', async () => {
    const result = await runAgent(
      'Find flights under 300 PLN'
    );
    
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.every(f => f.price <= 300))
      .toBe(true);
  });
  
  it('should handle no results gracefully', async () => {
    const result = await runAgent(
      'Find flights to Mars'
    );
    
    expect(result.reasoning).toContain('no flights');
    expect(result.alternatives).toBeDefined();
  });
});
```

## 📚 Dalsze zasoby

- [Anthropic Tool Use Docs](https://docs.anthropic.com/claude/docs/tool-use)
- [LangChain Agents](https://python.langchain.com/docs/modules/agents/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)

## 🎓 Ćwiczenia

1. Dodaj nowe narzędzie `get_hotel_prices()`
2. Zaimplementuj agent który planuje cały weekend (loty + hotel + pogoda)
3. Stwórz agenta który uczy się preferencji użytkownika
4. Dodaj parallel tool execution dla lepszej wydajności