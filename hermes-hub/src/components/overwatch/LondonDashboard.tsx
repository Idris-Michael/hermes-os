import React, { useState, useEffect, useMemo, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, FullscreenControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plane, Camera, AlertTriangle, Activity, X, Maximize2, RefreshCw, Crosshair, Map as MapIcon, Video, Brain, ShieldCheck, Zap, Info, MessageSquare, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInterval } from '../../hooks/useInterval';
import { format } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import TacticalAI from './TacticalAI';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const INITIAL_VIEW_STATE = {
  longitude: -0.1276,
  latitude: 51.5072,
  zoom: 13.5,
  pitch: 65,
  bearing: -15
};

const VIEWPOINTS = [
  { name: 'overview', label: 'GLOBAL OVERVIEW', state: INITIAL_VIEW_STATE },
  { name: 'city', label: 'FINANCIAL DISTRICT', state: { longitude: -0.0890, latitude: 51.5126, zoom: 15.5, pitch: 80, bearing: 30 } },
  { name: 'airport', label: 'HEATHROW AIRPORT', state: { longitude: -0.4543, latitude: 51.4700, zoom: 14, pitch: 60, bearing: -20 } },
  { name: 'street', label: 'STREET LEVEL', state: { longitude: -0.1276, latitude: 51.5072, zoom: 17.5, pitch: 85, bearing: 45 } },
];

interface Flight {
  icao24: string;
  callsign: string;
  origin_country: string;
  longitude: number;
  latitude: number;
  altitude: number;
  velocity: number;
  true_track: number;
}

interface JamCam {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  imageUrl: string;
  videoUrl: string;
}

interface Disruption {
  id: string;
  location: string;
  severity: string;
  category: string;
  comments: string;
  lat: number;
  lon: number;
}

interface TubeStatus {
  id: string;
  name: string;
  statusSeverityDescription: string;
}

interface Client {
  id: string;
  name: string;
  business: string;
  sector: string;
  lat: number;
  lng: number;
  address: string;
  status: "Lead" | "Active" | "Retained";
  services: string[];
  monthlySpend: number;
  notes: string;
  contact: string;
}

export default function LondonDashboard() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [jamCams, setJamCams] = useState<JamCam[]>([]);
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [tubeStatus, setTubeStatus] = useState<TubeStatus[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [activeTab, setActiveTab] = useState<'flights' | 'cams' | 'disruptions' | 'intelligence'>('flights');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [hoveredCam, setHoveredCam] = useState<JamCam | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiReport, setAiReport] = useState<string>('');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const mapRef = useRef<any>(null);
  const animationRef = useRef<number>(undefined);
  const [isRotating, setIsRotating] = useState(true);

  // Auto-rotate camera effect
  useEffect(() => {
    if (!mapRef.current || !isRotating) return;

    let startTime: number;
    
    const rotateCamera = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      
      const map = mapRef.current?.getMap();
      if (map && isRotating) {
        // Rotate slowly, approx 1 degree every 200ms
        const currentBearing = map.getBearing();
        map.rotateTo((currentBearing + 0.1) % 360, { duration: 0 });
        animationRef.current = requestAnimationFrame(rotateCamera);
      }
    };

    animationRef.current = requestAnimationFrame(rotateCamera);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRotating]); // re-run if map becomes available or rotation state changes

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Flights
      const flightsRes = await fetch('/api/flights');
      if (flightsRes.ok) {
        const flightsData = await flightsRes.json();
        if (flightsData.states) {
          const parsedFlights = flightsData.states.map((s: any) => ({
            icao24: s[0],
            callsign: s[1]?.trim() || 'UNKNOWN',
            origin_country: s[2],
            longitude: s[5],
            latitude: s[6],
            altitude: s[7] || s[13] || 0,
            velocity: s[9] || 0,
            true_track: s[10] || 0
          })).filter((f: any) => f.longitude && f.latitude);
          setFlights(parsedFlights);
        }
      }

      // Fetch JamCams
      const camsRes = await fetch('/api/cams');
      if (camsRes.ok) {
        const camsData = await camsRes.json();
        const parsedCams = camsData.map((c: any) => {
          const imageUrl = c.additionalProperties?.find((p: any) => p.key === 'imageUrl')?.value;
          const videoUrl = c.additionalProperties?.find((p: any) => p.key === 'videoUrl')?.value;
          return {
            id: c.id,
            commonName: c.commonName,
            lat: c.lat,
            lon: c.lon,
            imageUrl,
            videoUrl
          };
        }).filter((c: any) => c.imageUrl && c.videoUrl);
        setJamCams(parsedCams.slice(0, 200)); // Limit to 200 for performance
      }

      // Fetch Disruptions
      const disRes = await fetch('/api/disruptions');
      if (disRes.ok) {
        const disData = await disRes.json();
        const parsedDis = disData.map((d: any) => {
          let lat = 0, lon = 0;
          if (typeof d.point === 'string') {
            try {
              const coords = JSON.parse(d.point);
              if (Array.isArray(coords) && coords.length === 2) {
                lat = coords[0];
                lon = coords[1];
                if (lat < lon) {
                  const temp = lat;
                  lat = lon;
                  lon = temp;
                }
              }
            } catch (e) {}
          } else if (d.lat && d.lon) {
            lat = d.lat;
            lon = d.lon;
          }
          return {
            id: d.id,
            location: d.location,
            severity: d.severity,
            category: d.category,
            comments: d.comments,
            lat,
            lon
          };
        }).filter((d: any) => d.lat && d.lon);
        setDisruptions(parsedDis.slice(0, 100)); // Limit to 100
      }

      // Fetch Tube Status
      const tubeRes = await fetch('/api/tube');
      if (tubeRes.ok) {
        const tubeData = await tubeRes.json();
        const parsedTube = tubeData.map((l: any) => ({
          id: l.id,
          name: l.name,
          statusSeverityDescription: l.lineStatuses[0]?.statusSeverityDescription || 'Unknown'
        }));
        setTubeStatus(parsedTube);
      }

      // Fetch Clients
      const clientsRes = await fetch('/api/clients');
      if (clientsRes.ok) setClients(await clientsRes.json());
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useInterval(fetchData, 30000);

  const generateAiReport = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const flightContext = flights.slice(0, 5).map(f => `${f.callsign} (${f.icao24}) at ${Math.round(f.altitude)}m`).join(', ');
      const disruptionContext = disruptions.slice(0, 5).map(d => `${d.severity}: ${d.location}`).join(', ');
      const tubeContext = tubeStatus.filter(t => t.statusSeverityDescription !== 'Good Service').map(t => `${t.name}: ${t.statusSeverityDescription}`).join(', ');

      const prompt = `As the Severus Overwatch Tactical AI, provide a high-level concise situation report for London.
      Current Data:
      - Flights: ${flights.length} airborne. Examples: ${flightContext}
      - Road Disruptions: ${disruptions.length} active. Examples: ${disruptionContext}
      - Tube Issues: ${tubeContext || 'None reported'}
      
      Format your response with:
      1. TACTICAL OVERVIEW (one sentence)
      2. KEY RISKS (bullet points)
      3. RECOMMENDED ACTIONS FOR OVERSIGHT (short advice)
      Keep it professional, cyberpunk-themed (Severus Overwatch), and under 150 words.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiReport(result.text || 'Unable to generate analysis.');
    } catch (error) {
      console.error("AI Generation Error:", error);
      setAiReport("Tactical uplink failed. Error in intelligence gathering.");
    } finally {
      setAiGenerating(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'intelligence' && !aiReport && !loading) {
      generateAiReport();
    }
  }, [activeTab, loading]);

  const handleItemClick = (item: any, type: string) => {
    setSelectedItem({ ...item, type });
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [item.longitude || item.lon, item.latitude || item.lat],
        zoom: 14,
        duration: 1500
      });
    }
  };

  const flyToViewpoint = (viewpointState: any) => {
    setIsRotating(false);
    if (mapRef.current) {
      mapRef.current.flyTo({
        ...viewpointState,
        duration: 3000,
        essential: true
      });
    }
  };

  const activeFlightTrails = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: flights.map(f => {
        const backHeading = (f.true_track + 180) % 360;
        const rad = backHeading * (Math.PI / 180);
        const distance = 0.05 * (Math.max(f.velocity, 50) / 200); // Scale length by velocity
        const trailLat = f.latitude + Math.cos(rad) * distance;
        const trailLon = f.longitude + Math.sin(rad) * distance;
        
        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [f.longitude, f.latitude],
              [trailLon, trailLat]
            ]
          },
          properties: {
            id: f.icao24
          }
        };
      })
    };
  }, [flights]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      <div className="scanline"></div>
      <div className="hex-grid"></div>
      
      {/* Radar Sweep Overlay */}
      <div className="radar-container">
        <div className="radar-rings"></div>
        <div className="radar-sweep"></div>
      </div>

      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <Map
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          maxPitch={85}
          onMouseDown={() => setIsRotating(false)}
          onWheel={() => setIsRotating(false)}
          onTouchStart={() => setIsRotating(false)}
          onZoomStart={() => setIsRotating(false)}
          onPitchStart={() => setIsRotating(false)}
        >
          {/* Flight Trails 3D Laser Effect */}
          {activeTab === 'flights' && (
            <Source id="flight-trails" type="geojson" data={activeFlightTrails as any}>
              <Layer
                id="flight-trails-line"
                type="line"
                paint={{
                  'line-color': '#00f0ff',
                  'line-width': 3,
                  'line-opacity': 0.8,
                  'line-blur': 2
                }}
              />
            </Source>
          )}

          {/* 3D Buildings Layer directly using Carto's building source layer if it's rendered, otherwise default from maplibre */}
          <Layer 
            id="3d-buildings"
            source="carto"
            source-layer="building"
            type="fill-extrusion"
            minzoom={12}
            paint={{
              'fill-extrusion-color': [
                "interpolate", ["linear"], ["get", "render_height"],
                0, '#0a0a0f',
                30, '#12121a',
                70, '#1a1a2e',
                150, '#004455',
                300, '#00f0ff'
              ],
              'fill-extrusion-height': ["*", ["get", "render_height"], 1.2],
              'fill-extrusion-base': ["*", ["get", "render_min_height"], 1.2],
              'fill-extrusion-opacity': 0.8
            }}
          />

          {/* Markers */}
          {activeTab === 'flights' && flights.map(f => (
            <Marker key={f.icao24} longitude={f.longitude} latitude={f.latitude} pitchAlignment="map">
              <div 
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={(e) => { e.stopPropagation(); handleItemClick(f, 'flight'); }}
              >
                <div className="relative flex items-center justify-center" style={{ transform: `rotate(${f.true_track}deg)` }}>
                  <div className="absolute w-8 h-8 rounded-full border border-[#00f0ff]/20 animate-ping" />
                  <Plane className="w-5 h-5 text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,1)] relative z-10" />
                </div>
              </div>
            </Marker>
          ))}

          {activeTab === 'cams' && jamCams.map(c => (
            <Marker key={c.id} longitude={c.lon} latitude={c.lat} pitchAlignment="map">
              <div 
                className="cursor-pointer transform transition-transform hover:scale-125"
                onClick={(e) => { e.stopPropagation(); handleItemClick(c, 'cam'); }}
                onMouseEnter={() => setHoveredCam(c)}
                onMouseLeave={() => setHoveredCam(null)}
              >
                <div className="relative flex justify-center items-center">
                  <div className="absolute w-6 h-6 bg-[#39ff14]/30 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '1.5s' }} />
                  <div className="w-3 h-3 bg-[#39ff14] rounded-full shadow-[0_0_12px_rgba(57,255,20,1)] border border-black z-10 relative" />
                </div>
              </div>
            </Marker>
          ))}

          {activeTab === 'disruptions' && disruptions.map(d => (
            <Marker key={d.id} longitude={d.lon} latitude={d.lat} pitchAlignment="map">
              <div
                className="cursor-pointer transform transition-transform hover:scale-125"
                onClick={(e) => { e.stopPropagation(); handleItemClick(d, 'disruption'); }}
              >
                <div className="relative flex justify-center items-center">
                   <div className="absolute w-8 h-8 bg-[#ff003c]/20 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                   <AlertTriangle className="w-5 h-5 text-[#ff003c] drop-shadow-[0_0_10px_rgba(255,0,60,1)] z-10 relative" />
                </div>
              </div>
            </Marker>
          ))}

          {/* Client Pins — always visible */}
          {clients.map(c => {
            const statusColor = c.status === 'Retained' ? '#C9A84C' : c.status === 'Active' ? '#22c55e' : '#94a3b8';
            return (
              <Marker key={c.id} longitude={c.lng} latitude={c.lat} pitchAlignment="map">
                <div
                  className="cursor-pointer transition-transform hover:scale-125"
                  onClick={(e) => { e.stopPropagation(); setSelectedClient(c); }}
                >
                  <div className="relative flex flex-col items-center">
                    <div className="absolute w-10 h-10 rounded-full animate-ping pointer-events-none" style={{ background: `${statusColor}20`, animationDuration: '3s' }} />
                    <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2" style={{ background: '#0f1c2e', borderColor: statusColor, boxShadow: `0 0 12px ${statusColor}80` }}>
                      <Building2 size={13} color={statusColor} />
                    </div>
                    <div className="mt-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold whitespace-nowrap" style={{ background: '#0f1c2e', color: statusColor, border: `1px solid ${statusColor}40`, fontSize: '9px', letterSpacing: '0.05em' }}>
                      {c.business}
                    </div>
                  </div>
                </div>
              </Marker>
            );
          })}

          {/* Client Popup */}
          {selectedClient && (
            <Popup
              longitude={selectedClient.lng}
              latitude={selectedClient.lat}
              anchor="bottom"
              onClose={() => setSelectedClient(null)}
              closeButton={false}
              offset={20}
            >
              <div className="p-3 min-w-[220px]" style={{ background: '#0f1c2e', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10 }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-sm text-white">{selectedClient.business}</p>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>{selectedClient.name} · {selectedClient.sector}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono shrink-0" style={{
                    background: selectedClient.status === 'Retained' ? 'rgba(201,168,76,0.15)' : selectedClient.status === 'Active' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                    color: selectedClient.status === 'Retained' ? '#C9A84C' : selectedClient.status === 'Active' ? '#22c55e' : '#94a3b8'
                  }}>
                    {selectedClient.status}
                  </span>
                </div>
                <p className="text-xs mb-2" style={{ color: '#64748b' }}>{selectedClient.address}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedClient.services.map(s => (
                    <span key={s} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: '10px' }}>{s}</span>
                  ))}
                </div>
                {selectedClient.monthlySpend > 0 && (
                  <p className="text-xs font-mono" style={{ color: '#C9A84C' }}>£{selectedClient.monthlySpend.toLocaleString()}/mo</p>
                )}
                <p className="text-xs mt-1" style={{ color: '#64748b' }}>{selectedClient.notes}</p>
                <button onClick={() => setSelectedClient(null)} className="absolute top-2 right-2 opacity-50 hover:opacity-100">
                  <X size={12} color="#94a3b8" />
                </button>
              </div>
            </Popup>
          )}

          {/* Map Popups */}
          {/* Hover Popup for Cams */}
          {hoveredCam && (!selectedItem || selectedItem.id !== hoveredCam.id) && (
            <Popup
              longitude={hoveredCam.lon}
              latitude={hoveredCam.lat}
              anchor="bottom"
              closeButton={false}
              closeOnClick={false}
              className="z-40 pointer-events-none"
              maxWidth="200px"
              offset={[0, -10]}
            >
              <div className="bg-black/90 border border-[#39ff14]/30 p-1.5 rounded text-white font-sans shadow-[0_0_15px_rgba(57,255,20,0.2)]">
                <div className="text-[10px] font-bold mb-1 text-[#39ff14] flex items-center gap-1 w-40">
                  <Video className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{hoveredCam.commonName}</span>
                </div>
                <div className="relative rounded overflow-hidden aspect-video bg-gray-900">
                  <img 
                    src={hoveredCam.imageUrl} 
                    alt={hoveredCam.commonName}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </Popup>
          )}

          {selectedItem && selectedItem.type === 'cam' && (
            <Popup
              longitude={selectedItem.lon}
              latitude={selectedItem.lat}
              anchor="bottom"
              onClose={() => setSelectedItem(null)}
              closeButton={true}
              closeOnClick={false}
              className="z-50"
              maxWidth="320px"
            >
              <div className="bg-black/90 border border-white/20 p-2 rounded-lg text-white font-sans w-72">
                <div className="text-xs font-bold mb-2 text-[#39ff14] flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  {selectedItem.commonName}
                </div>
                <div className="relative rounded overflow-hidden aspect-video bg-gray-900 border border-white/10">
                  <video 
                    src={selectedItem.videoUrl} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    className="w-full h-full object-cover"
                    poster={selectedItem.imageUrl}
                  />
                  <div className="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-[#39ff14] border border-[#39ff14]/30">
                    REC
                  </div>
                </div>
              </div>
            </Popup>
          )}

          {/* Map Controls */}
          <NavigationControl position="bottom-right" visualizePitch={true} />
          <FullscreenControl position="bottom-right" />
        </Map>
      </div>

      {/* Camera Viewpoints Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="glass-panel p-2 rounded-full pointer-events-auto flex items-center gap-2 border border-[#00f0ff]/30 bg-black/60 shadow-[0_0_20px_rgba(0,240,255,0.1)] backdrop-blur-md">
          {VIEWPOINTS.map((vp) => (
            <button
              key={vp.name}
              onClick={() => flyToViewpoint(vp.state)}
              className="px-4 py-2 rounded-full text-[10px] font-mono font-bold tracking-widest text-[#00f0ff] hover:bg-[#00f0ff]/20 hover:text-white transition-all uppercase"
            >
              {vp.label}
            </button>
          ))}
          <div className="w-px h-6 bg-white/20 mx-1"></div>
          {/* Client list dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 rounded-full text-[10px] font-mono font-bold tracking-widest text-[#C9A84C] hover:bg-[#C9A84C]/20 hover:text-white transition-all uppercase flex items-center gap-2">
              <Building2 className="w-3 h-3" />
              CLIENTS ({clients.length})
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64">
              <div className="rounded-xl overflow-hidden shadow-2xl" style={{ background: '#0a1628', border: '1px solid rgba(201,168,76,0.3)' }}>
                {clients.map((c) => {
                  const statusColor = c.status === 'Retained' ? '#C9A84C' : c.status === 'Active' ? '#22c55e' : '#64748b';
                  return (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                      onClick={() => {
                        flyToViewpoint({ longitude: c.lng, latitude: c.lat, zoom: 16, pitch: 60, bearing: 0 });
                        setSelectedClient(c);
                      }}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{c.business}</p>
                        <p className="text-[10px] truncate" style={{ color: '#64748b' }}>{c.sector} · {c.address.split(',')[0]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="w-px h-6 bg-white/20 mx-1"></div>
          <button
            onClick={() => { setIsRotating(true); flyToViewpoint(INITIAL_VIEW_STATE); }}
            className="px-4 py-2 rounded-full text-[10px] font-mono font-bold tracking-widest text-[#39ff14] hover:bg-[#39ff14]/20 hover:text-white transition-all uppercase flex items-center gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            RESET TARGET
          </button>
        </div>
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="glass-panel px-6 py-3 rounded-lg pointer-events-auto flex items-center gap-4">
          <Activity className="w-6 h-6 neon-text-blue" />
          <div>
            <h1 className="text-xl font-bold tracking-widest uppercase">Severus Overwatch</h1>
            <div className="text-xs font-mono text-gray-400 flex items-center gap-2">
              <span>SYS.ONLINE</span>
              <span className="w-1 h-1 rounded-full bg-[#39ff14] animate-pulse"></span>
              <span>{format(lastUpdated, 'HH:mm:ss')}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel px-4 py-2 rounded-lg pointer-events-auto flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-mono neon-text-blue">{flights.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Airborne</div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="text-center">
            <div className="text-2xl font-mono neon-text-green">{jamCams.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Live Cams</div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="text-center">
            <div className="text-2xl font-mono neon-text-red">{disruptions.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Alerts</div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="text-center">
            <div className={`text-2xl font-mono ${tubeStatus.some(t => t.statusSeverityDescription !== 'Good Service') ? 'neon-text-red' : 'neon-text-green'}`}>
              {tubeStatus.filter(t => t.statusSeverityDescription === 'Good Service').length}/{tubeStatus.length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Lines OK</div>
          </div>
          <button 
            onClick={() => setIsAiOpen(!isAiOpen)}
            className={`ml-4 p-2 rounded-full transition-colors flex items-center gap-2 border ${isAiOpen ? 'bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/50' : 'bg-black/40 text-gray-400 border-white/10 hover:text-white hover:border-white/30'}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline">AI Comm</span>
          </button>
          <button 
            onClick={fetchData}
            className="ml-2 p-2 hover:bg-white/10 rounded-full transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gray-400' : 'text-white'}`} />
          </button>
        </div>
      </div>

      {/* Left Sidebar - Controls & List */}
      <div className="absolute top-24 left-4 bottom-4 w-80 z-10 flex flex-col gap-4 pointer-events-none">
        {/* Tabs */}
        <div className="glass-panel p-2 rounded-lg pointer-events-auto flex gap-2">
          <button
            onClick={() => setActiveTab('flights')}
            className={`flex-1 py-2 px-3 rounded text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'flights' ? 'bg-white/10 text-[#00f0ff]' : 'text-gray-400 hover:text-white'}`}
          >
            <Plane className="w-4 h-4" /> Air
          </button>
          <button
            onClick={() => setActiveTab('cams')}
            className={`flex-1 py-2 px-3 rounded text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'cams' ? 'bg-white/10 text-[#39ff14]' : 'text-gray-400 hover:text-white'}`}
          >
            <Camera className="w-4 h-4" /> Cams
          </button>
          <button
            onClick={() => setActiveTab('disruptions')}
            className={`flex-1 py-2 px-3 rounded text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'disruptions' ? 'bg-white/10 text-[#ff003c]' : 'text-gray-400 hover:text-white'}`}
          >
            <AlertTriangle className="w-4 h-4" /> Alerts
          </button>
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`flex-1 py-2 px-3 rounded text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'intelligence' ? 'bg-white/10 text-[#a855f7]' : 'text-gray-400 hover:text-white'}`}
          >
            <Brain className="w-4 h-4" /> Intel
          </button>
        </div>

        {/* List */}
        <div className="glass-panel rounded-lg flex-1 overflow-hidden flex flex-col pointer-events-auto">
          <div className="p-3 border-b border-white/10 text-xs font-mono text-gray-400 uppercase tracking-wider flex justify-between items-center">
            <span>{activeTab === 'flights' ? 'Active Flights' : activeTab === 'cams' ? 'Traffic Cameras' : activeTab === 'disruptions' ? 'Active Disruptions' : 'AI Situation Report'}</span>
            <span>{activeTab === 'flights' ? flights.length : activeTab === 'cams' ? jamCams.length : activeTab === 'disruptions' ? disruptions.length : 'BETA'}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading && flights.length === 0 ? (
              <div className="flex justify-center items-center h-full text-gray-500 font-mono text-xs">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> SCANNING...
              </div>
            ) : (
              <>
                {activeTab === 'intelligence' && (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-[#a855f7] mb-2">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Neural Link Active</span>
                    </div>
                    {aiGenerating ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-4 bg-white/5 rounded w-3/4"></div>
                        <div className="h-4 bg-white/5 rounded w-full"></div>
                        <div className="h-4 bg-white/5 rounded w-5/6"></div>
                        <div className="h-20 bg-white/5 rounded w-full"></div>
                      </div>
                    ) : (
                      <div className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {aiReport}
                        <button 
                          onClick={generateAiReport}
                          className="mt-4 block w-full py-2 border border-[#a855f7]/30 rounded hover:bg-[#a855f7]/10 transition-colors text-[#a855f7] uppercase tracking-tighter"
                        >
                          Refresh Neural Link
                        </button>
                      </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 text-gray-400 mb-3">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Network Status</span>
                      </div>
                      <div className="space-y-1">
                        {tubeStatus.map(line => (
                          <div key={line.id} className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-gray-400">{line.name}</span>
                            <span className={line.statusSeverityDescription === 'Good Service' ? 'text-[#39ff14]' : 'text-[#ff003c]'}>
                              {line.statusSeverityDescription}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'flights' && flights.map((f, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    key={f.icao24}
                    onClick={() => handleItemClick(f, 'flight')}
                    className={`p-3 rounded border cursor-pointer transition-colors ${selectedItem?.icao24 === f.icao24 ? 'bg-[#00f0ff]/10 border-[#00f0ff]/50' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono font-bold text-[#00f0ff]">{f.callsign}</span>
                      <span className="text-[10px] font-mono text-gray-400">{f.icao24}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>ALT: {Math.round(f.altitude)}m</span>
                      <span>SPD: {Math.round(f.velocity * 3.6)}km/h</span>
                    </div>
                  </motion.div>
                ))}
                
                {activeTab === 'cams' && jamCams.map((c, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    key={c.id}
                    onClick={() => handleItemClick(c, 'cam')}
                    className={`p-3 rounded border cursor-pointer transition-colors ${selectedItem?.id === c.id ? 'bg-[#39ff14]/10 border-[#39ff14]/50' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Video className="w-4 h-4 text-[#39ff14] mt-0.5 shrink-0" />
                      <span className="text-xs leading-tight text-gray-200">{c.commonName}</span>
                    </div>
                  </motion.div>
                ))}

                {activeTab === 'disruptions' && disruptions.map((d, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    key={d.id}
                    onClick={() => handleItemClick(d, 'disruption')}
                    className={`p-3 rounded border cursor-pointer transition-colors ${selectedItem?.id === d.id ? 'bg-[#ff003c]/10 border-[#ff003c]/50' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-[#ff003c] mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-gray-200 mb-1">{d.location}</div>
                        <div className="text-[10px] text-gray-400 uppercase">{d.category}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Details Panel */}
      <AnimatePresence>
        {isAiOpen && (
          <TacticalAI 
            onClose={() => setIsAiOpen(false)} 
            contextData={{ flights: flights.length, jams: jamCams.length, disruptions: disruptions.length }}
          />
        )}
        
        {selectedItem && (
          <motion.div 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-24 right-4 bottom-4 w-96 z-10 pointer-events-none"
          >
            <div className="glass-panel h-full rounded-lg pointer-events-auto flex flex-col overflow-hidden relative">
              <motion.div 
                initial={{ top: "-10%" }}
                animate={{ top: "110%" }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-b from-transparent to-[#00f0ff] opacity-30 z-20"
              />
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40 relative z-30">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Target Acquired</span>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-white/10 rounded transition-colors relative z-40">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 relative z-30">
                {selectedItem.type === 'flight' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-3xl font-mono font-bold neon-text-blue mb-1">{selectedItem.callsign}</h2>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">{selectedItem.origin_country}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 p-3 rounded border border-white/5">
                        <div className="text-[10px] text-gray-500 font-mono mb-1">ALTITUDE</div>
                        <div className="text-lg font-mono">{Math.round(selectedItem.altitude)} <span className="text-xs text-gray-500">m</span></div>
                      </div>
                      <div className="bg-black/40 p-3 rounded border border-white/5">
                        <div className="text-[10px] text-gray-500 font-mono mb-1">VELOCITY</div>
                        <div className="text-lg font-mono">{Math.round(selectedItem.velocity * 3.6)} <span className="text-xs text-gray-500">km/h</span></div>
                      </div>
                      <div className="bg-black/40 p-3 rounded border border-white/5">
                        <div className="text-[10px] text-gray-500 font-mono mb-1">HEADING</div>
                        <div className="text-lg font-mono">{Math.round(selectedItem.true_track)}°</div>
                      </div>
                      <div className="bg-black/40 p-3 rounded border border-white/5">
                        <div className="text-[10px] text-gray-500 font-mono mb-1">ICAO24</div>
                        <div className="text-lg font-mono text-[#00f0ff]">{selectedItem.icao24}</div>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <div className="text-[10px] text-gray-500 font-mono mb-2">COORDINATES</div>
                      <div className="font-mono text-sm">
                        LAT: {selectedItem.latitude.toFixed(6)}<br/>
                        LON: {selectedItem.longitude.toFixed(6)}
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem.type === 'cam' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1 leading-tight">{selectedItem.commonName}</h2>
                      <div className="text-xs text-[#39ff14] font-mono uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse"></span>
                        Live Feed Active
                      </div>
                    </div>
                    
                    <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black aspect-video group">
                      <video 
                        src={selectedItem.videoUrl} 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        className="w-full h-full object-cover"
                        poster={selectedItem.imageUrl}
                      />
                      <div className="absolute inset-0 border-2 border-[#39ff14]/30 pointer-events-none"></div>
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-[#39ff14] border border-[#39ff14]/30">
                        REC
                      </div>
                    </div>
                    
                    <div className="bg-black/40 p-4 rounded border border-white/5">
                      <div className="text-[10px] text-gray-500 font-mono mb-2">CAMERA ID</div>
                      <div className="font-mono text-sm text-gray-300">{selectedItem.id}</div>
                    </div>
                    
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-[10px] text-gray-500 font-mono mb-2">COORDINATES</div>
                      <div className="font-mono text-sm">
                        LAT: {selectedItem.lat.toFixed(6)}<br/>
                        LON: {selectedItem.lon.toFixed(6)}
                      </div>
                    </div>
                  </div>
                )}

                {selectedItem.type === 'disruption' && (
                  <div className="space-y-6">
                    <div>
                      <div className="inline-block px-2 py-1 bg-[#ff003c]/20 border border-[#ff003c]/50 rounded text-[#ff003c] text-[10px] font-mono uppercase tracking-widest mb-3">
                        {selectedItem.severity}
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2 leading-tight">{selectedItem.location}</h2>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">{selectedItem.category}</div>
                    </div>
                    
                    <div className="bg-black/40 p-4 rounded border border-white/5 text-sm text-gray-300 leading-relaxed">
                      {selectedItem.comments}
                    </div>
                    
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-[10px] text-gray-500 font-mono mb-2">COORDINATES</div>
                      <div className="font-mono text-sm">
                        LAT: {selectedItem.lat.toFixed(6)}<br/>
                        LON: {selectedItem.lon.toFixed(6)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
