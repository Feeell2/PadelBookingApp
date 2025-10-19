import { Plane, Clock } from 'lucide-react';
import { formatTime, formatDate, parseDuration } from '../utils/timeUtils';
import type { FlightSegment } from '../types';

interface FlightSegmentCardProps {
  segment: FlightSegment;
  showLayover?: {
    duration: string;
    airport: string;
  };
}

export default function FlightSegmentCard({
  segment,
  showLayover,
}: FlightSegmentCardProps) {
  return (
    <div className="flight-segment-card">
      {/* Flight Segment */}
      <div className="flight-segment-content">
        {/* Departure */}
        <div className="flight-segment-location">
          <div className="flight-segment-time">
            {formatTime(segment.departureTime)}
          </div>
          <div className="flight-segment-airport">
            {segment.departureAirport}
            {segment.departureTerminal && (
              <span className="flight-segment-terminal">
                T{segment.departureTerminal}
              </span>
            )}
          </div>
          <div className="flight-segment-date">
            {formatDate(segment.departureTime)}
          </div>
        </div>

        {/* Flight Line with Icon */}
        <div className="flight-segment-line">
          <div className="flight-segment-line-start"></div>
          <div className="flight-segment-plane-wrapper">
            <Plane className="flight-segment-plane-icon" />
          </div>
          <div className="flight-segment-line-end"></div>
          <div className="flight-segment-duration">
            <Clock className="flight-segment-duration-icon" />
            {parseDuration(segment.duration)}
          </div>
        </div>

        {/* Arrival */}
        <div className="flight-segment-location">
          <div className="flight-segment-time">
            {formatTime(segment.arrivalTime)}
          </div>
          <div className="flight-segment-airport">
            {segment.arrivalAirport}
            {segment.arrivalTerminal && (
              <span className="flight-segment-terminal">
                T{segment.arrivalTerminal}
              </span>
            )}
          </div>
          <div className="flight-segment-date">
            {formatDate(segment.arrivalTime)}
          </div>
        </div>
      </div>

      {/* Flight Info */}
      <div className="flight-segment-info">
        <span className="flight-segment-airline">{segment.airline}</span>
        <span className="flight-segment-separator">•</span>
        <span className="flight-segment-flight-number">
          {segment.flightNumber}
        </span>
        <span className="flight-segment-separator">•</span>
        <span className="flight-segment-aircraft">{segment.aircraft}</span>
      </div>

      {/* Layover Badge */}
      {showLayover && (
        <div className="flight-segment-layover">
          <Clock className="flight-segment-layover-icon" />
          <span>
            Layover in {showLayover.airport}: {showLayover.duration}
          </span>
        </div>
      )}
    </div>
  );
}
