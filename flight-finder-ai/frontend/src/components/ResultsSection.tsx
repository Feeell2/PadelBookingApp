// ==========================================
// Results Section Component
// ==========================================

import { Brain, Clock, Wrench } from 'lucide-react';
import type { AgentResponse } from '../types';
import FlightCard from './FlightCard';
import WeatherBadge from './WeatherBadge';

interface ResultsSectionProps {
  results: AgentResponse;
}

export default function ResultsSection({ results }: ResultsSectionProps) {
  return (
    <div className="results-section">
      {/* AI Reasoning Box */}
      <div className="ai-reasoning-box">
        <div className="ai-reasoning-header">
          <div className="ai-icon-wrapper">
            <Brain className="ai-icon" />
          </div>
          <div className="ai-reasoning-content">
            <h3 className="ai-reasoning-title">
              🤖 AI Agent Recommendation
            </h3>
            <div className="prose prose-invert max-w-none">
              <div className="ai-reasoning-text">
                {results.reasoning}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weather Info */}
      {results.weatherInfo && results.weatherInfo.length > 0 && (
        <div className="weather-section">
          <h3 className="weather-section-title">
            Weather Conditions
          </h3>
          <div className="weather-badges">
            {results.weatherInfo.map((weather, index) => (
              <WeatherBadge key={index} weather={weather} />
            ))}
          </div>
        </div>
      )}

      {/* Flight Recommendations */}
      {results.recommendations.length > 0 && (
        <div className="flights-section">
          <h3 className="flights-section-title">
            ✈️ Flight Options ({results.recommendations.length})
          </h3>
          <div className="flights-grid">
            {results.recommendations.map((flight, index) => (
              <FlightCard key={flight.id} flight={flight} rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Execution Stats */}
      <div className="execution-stats">
        <div className="execution-stats-content">
          <div className="execution-stat">
            <Clock className="execution-stat-icon" />
            <span>
              Processing time:{' '}
              <span className="execution-stat-value">
                {(results.executionTime / 1000).toFixed(2)}s
              </span>
            </span>
          </div>
          <div className="execution-stat">
            <Wrench className="execution-stat-icon" />
            <span>
              Tools used:{' '}
              <span className="execution-stat-value">
                {results.toolsUsed.join(', ')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
