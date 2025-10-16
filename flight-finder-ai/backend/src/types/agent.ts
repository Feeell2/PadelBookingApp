// ==========================================
// Agent/Orchestrator Types & Interfaces
// Types for flight recommendation orchestrator
// ==========================================

import type { FlightOffer } from './flight.js';

/**
 * Tool definition for AI agent (future use)
 */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Flight recommendation response with reasoning
 */
export interface AgentResponse {
  recommendations: FlightOffer[];
  reasoning: string;
  alternatives?: FlightOffer[];
  weatherInfo?: any[]; // Legacy support
  executionTime: number;
  toolsUsed: string[];
}
