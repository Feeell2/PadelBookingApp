// ==========================================
// Filters Bar Component (Horizontal Layout)
// ==========================================

import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
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

export default function FiltersBar({
  onSearch,
  onReset,
  loading,
}: FiltersBarProps) {
  const [budget, setBudget] = useState(500);
  const [origin, setOrigin] = useState('WAW');
  const [travelStyle, setTravelStyle] =
    useState<UserPreferences['travelStyle']>('culture');

  // Date states
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [flexibleDates, setFlexibleDates] = useState(false);

  // Validation error state
  const [dateError, setDateError] = useState<string | null>(null);

  // Format Date to YYYY-MM-DD
  const formatDateToString = (date: Date | null): string | undefined => {
    if (!date) return undefined;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Validate dates locally (soft validation)
  const validateDates = (): boolean => {
    setDateError(null);

    // Check if dates are selected
    if (!departureDate || !returnDate) {
      setDateError('Please select both departure and return dates');
      return false;
    }

    // Check if departure is in the future (at least tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (departureDate < tomorrow) {
      setDateError('Departure date must be at least tomorrow');
      return false;
    }

    // Check if return is after departure
    if (returnDate <= departureDate) {
      setDateError('Return date must be after departure date');
      return false;
    }

    // Check trip length (1-30 days)
    const tripDays = Math.ceil(
      (returnDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (tripDays < 1) {
      setDateError('Trip must be at least 1 day long');
      return false;
    }

    if (tripDays > 30) {
      setDateError('Trip cannot be longer than 30 days');
      return false;
    }

    // Check if departure is within 330 days (Amadeus limit)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 330);

    if (departureDate > maxDate) {
      setDateError('Departure date cannot be more than 330 days in the future');
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate dates
    if (!validateDates()) {
      return; // Don't submit if validation fails
    }

    onSearch({
      budget,
      origin,
      travelStyle,
      departureDate: formatDateToString(departureDate),
      returnDate: formatDateToString(returnDate),
      flexibleDates,
    });
  };

  const handleReset = () => {
    setBudget(500);
    setOrigin('WAW');
    setTravelStyle('culture');
    setDepartureDate(null);
    setReturnDate(null);
    setFlexibleDates(false);
    setDateError(null);
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

            {/* Departure Date Filter */}
            <div className="filter-group">
              <label className="filter-label">
                Departure Date
              </label>
              <DatePicker
                selected={departureDate}
                onChange={(date: Date | null) => {
                  setDepartureDate(date);
                  setDateError(null); // Clear error on change
                }}
                selectsStart
                startDate={departureDate}
                endDate={returnDate}
                minDate={new Date(new Date().setDate(new Date().getDate() + 1))} // Tomorrow
                maxDate={new Date(new Date().setDate(new Date().getDate() + 330))} // +330 days
                placeholderText="Select departure"
                dateFormat="yyyy-MM-dd"
                disabled={loading}
                className="date-picker-input"
                wrapperClassName="date-picker-wrapper"
                required
              />
            </div>

            {/* Return Date Filter */}
            <div className="filter-group">
              <label className="filter-label">
                Return Date
              </label>
              <DatePicker
                selected={returnDate}
                onChange={(date: Date | null) => {
                  setReturnDate(date);
                  setDateError(null); // Clear error on change
                }}
                selectsEnd
                startDate={departureDate}
                endDate={returnDate}
                minDate={departureDate ? new Date(departureDate.getTime() + 24 * 60 * 60 * 1000) : new Date()} // Day after departure
                maxDate={departureDate ? new Date(departureDate.getTime() + 30 * 24 * 60 * 60 * 1000) : undefined} // Max 30 days trip
                placeholderText="Select return"
                dateFormat="yyyy-MM-dd"
                disabled={loading || !departureDate}
                className="date-picker-input"
                wrapperClassName="date-picker-wrapper"
                required
              />
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

          </div>

          {/* Flexible Dates Checkbox */}
          <div className="flexible-dates-section">
            <label className="flexible-dates-label">
              <input
                type="checkbox"
                checked={flexibleDates}
                onChange={(e) => setFlexibleDates(e.target.checked)}
                disabled={loading || !departureDate || !returnDate}
                className="flexible-dates-checkbox"
              />
              <span className="flexible-dates-text">
                My dates are flexible (±3 days)
              </span>
              <span className="flexible-dates-hint">
                Find cheaper options by searching nearby dates
              </span>
            </label>
          </div>

          {/* Date Error Message */}
          {dateError && (
            <div className="date-error-message">
              <span className="date-error-icon">⚠️</span>
              <span>{dateError}</span>
            </div>
          )}

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
