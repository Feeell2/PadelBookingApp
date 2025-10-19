import { useState, useEffect } from 'react';
import { X, Plane, Calendar, Loader } from 'lucide-react';
import FlightSegmentCard from './FlightSegmentCard';
import FlightDateOption from './FlightDateOption';
import {
  fetchFlightOfferDetails,
  fetchFlightDates,
} from '../services/api';
import { calculateLayover, parseDuration } from '../utils/timeUtils';
import type {
  FlightOffer,
  FlightOfferDetail,
  FlightDateOption as FlightDateOptionType,
} from '../types';

interface FlightDetailsModalProps {
  flight: FlightOffer;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'details' | 'dates';

export default function FlightDetailsModal({
  flight,
  isOpen,
  onClose,
}: FlightDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [flightDetails, setFlightDetails] = useState<FlightOfferDetail[] | null>(null);
  const [dateOptions, setDateOptions] = useState<FlightDateOptionType[] | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [errorDates, setErrorDates] = useState<string | null>(null);

  // Fetch flight details when modal opens and tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'details' && !flightDetails && flight.flightOffersUrl) {
      fetchDetails();
    }
  }, [isOpen, activeTab, flight.flightOffersUrl]);

  // Fetch date options when tab switches to dates
  useEffect(() => {
    if (isOpen && activeTab === 'dates' && !dateOptions && flight.flightDatesUrl) {
      fetchDates();
    }
  }, [isOpen, activeTab, flight.flightDatesUrl]);

  const fetchDetails = async () => {
    if (!flight.flightOffersUrl) return;

    setLoadingDetails(true);
    setErrorDetails(null);

    try {
      const details = await fetchFlightOfferDetails(flight.flightOffersUrl);
      setFlightDetails(details);
    } catch (error) {
      setErrorDetails(error instanceof Error ? error.message : 'Failed to load details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchDates = async () => {
    if (!flight.flightDatesUrl) return;

    setLoadingDates(true);
    setErrorDates(null);

    try {
      const dates = await fetchFlightDates(flight.flightDatesUrl);
      // Sort by price (cheapest first)
      const sorted = dates.sort((a, b) => a.price - b.price);
      setDateOptions(sorted);
    } catch (error) {
      setErrorDates(error instanceof Error ? error.message : 'Failed to load dates');
    } finally {
      setLoadingDates(false);
    }
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <h2 className="modal-title">
              {flight.destination} ({flight.destinationCode})
            </h2>
            <p className="modal-subtitle">
              from {flight.origin} • {flight.departureDate} to {flight.returnDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="modal-close-button"
            aria-label="Close modal"
          >
            <X className="modal-close-icon" />
          </button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'details' ? 'modal-tab-active' : ''}`}
            onClick={() => setActiveTab('details')}
            disabled={!flight.flightOffersUrl}
          >
            <Plane className="modal-tab-icon" />
            <span>Flight Details</span>
          </button>
          <button
            className={`modal-tab ${activeTab === 'dates' ? 'modal-tab-active' : ''}`}
            onClick={() => setActiveTab('dates')}
            disabled={!flight.flightDatesUrl}
          >
            <Calendar className="modal-tab-icon" />
            <span>Flexible Dates</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-content">
          {/* Flight Details Tab */}
          {activeTab === 'details' && (
            <div className="modal-tab-content">
              {loadingDetails && (
                <div className="modal-loading">
                  <Loader className="modal-loading-spinner" />
                  <p>Loading flight details...</p>
                </div>
              )}

              {errorDetails && (
                <div className="modal-error">
                  <p>{errorDetails}</p>
                  <button
                    onClick={fetchDetails}
                    className="modal-error-retry-button"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loadingDetails && !errorDetails && flightDetails && (
                <div className="modal-flight-details">
                  {flightDetails.map((offer) => (
                    <div key={offer.id} className="modal-flight-offer">
                      {/* Price Header */}
                      <div className="modal-offer-header">
                        <div className="modal-offer-price">
                          <span className="modal-offer-price-amount">
                            {Math.round(offer.price)}
                          </span>
                          <span className="modal-offer-price-currency">
                            {offer.currency}
                          </span>
                        </div>
                        {offer.originalPrice && (
                          <div className="modal-offer-original-price">
                            Originally {offer.originalPrice.toFixed(2)} {offer.originalCurrency}
                          </div>
                        )}
                      </div>

                      {/* Outbound Flight */}
                      <div className="modal-itinerary">
                        <h3 className="modal-itinerary-title">
                          Outbound Flight
                          <span className="modal-itinerary-duration">
                            {parseDuration(offer.outbound.totalDuration)}
                          </span>
                        </h3>
                        <div className="modal-segments">
                          {offer.outbound.segments.map((segment, segIndex) => (
                            <FlightSegmentCard
                              key={segIndex}
                              segment={segment}
                              showLayover={
                                segIndex < offer.outbound.segments.length - 1
                                  ? {
                                      duration: calculateLayover(
                                        segment.arrivalTime,
                                        offer.outbound.segments[segIndex + 1].departureTime
                                      ),
                                      airport: segment.arrivalAirport,
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>

                      {/* Inbound Flight */}
                      {offer.inbound && (
                        <div className="modal-itinerary">
                          <h3 className="modal-itinerary-title">
                            Return Flight
                            <span className="modal-itinerary-duration">
                              {parseDuration(offer.inbound.totalDuration)}
                            </span>
                          </h3>
                          <div className="modal-segments">
                            {offer.inbound.segments.map((segment, segIndex) => {
                              const inboundSegments = offer.inbound?.segments;
                              return (
                                <FlightSegmentCard
                                  key={segIndex}
                                  segment={segment}
                                  showLayover={
                                    inboundSegments && segIndex < inboundSegments.length - 1
                                      ? {
                                          duration: calculateLayover(
                                            segment.arrivalTime,
                                            inboundSegments[segIndex + 1].departureTime
                                          ),
                                          airport: segment.arrivalAirport,
                                        }
                                      : undefined
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!loadingDetails && !errorDetails && !flightDetails && (
                <div className="modal-empty">
                  <p>No detailed flight information available</p>
                </div>
              )}
            </div>
          )}

          {/* Flexible Dates Tab */}
          {activeTab === 'dates' && (
            <div className="modal-tab-content">
              {loadingDates && (
                <div className="modal-loading">
                  <Loader className="modal-loading-spinner" />
                  <p>Loading flexible dates...</p>
                </div>
              )}

              {errorDates && (
                <div className="modal-error">
                  <p>{errorDates}</p>
                  <button
                    onClick={fetchDates}
                    className="modal-error-retry-button"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loadingDates && !errorDates && dateOptions && (
                <div className="modal-date-options">
                  <p className="modal-date-options-hint">
                    Showing alternative dates for the same route. Prices may vary.
                  </p>
                  <div className="modal-date-options-grid">
                    {dateOptions.map((dateOption, index) => (
                      <FlightDateOption
                        key={index}
                        dateOption={dateOption}
                        isCheapest={index === 0}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!loadingDates && !errorDates && !dateOptions && (
                <div className="modal-empty">
                  <p>No flexible date options available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
