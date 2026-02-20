import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Users, Car, Building, Zap, Loader2, Map as MapIcon, ShieldAlert, Info, BatteryCharging } from 'lucide-react';

// Dynamic Leaflet Map Component (Bypasses bundler errors by loading via CDN)
function RealMap({ gisData, setHoveredSite }) {
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    // Dynamically load Leaflet to avoid build-time import errors
    const loadLeaflet = async () => {
      if (!window.L) {
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        
        await new Promise(resolve => {
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }
      return window.L;
    };

    loadLeaflet().then((L) => {
      if (!mapContainerRef.current) return;

      // Initialize map once
      if (!mapInstance.current) {
        mapInstance.current = L.map(mapContainerRef.current, {
          zoomControl: false, // Keep UI clean
          attributionControl: false // Simplified for this demo
        }).setView([39.8283, -98.5795], 4); // Default to US center

        // Use CARTO's Voyager tiles for a clean, modern look
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(mapInstance.current);
      }

      // Update map if gisData is available
      if (gisData && mapInstance.current) {
        const { cityCenter, sites } = gisData;

        // Fly smoothly to the new city center
        mapInstance.current.flyTo([cityCenter.lat, cityCenter.lng], 13, {
          duration: 1.5,
          easeLinearity: 0.25
        });

        // Clear existing markers
        markersRef.current.forEach(marker => mapInstance.current.removeLayer(marker));
        markersRef.current = [];

        // Create a custom HTML icon for the pins (uses Tailwind colors/Lucide SVG)
        const customIcon = L.divIcon({
          className: 'custom-ev-pin',
          html: `
            <div style="background-color: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 3px solid white; cursor: pointer; transition: transform 0.2s;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #10b981; margin: -2px auto 0 auto;"></div>
          `,
          iconSize: [36, 44],
          iconAnchor: [18, 44], // Anchor at bottom center of the pin
        });

        // Add new markers
        sites.forEach(site => {
          const marker = L.marker([site.lat, site.lng], { icon: customIcon })
            .addTo(mapInstance.current)
            .on('mouseover', () => setHoveredSite(site))
            .on('mouseout', () => setHoveredSite(null));
          
          markersRef.current.push(marker);
        });
      }
    });
  }, [gisData, setHoveredSite]);

  return <div ref={mapContainerRef} className="w-full h-full z-0 absolute inset-0 bg-slate-100" />;
}

export default function App() {
  const [formData, setFormData] = useState({
    location: '',
    demographics: 'urban-dense',
    traffic: 'highway-adjacent',
    amenities: 'retail',
    budget: 'medium'
  });

  const [loading, setLoading] = useState(false);
  const [gisData, setGisData] = useState(null);
  const [error, setError] = useState(null);
  const [hoveredSite, setHoveredSite] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const callGeminiWithRetry = async (prompt) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: "You are an expert GIS analyst, urban planner, and EV infrastructure consultant. Generate realistic, precise hypothetical map coordinates (latitude/longitude) and site planning data based on the user's geographic and demographic requests." }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            cityCenter: {
              type: "OBJECT",
              properties: {
                lat: { type: "NUMBER" },
                lng: { type: "NUMBER" }
              }
            },
            sites: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "INTEGER" },
                  lat: { type: "NUMBER" },
                  lng: { type: "NUMBER" },
                  name: { type: "STRING" },
                  rationale: { type: "STRING" },
                  chargers: { type: "STRING" }
                }
              }
            }
          }
        }
      }
    };

    const delays = [500, 1000];
    let lastError;

    for (let i = 0; i <= 2; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);

        const data = await response.json();
        const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return JSON.parse(jsonString);
      } catch (err) {
        lastError = err;
        if (i < 2) await new Promise(res => setTimeout(res, delays[i]));
      }
    }
    throw new Error("Failed to connect to AI. Please try again.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.location.trim()) {
      setError("Please enter a target location (City, State, or Region).");
      return;
    }

    setLoading(true);
    setError(null);
    setGisData(null);
    setHoveredSite(null);

    const prompt = `
      Determine the central coordinates (lat/lng) for: ${formData.location}.
      Then, recommend the top 3 optimal hypothetical sites to build NEW EV charging infrastructure in or around that exact location.
      
      Criteria constraints:
      - Demographics / Area Type: ${formData.demographics.replace('-', ' ')}
      - Traffic Profile: ${formData.traffic.replace('-', ' ')}
      - Nearby Amenities: ${formData.amenities.replace('-', ' ')}
      - Expected Scale/Budget: ${formData.budget}
      
      CRITICAL: Ensure the coordinates (lat/lng) for the 3 sites are realistic and actually located near the requested city center (e.g. within a 0.05 to 0.1 degree radius), accurately reflecting the demographics (e.g., near a highway if requested).
    `;

    try {
      const parsedData = await callGeminiWithRetry(prompt);
      setGisData(parsedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-emerald-900 text-white shadow-md z-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <MapIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">EV GIS Prospector</h1>
              <p className="text-emerald-100 text-xs">AI Geospatial Infrastructure Planning</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[600px]">
          
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-4 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-y-auto z-20">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                Spatial Query Parameters
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-slate-400" />
                    Target Region
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g. Miami, FL or I-95 Corridor"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                  />
                </div>

                {/* Demographics */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    Zoning / Demographics
                  </label>
                  <select
                    name="demographics"
                    value={formData.demographics}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                  >
                    <option value="urban-dense">Dense Urban / City Center</option>
                    <option value="suburban-residential">Suburban Residential</option>
                    <option value="commercial-district">Commercial / Business District</option>
                    <option value="rural-corridor">Rural Transit Corridor</option>
                  </select>
                </div>

                {/* Traffic */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Car className="h-4 w-4 text-slate-400" />
                    Traffic Profile
                  </label>
                  <select
                    name="traffic"
                    value={formData.traffic}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                  >
                    <option value="highway-adjacent">Highway / Interstate Adjacent</option>
                    <option value="local-commuter">Heavy Local Commuter Traffic</option>
                    <option value="destination-traffic">Destination / Tourism Traffic</option>
                    <option value="ride-share-hub">Ride-share / Taxi Hub</option>
                  </select>
                </div>

                {/* Amenities */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Building className="h-4 w-4 text-slate-400" />
                    Surrounding Amenities
                  </label>
                  <select
                    name="amenities"
                    value={formData.amenities}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                  >
                    <option value="retail">Retail Shopping & Groceries</option>
                    <option value="dining">Restaurants & Fast Food</option>
                    <option value="workplaces">Office Parks & Workplaces</option>
                    <option value="parks-recreation">Parks & Recreation</option>
                    <option value="none-isolated">Isolated / Rest Stop</option>
                  </select>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-emerald-400 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Running Spatial Analysis...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-5 w-5" />
                      Generate GIS Locations
                    </>
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3 border border-red-200 text-sm">
                  <ShieldAlert className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Map */}
          <div className="lg:col-span-8 bg-slate-200 rounded-xl border border-slate-300 overflow-hidden relative shadow-inner z-10">
            
            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-12">
                <Loader2 className="h-12 w-12 text-emerald-600 animate-spin mb-4" />
                <h3 className="text-xl font-medium text-emerald-900">Geolocating Optimal Sites...</h3>
                <p className="text-slate-600 mt-2">The AI is parsing geographic data and generating precise coordinates.</p>
              </div>
            )}

            {/* GIS Hover Details Overlay Card (Floats above map) */}
            {hoveredSite && !loading && (
              <div className="absolute top-4 right-4 z-[1000] w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300">
                <div className="bg-emerald-600 px-4 py-3 flex items-start gap-3">
                  <Zap className="h-6 w-6 text-emerald-100 flex-shrink-0" />
                  <div>
                    <h3 className="text-white font-bold leading-tight">{hoveredSite.name}</h3>
                    <p className="text-emerald-100 text-xs mt-1 font-mono">
                      {hoveredSite.lat.toFixed(4)}, {hoveredSite.lng.toFixed(4)}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-white space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      <Info className="h-3.5 w-3.5" /> Site Rationale
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {hoveredSite.rationale}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      <BatteryCharging className="h-3.5 w-3.5" /> Charger Mix
                    </div>
                    <p className="text-emerald-700 text-sm font-medium">
                      {hoveredSite.chargers}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Initial Placeholder (Before search) */}
            {!gisData && !loading && (
               <div className="absolute inset-0 z-50 bg-slate-100/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-12">
               <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                 <MapIcon className="h-10 w-10 text-emerald-500 opacity-50" />
               </div>
               <h3 className="text-xl font-medium text-slate-700 mb-2">Awaiting GIS Query</h3>
               <p className="text-slate-500 max-w-md">
                 Configure your parameters on the left and run the spatial analysis to populate the map with AI-predicted EV infrastructure coordinates.
               </p>
             </div>
            )}

            {/* Real Street Map Layer */}
            <RealMap gisData={gisData} setHoveredSite={setHoveredSite} />
            
          </div>
        </div>
      </main>
    </div>
  );
}