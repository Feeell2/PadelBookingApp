// ==========================================
// Agent Thinking Loader Component
// ==========================================

import { Sparkles } from 'lucide-react';

interface AgentThinkingProps {
  toolsUsed?: string[];
}

export default function AgentThinking({ toolsUsed = [] }: AgentThinkingProps) {
  return (
    <div className="agent-thinking">
      {/* Pulsing gradient circle */}
      <div className="agent-thinking-circle-wrapper">
        <div className="agent-thinking-circle">
          <Sparkles className="agent-thinking-icon" />
        </div>
        <div className="agent-thinking-glow"></div>
      </div>

      {/* Main message */}
      <h3 className="agent-thinking-title">
        🤖 AI Agent analizuje opcje...
      </h3>
      <p className="agent-thinking-description">
        Przeszukuję najlepsze połączenia lotnicze i analizuję warunki pogodowe
        dla Twoich preferencji
      </p>

      {/* Tools being used */}
      {toolsUsed.length > 0 && (
        <div className="agent-tools-box">
          <p className="agent-tools-label">Używane narzędzia:</p>
          <div className="agent-tools-list">
            {toolsUsed.map((tool, index) => (
              <span
                key={index}
                className="agent-tool-badge"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Loading dots animation */}
      <div className="agent-dots">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="agent-dot"
            style={{
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
