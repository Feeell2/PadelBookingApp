// ==========================================
// Filters Bar Component (Horizontal Layout)
// ==========================================

import { useState } from 'react';
import type { UserPreferences } from '../types';

interface FiltersBarProps {
  onSearch: (preferences: UserPreferences) => void;
  onReset: () => void;
  loading: boolean;
}

const ORIGINS = [
  { code: 'WAW', name: 'Warsaw' },
  { code: 'KRK', name: 'Kraków' },
  { code: 'GDN', name: 'Gdańsk' },
  { code: 'MAD', name: 'Madryt' },
];

const TRAVEL_STYLES = [
  { value: 'adventure', label: 'Adventure', icon: '🏔️' },
  { value: 'relaxation', label: 'Relax', icon: '🏖️' },
  { value: 'culture', label: 'Culture', icon: '🏛️' },
  { value: 'party', label: 'Party', icon: '🎉' },
  { value: 'nature', label: 'Nature', icon: '🌲' },
] as const;

const WEATHER_PREFERENCES = [
  { value: 'hot', icon: '☀️' },
  { value: 'mild', icon: '🌤️' },
  { value: 'cold', icon: '❄️' },
  { value: 'any', icon: '🌍' },
] as const;

export default function FiltersBar({
  onSearch,
  onReset,
  loading,
}: FiltersBarProps) {
  const [budget, setBudget] = useState(500);
  const [origin, setOrigin] = useState('WAW');
  const [travelStyle, setTravelStyle] =
    useState<UserPreferences['travelStyle']>('culture');
  const [weatherPreference, setWeatherPreference] =
    useState<UserPreferences['weatherPreference']>('mild');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      budget,
      origin,
      travelStyle,
      weatherPreference,
    });
  };

  const handleReset = () => {
    setBudget(500);
    setOrigin('WAW');
    setTravelStyle('culture');
    setWeatherPreference('mild');
    onReset();
  };

  return (
    <section className="filters-bar">
      <div className="filters-container">
        <form onSubmit={handleSubmit} className="filters-form">
          {/* Filters Grid */}
          <div className="filters-grid">

            {/* Budget Filter */}
            <div className="filter-group">
              <label className="filter-label">
                Budget
              </label>
              <div className="filter-input-group">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={loading}
                />
                <div className="budget-display">
                  {budget} PLN
                </div>
              </div>
            </div>

            {/* Origin Filter */}
            <div className="filter-group">
              <label className="filter-label">
                From
              </label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="origin-select"
                disabled={loading}
              >
                {ORIGINS.map((airport) => (
                  <option key={airport.code} value={airport.code}>
                    {airport.name} ({airport.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Travel Style Filter */}
            <div className="filter-group">
              <label className="filter-label">
                Travel Style
              </label>
              <div className="style-buttons-grid">
                {TRAVEL_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => setTravelStyle(style.value)}
                    disabled={loading}
                    className={`style-button ${
                      travelStyle === style.value ? 'active' : ''
                    }`}
                    title={style.label}
                  >
                    {style.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather Filter */}
            <div className="filter-group">
              <label className="filter-label">
                Weather
              </label>
              <div className="weather-buttons-grid">
                {WEATHER_PREFERENCES.map((weather) => (
                  <button
                    key={weather.value}
                    type="button"
                    onClick={() => setWeatherPreference(weather.value)}
                    disabled={loading}
                    className={`weather-button ${
                      weatherPreference === weather.value ? 'active' : ''
                    }`}
                  >
                    {weather.icon}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              type="submit"
              disabled={loading}
              className="search-button"
            >
              {loading ? (
                <span className="search-button-content">
                  <span className="animate-spin">⏳</span>
                  Searching...
                </span>
              ) : (
                '✈️ Search Flights'
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="reset-button"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
