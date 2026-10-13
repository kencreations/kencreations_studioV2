import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PricingModal from "../components/UI/PricingModal";
import { useAccess } from "../contexts/AccessContext";

export default function Pricing() {
    const navigate = useNavigate();
    const access = useAccess();

    return (
        <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans">
            <Navbar
                isLicensed={access.hasActiveLicense}
                onPricingClick={() => {}}
            />
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <PricingModal
                    isOpen={true}
                    embedded={true}
                    onClose={() => navigate("/")}
                />
            </main>
        </div>
    );
}
