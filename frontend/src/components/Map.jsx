import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
// FIX: Remove curly braces here
import DriftMarker from "react-leaflet-drift-marker"; 
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import io from 'socket.io-client';

// ... rest of your code (Icons, Styles, Logic) remains exactly the same ...
// --- CUSTOM ICONS ---

// 1. Warehouse (Yellow Building)
const warehouseIcon = new L.Icon({
    iconUrl: 'https://img.icons8.com/fluency/48/warehouse-1.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// 2. Blue Bike (IDLE)
const bikeIconBlue = new L.Icon({
    iconUrl: 'https://img.icons8.com/ultraviolet/48/scooter.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35]
});

// 3. Green Bike (ASSIGNED/BUSY)
const bikeIconGreen = new L.Icon({
    iconUrl: 'https://img.icons8.com/office/48/scooter.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35]
});

// 4. Customer (Red Pin - Existing)
const customerIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const socket = io('http://localhost:4000');

function ClickHandler({ onMapClick }) {
    useMapEvents({
        click(e) { onMapClick(e.latlng); },
    });
    return null;
}

const Map = () => {
    const [drivers, setDrivers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]); 
    
    // Keyed by driverId: { path: [[lat,lng]...], type: 'pickup'|'delivery' }
    const [driverRoutes, setDriverRoutes] = useState({});

    const [modalOpen, setModalOpen] = useState(false);
    const [tempCoords, setTempCoords] = useState(null); 
    const [formData, setFormData] = useState({ name: '', item: '' });

    useEffect(() => {
        fetch('http://localhost:4000/api/warehouses')
            .then(res => res.json())
            .then(data => setWarehouses(data));

        socket.on('drivers_update', (updatedDrivers) => {
            setDrivers(updatedDrivers);
        });

        socket.on('order_created', (newOrder) => {
            setActiveOrders(prev => [...prev, newOrder]);
        });

        // NEW: Receive actual path geometry from simulator
        socket.on('route_update', ({ driverId, routePath, type }) => {
            setDriverRoutes(prev => ({
                ...prev,
                [driverId]: { path: routePath, type }
            }));
        });

        socket.on('order_finished', ({ orderId }) => {
            setActiveOrders(prev => prev.filter(o => o.id !== orderId));
        });

        return () => {
            socket.off('drivers_update');
            socket.off('order_created');
            socket.off('route_update');
            socket.off('order_finished');
        };
    }, []);

    // Cleanup routes for idle drivers
    useEffect(() => {
        drivers.forEach(d => {
            if (d.status === 'IDLE' && driverRoutes[d.id]) {
                setDriverRoutes(prev => {
                    const newState = { ...prev };
                    delete newState[d.id];
                    return newState;
                });
            }
        });
    }, [drivers]);

    const handleMapClick = (coords) => {
        setTempCoords(coords);
        setModalOpen(true);
    };

    const handleOrder = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:4000/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: formData.name,
                    item: formData.item,
                    lat: tempCoords.lat,
                    lng: tempCoords.lng
                })
            });
            const data = await response.json();
            if (data.success) {
                setModalOpen(false);
                setFormData({ name: '', item: '' });
            } else {
                alert(data.message);
            }
        } catch (error) { console.error(error); }
    };

    // UI HELPER: Get status color for Sidebar
    const getStatusColor = (status) => {
        if (status === 'IDLE') return '#6c757d';
        if (status === 'ASSIGNED') return '#ffc107';
        if (status === 'TO_WAREHOUSE') return '#fd7e14';
        if (status === 'PICKUP') return '#17a2b8';
        if (status === 'TO_CUSTOMER') return '#28a745';
        return '#000';
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'Segoe UI, sans-serif' }}>
            
            {/* --- DASHBOARD SIDEBAR --- */}
            <div style={{ 
                width: '350px', background: '#fff', 
                boxShadow: '2px 0 10px rgba(0,0,0,0.1)', zIndex: 500,
                display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ padding: '20px', background: '#1a1a2e', color: 'white' }}>
                    <h2 style={{ margin: 0 }}>🚀 LogisticsSim</h2>
                    <p style={{ margin: '5px 0 0', opacity: 0.7, fontSize: '0.9rem' }}>Redis Geospatial & OSRM Routing</p>
                </div>

                <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{activeOrders.length}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Active Orders</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{drivers.length}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Drivers</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{drivers.filter(d=>d.status!=='IDLE').length}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Busy</div>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '15px', background: '#f8f9fa' }}>
                    <h4 style={{ marginTop: 0, color: '#444' }}>Live Deliveries</h4>
                    {activeOrders.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
                            No active orders.<br/>Click map to create one.
                        </div>
                    )}
                    {activeOrders.map(order => {
                        const driver = drivers.find(d => d.id === order.driverId);
                        return (
                            <div key={order.id} style={{ 
                                background: 'white', padding: '15px', marginBottom: '15px', 
                                borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                borderLeft: `4px solid ${driver ? getStatusColor(driver.status) : '#ccc'}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <strong>#{order.id}</strong>
                                    <span style={{ fontSize: '0.8rem', background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>
                                        {driver ? driver.status : 'PENDING'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333' }}>{order.customer_name}</div>
                                <div style={{ color: '#666', fontSize: '0.9rem' }}>📦 {order.item}</div>
                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>
                                    Driver: {order.driverId}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* --- MAP AREA --- */}
            <div style={{ flex: 1, position: 'relative' }}>
                <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap' />
                    <ClickHandler onMapClick={handleMapClick} />

                    {/* Warehouses - NEW ICON */}
                    {warehouses.map(w => (
                        <Marker key={`wh-${w.id}`} position={[w.lat, w.lng]} icon={warehouseIcon}>
                            <Popup>🏭 {w.name}</Popup>
                        </Marker>
                    ))}

                    {/* Drivers - NEW ANIMATED MARKER & ICONS */}
                    {drivers.map(d => (
                        <DriftMarker 
                            key={d.id} 
                            position={[d.lat, d.lng]} 
                            duration={1000} // Smooth animation duration (1s)
                            icon={d.status === "IDLE" ? bikeIconBlue : bikeIconGreen}
                        >
                            <Popup>
                                <strong>{d.id}</strong><br/>
                                Status: {d.status}
                            </Popup>
                        </DriftMarker>
                    ))}

                    {/* Active Order Pins (Customers) */}
                    {activeOrders.map(order => (
                        <Marker key={`cust-${order.id}`} position={[order.lat, order.lng]} icon={customerIcon}>
                            <Popup>User: {order.customer_name}<br/>Item: {order.item}</Popup>
                        </Marker>
                    ))}

                    {/* --- THE ROUTES (Polylines) --- */}
                    {Object.keys(driverRoutes).map(dId => {
                        const route = driverRoutes[dId];
                        const isPickup = route.type === 'pickup';
                        return (
                            <Polyline 
                                key={`route-${dId}`} 
                                positions={route.path} 
                                pathOptions={{ 
                                    color: isPickup ? '#fd7e14' : '#28a745', 
                                    weight: 4,
                                    opacity: 0.8,
                                    dashArray: isPickup ? '10, 10' : null 
                                }} 
                            />
                        );
                    })}

                </MapContainer>

                {/* --- MODAL FORM --- */}
                {modalOpen && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '300px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            <h3 style={{ marginTop: 0 }}>New Order</h3>
                            <p style={{ color: '#666', fontSize: '0.9rem' }}>Deliver to selected location</p>
                            <form onSubmit={handleOrder}>
                                <input 
                                    placeholder="Customer Name" 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    required 
                                    style={{ width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                                <input 
                                    placeholder="Item (e.g., Pizza, Laptop)" 
                                    value={formData.item} 
                                    onChange={e => setFormData({...formData, item: e.target.value})} 
                                    required 
                                    style={{ width: '100%', padding: '10px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="submit" style={{ flex: 1, padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create</button>
                                    <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '10px', background: '#eee', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Map;