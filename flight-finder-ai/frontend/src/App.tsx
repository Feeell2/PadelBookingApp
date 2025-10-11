// ==========================================
// Main App Component
// ==========================================

import { useState } from 'react';
import { AlertCircle, Plane } from 'lucide-react';
import FiltersBar from './components/FiltersBar';
import AgentThinking from './components/AgentThinking';
import ResultsSection from './components/ResultsSection';
import { searchFlights } from './services/api';
import type { UserPreferences, AgentResponse } from './types';

function App() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (preferences: UserPreferences) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await searchFlights(preferences);
      setResults(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setError(null);
  };

  return (
    <div className="app-container">
      {/* Hero Header - 20vh with Golden Ratio proportions */}
      <header className="hero-header">
        <div className="hero-content">
          {/* Logo & Title - Horizontally aligned, centered */}
          <div className="hero-logo-title">
            <div className="hero-logo-wrapper">
              {/* Logo size based on golden ratio: base 56px * φ ≈ 90px */}
              <Plane className="hero-logo animate-pulse" />
              <div className="hero-logo-glow"></div>
            </div>
            {/* Font size based on golden ratio: 90px / φ ≈ 56px */}
            <h1 className="hero-title">
              <span className="hero-title-gradient">
                Flight Finder AI
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="hero-subtitle">
            <span>Powered by</span>
            <span className="hero-subtitle-highlight">Claude Sonnet 4.5</span>
            <span className="hero-subtitle-separator">•</span>
            <span>AI-Driven Travel Search</span>
            <span className="hero-status">
              <span className="hero-status-dot"></span>
              <span className="hero-status-text">Online</span>
            </span>
          </p>
        </div>
      </header>

      {/* Filters Bar */}
      <FiltersBar
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      {/* Main Content */}
      <main className="main-content">
        {/* Loading State */}
        {loading && <AgentThinking />}

        {/* Error State */}
        {error && !loading && (
          <div className="error-state">
            <div className="error-box">
              <AlertCircle className="error-icon" />
              <h3 className="error-title">
                Oops! Something went wrong
              </h3>
              <p className="error-message">{error}</p>
              <button
                onClick={handleReset}
                className="error-button"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {results && !loading && <ResultsSection results={results} />}

        {/* Empty State */}
        {!loading && !results && !error && (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <div className="empty-icon-circle">
                <span>✈️</span>
              </div>
              <div className="empty-icon-glow"></div>
            </div>
            <h2 className="empty-title">
              Ready to find your perfect flight?
            </h2>
            <p className="empty-description">
              Use the filters above to set your preferences and let our AI agent discover the best flight options tailored just for you
            </p>
            <div className="empty-features">
              <div className="empty-feature">
                <span className="empty-feature-icon">✓</span>
                <span>AI-Powered Search</span>
              </div>
              <div className="empty-feature">
                <span className="empty-feature-icon">✓</span>
                <span>Real-time Analysis</span>
              </div>
              <div className="empty-feature">
                <span className="empty-feature-icon">✓</span>
                <span>Best Price Guarantee</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p className="footer-tech-stack">
            <span>Built with</span>
            <span className="footer-tech">React</span>
            <span>+</span>
            <span className="footer-tech">TypeScript</span>
            <span>+</span>
            <span className="footer-tech">Tailwind CSS v4</span>
            <span>+</span>
            <span className="footer-tech">Claude Sonnet 4.5</span>
          </p>
          <p className="footer-copyright">
            Flight Finder AI &copy; 2025
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
