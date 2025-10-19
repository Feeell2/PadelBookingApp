// ==========================================
// Flight Card Component
// ==========================================

import { Plane, MapPin, Clock, Calendar } from 'lucide-react';
import type { FlightOffer } from '../types';

interface FlightCardProps {
  flight: FlightOffer;
  rank?: number;
  onViewDetails?: (flight: FlightOffer) => void;
}

export default function FlightCard({ flight, rank, onViewDetails }: FlightCardProps) {
  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '✈️';
  };

  return (
    <div className="flight-card">
      {/* Gradient border effect */}
      <div className="flight-card-border-glow"></div>
      <div className="flight-card-bg"></div>

      {/* Rank badge */}
      {rank && (
        <div className="flight-rank-badge">
          {getRankEmoji(rank)}
        </div>
      )}

      {/* Header - Destination */}
      <div className="flight-header">
        <div className="flight-destination-row">
          <MapPin className="flight-destination-icon" />
          <h3 className="flight-destination-name">
            {flight.destination}
          </h3>
          <span className="flight-destination-code">({flight.destinationCode})</span>
        </div>
        <p className="flight-origin-row">
          <Plane className="flight-origin-icon" />
          from {flight.origin}
        </p>
      </div>

      {/* Price - BIG and prominent */}
      <div className="flight-price-section">
        <div className="flight-price">
          {flight.price}
          <span className="flight-currency">{flight.currency}</span>
        </div>
      </div>

      {/* Flight details grid */}
      <div className="flight-details-grid">
        <div className="flight-detail">
          <Calendar className="flight-detail-icon" />
          <div>
            <p className="flight-detail-label">Departure</p>
            <p className="flight-detail-value">
              {new Date(flight.departureDate).toLocaleDateString('pl-PL', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flight-detail">
          <Calendar className="flight-detail-icon" />
          <div>
            <p className="flight-detail-label">Return</p>
            <p className="flight-detail-value">
              {new Date(flight.returnDate).toLocaleDateString('pl-PL', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flight-detail">
          <Clock className="flight-detail-icon" />
          <div>
            <p className="flight-detail-label">Duration</p>
            <p className="flight-detail-value">{flight.duration}</p>
          </div>
        </div>

        <div className="flight-detail">
          <Plane className="flight-detail-icon" />
          <div>
            <p className="flight-detail-label">Stops</p>
            <p className="flight-detail-value">
              {flight.stops === 0 ? 'Direct' : `${flight.stops} stop(s)`}
            </p>
          </div>
        </div>
      </div>

      {/* Airline */}
      <div className="flight-airline-section">
        <p className="flight-airline-text">
          <span className="flight-airline-name">{flight.airline}</span>
        </p>
      </div>

      {/* Direct flight badge */}
      {flight.stops === 0 && (
        <div className="flight-direct-badge">
          <span className="flight-direct-text">
            Direct
          </span>
        </div>
      )}

      {/* View Details Button */}
      {(flight.flightOffersUrl || flight.flightDatesUrl) && (
        <button
          className="flight-view-details-button"
          onClick={() => onViewDetails?.(flight)}
        >
          View Details
        </button>
      )}
    </div>
  );
}
