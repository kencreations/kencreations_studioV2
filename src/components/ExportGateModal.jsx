import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { X, Lock, Download, Mail } from "lucide-react";

export default function ExportGateModal({
    isOpen,
    onClose,
    onAuthenticated,
    exportType,
}) {
    const { loginWithGoogle, currentUser } = useAuth();
    const [loading, setLoading] = React.useState(false);

    if (!isOpen) return null;

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const user = await loginWithGoogle();
            onAuthenticated(user); // Proceed with export
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
                {/* Header Image / Pattern */}
                <div className="h-32 bg-gradient-to-br from-teal-400 to-teal-600 p-6 flex items-end relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                        <svg
                            width="120"
                            height="120"
                            viewBox="0 0 100 100"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="white"
                                strokeWidth="20"
                            />
                        </svg>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full bg-black/10 p-2 text-white hover:bg-black/20 transition-colors"
                    >
                        <X size={18} strokeWidth={3} />
                    </button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg relative z-10">
                        <Lock
                            className="h-6 w-6 text-teal-500"
                            strokeWidth={2.5}
                        />
                    </div>
                </div>

                <div className="p-8">
                    <h2 className="mb-2 text-2xl font-black text-gray-900 tracking-tight">
                        Sign in to download
                    </h2>
                    <p className="mb-8 text-sm font-medium text-gray-500 leading-relaxed">
                        You're about to download a{" "}
                        <strong className="text-gray-700">
                            {exportType || "3D Model"}
                        </strong>{" "}
                        file. Sign in with your Google account to get 5 free basic
                        exports, or access your active license.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                            ) : (
                                <>
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    Continue with Google
                                </>
                            )}
                        </button>
                    </div>

                    <p className="mt-6 text-center text-xs font-semibold text-gray-400">
                        By continuing, you agree to our Terms of Service.
                    </p>
                </div>
            </div>
        </div>
    );
}
