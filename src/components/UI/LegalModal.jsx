import React from "react";
import GlassModal from "./GlassModal";

/**
 * A modal to display legal documents (Terms, Privacy, Refund).
 */
export default function LegalModal({ isOpen, onClose, documentType }) {
    if (!isOpen || !documentType) return null;

    const getTitle = () => {
        switch (documentType) {
            case "terms":
                return "Terms and Conditions & Commercial License Agreement";
            case "privacy":
                return "Privacy Policy";
            case "refund":
                return "Refund Policy";
            default:
                return "";
        }
    };

    const renderContent = () => {
        switch (documentType) {
            case "terms":
                return (
                    <div className="space-y-6 text-gray-700 leading-relaxed text-sm">
                        <p>
                            These Terms and Conditions (“Terms”) govern access
                            to and use of <strong>Kencreations Studio</strong>{" "}
                            (including our desktop application, design
                            generators, slicer preparation utilities, and studio
                            management modules), developed and operated by Ken
                            Samonte, doing business as{" "}
                            <strong>Kencreations</strong> (“Kencreations,” “we,”
                            “us,” or “our”).
                        </p>
                        <p>
                            By purchasing a license key, activating an account,
                            downloading, or using the Service, you agree to
                            these Terms on behalf of yourself and, if
                            applicable, the business, studio, or commercial
                            entity you represent.
                        </p>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            1. Parties and Acceptance
                        </h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                <strong>Definition of "You":</strong> Refers to
                                the individual accessing the Service and, where
                                applicable, the print shop, studio, business, or
                                commercial entity on whose behalf the Service is
                                used.
                            </li>
                            <li>
                                <strong>Commercial Paid-Only Service:</strong>{" "}
                                Kencreations Studio is offered exclusively as a
                                paid, commercial-grade software suite for makers
                                and 3D printing businesses. We do not provide
                                public free evaluation access for exporting
                                files.
                            </li>
                            <li>
                                <strong>Agreement Requirement:</strong> If you
                                do not agree to these Terms in full, do not
                                purchase, install, access, or use the Service.
                            </li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            2. The Service & Scope of Operation
                        </h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                <strong>Tooling & Generation:</strong>{" "}
                                Kencreations Studio provides tools to design,
                                customize, preview, calculate costs for, and
                                export 3D-printable assets in formats such as
                                .stl and .3mf.
                            </li>
                            <li>
                                <strong>Software-Only Nature:</strong>{" "}
                                Kencreations Studio provides design software and
                                business calculation utilities only. We do not
                                manufacture, slice, package, ship, or sell
                                physical prints on your behalf.
                            </li>
                            <li>
                                <strong>Operator Responsibility:</strong> You
                                are solely responsible for all slicing
                                configurations, machine tolerances, print
                                execution, material selection, quality
                                assurance, fulfillment, and customer service
                                associated with the physical products you
                                manufacture.
                            </li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            3. Accounts, License Keys, and Device Authorization
                        </h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                <strong>Paid Entitlement & Credentials:</strong>{" "}
                                Access to export features requires a valid,
                                active license key. You agree to maintain strict
                                confidentiality over your access credentials and
                                activation keys.
                            </li>
                            <li>
                                <strong>Single-Seat Entitlement:</strong> Unless
                                your plan explicitly grants multi-seat access,
                                each license key is restricted to one named
                                user/business operator.
                            </li>
                            <li>
                                <strong>
                                    Prohibition on Credential Sharing:
                                </strong>{" "}
                                You may not rent, lease, sub-license, resell, or
                                publicly share your license keys or offline
                                authorization tokens.
                            </li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            4. Commercial Manufacturing License (Paid
                            Entitlement)
                        </h3>
                        <p>
                            Subject to an active, valid commercial license in
                            good standing, Kencreations grants you a limited,
                            non-exclusive, non-transferable, revocable license
                            to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                <strong>Create & Export:</strong> Use all
                                generators, design tools, and export functions
                                included in your purchased tier.
                            </li>
                            <li>
                                <strong>Physical Manufacturing & Sale:</strong>{" "}
                                3D-print physical items derived from exported
                                files and sell those finished physical products
                                under your own business or brand.
                            </li>
                            <li>
                                <strong>
                                    Commercial Quoting & Client Work:
                                </strong>{" "}
                                Utilize the Studio Management Hub to generate
                                client quotes and fulfill custom print orders.
                            </li>
                        </ul>

                        <p className="font-bold text-red-600 mt-4">
                            License Restrictions & Prohibitions (Physical
                            Objects Only)
                        </p>
                        <p>
                            You may <strong>NOT</strong>:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                Sell, redistribute, share, sub-license, bundle,
                                or publicly host the digital files (.stl, .3mf,
                                .obj, .step) or source geometries generated by
                                the software.
                            </li>
                            <li>
                                Extract, decompile, scrape, or distribute the
                                application’s procedural generation scripts, 3D
                                math routines, mesh templates, UI assets, or
                                fonts.
                            </li>
                            <li>
                                Continue manufacturing or selling physical
                                products after your commercial license has
                                expired, cancelled, or been revoked.
                            </li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            5. Intellectual Property Rights
                        </h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                <strong>Kencreations IP:</strong> All software
                                architecture, procedural 3D algorithms, UI
                                components, brand marks, logos, graphics, and
                                backend code are the exclusive intellectual
                                property of Kencreations
                            </li>
                            <li>
                                <strong>Third-Party IP Clearance:</strong> You
                                are solely responsible for ensuring you have
                                full legal permission for any brand logos,
                                names, or copyrighted characters you input into
                                the design generator.
                            </li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            6. Limitation of Liability & Disclaimers
                        </h3>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                <strong>"As-Is" Provision:</strong> The Service
                                is provided on an "AS IS" and "AS AVAILABLE"
                                basis without warranties of any kind. We do not
                                warrant that exported 3D models will slice or
                                print without errors on all hardware.
                            </li>
                            <li>
                                <strong>Exclusion of Damages:</strong> To the
                                fullest extent permitted by applicable law,
                                KENCREATIONS and Ken Samonte shall not be liable
                                for any indirect, incidental, special,
                                exemplary, consequential, or punitive
                                damages—including lost profits, wasted
                                filament/resin, machine damage, printer
                                downtime, or customer disputes.
                            </li>
                        </ul>
                    </div>
                );
            case "privacy":
                return (
                    <div className="space-y-6 text-gray-700 leading-relaxed text-sm">
                        <p>
                            At Kencreations, we respect your privacy. Because
                            Kencreations Studio is built as a desktop
                            application, we prioritize keeping your business
                            data in your hands.
                        </p>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            1. Data Stored Locally
                        </h3>
                        <p>
                            The core features of Kencreations Studio, including
                            your{" "}
                            <strong>
                                Filament Inventory, Consumables Tracker, and
                                Cost Calculator data
                            </strong>
                            , are stored entirely locally on your device via an
                            encrypted SQLite database.{" "}
                            <strong>
                                We do not have access to, nor do we collect,
                                your local inventory data, client quotes, or
                                pricing margins.
                            </strong>
                        </p>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            2. Data We Collect
                        </h3>
                        <p>
                            To provide and secure our services, we only collect:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>
                                <strong>License Information:</strong> Your
                                purchase history and unique license keys to
                                verify your commercial rights.
                            </li>
                            <li>
                                <strong>Device Telemetry:</strong> Basic
                                hardware identifiers strictly used to
                                authenticate your license key and prevent
                                software piracy.
                            </li>
                        </ul>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            3. Sharing of Information
                        </h3>
                        <p>
                            We will never sell, rent, or trade your personal
                            information to third parties. We only share data
                            with trusted payment processors to handle your
                            transactions securely.
                        </p>
                    </div>
                );
            case "refund":
                return (
                    <div className="space-y-6 text-gray-700 leading-relaxed text-sm">
                        <p>
                            Because KenCreations Studio provides instant access
                            to proprietary digital generation tools and
                            commercial manufacturing rights, our refund policy
                            is strictly governed by the nature of digital goods.
                        </p>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            1. All Sales Are Final
                        </h3>
                        <p>
                            Due to the non-returnable nature of digital license
                            keys and offline software,{" "}
                            <strong>
                                all sales are final and non-refundable
                            </strong>
                            . Once a license key has been issued and activated,
                            we cannot revoke the digital files or knowledge
                            acquired through the use of the Service.
                        </p>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            2. Defective Software Exception
                        </h3>
                        <p>
                            Refunds are not granted for changes of mind, lack of
                            required 3D printing hardware, or failure to
                            understand the software's capabilities prior to
                            purchase. In the rare event that the software is
                            fundamentally defective and completely fails to
                            launch on a system meeting our minimum specified
                            requirements, we may, at our sole discretion, offer
                            a replacement or refund within 3 days of purchase,
                            provided the license key has logged zero export
                            actions.
                        </p>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-3">
                            3. Requesting Technical Support
                        </h3>
                        <p>
                            If you are experiencing technical difficulties,
                            please contact our support team before filing a
                            dispute with your payment provider. Unjustified
                            chargebacks will result in the immediate and
                            permanent revocation of your license key. Contact us
                            at: <strong>admin@kencreations.dev</strong>
                        </p>
                    </div>
                );

            default:
                return null;
        }
    };

    const title = getTitle();
    if (!title) return null;

    return (
        <GlassModal isOpen={isOpen} onClose={onClose} title={title}>
            {/* Render the correctly structured content directly */}
            {renderContent()}
        </GlassModal>
    );
}
