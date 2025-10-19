import { Calendar, TrendingDown } from 'lucide-react';
import { formatDateShort } from '../utils/timeUtils';
import type { FlightDateOption } from '../types';

interface FlightDateOptionProps {
  dateOption: FlightDateOption;
  isCheapest?: boolean;
}

export default function FlightDateOption({
  dateOption,
  isCheapest,
}: FlightDateOptionProps) {
  const tripDays = Math.ceil(
    (new Date(dateOption.returnDate).getTime() -
      new Date(dateOption.departureDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return (
    <div
      className={`flight-date-option ${isCheapest ? 'flight-date-option-cheapest' : ''}`}
    >
      {/* Cheapest Badge */}
      {isCheapest && (
        <div className="flight-date-cheapest-badge">
          <TrendingDown className="flight-date-cheapest-icon" />
          <span>Best Price</span>
        </div>
      )}

      {/* Date Range */}
      <div className="flight-date-header">
        <Calendar className="flight-date-calendar-icon" />
        <div className="flight-date-range">
          <div className="flight-date-departure">
            {formatDateShort(dateOption.departureDate)}
          </div>
          <div className="flight-date-arrow">→</div>
          <div className="flight-date-return">
            {formatDateShort(dateOption.returnDate)}
          </div>
        </div>
      </div>

      {/* Trip Duration */}
      <div className="flight-date-duration">{tripDays} days</div>

      {/* Price */}
      <div className="flight-date-price">
        <span className="flight-date-price-amount">
          {Math.round(dateOption.price)}
        </span>
        <span className="flight-date-price-currency">
          {dateOption.currency}
        </span>
      </div>
    </div>
  );
}
