import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Heart, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MakesGallery() {
    const [makes, setMakes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMakes = async () => {
            try {
                const makesRef = collection(db, 'makes');
                // Normally you'd filter by status === 'approved', but for MVP just fetch latest
                const q = query(makesRef, orderBy('createdAt', 'desc'), limit(20));
                const querySnapshot = await getDocs(q);
                
                const loadedMakes = [];
                querySnapshot.forEach((doc) => {
                    loadedMakes.push({ id: doc.id, ...doc.data() });
                });
                
                setMakes(loadedMakes);
            } catch (error) {
                console.error("Error fetching makes:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMakes();
    }, []);

    return (
        <div className="min-h-screen bg-[#f8f9fc] p-8 font-sans">
            <div className="max-w-7xl mx-auto flex flex-col gap-8">
                
                {/* Header */}
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Community Makes</h1>
                        <p className="text-gray-500 font-medium mt-1">See what others are printing with KenCreations Studio</p>
                    </div>
                    <Link to={!!window.electronAPI ? "/" : "/app"} className="px-5 py-2.5 rounded-xl bg-white text-gray-700 border border-gray-200 shadow-sm font-bold hover:bg-gray-50 transition-colors">
                        Back to Studio
                    </Link>
                </header>

                {/* Gallery Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="font-semibold">Loading gallery...</p>
                    </div>
                ) : makes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <ImageIcon size={48} className="mb-4 opacity-50" />
                        <h3 className="text-lg font-bold text-gray-700">No makes yet!</h3>
                        <p className="text-sm">Be the first to share your print and earn Maker Points.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {makes.map(make => (
                            <div key={make.id} className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:-translate-y-1 flex flex-col">
                                <div className="aspect-square w-full relative bg-gray-100 overflow-hidden">
                                    {make.imageUrls && make.imageUrls.length > 0 ? (
                                        <img 
                                            src={make.imageUrls[0]} 
                                            alt={make.generatorTitle || "Community Make"}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ImageIcon size={32} />
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold shadow-md">
                                        {make.generatorTitle || "KenCreations Model"}
                                    </div>
                                </div>
                                
                                <div className="p-4 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        {make.userPhoto ? (
                                            <img src={make.userPhoto} alt="Maker" className="w-6 h-6 rounded-full bg-gray-200" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-bold">
                                                {make.userName ? make.userName[0].toUpperCase() : "?"}
                                            </div>
                                        )}
                                        <span className="text-sm font-semibold text-gray-700 truncate flex-1">
                                            {make.userName || "Anonymous Maker"}
                                        </span>
                                    </div>
                                    
                                    {make.caption && (
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                            {make.caption}
                                        </p>
                                    )}
                                    
                                    <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                                        <button className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-coral-500 transition-colors">
                                            <Heart size={14} strokeWidth={2.5} />
                                            {make.likes || 0}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
