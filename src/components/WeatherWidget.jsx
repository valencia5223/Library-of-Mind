import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudSun, CloudRain, Snowflake, CloudLightning } from 'lucide-react';

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const fetchWeatherForCoords = async (lat, lon, locationName = '') => {
      try {
        let city = locationName;

        // 도시 이름이 지정되지 않은 경우 역지오코딩 시도
        if (!city) {
          try {
            const geoRes = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`
            );
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const rawCity = geoData.city || geoData.locality || geoData.principalSubdivision || '서울';
              city = rawCity.replace(/(특별시|광역시|특별자치시|특별자치도)$/g, '').trim();
            }
          } catch (geoErr) {
            console.warn('역지오코딩 실패, 기본값 적용:', geoErr);
            city = '내위치';
          }
        }

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );

        if (res.ok) {
          const data = await res.json();
          if (data.current_weather) {
            setWeather({
              temp: Math.round(data.current_weather.temperature),
              code: data.current_weather.weathercode,
              isDay: data.current_weather.is_day === 1,
              cityName: city || '서울'
            });
          }
        }
      } catch (err) {
        console.warn('날씨 API 호출 실패:', err);
      }
    };

    const loadWeather = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            fetchWeatherForCoords(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            console.warn('위치 권한 거부 또는 실패, 서울 기본값 사용:', err);
            fetchWeatherForCoords(37.5665, 126.9780, '서울');
          },
          { timeout: 5000 }
        );
      } else {
        fetchWeatherForCoords(37.5665, 126.9780, '서울');
      }
    };

    loadWeather();
    const interval = setInterval(loadWeather, 15 * 60 * 1000);
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
      <span className="weather-location">{weather.cityName}</span>
      <span className="weather-icon-box">{info.icon}</span>
      <span className="weather-temp">{weather.temp}°C</span>
      <span className="weather-desc">{info.label}</span>
    </div>
  );
}
