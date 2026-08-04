import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudSun, CloudRain, Snowflake, CloudLightning } from 'lucide-react';

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Open-Meteo 무료 날씨 API (서울 좌표: lat 37.5665, lon 126.9780)
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current_weather=true'
        );
        if (res.ok) {
          const data = await res.json();
          if (data.current_weather) {
            setWeather({
              temp: Math.round(data.current_weather.temperature),
              code: data.current_weather.weathercode,
              isDay: data.current_weather.is_day === 1
            });
          }
        }
      } catch (err) {
        console.warn('날씨 API 호출 실패:', err);
      }
    };

    fetchWeather();
    // 15분마다 갱신
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!weather) return null;

  // WMO Weather interpretation codes
  const getWeatherInfo = (code) => {
    if (code === 0) return { icon: <Sun size={13} className="text-amber-400" />, label: '맑음' };
    if (code >= 1 && code <= 3) return { icon: <CloudSun size={13} className="text-amber-300" />, label: '구름조금' };
    if (code === 45 || code === 48) return { icon: <Cloud size={13} className="text-slate-400" />, label: '안개' };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
      return { icon: <CloudRain size={13} className="text-blue-400" />, label: '비' };
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
      return { icon: <Snowflake size={13} className="text-sky-300" />, label: '눈' };
    if (code >= 95) return { icon: <CloudLightning size={13} className="text-purple-400" />, label: '뇌우' };
    return { icon: <Sun size={13} className="text-amber-400" />, label: '맑음' };
  };

  const info = getWeatherInfo(weather.code);

  return (
    <div className="weather-widget">
      <span className="weather-location">서울</span>
      <span className="weather-icon-box">{info.icon}</span>
      <span className="weather-temp">{weather.temp}°C</span>
      <span className="weather-desc">{info.label}</span>
    </div>
  );
}
