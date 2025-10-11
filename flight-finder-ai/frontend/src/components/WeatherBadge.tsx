// ==========================================
// Weather Badge Component
// ==========================================

import { Sun, Cloud, CloudRain, CloudSnow } from 'lucide-react';
import type { WeatherInfo } from '../types';

interface WeatherBadgeProps {
  weather: WeatherInfo;
}

export default function WeatherBadge({ weather }: WeatherBadgeProps) {
  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();

    if (lowerCondition.includes('sun') || lowerCondition.includes('clear')) {
      return <Sun className="weather-icon sunny" />;
    }
    if (lowerCondition.includes('rain') || lowerCondition.includes('shower')) {
      return <CloudRain className="weather-icon rainy" />;
    }
    if (lowerCondition.includes('snow')) {
      return <CloudSnow className="weather-icon snowy" />;
    }
    return <Cloud className="weather-icon cloudy" />;
  };

  const getWeatherClass = (condition: string) => {
    const lowerCondition = condition.toLowerCase();

    if (lowerCondition.includes('sun') || lowerCondition.includes('clear')) {
      return 'sunny';
    }
    if (lowerCondition.includes('rain') || lowerCondition.includes('shower')) {
      return 'rainy';
    }
    if (lowerCondition.includes('snow')) {
      return 'snowy';
    }
    return 'cloudy';
  };

  return (
    <div className={`weather-badge ${getWeatherClass(weather.condition)}`}>
      {getWeatherIcon(weather.condition)}
      <div className="weather-info">
        <span className="weather-temperature">{weather.temperature}°C</span>
        <span className="weather-condition">{weather.condition}</span>
      </div>
    </div>
  );
}
